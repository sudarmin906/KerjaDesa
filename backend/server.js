// KerjaDesa Pro Backend API Foundation
// Stage: Upgrade Full - API Server Preparation

const http = require('http');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.url === '/api/health') {
    res.end(JSON.stringify({
      app: 'KerjaDesa Pro',
      status: 'online',
      stage: 'backend foundation'
    }));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({message:'API route not found'}));
});

server.listen(PORT, () => {
  console.log(`KerjaDesa API running on port ${PORT}`);
});
