import build from "@fabiogaliano/ladle-react/build";

build({
  port: 61105,
  host: "127.0.0.1",
  storyOrder: ["hello--world", "hello--ayo"],
});
