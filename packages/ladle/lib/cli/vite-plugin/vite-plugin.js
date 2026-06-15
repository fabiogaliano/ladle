import { glob } from "tinyglobby";
import picomatch from "picomatch";
import path from "path";
import fs from "fs";
import debugFactory from "debug";
import getAppRoot from "../get-app-root.js";
import getGeneratedList from "./generate/get-generated-list.js";
import { getEntryData } from "./parse/get-entry-data.js";
import { getMetaJsonObject } from "./generate/get-meta-json.js";
import { detectDuplicateStoryNames, printError } from "./utils.js";
import cleanupWindowsPath from "./generate/cleanup-windows-path.js";

const debug = debugFactory("ladle:vite");

/**
 * @param errorMessage {string}
 */
const defaultListModule = (errorMessage) => `
import { lazy } from "react";
import * as React from "react";
export const list = [];
export const config = {};
export const stories = {};
export const storySource = {};
export const errorMessage = \`${errorMessage}\`;
export const Provider = ({ children }) =>
  /*#__PURE__*/ React.createElement(React.Fragment, null, children);
`;

/**
 * @param config {import("../../shared/types").Config}
 * @param configFolder {string}
 * @param mode {string}
 */
function ladlePlugin(config, configFolder, mode) {
  const virtualModuleId = "virtual:generated-list";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;
  const headHtmlPath = path.join(configFolder, "head.html");
  return {
    name: "ladle:core",
    /**
     * @param {string} id
     */
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
      return null;
    },
    /**
     * Runs only for the dev server (never during build). Owns the routes Ladle
     * used to serve from its hand-rolled Koa server, plus the story-file watcher
     * that triggers a full reload when stories are added/removed.
     * @param {import('vite').ViteDevServer} server
     */
    configureServer(server) {
      const storyGlobs = Array.isArray(config.stories)
        ? config.stories
        : [config.stories];
      const base = server.config.base;
      const redirectBase = base && base !== "/" && base !== "./" ? base : "";
      const metaJsonUrl = redirectBase
        ? path.posix.join(redirectBase, "meta.json")
        : "/meta.json";

      // registered synchronously so it runs ahead of Vite's SPA/transform
      // middleware
      server.middlewares.use(async (req, res, next) => {
        if (req.method === "GET" && req.url === metaJsonUrl) {
          const entryData = await getEntryData(await glob(storyGlobs));
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(getMetaJsonObject(entryData)));
          return;
        }
        if (redirectBase && req.method === "GET") {
          if (req.url === "/" || req.url === "/index.html") {
            res.statusCode = 302;
            res.setHeader("Location", redirectBase);
            res.end();
            return;
          }
          if (req.url === "/meta.json") {
            res.statusCode = 302;
            res.setHeader("Location", metaJsonUrl);
            res.end();
            return;
          }
        }
        if (req.method === "HEAD") {
          res.statusCode = 200;
          res.end();
          return;
        }
        next();
      });

      if (config.noWatch === false) {
        const isStory = picomatch(storyGlobs);
        let checkSum = "";
        const getChecksum = async () => {
          try {
            const entryData = await getEntryData(await glob(storyGlobs));
            const jsonContent = getMetaJsonObject(entryData);
            // loc changes alone should not trigger a full reload
            Object.keys(jsonContent.stories).forEach((storyId) => {
              jsonContent.stories[storyId].locStart = 0;
              jsonContent.stories[storyId].locEnd = 0;
            });
            return JSON.stringify(jsonContent);
          } catch (e) {
            return checkSum;
          }
        };
        // seed the baseline without blocking server startup
        getChecksum().then((initial) => {
          checkSum = initial;
        });
        const invalidate = async () => {
          const newChecksum = await getChecksum();
          if (checkSum === newChecksum) return;
          checkSum = newChecksum;
          const mod = server.moduleGraph.getModuleById(resolvedVirtualModuleId);
          if (mod) {
            server.moduleGraph.invalidateModule(mod);
            server.ws.send({ type: "full-reload", path: "*" });
          }
        };
        // Vite's root is Ladle's own app dir, so its watcher only covers story
        // files once they're in the module graph (good for edits, but a brand
        // new file never fires "add"). Explicitly watch each glob's base dir so
        // adding/removing a story triggers a reload — this is the fix for the
        // long-standing add-a-new-story HMR bug, now without globs handed to
        // chokidar v4 (which dropped glob support).
        const watchDirs = [
          ...new Set(
            storyGlobs.map((glob) =>
              path.resolve(process.cwd(), picomatch.scan(glob).base || "."),
            ),
          ),
        ];
        server.watcher.add(watchDirs);
        const onFs = (/** @type {string} */ file) => {
          const relative = path
            .relative(process.cwd(), file)
            .split(path.sep)
            .join("/");
          if (isStory(relative)) invalidate();
        };
        server.watcher.on("add", onFs).on("unlink", onFs).on("change", onFs);
      }
    },
    /**
     * @param {string} html
     * @param {any} ctx
     */
    transformIndexHtml(html, ctx) {
      if (ctx.path === "/index.html") {
        if (fs.existsSync(headHtmlPath)) {
          const headHtml = fs.readFileSync(headHtmlPath, "utf8");
          html = html.replace("</head>", `${headHtml}</head>`);
        }
        if (config.appendToHead !== "") {
          html = html.replace("</head>", `${config.appendToHead}</head>`);
        }
      }
      return html;
    },
    /**
     * @param {string} code
     * @param {string} id
     */
    async transform(code, id) {
      // We instrument stories with a simple eventemitter like code so
      // some addons (like a11y) can subscribe to changes and re-run
      // on HMR updates
      if (id.includes(".stories.")) {
        const from = cleanupWindowsPath(
          path.join(getAppRoot(), "src/story-hmr"),
        );
        const watcherImport = `import { storyUpdated } from "${from}";`;
        // if stories are defined through .bind({}) we need to force full reloads since
        // react-refresh can't pick it up
        const invalidateHmr = code.includes(".bind({})")
          ? `if (import.meta.hot) {
          import.meta.hot.on("vite:beforeUpdate", () => {
            import.meta.hot.invalidate();
          });
        }`
          : "";
        // make sure the `loaded` attr is set even if the story is loaded through iframe
        const setLoadedAttr = `typeof window !== 'undefined' &&
          window.document &&
          window.document.createElement && document.documentElement.setAttribute("data-storyloaded", "");`;
        return {
          code: `${code}\n${setLoadedAttr}\n${invalidateHmr}\n${watcherImport}\nif (import.meta.hot) {
          import.meta.hot.accept(() => {
            storyUpdated();
          });
        }`,
          map: null,
        };
      }
      return { code, map: null };
    },
    /**
     * @param {string} id
     */
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        debug(`transforming: ${id}`);
        try {
          debug("Initial generation of the list");
          const entryData = await getEntryData(
            await glob(
              Array.isArray(config.stories) ? config.stories : [config.stories],
            ),
          );
          detectDuplicateStoryNames(entryData);
          return await getGeneratedList(entryData, configFolder, config);
        } catch (/** @type {any} */ e) {
          printError("\nStory discovering failed:\n");
          printError(e);
          printError("\nMore info: https://ladle.dev/docs/stories#limitations");
          if (mode === "production") {
            process.exit(1);
          }
          return /** @type {string} */ (defaultListModule(e.message));
        }
      }
      return;
    },
  };
}

export default ladlePlugin;
