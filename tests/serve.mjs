/**
 * Foreground static server for `dist/`, used only by `playwright.config.ts`.
 *
 * `astro preview` daemonises — it prints a pid and returns — and Playwright's
 * `webServer` treats a command that exits as a failed start, as well as leaving
 * the daemon running between runs. This stays in the foreground and dies with
 * the test run.
 */
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = new URL("../dist/", import.meta.url).pathname;
const PORT = Number(process.env.PORT || 4321);
const HOST = process.env.HOST || "127.0.0.1";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".wasm": "application/wasm",
  ".glb": "model/gltf-binary",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

/** Resolve a URL path to a file inside dist, or null. */
async function resolve(pathname) {
  // normalize collapses `..`; the prefix check is what keeps the walk inside dist.
  const target = normalize(join(ROOT, decodeURIComponent(pathname)));
  if (!target.startsWith(ROOT)) return null;

  for (const candidate of [target, join(target, "index.html")]) {
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      // try the next shape
    }
  }
  return null;
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${HOST}`);
  /* Only a document request falls back to the 404 page. Serving HTML for a
     missing `.js` — as a blanket fallback does — makes the browser report
     `Unexpected token '<'` instead of a 404, which buries real failures. */
  const wantsDocument = (req.headers.accept ?? "").includes("text/html");
  const found = await resolve(pathname);
  const file = found ?? (wantsDocument ? await resolve("/404.html") : null);

  if (!file) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }

  res.writeHead(found ? 200 : 404, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(file).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`serving dist/ at http://${HOST}:${PORT}`);
});
