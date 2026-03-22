const express = require('express');

const hostname = '127.0.0.1';
const port = 3000;

const app = express();

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.get('/evening', (req, res) => {
  res.send('Good evening');
});

app.post('/evening', (req, res) => {
  res.status(201).send('Good evening');
});

app.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
