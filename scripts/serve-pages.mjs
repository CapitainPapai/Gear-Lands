// A tiny local simulation of https://<user>.github.io/Gear-Lands/.
// It deliberately serves the production dist/ below a repository subpath, so
// accidentally root-relative asset URLs fail here just as they would on Pages.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const prefix = '/Gear-Lands/';
const port = Number(process.env.PORT || 4174);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.ogg': 'audio/ogg', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' };
if (!existsSync(resolve(dist, 'index.html'))) {
  console.error('dist/index.html not found. Run npm run build first.');
  process.exit(1);
}
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/' || url.pathname === '/Gear-Lands') {
    response.writeHead(302, { Location: prefix }); response.end(); return;
  }
  if (!url.pathname.startsWith(prefix)) { response.writeHead(404); response.end('Not found'); return; }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html'; } catch { response.writeHead(400); response.end(); return; }
  const file = resolve(dist, pathname);
  if (!file.startsWith(dist.endsWith(sep) ? dist : dist + sep)) { response.writeHead(403); response.end(); return; }
  if (!existsSync(file) || !statSync(file).isFile()) { response.writeHead(404); response.end('Not found'); return; }
  response.writeHead(200, { 'Content-Type': types[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  if (request.method === 'HEAD') response.end(); else createReadStream(file).pipe(response);
});
server.listen(port, '0.0.0.0', () => console.log(`GitHub Pages simulation: http://localhost:${port}${prefix}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
