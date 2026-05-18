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

> Source: `package.json` (`dependencies`: `express`, `winston`, `morgan`, `dotenv`, `helmet`, `cors`, `express-rate-limit`, `compression`); `src/app.js` (middleware pipeline composition); `src/utils/logger.js` (Winston construction); `src/routes/health.js` (health endpoint); `server.js` (signal-driven shutdown); `ecosystem.config.js` (PM2 cluster mode).

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** (included with Node.js)
- **PM2** (global install, required for production deployment):
  ```bash
  npm install -g pm2
  ```

> Source: `package.json` (`engines.node` declares `>=18.0.0`); `ecosystem.config.js` (PM2 deployment configuration).

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

> Source: `package.json` (`dependencies` and `devDependencies`); `.env.example` (canonical environment template).

## Environment Configuration

All runtime settings are controlled via environment variables. Copy `.env.example` to `.env` and adjust values as needed.

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Application environment (`development`, `production`) |
| `PORT` | `3000` | Server port number |
| `HOST` | `0.0.0.0` | Server bind address |
| `LOG_LEVEL` | `debug` | Winston log level (`error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`) |
| `CORS_ORIGIN` | `*` | Allowed CORS origins (use `*` for all, or comma-separated list) |
| `BODY_LIMIT` | `10kb` | Maximum request body size for JSON and URL-encoded payloads (prevents payload-based DoS) |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window in milliseconds (default: 15 minutes) |
| `RATE_LIMIT_MAX` | `100` | Maximum number of requests per rate limit window |

> Source: `src/config/index.js` (defaults and `parseIntSafe`) and `.env.example` (operator-facing template with line-by-line guidance).

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

> Source: `package.json` `scripts` (`start`, `dev`, `start:pm2`, `stop:pm2`, `logs`); `server.js` (entrypoint executed by `node server.js`); `ecosystem.config.js` (PM2 ecosystem configuration referenced by `start:pm2` / `stop:pm2`).

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

> Source: `ecosystem.config.js` (`apps[0].name = 'hello-world'`, `script: 'server.js'`, `instances: 'max'`, `exec_mode: 'cluster'`, `autorestart: true`, `env`/`env_production` blocks). See [`docs/deployment.md`](./docs/deployment.md) for the full PM2 process-lifecycle reference.

## Project Structure

```bash
├── server.js                    # Application entry point (app.listen + signal handlers)
├── src/
│   ├── README.md                # src module README — Express application layer
│   ├── app.js                   # Express application factory (non-listening)
│   ├── config/
│   │   ├── README.md            # config module README
│   │   └── index.js             # Centralized, frozen configuration
│   ├── middleware/
│   │   ├── README.md            # middleware module README
│   │   ├── errorHandler.js      # Central error handler (CWE-209 masking)
│   │   ├── notFound.js          # 404 catch-all (CWE-117 sanitization)
│   │   └── validateInput.js     # Zod validation middleware factory
│   ├── routes/
│   │   ├── README.md            # routes module README
│   │   ├── index.js             # Route aggregator (GET / + /health + /api)
│   │   ├── health.js            # Health check endpoint
│   │   └── api.js               # API routes (welcome + info)
│   └── utils/
│       ├── README.md            # utils module README
│       ├── logger.js            # Winston logger + Morgan stream adapter
│       └── sanitizer.js         # Log/URL sanitization helpers
├── docs/
│   ├── architecture.md          # Architecture overview and middleware pipeline
│   ├── api.md                   # REST API reference
│   ├── security.md              # Security controls and CWE mappings
│   ├── observability.md         # Logging and metrics guide
│   ├── deployment.md            # Deployment and PM2 process management
│   └── testing.md               # Jest + Supertest testing guide
├── tests/
│   ├── app.test.js              # Integration tests for the Express app
│   ├── server.test.js           # Bootstrap/lifecycle tests for server.js
│   ├── config/                  # Configuration module tests
│   ├── helpers/                 # Shared test utilities
│   ├── middleware/              # Middleware unit tests
│   ├── routes/                  # Route contract tests
│   └── utils/                   # Logger and sanitizer tests
├── ecosystem.config.js          # PM2 cluster configuration
├── jest.config.js               # Jest configuration (coverage thresholds 90/90/80/90)
├── package.json
├── package-lock.json
├── .env                         # Development environment defaults (tracked; future local-only changes should be excluded via .gitignore)
├── .env.example                 # Environment variable template (canonical operator-facing reference)
└── .gitignore
```

> Source: repository tree at the project root. Module-level README files cite the source files they describe; see [Documentation](#documentation) for the index.

## API Endpoints

| Method | Path | Description | Source |
|---|---|---|---|
| `GET` | `/` | Welcome message (plain text `Hello, World!\n`) | `src/routes/index.js` |
| `GET` | `/health` | Health check — returns status, uptime, timestamp, memory usage, and Node.js version | `src/routes/health.js` |
| `GET` | `/api` | API welcome message | `src/routes/api.js` |
| `GET` | `/api/info` | Server metadata — version, environment, and Node.js version | `src/routes/api.js` |

> `GET /` contract: `Content-Type: text/plain`, body `Hello, World!\n` (trailing newline included). Source: `src/routes/index.js` line 46. For the full REST API reference including 400/404/405/429/500 error contracts, see [`docs/api.md`](./docs/api.md).

## Documentation

Comprehensive documentation is organized into module-level READMEs (adjacent to the code they describe) and cross-cutting operator guides under `docs/`.

### Module READMEs

- [`src/README.md`](./src/README.md) — Express application layer (`app.js` composition)
- [`src/config/README.md`](./src/config/README.md) — Immutable configuration module and environment contract
- [`src/middleware/README.md`](./src/middleware/README.md) — Error handler, 404 handler, and Zod validation middleware
- [`src/routes/README.md`](./src/routes/README.md) — Route aggregation, endpoint contracts, and 405 method guards
- [`src/utils/README.md`](./src/utils/README.md) — Winston logger, Morgan stream, and sanitization helpers

### Operator Guides

- [`docs/architecture.md`](./docs/architecture.md) — Bootstrap/app separation, middleware pipeline, route topology, and request lifecycle
- [`docs/api.md`](./docs/api.md) — REST API reference with exact response bodies and error shapes
- [`docs/security.md`](./docs/security.md) — Security controls: Helmet CSP, CORS, rate limiting, input validation, error masking, sanitization
- [`docs/observability.md`](./docs/observability.md) — Winston logging, Morgan HTTP logs, log rotation, and PM2 log files
- [`docs/deployment.md`](./docs/deployment.md) — Direct Node execution, PM2 cluster mode, graceful shutdown, and restart policy
- [`docs/testing.md`](./docs/testing.md) — Jest configuration, Supertest patterns, coverage thresholds, and mocking conventions

## License

[MIT](https://opensource.org/licenses/MIT)
