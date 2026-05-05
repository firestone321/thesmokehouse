const fs = require("fs");
const path = require("path");

const targetPath = path.join(process.cwd(), "node_modules", "web-push", "src", "web-push-lib.js");

if (!fs.existsSync(targetPath)) {
  console.warn(`[patch-web-push] Skipped: ${targetPath} does not exist.`);
  process.exit(0);
}

const original = fs.readFileSync(targetPath, "utf8");
let patched = original;

patched = patched.replace(
  "const parsedUrl = url.parse(subscription.endpoint);",
  "const parsedUrl = new URL(subscription.endpoint);"
);
patched = patched.replace(
  "const urlParts = url.parse(requestDetails.endpoint);",
  "const urlParts = new URL(requestDetails.endpoint);"
);
patched = patched.replace(
  "httpsOptions.path = urlParts.path;",
  "httpsOptions.path = `${urlParts.pathname}${urlParts.search}`;"
);

if (patched === original) {
  console.log("[patch-web-push] web-push is already patched.");
  process.exit(0);
}

fs.writeFileSync(targetPath, patched);
console.log("[patch-web-push] Patched web-push to use the WHATWG URL API.");
