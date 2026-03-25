# hello_world

A simple Node.js HTTP server built with [ExpressJS](https://expressjs.com/) (v5). This tutorial project demonstrates basic route handling with Express, serving plain-text responses on two endpoints.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher (Express 5 requires Node.js v18+)
- npm (included with Node.js)

## Installation

Clone the repository and install dependencies:

```bash
npm install
```

## Running the Server

Start the server using npm:

```bash
npm start
```

Or run it directly with Node.js:

```bash
node server.js
```

The server will start and bind to `http://127.0.0.1:3000/`.

## Available Endpoints

| Method | Path             | Response            | Status |
|--------|------------------|---------------------|--------|
| GET    | `/`              | `Hello, World!\n`   | 200    |
| GET    | `/good-evening`  | `Good evening`      | 200    |

### `GET /`

Returns a plain-text greeting:

```
Hello, World!
```

### `GET /good-evening`

Returns a plain-text evening greeting:

```
Good evening
```

## License

This project is licensed under the [MIT](https://opensource.org/licenses/MIT) license.
