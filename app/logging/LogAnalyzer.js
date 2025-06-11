import fs from "fs";
import path from "path";
import readline from "readline";

class LogAnalyzer {
  constructor(logsDir = "./logs") {
    this.logsDir = logsDir;
  }

  // Parse a log file and return structured data
  async parseLogFile(filename) {
    const filePath = path.join(this.logsDir, filename);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Log file not found: ${filePath}`);
    }

    const logs = [];
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (line.trim()) {
        try {
          const logEntry = JSON.parse(line);
          logs.push(logEntry);
        } catch (error) {
          // Skip malformed lines
          console.warn(
            `Skipping malformed log line: ${line.substring(0, 100)}...`
          );
        }
      }
    }

    return logs;
  }

  // Get logs within a time range
  filterByTimeRange(logs, startTime, endTime) {
    return logs.filter((log) => {
      const logTime = new Date(log.timestamp);
      return logTime >= startTime && logTime <= endTime;
    });
  }

  // Filter logs by criteria
  filterLogs(logs, criteria = {}) {
    return logs.filter((log) => {
      // Filter by level
      if (criteria.level && log.level !== criteria.level) {
        return false;
      }

      // Filter by action
      if (criteria.action && log.action !== criteria.action) {
        return false;
      }

      // Filter by recordId
      if (criteria.recordId && log.recordId !== criteria.recordId) {
        return false;
      }

      // Filter by projectNum
      if (criteria.projectNum && log.projectNum !== criteria.projectNum) {
        return false;
      }

      // Filter by error presence
      if (criteria.hasError !== undefined) {
        const hasError = log.errorDetails || log.level === "error";
        if (criteria.hasError !== hasError) {
          return false;
        }
      }

      return true;
    });
  }

  // Generate summary statistics
  generateSummary(logs) {
    const summary = {
      totalLogs: logs.length,
      timeRange: {
        start: logs.length > 0 ? logs[0].timestamp : null,
        end: logs.length > 0 ? logs[logs.length - 1].timestamp : null,
      },
      levels: {},
      actions: {},
      errors: {
        total: 0,
        byType: {},
        details: [],
      },
      performance: {
        totalDuration: 0,
        operations: {},
        averages: {},
      },
      records: {
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
      },
      photos: {
        downloaded: 0,
        failed: 0,
      },
      uploads: {
        successful: 0,
        failed: 0,
      },
    };

    logs.forEach((log) => {
      // Count levels
      summary.levels[log.level] = (summary.levels[log.level] || 0) + 1;

      // Count actions
      if (log.action) {
        summary.actions[log.action] = (summary.actions[log.action] || 0) + 1;
      }

      // Analyze errors
      if (log.level === "error" || log.errorDetails) {
        summary.errors.total++;

        if (log.errorDetails) {
          const errorType = log.errorDetails.name || "Unknown";
          summary.errors.byType[errorType] =
            (summary.errors.byType[errorType] || 0) + 1;
          summary.errors.details.push({
            timestamp: log.timestamp,
            message: log.message,
            error: log.errorDetails.message,
            recordId: log.recordId,
            projectNum: log.projectNum,
          });
        }
      }

      // Analyze performance
      if (log.duration) {
        summary.performance.totalDuration += log.duration;

        if (log.operation) {
          if (!summary.performance.operations[log.operation]) {
            summary.performance.operations[log.operation] = {
              count: 0,
              totalDuration: 0,
              minDuration: Infinity,
              maxDuration: 0,
            };
          }

          const op = summary.performance.operations[log.operation];
          op.count++;
          op.totalDuration += log.duration;
          op.minDuration = Math.min(op.minDuration, log.duration);
          op.maxDuration = Math.max(op.maxDuration, log.duration);
        }
      }

      // Analyze records
      if (log.action === "record_start") summary.records.processed++;
      if (log.action === "record_complete") summary.records.successful++;
      if (log.action === "record_error") summary.records.failed++;
      if (log.action === "record_skipped") summary.records.skipped++;

      // Analyze photos
      if (log.action === "photo_download_success") summary.photos.downloaded++;
      if (log.action === "photo_download_error") summary.photos.failed++;

      // Analyze uploads
      if (log.action === "file_upload_success") summary.uploads.successful++;
      if (log.action === "file_upload_error") summary.uploads.failed++;
    });

    // Calculate averages
    Object.keys(summary.performance.operations).forEach((operation) => {
      const op = summary.performance.operations[operation];
      op.averageDuration = Math.round(op.totalDuration / op.count);
      summary.performance.averages[operation] = op.averageDuration;
    });

    return summary;
  }

  // Get recent errors with context
  async getRecentErrors(hours = 24) {
    const logs = await this.parseLogFile("error.log");
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentLogs = this.filterByTimeRange(logs, since, new Date());

    return recentLogs.map((log) => ({
      timestamp: log.timestamp,
      message: log.message,
      error: log.errorDetails,
      context: {
        recordId: log.recordId,
        projectNum: log.projectNum,
        operation: log.operation,
        action: log.action,
      },
    }));
  }

  // Get performance insights
  async getPerformanceInsights(hours = 24) {
    const logs = await this.parseLogFile("performance.log");
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentLogs = this.filterByTimeRange(logs, since, new Date());

    const summary = this.generateSummary(recentLogs);

    return {
      timeRange: `Last ${hours} hours`,
      totalOperations: Object.values(summary.performance.operations).reduce(
        (sum, op) => sum + op.count,
        0
      ),
      averageDurations: summary.performance.averages,
      slowestOperations: Object.entries(summary.performance.operations)
        .sort((a, b) => b[1].maxDuration - a[1].maxDuration)
        .slice(0, 10)
        .map(([operation, stats]) => ({
          operation,
          maxDuration: stats.maxDuration,
          avgDuration: stats.averageDuration,
          count: stats.count,
        })),
    };
  }

  // Get upload success rates
  async getUploadStats(hours = 24) {
    const logs = await this.parseLogFile("operations.log");
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentLogs = this.filterByTimeRange(logs, since, new Date());

    const summary = this.generateSummary(recentLogs);

    const photoSuccessRate =
      (summary.photos.downloaded /
        (summary.photos.downloaded + summary.photos.failed)) *
      100;

    const uploadSuccessRate =
      (summary.uploads.successful /
        (summary.uploads.successful + summary.uploads.failed)) *
      100;

    return {
      timeRange: `Last ${hours} hours`,
      photos: {
        downloaded: summary.photos.downloaded,
        failed: summary.photos.failed,
        successRate: Math.round(photoSuccessRate || 0) + "%",
      },
      uploads: {
        successful: summary.uploads.successful,
        failed: summary.uploads.failed,
        successRate: Math.round(uploadSuccessRate || 0) + "%",
      },
      records: summary.records,
    };
  }

  // Generate a comprehensive report
  async generateReport(hours = 24) {
    const [errors, performance, uploads] = await Promise.all([
      this.getRecentErrors(hours),
      this.getPerformanceInsights(hours),
      this.getUploadStats(hours),
    ]);

    const report = {
      generatedAt: new Date().toISOString(),
      timeRange: `Last ${hours} hours`,
      summary: {
        totalErrors: errors.length,
        totalOperations: performance.totalOperations,
        photoSuccessRate: uploads.photos.successRate,
        uploadSuccessRate: uploads.uploads.successRate,
      },
      errors: {
        count: errors.length,
        recent: errors.slice(0, 10),
        byType: this.groupBy(errors, (error) => error.error?.name || "Unknown"),
      },
      performance,
      uploads,
    };

    return report;
  }

  // Search logs by text
  async searchLogs(searchTerm, filename = "operations.log") {
    const logs = await this.parseLogFile(filename);

    return logs.filter((log) => {
      const logString = JSON.stringify(log).toLowerCase();
      return logString.includes(searchTerm.toLowerCase());
    });
  }

  // Get logs for a specific record
  async getRecordLogs(recordId) {
    const logs = await this.parseLogFile("operations.log");

    return this.filterLogs(logs, { recordId }).sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
  }

  // Get logs for a specific project
  async getProjectLogs(projectNum) {
    const logs = await this.parseLogFile("operations.log");

    return this.filterLogs(logs, { projectNum }).sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
  }

  // Helper function to group array by key
  groupBy(array, keyFunction) {
    return array.reduce((result, item) => {
      const key = keyFunction(item);
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(item);
      return result;
    }, {});
  }

  // Pretty print a report
  printReport(report) {
    console.log("\n=== FULCRUM PROCESSING REPORT ===");
    console.log(`Generated: ${report.generatedAt}`);
    console.log(`Time Range: ${report.timeRange}`);

    console.log("\n--- SUMMARY ---");
    console.log(`Total Errors: ${report.summary.totalErrors}`);
    console.log(`Total Operations: ${report.summary.totalOperations}`);
    console.log(`Photo Success Rate: ${report.summary.photoSuccessRate}`);
    console.log(`Upload Success Rate: ${report.summary.uploadSuccessRate}`);

    if (report.errors.count > 0) {
      console.log("\n--- RECENT ERRORS ---");
      report.errors.recent.forEach((error, i) => {
        console.log(`${i + 1}. ${error.timestamp} - ${error.message}`);
        if (error.error) {
          console.log(`   Error: ${error.error.message}`);
        }
        if (error.context.recordId) {
          console.log(
            `   Record: ${error.context.recordId}, Project: ${error.context.projectNum}`
          );
        }
        console.log("");
      });
    }

    console.log("\n--- PERFORMANCE ---");
    console.log("Slowest Operations:");
    report.performance.slowestOperations.forEach((op, i) => {
      console.log(
        `${i + 1}. ${op.operation}: ${op.maxDuration}ms max, ${
          op.avgDuration
        }ms avg (${op.count} times)`
      );
    });

    console.log("\n--- UPLOAD STATISTICS ---");
    console.log(
      `Photos - Downloaded: ${report.uploads.photos.downloaded}, Failed: ${report.uploads.photos.failed}, Success: ${report.uploads.photos.successRate}`
    );
    console.log(
      `Files - Uploaded: ${report.uploads.uploads.successful}, Failed: ${report.uploads.uploads.failed}, Success: ${report.uploads.uploads.successRate}`
    );
    console.log(
      `Records - Processed: ${report.uploads.records.processed}, Successful: ${report.uploads.records.successful}, Failed: ${report.uploads.records.failed}, Skipped: ${report.uploads.records.skipped}`
    );

    console.log("\n==========================================\n");
  }
}

export default LogAnalyzer;
