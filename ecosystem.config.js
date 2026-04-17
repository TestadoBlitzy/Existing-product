/**
 * PM2 Ecosystem Configuration — Process Manager Setup
 *
 * Defines the PM2 application configuration for both development and production
 * environments.  PM2 uses this file to manage the Node.js process with features
 * such as cluster mode (multi-core utilisation), automatic restarts on crash,
 * memory-limit restarts, and structured log management.
 *
 * The `script` property references `server.js` at the project root, which is
 * the Express application bootstrap / entry point.  PM2 spawns this file as a
 * child process (or multiple workers in cluster mode) when starting the app.
 *
 * Usage:
 *   Start (development):   pm2 start ecosystem.config.js
 *   Start (production):    pm2 start ecosystem.config.js --env production
 *   Stop:                  pm2 stop ecosystem.config.js
 *   Restart:               pm2 restart ecosystem.config.js
 *   View logs:             pm2 logs hello-world
 *   Delete from PM2:       pm2 delete ecosystem.config.js
 *
 * npm script shortcuts (defined in package.json):
 *   npm run start:pm2      — starts the app via PM2
 *   npm run stop:pm2       — stops the PM2 managed process
 *   npm run restart:pm2    — restarts the PM2 managed process
 *   npm run logs:pm2       — streams PM2 logs to the terminal
 *
 * @see https://pm2.keymetrics.io/docs/usage/application-declaration/
 * @module ecosystem.config
 */

module.exports = {
  /**
   * apps — Array of PM2 application definitions.
   *
   * Each entry describes a single application that PM2 will manage.  This
   * project defines one application (`hello-world`) with cluster mode enabled
   * for horizontal scaling across all available CPU cores in production.
   */
  apps: [
    {
      // ------------------------------------------------------------------
      // Core application identity
      // ------------------------------------------------------------------

      /**
       * Human-readable name used by PM2 to identify this process in the
       * process list (`pm2 list`), logs, and monitoring dashboard.
       */
      name: 'hello-world',

      /**
       * Path to the Node.js entry-point script that PM2 will execute.
       * This MUST point to the project's server bootstrap file which
       * imports the Express app from src/app.js and starts listening.
       */
      script: 'server.js',

      // ------------------------------------------------------------------
      // Cluster mode and scaling
      // ------------------------------------------------------------------

      /**
       * Number of worker instances to launch.  Setting this to 'max'
       * tells PM2 to spawn one worker per available CPU core, maximising
       * throughput under load.  In development a single instance is
       * typically sufficient (override via `pm2 start -i 1`).
       */
      instances: 'max',

      /**
       * Execution mode.  'cluster' leverages Node.js's built-in cluster
       * module to share the listening socket across workers, enabling
       * zero-downtime restarts and horizontal scaling.  Requires the
       * application to be stateless (no in-memory session state).
       */
      exec_mode: 'cluster',

      // ------------------------------------------------------------------
      // Process lifecycle
      // ------------------------------------------------------------------

      /**
       * Automatically restart the process if it exits unexpectedly
       * (non-zero exit code or unhandled exception).  Combined with the
       * process-level error handlers in server.js (unhandledRejection,
       * uncaughtException), this ensures high availability.
       */
      autorestart: true,

      /**
       * Disable file-system watching in production.  File-change-driven
       * restarts are handled by nodemon during development (`npm run dev`).
       * Enabling watch in production would cause unnecessary restarts on
       * log file writes or temporary file creation.
       */
      watch: false,

      /**
       * Memory threshold (in bytes or human-readable string) at which PM2
       * will gracefully restart the worker.  Prevents slow memory leaks
       * from degrading performance over extended uptimes.
       */
      max_memory_restart: '1G',

      // ------------------------------------------------------------------
      // Log configuration
      // ------------------------------------------------------------------

      /**
       * Timestamp format prepended to every PM2 log line.  Uses a
       * human-readable ISO-like format with timezone offset for
       * straightforward correlation with application (Winston) logs.
       */
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      /**
       * File path for PM2-captured stderr output.  Stored in the same
       * `logs/` directory used by Winston to keep all log artefacts
       * co-located for easy collection and rotation.
       */
      error_file: './logs/pm2-error.log',

      /**
       * File path for PM2-captured stdout output.
       */
      out_file: './logs/pm2-out.log',

      /**
       * When running in cluster mode, merge log output from all worker
       * instances into the single error_file and out_file rather than
       * creating per-worker log files (e.g. pm2-out-0.log, pm2-out-1.log).
       * Simplifies log aggregation and analysis.
       */
      merge_logs: true,

      // ------------------------------------------------------------------
      // Environment variables — Development (default)
      // ------------------------------------------------------------------

      /**
       * Default environment variables applied when PM2 starts the app
       * without an explicit `--env` flag.  Mirrors the values defined in
       * the project `.env` file for local development.
       *
       * These variables are consumed by src/config/index.js which loads
       * them via dotenv and exports a structured configuration object.
       */
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        HOST: '0.0.0.0',
        LOG_LEVEL: 'debug',
        CORS_ORIGIN: '*',
      },

      // ------------------------------------------------------------------
      // Environment variables — Production
      // ------------------------------------------------------------------

      /**
       * Production environment variables applied when PM2 is started with
       * `pm2 start ecosystem.config.js --env production`.  Differences
       * from development:
       *   - NODE_ENV set to 'production' (enables Express optimisations,
       *     Helmet strict defaults, sanitised error responses)
       *   - LOG_LEVEL raised to 'info' (suppresses verbose debug output)
       */
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
        LOG_LEVEL: 'info',
        CORS_ORIGIN: '*',
      },
    },
  ],
};
