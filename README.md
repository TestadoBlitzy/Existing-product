# hao-backprop-test

A production-ready Express.js HTTP server with comprehensive middleware stack, structured logging via Winston, environment-driven configuration via dotenv, and PM2 process management for production deployment. Originally a minimal Node.js "Hello, World!" server, now enhanced with Express 5.x framework.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher (project tested on v20.20.1)
- [npm](https://www.npmjs.com/) v7 or higher
- [PM2](https://pm2.keymetrics.io/) (globally installed for production: `npm install pm2 -g`)

## Installation

```bash
git clone <repository-url>
cd hao-backprop-test
npm install
cp .env.example .env
```

## Environment Configuration

See [`.env.example`](.env.example) for all available variables.

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Application environment |
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `LOG_LEVEL` | `debug` | Winston log level |

## Usage

### Development

```bash
npm run dev
```

Uses nodemon for auto-restart on file changes.

### Production

```bash
npm start
```

Or with PM2:

```bash
npm run pm2:start
npm run pm2:stop
npm run pm2:restart
```

## API Endpoints

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| GET | `/` | Hello World (backward compatible) | `Hello, World!\n` (text/plain) |
| GET | `/health` | Health check | JSON: `{ status, uptime, timestamp }` |
| GET | `/info` | Application info | JSON: `{ name, version, environment }` |

## Project Structure

```
├── server.js              # Entry point
├── src/
│   ├── app.js             # Express application setup
│   ├── config/
│   │   ├── index.js       # Environment configuration
│   │   └── logger.js      # Winston logger setup
│   ├── routes/
│   │   ├── index.js       # Route aggregator
│   │   ├── health.js      # Health check endpoint
│   │   └── api.js         # API routes
│   └── middleware/
│       ├── errorHandler.js # Centralized error handler
│       └── notFound.js     # 404 handler
├── ecosystem.config.js    # PM2 configuration
├── .env                   # Environment variables
├── .env.example           # Environment variable template
├── .gitignore             # Git ignore rules
├── package.json           # npm manifest
├── package-lock.json      # Dependency lock file
└── README.md              # This file
```

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| start | `npm start` | Start production server |
| dev | `npm run dev` | Start development server with nodemon |
| pm2:start | `npm run pm2:start` | Start with PM2 cluster mode |
| pm2:stop | `npm run pm2:stop` | Stop PM2 processes |
| pm2:restart | `npm run pm2:restart` | Restart PM2 processes |

## License

MIT
