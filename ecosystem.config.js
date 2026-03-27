/**
 * PM2 Ecosystem Configuration
 *
 * Defines the process management configuration for the hello-world-api
 * application when deployed with PM2. This file is consumed by PM2 via:
 *
 *   npx pm2 start ecosystem.config.js
 *   npx pm2 start ecosystem.config.js --env production
 *
 * Key features:
 *   - Cluster mode: leverages Node.js cluster module across all available
 *     CPU cores for horizontal scaling and zero-downtime reloads.
 *   - Automatic restarts: workers that crash or exceed the memory threshold
 *     are restarted automatically with a configurable delay.
 *   - Environment profiles: separate `env` (development) and `env_production`
 *     blocks allow one-command switching between deployment targets.
 *   - Unified logging: log output is merged across cluster workers into a
 *     single timestamped stream stored in the `./logs/` directory alongside
 *     the Winston application logs.
 *
 * Usage:
 *   Development:  npx pm2 start ecosystem.config.js
 *   Production:   npx pm2 start ecosystem.config.js --env production
 *   Stop:         npx pm2 stop ecosystem.config.js
 *   Restart:      npx pm2 restart ecosystem.config.js
 *   Reload (0dt): npx pm2 reload ecosystem.config.js
 *   Logs:         npx pm2 logs hello-world-api
 *
 * @module ecosystem.config
 * @see https://pm2.keymetrics.io/docs/usage/application-declaration/
 */

module.exports = {
  /**
   * apps — Array of application configurations managed by PM2.
   * Each entry describes a single application process (or set of clustered
   * workers) that PM2 will spawn, monitor, and restart as needed.
   */
  apps: [
    {
      // -----------------------------------------------------------------------
      // IDENTITY
      // -----------------------------------------------------------------------

      /**
       * Human-readable name used in PM2 process list, log filenames, and the
       * PM2 monitoring dashboard. Must be unique across all PM2-managed apps.
       */
      name: 'hello-world-api',

      /**
       * Path to the entry-point script that PM2 will execute. Points to the
       * refactored Express server entry point which imports src/app.js,
       * src/config, and src/config/logger before calling app.listen().
       */
      script: 'server.js',

      // -----------------------------------------------------------------------
      // CLUSTER & SCALING
      // -----------------------------------------------------------------------

      /**
       * Number of worker instances to spawn. Setting to 'max' instructs PM2
       * to fork one worker per available CPU core, maximizing throughput on
       * multi-core systems. For constrained environments, set to a fixed
       * integer (e.g., 2) instead.
       */
      instances: 'max',

      /**
       * Execution mode. 'cluster' enables the Node.js built-in cluster module
       * so that all workers share the same server port via round-robin load
       * balancing. This also enables zero-downtime reloads (`pm2 reload`),
       * where workers are restarted one at a time without dropping connections.
       */
      exec_mode: 'cluster',

      // -----------------------------------------------------------------------
      // FILE WATCHING
      // -----------------------------------------------------------------------

      /**
       * Disable file watching in production. File-change–triggered restarts
       * are handled by nodemon during development (`npm run dev`). Enabling
       * watch in production risks unnecessary restarts from log file writes
       * or temporary deploy artifacts.
       */
      watch: false,

      // -----------------------------------------------------------------------
      // MEMORY MANAGEMENT
      // -----------------------------------------------------------------------

      /**
       * Maximum memory threshold per worker before PM2 triggers an automatic
       * restart. Protects against memory leaks by recycling workers that
       * exceed 300 MB of resident set size. Adjust upward if the application
       * legitimately requires more memory (e.g., large in-memory caches).
       */
      max_memory_restart: '300M',

      // -----------------------------------------------------------------------
      // RESTART POLICY
      // -----------------------------------------------------------------------

      /**
       * Enable automatic restart when a worker exits unexpectedly. Combined
       * with max_restarts and restart_delay, this provides resilience against
       * transient errors while preventing infinite restart loops.
       */
      autorestart: true,

      /**
       * Maximum number of consecutive restarts within a 15-minute window
       * before PM2 marks the application as errored and stops attempting
       * further restarts. Prevents runaway restart loops caused by persistent
       * configuration errors or missing dependencies.
       */
      max_restarts: 10,

      /**
       * Delay in milliseconds between automatic restarts. Provides a brief
       * cooldown period to allow transient issues (e.g., port conflicts,
       * temporary resource exhaustion) to resolve before the worker respawns.
       */
      restart_delay: 1000,

      // -----------------------------------------------------------------------
      // LOGGING
      // -----------------------------------------------------------------------

      /**
       * Timestamp format prepended to every log line emitted by PM2. Uses
       * Moment.js formatting tokens. This timestamp is independent of any
       * timestamps added by the Winston logger inside the application.
       */
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      /**
       * Path to the PM2 error log file. Captures stderr output from the
       * application process. Stored in the same ./logs/ directory used by
       * Winston file transports for consolidated log management.
       */
      error_file: './logs/pm2-error.log',

      /**
       * Path to the PM2 standard output log file. Captures stdout output
       * from the application process. Stored alongside the error log in
       * ./logs/ for unified access.
       */
      out_file: './logs/pm2-out.log',

      /**
       * Merge log output from all cluster workers into a single log file
       * instead of creating per-worker log files (e.g., pm2-out-0.log,
       * pm2-out-1.log). Simplifies log aggregation and analysis in
       * clustered deployments.
       */
      merge_logs: true,

      // -----------------------------------------------------------------------
      // ENVIRONMENT VARIABLES
      // -----------------------------------------------------------------------

      /**
       * Default environment variables applied when PM2 starts without an
       * explicit --env flag. Configured for development with verbose logging.
       * Variable names must align with the keys read by src/config/index.js:
       *   - NODE_ENV  : Application environment identifier
       *   - PORT      : TCP port the HTTP server binds to
       *   - HOST      : Network interface the server listens on
       *   - LOG_LEVEL : Minimum severity level for Winston logger output
       */
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        HOST: '0.0.0.0',
        LOG_LEVEL: 'debug',
      },

      /**
       * Production environment variables applied when PM2 is started with:
       *   npx pm2 start ecosystem.config.js --env production
       *
       * Overrides the default `env` block above. Reduces log verbosity to
       * 'info' level to minimize I/O overhead and log volume in production.
       */
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
        LOG_LEVEL: 'info',
      },
    },
  ],
};
