const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT || 3000);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.webp': 'image/webp'
};

const server = http.createServer((req, res) => {
  const requested = decodeURIComponent((req.url || '/').split('?')[0]);
  const safePath = path.normalize(requested === '/' ? '/index.html' : requested);
  const filePath = path.join(root, safePath);
  const publicFilePath = path.join(root, 'public', safePath);
  if (!filePath.startsWith(root) || !publicFilePath.startsWith(root)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(filePath, (error, data) => {
    if (!error) {
      res.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream' });
      return res.end(data);
    }
    fs.readFile(publicFilePath, (publicError, publicData) => {
      if (publicError) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Not found');
      }
      res.writeHead(200, { 'Content-Type': mime[path.extname(publicFilePath)] || 'application/octet-stream' });
      res.end(publicData);
    });
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`FrameZip listening on 0.0.0.0:${port}`);
});
