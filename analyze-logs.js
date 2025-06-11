#!/usr/bin/env node

import LogAnalyzer from "./app/logging/LogAnalyzer.js";
import { program } from "commander";

const analyzer = new LogAnalyzer();

program
  .name("analyze-logs")
  .description("Analyze Fulcrum photo processing logs")
  .version("1.0.0");

// Generate comprehensive report
program
  .command("report")
  .description("Generate a comprehensive processing report")
  .option("-h, --hours <hours>", "Hours to look back", "24")
  .action(async (options) => {
    try {
      console.log("Generating report...\n");
      const report = await analyzer.generateReport(parseInt(options.hours));
      analyzer.printReport(report);
    } catch (error) {
      console.error("Error generating report:", error.message);
    }
  });

// Show recent errors
program
  .command("errors")
  .description("Show recent errors")
  .option("-h, --hours <hours>", "Hours to look back", "24")
  .option("-c, --count <count>", "Number of errors to show", "10")
  .action(async (options) => {
    try {
      const errors = await analyzer.getRecentErrors(parseInt(options.hours));

      console.log(`\n=== RECENT ERRORS (Last ${options.hours} hours) ===\n`);

      if (errors.length === 0) {
        console.log("No errors found! 🎉");
        return;
      }

      const count = Math.min(parseInt(options.count), errors.length);
      errors.slice(0, count).forEach((error, i) => {
        console.log(`${i + 1}. ${error.timestamp}`);
        console.log(`   Message: ${error.message}`);
        if (error.error) {
          console.log(`   Error: ${error.error.message}`);
        }
        if (error.context.recordId) {
          console.log(
            `   Context: Record ${error.context.recordId}, Project ${error.context.projectNum}`
          );
        }
        console.log("");
      });

      if (errors.length > count) {
        console.log(`... and ${errors.length - count} more errors`);
      }
    } catch (error) {
      console.error("Error fetching errors:", error.message);
    }
  });

// Show performance stats
program
  .command("performance")
  .description("Show performance statistics")
  .option("-h, --hours <hours>", "Hours to look back", "24")
  .action(async (options) => {
    try {
      const perf = await analyzer.getPerformanceInsights(
        parseInt(options.hours)
      );

      console.log(
        `\n=== PERFORMANCE INSIGHTS (Last ${options.hours} hours) ===\n`
      );
      console.log(`Total Operations: ${perf.totalOperations}`);

      console.log("\nAverage Durations:");
      Object.entries(perf.averageDurations).forEach(([operation, duration]) => {
        console.log(`  ${operation}: ${duration}ms`);
      });

      console.log("\nSlowest Operations:");
      perf.slowestOperations.forEach((op, i) => {
        console.log(
          `  ${i + 1}. ${op.operation}: ${op.maxDuration}ms max (${
            op.count
          } times)`
        );
      });
    } catch (error) {
      console.error("Error fetching performance data:", error.message);
    }
  });

// Show upload statistics
program
  .command("uploads")
  .description("Show upload statistics")
  .option("-h, --hours <hours>", "Hours to look back", "24")
  .action(async (options) => {
    try {
      const stats = await analyzer.getUploadStats(parseInt(options.hours));

      console.log(
        `\n=== UPLOAD STATISTICS (Last ${options.hours} hours) ===\n`
      );

      console.log("Photos:");
      console.log(`  Downloaded: ${stats.photos.downloaded}`);
      console.log(`  Failed: ${stats.photos.failed}`);
      console.log(`  Success Rate: ${stats.photos.successRate}`);

      console.log("\nFile Uploads:");
      console.log(`  Successful: ${stats.uploads.successful}`);
      console.log(`  Failed: ${stats.uploads.failed}`);
      console.log(`  Success Rate: ${stats.uploads.successRate}`);

      console.log("\nRecords:");
      console.log(`  Processed: ${stats.records.processed}`);
      console.log(`  Successful: ${stats.records.successful}`);
      console.log(`  Failed: ${stats.records.failed}`);
      console.log(`  Skipped: ${stats.records.skipped}`);
    } catch (error) {
      console.error("Error fetching upload stats:", error.message);
    }
  });

