module.exports = {
  apps: [
    {
      name: "index.main",
      script: "index.main.js",
      instances: 1,
      exec_mode: "fork",

      // Memory and restart settings
      max_memory_restart: "200MB",
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: "10s",

      // Automatic restart schedule (daily at 3 AM)
      cron_restart: "0 3 * * *",

      // Environment variables
      env: {
        NODE_ENV: "production",
        LOG_LEVEL: "info",
      },

      // Logging
      log_file: "./logs/combined.log",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Performance monitoring
      pmx: true,

      // Auto restart on file changes (disable in production)
      watch: false,

      // Ignore these files when watching
      ignore_watch: ["node_modules", "logs", "app/util/photos"],

      // Advanced settings
      node_args: "--max-old-space-size=512",

      // Kill timeout
      kill_timeout: 5000,

      // Wait ready timeout
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};
