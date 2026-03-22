const express = require('express');

const hostname = '127.0.0.1';
const port = 3000;

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
  app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
  });
}

module.exports = app;
