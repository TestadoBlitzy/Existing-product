const express = require('express');

// Allow host override via environment variable; default to localhost-only binding
const hostname = process.env.HOST || '127.0.0.1';
// Allow port override via environment variable; default to 3000
const port = parseInt(process.env.PORT, 10) || 3000;

const app = express();

// Disable X-Powered-By header to prevent server framework disclosure
app.disable('x-powered-by');

app.get('/', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send('Hello, World!\n');
});

app.get('/evening', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send('Good evening');
});

if (require.main === module) {
  // Capture server reference for potential graceful shutdown
  const server = app.listen(port, hostname, (err) => {
    if (err) {
      // Express 5.x forwards listen errors (e.g. EADDRINUSE) to the callback
      // as the first argument — handle gracefully instead of printing false success
      console.error(`Failed to start server: ${err.message}`);
      process.exit(1);
    }
    console.log(`Server running at http://${hostname}:${port}/`);
  });
}

module.exports = app;