// Search logs
program
  .command("search <term>")
  .description("Search logs for a specific term")
  .option("-f, --file <filename>", "Log file to search", "operations.log")
  .option("-c, --count <count>", "Number of results to show", "10")
  .action(async (term, options) => {
    try {
      const results = await analyzer.searchLogs(term, options.file);

      console.log(
        `\n=== SEARCH RESULTS for "${term}" in ${options.file} ===\n`
      );

      if (results.length === 0) {
        console.log("No results found.");
        return;
      }

      const count = Math.min(parseInt(options.count), results.length);
      results.slice(0, count).forEach((log, i) => {
        console.log(`${i + 1}. ${log.timestamp} [${log.level}] ${log.message}`);
        if (log.recordId) console.log(`   Record: ${log.recordId}`);
        if (log.projectNum) console.log(`   Project: ${log.projectNum}`);
        if (log.action) console.log(`   Action: ${log.action}`);
        console.log("");
      });

      if (results.length > count) {
        console.log(`... and ${results.length - count} more results`);
      }
    } catch (error) {
      console.error("Error searching logs:", error.message);
    }
  });

// Get logs for specific record
program
  .command("record <recordId>")
  .description("Get all logs for a specific record")
  .action(async (recordId) => {
    try {
      const logs = await analyzer.getRecordLogs(recordId);

      console.log(`\n=== LOGS FOR RECORD ${recordId} ===\n`);

      if (logs.length === 0) {
        console.log("No logs found for this record.");
        return;
      }

      logs.forEach((log, i) => {
        console.log(`${i + 1}. ${log.timestamp} [${log.level}] ${log.message}`);
        if (log.action) console.log(`   Action: ${log.action}`);
        if (log.duration) console.log(`   Duration: ${log.duration}ms`);
        if (log.errorDetails) {
          console.log(`   Error: ${log.errorDetails.message}`);
        }
        console.log("");
      });
    } catch (error) {
      console.error("Error fetching record logs:", error.message);
    }
  });

// Get logs for specific project
program
  .command("project <projectNum>")
  .description("Get all logs for a specific project")
  .action(async (projectNum) => {
    try {
      const logs = await analyzer.getProjectLogs(projectNum);

      console.log(`\n=== LOGS FOR PROJECT ${projectNum} ===\n`);

      if (logs.length === 0) {
        console.log("No logs found for this project.");
        return;
      }

      // Group by record for better readability
      const logsByRecord = analyzer.groupBy(
        logs,
        (log) => log.recordId || "unknown"
      );

      Object.entries(logsByRecord).forEach(([recordId, recordLogs]) => {
        console.log(`Record: ${recordId}`);
        recordLogs.forEach((log, i) => {
          console.log(`  ${log.timestamp} [${log.level}] ${log.message}`);
          if (log.action) console.log(`    Action: ${log.action}`);
          if (log.duration) console.log(`    Duration: ${log.duration}ms`);
        });
        console.log("");
      });
    } catch (error) {
      console.error("Error fetching project logs:", error.message);
    }
  });

// Live tail equivalent
program
  .command("tail")
  .description("Show recent log entries (like tail -f)")
  .option("-f, --file <filename>", "Log file to tail", "operations.log")
  .option("-n, --lines <lines>", "Number of lines to show", "20")
  .action(async (options) => {
    try {
      const logs = await analyzer.parseLogFile(options.file);
      const recentLogs = logs.slice(-parseInt(options.lines));

      console.log(`\n=== RECENT ENTRIES from ${options.file} ===\n`);

      recentLogs.forEach((log) => {
        // Handle logs that might not have timestamp field
        const timestamp = log.timestamp || new Date().toISOString();
        console.log(`${timestamp} [${log.level}] ${log.message}`);
        if (log.recordId)
          console.log(`  Record: ${log.recordId}, Project: ${log.projectNum}`);
        if (log.action) console.log(`  Action: ${log.action}`);
        if (log.duration) console.log(`  Duration: ${log.duration}ms`);
        console.log("");
      });
    } catch (error) {
      console.error("Error tailing logs:", error.message);
    }
  });

// Export report to JSON
program
  .command("export")
  .description("Export report to JSON file")
  .option("-h, --hours <hours>", "Hours to look back", "24")
  .option(
    "-o, --output <filename>",
    "Output filename",
    `fulcrum-report-${new Date().toISOString().split("T")[0]}.json`
  )
  .action(async (options) => {
    try {
      const report = await analyzer.generateReport(parseInt(options.hours));

      // Write to file
      const fs = await import("fs");
      fs.writeFileSync(options.output, JSON.stringify(report, null, 2));

      console.log(`Report exported to: ${options.output}`);
      console.log(`Report covers last ${options.hours} hours`);
      console.log(
        `Summary: ${report.summary.totalErrors} errors, ${report.summary.totalOperations} operations`
      );
    } catch (error) {
      console.error("Error exporting report:", error.message);
    }
  });

program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
