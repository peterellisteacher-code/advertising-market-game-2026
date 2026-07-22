import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const webRoot = path.resolve(process.argv[2] ?? "build/web");
const port = Number.parseInt(process.argv[3] ?? "4189", 10);

if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error("Port must be an integer from 1 to 65535");
}

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".pck", "application/octet-stream"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".wasm", "application/wasm"]
]);

function headersFor(contentType) {
  return {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Resource-Policy": "same-origin"
  };
}

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (request.method === "GET" && pathname === "/api/account/session") {
      response.writeHead(200, headersFor(MIME_TYPES.get(".json")));
      response.end(JSON.stringify({ authenticated: true, username: "qa-pair" }));
      return;
    }
    if (pathname === "/" || pathname === "/index.html") {
      const html = await readFile(path.join(webRoot, "index.html"), "utf8");
      response.writeHead(200, headersFor(MIME_TYPES.get(".html")));
      response.end(html);
      return;
    }

    const relative = decodeURIComponent(pathname).replace(/^\/+/, "");
    const absolute = path.resolve(webRoot, relative);
    if (absolute !== webRoot && !absolute.startsWith(`${webRoot}${path.sep}`)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const metadata = await stat(absolute);
    if (!metadata.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const body = await readFile(absolute);
    const contentType = MIME_TYPES.get(path.extname(absolute).toLowerCase()) ?? "application/octet-stream";
    response.writeHead(200, headersFor(contentType));
    response.end(body);
  } catch (error) {
    const status = error && typeof error === "object" && error.code === "ENOENT" ? 404 : 500;
    response.writeHead(status, headersFor("text/plain; charset=utf-8"));
    response.end(status === 404 ? "Not found" : "QA server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`ADMARKET_BROWSER_QA_READY http://127.0.0.1:${port}/`);
});
