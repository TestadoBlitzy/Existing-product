# hao-backprop-test

A minimal Node.js tutorial server powered by [Express.js](https://expressjs.com/). This project demonstrates basic HTTP routing with Express, serving simple text responses across multiple endpoints.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm (included with Node.js)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the server:

   ```bash
   npm start
   ```

   The server will start listening at **http://127.0.0.1:3000/**.

## Available Endpoints

| Method | Path       | Response Body    | Status Code     |
| ------ | ---------- | ---------------- | --------------- |
| GET    | `/`        | `Hello, World!`  | `200 OK`        |
| GET    | `/evening` | `Good evening`   | `200 OK`        |
| POST   | `/evening` | `Good evening`   | `201 Created`   |

> **Note:** POST requests return a `201 Created` status code.

## License

This project is licensed under the [MIT](https://opensource.org/licenses/MIT) license.
