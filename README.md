# Hello World Express.js Server

A production-ready Express.js application evolved from a minimal Node.js HTTP server. This project demonstrates a fully configured Express 5.x server with structured logging, security hardening, environment-based configuration, and PM2 process management for production deployment.

## Features

- **Express.js 5.x** web framework with modular routing and middleware pipeline
- **Structured logging** with Winston (application logs) and Morgan (HTTP request logs)
- **Security hardening** with Helmet (HTTP security headers)
- **CORS support** for cross-origin request handling
- **Response compression** with gzip/deflate for optimized payload delivery
- **Environment-based configuration** with dotenv for externalized settings
- **PM2 process management** for production deployment with cluster mode
- **Health check endpoint** for monitoring and load balancer integration
- **Centralized error handling** with consistent JSON error responses

## Prerequisites

- **Node.js** >= 18.0.0 (v20.x recommended)
- **npm** >= 9.x
- **PM2** (for production deployment — installed automatically as a devDependency)

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

3. Create your environment configuration file:

   ```bash
   cp .env.example .env
   ```

4. Adjust the environment variables in `.env` as needed for your environment (see [Environment Configuration](#environment-configuration) below).

## Environment Configuration

All application settings are managed through environment variables. Copy `.env.example` to `.env` and modify values as needed.

| Variable      | Default       | Description                                                                 |
| ------------- | ------------- | --------------------------------------------------------------------------- |
| `NODE_ENV`    | `development` | Application environment (`development`, `production`, `test`)               |
| `PORT`        | `3000`        | Server port number                                                          |
| `HOST`        | `0.0.0.0`    | Server hostname (`0.0.0.0` for all interfaces, `127.0.0.1` for localhost)   |
| `LOG_LEVEL`   | `debug`       | Winston log level (`error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`) |
| `CORS_ORIGIN` | `*`           | Allowed CORS origins (`*` for all, or comma-separated URLs)                 |

## Usage

### Development Mode

Start the server with automatic reload on file changes using nodemon:

```bash
npm run dev
```

### Production Mode

Start the server directly with Node.js:

```bash
npm start
```

### PM2 Deployment

Manage the application in production using PM2:

```bash
# Start the application
npm run start:pm2

# Stop the application
npm run stop:pm2

# Restart the application
npm run restart:pm2

# View real-time logs
npm run logs:pm2
```

## API Endpoints

| Method | Endpoint     | Description                                            |
| ------ | ------------ | ------------------------------------------------------ |
| `GET`  | `/health`    | Health check — returns status, uptime, timestamp, environment |
| `GET`  | `/api`       | Root API endpoint — Hello World JSON response           |
| `GET`  | `/api/info`  | Server information — returns name, version, description |

### Example Responses

**GET /health**

```json
{
  "status": "ok",
  "uptime": 123.456,
  "timestamp": "2024-01-15T12:30:45.123Z",
  "environment": "development"
}
```

**GET /api**

```json
{
  "message": "Hello, World!"
}
```

**GET /api/info**

```json
{
  "name": "hello_world",
  "version": "1.0.0",
  "description": "Production-ready Express.js web server"
}
```

## PM2 Deployment Guide

The application includes an `ecosystem.config.js` file for PM2 process management, providing production-grade process supervision with automatic restarts, log management, and cluster mode support.

### Cluster Mode

PM2 is configured to run in **cluster mode** by default, which spawns multiple worker processes to utilize all available CPU cores for horizontal scaling. The `instances` setting is set to `'max'`, meaning PM2 will automatically create one worker per CPU core.

### Starting with PM2

Start the application using the ecosystem configuration:

```bash
# Development environment (default)
npx pm2 start ecosystem.config.js

# Production environment
npx pm2 start ecosystem.config.js --env production
```

### PM2 Environment Configuration

The ecosystem file defines two environment profiles:

- **Development (`env`):** `NODE_ENV=development`, `LOG_LEVEL=debug` — verbose logging and detailed error responses
- **Production (`env_production`):** `NODE_ENV=production`, `LOG_LEVEL=info` — minimal logging and sanitized error responses (no stack traces)

### Log Management

PM2 logs are written to the `logs/` directory:

- `logs/pm2-out.log` — Standard output from all cluster workers
- `logs/pm2-error.log` — Error output from all cluster workers

Cluster worker logs are merged into single files via the `merge_logs` option, and each log entry is timestamped with the format `YYYY-MM-DD HH:mm:ss Z`.

### Key PM2 Settings

| Setting              | Value       | Description                                      |
| -------------------- | ----------- | ------------------------------------------------ |
| `name`               | `hello-world` | PM2 process name                               |
| `script`             | `server.js` | Application entry point                          |
| `instances`          | `max`       | Number of cluster workers (all CPU cores)        |
| `exec_mode`          | `cluster`   | Cluster mode for horizontal scaling              |
| `autorestart`        | `true`      | Automatic restart on crash                       |
| `max_memory_restart` | `1G`        | Restart worker if memory exceeds 1 GB            |
| `watch`              | `false`     | File watching disabled (use nodemon for dev)     |

## Project Structure

```
├── server.js              # Application entry point
├── src/
│   ├── app.js             # Express application setup
│   ├── config/
│   │   └── index.js       # Centralized configuration
│   ├── middleware/
│   │   ├── errorHandler.js # Error handling middleware
│   │   └── notFound.js    # 404 handler
│   ├── routes/
│   │   ├── index.js       # Route aggregator
│   │   ├── api.js         # API routes
│   │   └── health.js      # Health check route
│   └── utils/
│       └── logger.js      # Winston logger setup
├── package.json
├── ecosystem.config.js    # PM2 configuration
├── .env                   # Environment variables (not committed)
├── .env.example           # Environment template
└── .gitignore
```

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).
