/**
 * Local receiver for the in-app browser recon. Listens on 127.0.0.1:3999 and
 * merges POSTed page captures into contextqa-dump/complete-site-map.json.
 * Run: node scripts/capture-receiver.mjs
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "contextqa-dump", "complete-site-map.json");
fs.mkdirSync(path.dirname(OUT), { recursive: true });

function readMap() {
  try {
    return JSON.parse(fs.readFileSync(OUT, "utf8"));
  } catch {
    return { source: "https://gmailad.contextqa.com", capturedAt: new Date().toISOString().slice(0, 10), pages: {}, network: [] };
  }
}

function saveMap(map) {
  fs.writeFileSync(OUT, JSON.stringify(map, null, 2));
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  if (req.method === "GET" && req.url === "/health") return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true, out: OUT }));
  if (req.method === "GET" && req.url === "/map") return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(readMap()));
  if (req.method === "POST" && req.url === "/capture") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const map = readMap();
        const key = payload.key ?? payload.page?.url ?? `page-${Object.keys(map.pages).length + 1}`;
        map.pages[key] = payload.page ?? payload;
        if (Array.isArray(payload.network)) {
          map.network = [...(map.network ?? []), ...payload.network];
        }
        map.updatedAt = new Date().toISOString();
        saveMap(map);
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true, key, pages: Object.keys(map.pages).length }));
      } catch (e) {
        res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }
  res.writeHead(404).end();
});

server.listen(3999, "127.0.0.1", () => console.log("capture receiver on http://127.0.0.1:3999 ->", OUT));
