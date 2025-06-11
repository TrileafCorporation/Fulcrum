import winston from "winston";
import path from "path";
import fs from "fs";

// Ensure logs directory exists
const logsDir = "./logs";
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom error formatter that captures all error details
const errorFormat = winston.format((info) => {
  if (info instanceof Error) {
    return {
      ...info,
      level: "error",
      message: info.message,
      stack: info.stack,
      name: info.name,
      code: info.code,
    };
  }
  return info;
});

// Enhanced JSON formatter with performance metrics
const enhancedJsonFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  errorFormat(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const baseLog = {
      timestamp: info.timestamp,
      level: info.level,
      message: info.message,
      service: "fulcrum-photo-processor",
      ...info,
    };

    // Add memory usage to each log
    const memUsage = process.memoryUsage();
    baseLog.system = {
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024) + "MB",
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + "MB",
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + "MB",
      },
      uptime: Math.round(process.uptime()) + "s",
    };

    return JSON.stringify(baseLog);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;

    // Add key metadata for console
    if (meta.recordId) log += ` [Record: ${meta.recordId}]`;
    if (meta.projectNum) log += ` [Project: ${meta.projectNum}]`;
    if (meta.operation) log += ` [Op: ${meta.operation}]`;
    if (meta.duration) log += ` [${meta.duration}ms]`;

    return log;
  })
);

