const fs = require("node:fs"),
  path = require("node:path");
const mobile = path.resolve(__dirname, ".."),
  game = path.resolve(mobile, ".."),
  dest = path.join(mobile, "www");
fs.mkdirSync(dest, { recursive: true });
for (const name of [
  "index.html",
  "app.js",
  "engine.js",
  "stages.js",
  "progression.js",
  "services.js",
  "config.js",
  "style.css",
  "manifest.webmanifest",
  "sw.js",
  "account-delete.html",
])
  fs.copyFileSync(path.join(game, name), path.join(dest, name));
fs.cpSync(path.join(game, "icons"), path.join(dest, "icons"), {
  recursive: true,
});
console.log("Copied browser game into mobile/www (generated).");

// Core runtime registers the native App lifecycle/back-button plugin.
fs.copyFileSync(
  path.join(mobile, "node_modules/@capacitor/core/dist/capacitor.js"),
  path.join(dest, "native-capacitor.js"),
);
const html = fs.readFileSync(path.join(dest, "index.html"), "utf8");
fs.writeFileSync(
  path.join(dest, "index.html"),
  html.replace(
    /(<script src="config\.js[^"]*"><\/script>)/,
    '<script src="native-capacitor.js"></script>$1',
  ),
);
