import { createServer, searchForWorkspaceRoot } from "vite";
import boxen from "boxen";
import openBrowser from "./open-browser.js";
import debug from "./debug.js";
import getBaseViteConfig from "./vite-base.js";

/**
 * @param config {import("../shared/types").Config}
 * @param configFolder {string}
 */
const bundler = async (config, configFolder) => {
  try {
    // only set server.hmr when the user explicitly overrides host/port, otherwise
    // let Vite reuse the dev server's own connection (works over the network/WSL2)
    const hmr =
      config.hmrHost || config.hmrPort
        ? { host: config.hmrHost, port: config.hmrPort }
        : undefined;
    /**
     * @type {import('vite').InlineConfig}
     */
    const viteConfig = await getBaseViteConfig(config, configFolder, {
      mode: config.mode || "development",
      server: {
        host: config.host,
        // Vite owns the http/https/http2 server now; strictPort: false lets it
        // bump to the next free port instead of Ladle's old get-port fallback list
        port: config.port,
        strictPort: false,
        hmr: config.noWatch ? false : hmr,
        fs: {
          allow: [searchForWorkspaceRoot(process.cwd())],
        },
        watch: {
          ignored: config.noWatch ? "**" : undefined,
        },
      },
    });

    // capture the user's browser-open intent, then stop Vite from opening on its
    // own — our opener supports pnp and Ladle's "none" sentinel
    /** @type {boolean | string | undefined} */
    const openBrowserValue = viteConfig.server
      ? viteConfig.server.open
      : undefined;
    if (viteConfig.server) {
      viteConfig.server.open = false;
    }

    const vite = await createServer(viteConfig);
    await vite.listen();

    const serverUrl =
      vite.resolvedUrls?.local[0] ?? vite.resolvedUrls?.network[0] ?? "";
    debug(`Dev server listening at: ${serverUrl}`);

    console.log(
      boxen(`🥄 Ladle.dev served at ${serverUrl}`, {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "yellow",
        titleAlignment: "center",
        textAlignment: "center",
      }),
    );

    config.onDevServerStart(serverUrl);

    if (openBrowserValue !== "none" && openBrowserValue !== false) {
      openBrowser(serverUrl);
    }
  } catch (e) {
    console.log(e);
  }
};

export default bundler;
