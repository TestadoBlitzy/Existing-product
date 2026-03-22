/**
 * PM2 Ecosystem Configuration
 *
 * Defines the PM2 process management configuration for the hello-world
 * Express application. This file is consumed by PM2 CLI commands such as:
 *
 *   pm2 start ecosystem.config.js              — start in development mode
 *   pm2 start ecosystem.config.js --env production — start in production mode
 *   pm2 reload ecosystem.config.js             — zero-downtime reload
 *   pm2 stop ecosystem.config.js               — stop all instances
 *   pm2 delete ecosystem.config.js             — remove from PM2 process list
 *
 * Cluster mode is enabled to fork one worker process per available CPU core,
 * providing horizontal scaling and zero-downtime reloads via PM2's built-in
 * load balancer.
 *
 * @see https://pm2.keymetrics.io/docs/usage/application-declaration/
 * @module ecosystem.config
 */

module.exports = {
  apps: [
    {
      // ---------------------------------------------------------------------
      // Application Identity and Entry Point
      // ---------------------------------------------------------------------
      // name: Kebab-case identifier used in PM2 process list, logs, and CLI
      //       commands. Derived from the package.json "name" field (hello_world).
      // script: Relative path to the Node.js entry point that PM2 will fork.
      //         This MUST match the "main" field in package.json and the file
      //         that bootstraps the Express application.
      // ---------------------------------------------------------------------
      name: 'hello-world',
      script: 'server.js',

      // ---------------------------------------------------------------------
      // Cluster Mode Configuration
      // ---------------------------------------------------------------------
      // instances: 'max' forks one worker process per logical CPU core,
      //            maximizing throughput on multi-core servers. PM2 acts as a
      //            load balancer distributing incoming connections across workers.
      // exec_mode: 'cluster' enables Node.js cluster module integration,
      //            allowing zero-downtime reloads (pm2 reload) by restarting
      //            workers one at a time while others continue serving traffic.
      // ---------------------------------------------------------------------
      instances: 'max',
      exec_mode: 'cluster',

      // ---------------------------------------------------------------------
      // Restart Policy
      // ---------------------------------------------------------------------
      // autorestart: Automatically restart the worker if it exits unexpectedly
      //              (crash, unhandled exception, memory limit exceeded).
      // watch: Disabled in production — file-system watching is a development
      //        convenience that should not run under PM2 cluster mode because
      //        it triggers unnecessary full-cluster restarts.
      // max_memory_restart: Restart a worker if its heap usage exceeds 1 GB,
      //                     preventing runaway memory leaks from degrading the
      //                     host.
      // restart_delay: Base delay (milliseconds) between automatic restart
      //                attempts. PM2 applies exponential backoff on top of this
      //                value to avoid rapid restart loops.
      // max_restarts: Upper bound on consecutive restart attempts before PM2
      //               stops trying. Prevents infinite restart loops when the
      //               application has a persistent startup failure.
      // ---------------------------------------------------------------------
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 4000,
      max_restarts: 10,

      // ---------------------------------------------------------------------
      // Log Configuration
      // ---------------------------------------------------------------------
      // All log files are written to the ./logs/ directory, which is also used
      // by the Winston application logger (combined.log, error.log). PM2 logs
      // capture raw stdout/stderr output from worker processes.
      //
      // log_file: Combined stdout + stderr stream for convenience.
      // out_file: Stdout-only stream (normal application output).
      // error_file: Stderr-only stream (errors and warnings).
      // log_date_format: ISO-like timestamp prepended to each PM2 log line.
      // merge_logs: When true, all cluster instances write to the same set of
      //             log files instead of creating per-instance files. This
      //             simplifies log aggregation and monitoring.
      // ---------------------------------------------------------------------
      log_file: './logs/pm2-combined.log',
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // ---------------------------------------------------------------------
      // Environment Variables — Development (Default)
      // ---------------------------------------------------------------------
      // Applied when starting without --env flag:
      //   pm2 start ecosystem.config.js
      //
      // NODE_ENV: Enables verbose error responses and development-friendly
      //           middleware behavior.
      // PORT: Default HTTP listening port (matches the original server.js).
      // HOST: Bind to all network interfaces so the server is accessible
      //       from outside the container or VM.
      // LOG_LEVEL: 'debug' enables the most verbose logging for development
      //            troubleshooting.
      // ---------------------------------------------------------------------
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        HOST: '0.0.0.0',
        LOG_LEVEL: 'debug',
      },

      // ---------------------------------------------------------------------
      // Environment Variables — Production
      // ---------------------------------------------------------------------
      // Applied when starting with --env production:
      //   pm2 start ecosystem.config.js --env production
      //
      // NODE_ENV: Enables production optimizations in Express (view caching,
      //           minified error responses, etc.).
      // PORT: Same default port; override via .env or deployment config as
      //       needed.
      // HOST: Bind to all interfaces for reverse-proxy and load-balancer
      //       compatibility.
      // LOG_LEVEL: 'warn' suppresses info/debug noise in production, logging
      //            only warnings and errors.
      // ---------------------------------------------------------------------
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
        LOG_LEVEL: 'warn',
      },
    },
  ],
};
