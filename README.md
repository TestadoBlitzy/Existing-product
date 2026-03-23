# Hello World Express Server

A production-ready Express.js server with structured logging, environment-based configuration, security middleware, and PM2 cluster-mode deployment support.

## Features

- **Express.js 5** web framework with modern routing and async support
- **Structured logging** with Winston (file + console transports) and Morgan (HTTP request logging)
- **Environment-based configuration** with dotenv for flexible deployment across environments
- **Security middleware** — Helmet for HTTP headers, CORS for cross-origin control, rate limiting for abuse prevention
- **Response compression** via gzip/deflate for optimized payload delivery
- **PM2 cluster mode** for production process management with zero-downtime reloads
- **Health check endpoint** for load balancer and PM2 monitoring probes
- **Graceful shutdown handling** via SIGTERM/SIGINT for clean process termination

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** (included with Node.js)
- **PM2** (global install, required for production deployment):
  ```bash
  npm install -g pm2
  ```

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd hello_world
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your environment configuration:
   ```bash
   cp .env.example .env
   ```

4. Customize `.env` as needed for your environment (see [Environment Configuration](#environment-configuration) below).

## Environment Configuration

All runtime settings are controlled via environment variables. Copy `.env.example` to `.env` and adjust values as needed.

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Application environment (`development`, `production`) |
| `PORT` | `3000` | Server port number |
| `HOST` | `0.0.0.0` | Server bind address |
| `LOG_LEVEL` | `debug` | Winston log level (`error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`) |
| `CORS_ORIGIN` | `*` | Allowed CORS origins (use `*` for all, or comma-separated list) |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window in milliseconds (default: 15 minutes) |
| `RATE_LIMIT_MAX` | `100` | Maximum number of requests per rate limit window |

## Usage

### Development

```bash
npm run dev
```

Starts the server with `node server.js` using development environment defaults.

### Production

```bash
npm start
```

Runs `node server.js` in production mode. Set `NODE_ENV=production` in your `.env` file or system environment.

### PM2 Production (Cluster Mode)

```bash
npm run start:pm2
```

Launches the application via PM2 in cluster mode using the `ecosystem.config.js` configuration.

### Stop PM2

```bash
npm run stop:pm2
```

### View Logs

```bash
npm run logs
```

## PM2 Deployment

PM2 provides cluster-mode process management, automatic restarts, and log management for production deployments.

### Start with PM2

```bash
pm2 start ecosystem.config.js
```

### Start in Production Mode

```bash
pm2 start ecosystem.config.js --env production
```

### Zero-Downtime Reload

```bash
pm2 reload hello-world
```

### Check Status

```bash
pm2 status
```

### View Logs

```bash
pm2 logs hello-world
```

### Stop Application

```bash
pm2 stop hello-world
```

## Project Structure

```
├── server.js                  # Application entry point
├── src/
│   ├── app.js                 # Express application factory
│   ├── config/
│   │   └── index.js           # Centralized configuration
│   ├── middleware/
│   │   ├── errorHandler.js    # Central error handling
│   │   └── notFound.js        # 404 catch-all handler
│   ├── routes/
│   │   ├── index.js           # Route aggregator
│   │   ├── health.js          # Health check endpoint
│   │   └── api.js             # API routes
│   └── utils/
│       └── logger.js          # Winston logger setup
├── package.json
├── ecosystem.config.js        # PM2 configuration
├── .env                       # Environment variables (not committed)
├── .env.example               # Environment variable template
└── .gitignore
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Welcome message (JSON) |
| `GET` | `/health` | Health check — returns status, uptime, timestamp, memory usage, and Node.js version |
| `GET` | `/api` | API welcome message |
| `GET` | `/api/info` | Server metadata — version, environment, and Node.js version |

## License

[MIT](https://opensource.org/licenses/MIT)
