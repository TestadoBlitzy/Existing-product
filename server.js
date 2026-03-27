const express = require('express');

const app = express();
app.disable('x-powered-by');
const hostname = '127.0.0.1';
const port = 3000;

// Route handler for GET / — preserves original "Hello, World!" response
app.get('/', (req, res) => {
  res.type('text').send('Hello, World!\n');
});

// Route handler for GET /good-evening — new endpoint
app.get('/good-evening', (req, res) => {
  res.type('text').send('Good evening');
});

if (require.main === module) {
  app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
  });
}
module.exports = app;
