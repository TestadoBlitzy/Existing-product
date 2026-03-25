const express = require('express');

const app = express();
const hostname = '127.0.0.1';
const port = 3000;

// Route handler for GET / — preserves original "Hello, World!" response
app.get('/', (req, res) => {
  res.send('Hello, World!\n');
});

// Route handler for GET /good-evening — new endpoint
app.get('/good-evening', (req, res) => {
  res.send('Good evening');
});

app.listen(port, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
