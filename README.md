# hao-backprop-test

A minimal Node.js HTTP server tutorial project powered by [Express.js](https://expressjs.com/) (v5.x), serving two plain-text endpoints.

## Endpoints

| Endpoint       | Method | Response Body      | Content-Type | Status Code |
|----------------|--------|--------------------|--------------|-------------|
| `/`            | GET    | `Hello, World!\n`  | `text/plain` | 200         |
| `/evening`     | GET    | `Good evening`     | `text/plain` | 200         |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18

### Install Dependencies

```bash
npm install
```

### Start the Server

```bash
npm start
```

Or run directly:

```bash
node server.js
```

The server will start at **http://127.0.0.1:3000/**.

## License

This project is licensed under the [MIT](https://opensource.org/licenses/MIT) license.