class AdvancedLogger {
  constructor() {
    this.winston = winston.createLogger({
      level: process.env.LOG_LEVEL || "info",
      format: enhancedJsonFormat,
      transports: [
        // Error logs - Critical issues only
        new winston.transports.File({
          filename: path.join(logsDir, "error.log"),
          level: "error",
          maxsize: 10485760, // 10MB
          maxFiles: 10,
          tailable: true,
        }),

        // Operations log - All business logic
        new winston.transports.File({
          filename: path.join(logsDir, "operations.log"),
          level: "info",
          maxsize: 20971520, // 20MB
          maxFiles: 15,
          tailable: true,
        }),

        // Performance log - Timing and metrics
        new winston.transports.File({
          filename: path.join(logsDir, "performance.log"),
          level: "info",
          maxsize: 10485760, // 10MB
          maxFiles: 10,
          tailable: true,
        }),

        // Daily rotating log for historical analysis
        new winston.transports.File({
          filename: path.join(
            logsDir,
            `daily-${new Date().toISOString().split("T")[0]}.log`
          ),
          maxsize: 50331648, // 50MB
          maxFiles: 30,
        }),
      ],
    });

    // Add console in development
    if (process.env.NODE_ENV !== "production") {
      this.winston.add(
        new winston.transports.Console({
          format: consoleFormat,
        })
      );
    }

    // Performance tracking
    this.timers = new Map();
    this.metrics = {
      recordsProcessed: 0,
      photosDownloaded: 0,
      filesUploaded: 0,
      errors: 0,
      startTime: Date.now(),
    };

    // Session ID for tracking related operations
    this.sessionId = `session-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  // Enhanced logging methods with automatic context enrichment
  log(level, message, context = {}) {
    this.winston.log(level, message, {
      sessionId: this.sessionId,
      ...context,
    });
  }

  info(message, context = {}) {
    this.log("info", message, context);
  }

  warn(message, context = {}) {
    this.log("warn", message, context);
  }

  error(message, error = null, context = {}) {
    this.metrics.errors++;

    const errorContext = {
      ...context,
      errorDetails: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: error.code,
          }
        : null,
    };

    this.log("error", message, errorContext);
  }

  debug(message, context = {}) {
    this.log("debug", message, context);
  }

  // Performance timing methods
  startTimer(operationId, context = {}) {
    this.timers.set(operationId, {
      startTime: Date.now(),
      context,
    });

    this.info(`Started: ${operationId}`, {
      operation: operationId,
      action: "timer_start",
      ...context,
    });
  }

  endTimer(operationId, additionalContext = {}) {
    const timer = this.timers.get(operationId);
    if (!timer) {
      this.warn(`Timer not found: ${operationId}`, { operation: operationId });
      return null;
    }

    const duration = Date.now() - timer.startTime;
    this.timers.delete(operationId);

    const perfLog = {
      operation: operationId,
      action: "timer_end",
      duration,
      ...timer.context,
      ...additionalContext,
    };

    this.info(`Completed: ${operationId}`, perfLog);

    // Log to performance file specifically
    this.winston.log("info", `Performance: ${operationId}`, perfLog);

    return duration;
  }

  // Business-specific logging methods
  processStart(totalRecords, context = {}) {
    this.info("Photo processing started", {
      action: "process_start",
      totalRecords,
      sessionId: this.sessionId,
      ...context,
    });
    this.startTimer("full_process");
  }

  processComplete(results = {}) {
    const duration = this.endTimer("full_process");

    this.info("Photo processing completed", {
      action: "process_complete",
      duration,
      results: {
        recordsProcessed: this.metrics.recordsProcessed,
        photosDownloaded: this.metrics.photosDownloaded,
        filesUploaded: this.metrics.filesUploaded,
        errors: this.metrics.errors,
        totalDuration: duration,
        ...results,
      },
    });

    // Reset metrics for next run
    this.resetMetrics();
  }

  recordStart(recordId, projectNum, status, photoCount, context = {}) {
    this.metrics.recordsProcessed++;

    this.info("Record processing started", {
      action: "record_start",
      recordId,
      projectNum,
      status,
      photoCount,
      recordIndex: this.metrics.recordsProcessed,
      ...context,
    });

    this.startTimer(`record_${recordId}`, { recordId, projectNum });
  }

  recordComplete(recordId, projectNum, results = {}) {
    const duration = this.endTimer(`record_${recordId}`);

    this.info("Record processing completed", {
      action: "record_complete",
      recordId,
      projectNum,
      duration,
      ...results,
    });
  }

  recordSkipped(recordId, reason, context = {}) {
    this.warn("Record skipped", {
      action: "record_skipped",
      recordId,
      reason,
      ...context,
    });
  }

  recordError(recordId, error, context = {}) {
    this.error("Record processing failed", error, {
      action: "record_error",
      recordId,
      ...context,
    });
  }

  photoDownloadStart(recordId, photoId, context = {}) {
    this.info("Photo download started", {
      action: "photo_download_start",
      recordId,
      photoId,
      ...context,
    });

    this.startTimer(`photo_${photoId}`, { recordId, photoId });
  }

  photoDownloadSuccess(recordId, photoId, filePath, context = {}) {
    this.metrics.photosDownloaded++;
    const duration = this.endTimer(`photo_${photoId}`);

    this.info("Photo download successful", {
      action: "photo_download_success",
      recordId,
      photoId,
      filePath,
      duration,
      downloadCount: this.metrics.photosDownloaded,
      ...context,
    });
  }

  photoDownloadError(recordId, photoId, error, context = {}) {
    this.endTimer(`photo_${photoId}`);

    this.error("Photo download failed", error, {
      action: "photo_download_error",
      recordId,
      photoId,
      ...context,
    });
  }

  fileUploadStart(sourceFile, targetPath, context = {}) {
    const uploadId = path.basename(sourceFile);

    this.info("File upload started", {
      action: "file_upload_start",
      sourceFile,
      targetPath,
      uploadId,
      ...context,
    });

    this.startTimer(`upload_${uploadId}`, { sourceFile, targetPath });
  }

  fileUploadSuccess(sourceFile, targetPath, context = {}) {
    this.metrics.filesUploaded++;
    const uploadId = path.basename(sourceFile);
    const duration = this.endTimer(`upload_${uploadId}`);

    this.info("File upload successful", {
      action: "file_upload_success",
      sourceFile,
      targetPath,
      uploadId,
      duration,
      uploadCount: this.metrics.filesUploaded,
      ...context,
    });
  }

  fileUploadError(sourceFile, targetPath, error, context = {}) {
    const uploadId = path.basename(sourceFile);
    this.endTimer(`upload_${uploadId}`);

    this.error("File upload failed", error, {
      action: "file_upload_error",
      sourceFile,
      targetPath,
      uploadId,
      ...context,
    });
  }

  folderOperation(operation, folderPath, success, error = null, context = {}) {
    const level = success ? "info" : "error";
    const message = `Folder ${operation} ${success ? "successful" : "failed"}`;

    this.log(level, message, {
      action: "folder_operation",
      operation,
      folderPath,
      success,
      error: error?.message,
      ...context,
    });
  }

  apiCall(endpoint, method, success, duration, context = {}) {
    this.info(`API call: ${method} ${endpoint}`, {
      action: "api_call",
      endpoint,
      method,
      success,
      duration,
      ...context,
    });
  }

  // System health logging
  systemHealth() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    this.info("System health check", {
      action: "system_health",
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024) + "MB",
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + "MB",
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + "MB",
        external: Math.round(memUsage.external / 1024 / 1024) + "MB",
      },
      cpu: {
        user: cpuUsage.user / 1000 + "ms",
        system: cpuUsage.system / 1000 + "ms",
      },
      uptime: Math.round(process.uptime()) + "s",
      metrics: this.metrics,
    });
  }

  resetMetrics() {
    this.metrics = {
      recordsProcessed: 0,
      photosDownloaded: 0,
      filesUploaded: 0,
      errors: 0,
      startTime: Date.now(),
    };
  }

  // Search and analysis helpers
  async getLogSummary(hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    this.info("Generating log summary", {
      action: "log_summary",
      since: since.toISOString(),
      hours,
    });
  }
}

// Create singleton instance
const logger = new AdvancedLogger();

export default logger;
