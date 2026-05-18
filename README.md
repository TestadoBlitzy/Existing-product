# hao-backprop-test

A simple Express.js HTTP server with multiple endpoints, built on Node.js.

## Prerequisites

- [Node.js](https://nodejs.org/) v20 or higher

## Installation

Install Express and its dependencies:

```bash
npm install
```

## Starting the Server

Start the server using npm:

```bash
npm start
```

Or run it directly:

```bash
node server.js
```

The server will start at **http://127.0.0.1:3000/**.

## Available Endpoints

| Method | Path       | Response          |
|--------|------------|-------------------|
| GET    | `/`        | `Hello, World!\n` |
| GET    | `/evening` | `Good evening`    |

## Testing

This project uses [Jest](https://jestjs.io/) and [Supertest](https://github.com/ladjs/supertest) for automated tests.

```bash
npm test
```

Run tests with coverage reporting:

```bash
npm run test:coverage
```
