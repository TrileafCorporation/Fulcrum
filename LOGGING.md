# Advanced Logging System for Fulcrum Photo Processing

This logging system provides comprehensive monitoring and analysis capabilities that far exceed standard pm2 logs or console output.

## 🎯 **Why This System is Better Than pm2 Logs**

### **pm2 logs limitations:**

- ❌ Plain text output with no structure
- ❌ No searchability or filtering
- ❌ No performance metrics
- ❌ No error categorization
- ❌ No correlation between related operations
- ❌ Limited retention and rotation

### **Our Advanced Logging Benefits:**

- ✅ **Structured JSON logs** - Machine readable and searchable
- ✅ **Performance tracking** - Automatic timing of all operations
- ✅ **Error categorization** - Detailed error context and stack traces
- ✅ **Session correlation** - Track related operations across the entire process
- ✅ **Multiple log files** - Separate errors, operations, and performance data
- ✅ **Automatic rotation** - Prevents disk space issues
- ✅ **Rich metadata** - Every log includes context like record IDs, project numbers, file paths
- ✅ **CLI analysis tools** - Quick reports and insights
- ✅ **Memory/CPU monitoring** - System health tracking

## 📁 **Log File Structure**

```
logs/
├── error.log                    # Critical errors only (10MB, 10 files)
├── operations.log               # All business operations (20MB, 15 files)
├── performance.log              # Timing and metrics (10MB, 10 files)
└── daily-YYYY-MM-DD.log        # Daily archive (50MB, 30 days)
```

## 🔍 **Log Analysis Commands**

### **Quick Start Commands:**

```bash
# Generate comprehensive report
npm run logs:report

# Show recent errors
npm run logs:errors

# Performance insights
npm run logs:performance

# Upload statistics
npm run logs:uploads

# Show latest log entries
npm run logs:tail
```

### **Advanced Commands:**

```bash
# Search for specific terms
node analyze-logs.js search "Project 1234"
node analyze-logs.js search "photo_download_error"

# Get all logs for a specific record
node analyze-logs.js record "a2c03deb-5475-4dea-8e49-0b0faba1d7f3"

# Get all logs for a specific project
node analyze-logs.js project "P1234"

# Export detailed report to JSON
node analyze-logs.js export --hours 48 --output weekly-report.json

# View specific time periods
node analyze-logs.js report --hours 6    # Last 6 hours
node analyze-logs.js errors --hours 72   # Last 3 days
```

## 📊 **Sample Log Output**

### **Structured JSON Format:**

```json
{
  "level": "info",
  "message": "Photo download successful",
  "service": "fulcrum-photo-processor",
  "sessionId": "session-1703123456789-abc123",
  "action": "photo_download_success",
  "recordId": "a2c03deb-5475-4dea-8e49-0b0faba1d7f3",
  "projectNum": "P1234",
  "photoId": "abc123xyz",
  "filePath": "/app/util/photos/abc123xyz.jpg",
  "duration": 2340,
  "downloadCount": 5,
  "system": {
    "memory": {
      "rss": "156MB",
      "heapUsed": "89MB",
      "heapTotal": "134MB"
    },
    "uptime": "3600s"
  },
  "timestamp": "2025-06-11 14:30:45.123"
}
```

### **Error Log Example:**

```json
{
  "level": "error",
  "message": "File upload failed",
  "action": "file_upload_error",
  "recordId": "def456ghi",
  "projectNum": "P5678",
  "sourceFile": "/app/util/photos/photo.jpg",
  "targetPath": "\\\\network\\path\\Photos",
  "errorDetails": {
    "name": "ENOENT",
    "message": "no such file or directory",
    "stack": "Error: ENOENT...\n    at copyImageToFolder...",
    "code": "ENOENT"
  },
  "system": {
    "memory": { "rss": "145MB", "heapUsed": "78MB" },
    "uptime": "3645s"
  },
  "timestamp": "2025-06-11 14:31:02.456"
}
```

## 📈 **Sample Report Output**

```
=== FULCRUM PROCESSING REPORT ===
Generated: 2025-06-11T14:35:00.000Z
Time Range: Last 24 hours

--- SUMMARY ---
Total Errors: 3
Total Operations: 157
Photo Success Rate: 94%
Upload Success Rate: 96%

--- RECENT ERRORS ---
1. 2025-06-11 14:31:02 - File upload failed
   Error: no such file or directory
   Record: def456ghi, Project: P5678

2. 2025-06-11 12:15:30 - Photo download failed
   Error: Request timeout
   Record: xyz789abc, Project: P9012

--- PERFORMANCE ---
Slowest Operations:
1. photo_abc123xyz: 5240ms max, 2340ms avg (1 times)
2. record_def456ghi: 3100ms max, 3100ms avg (1 times)
3. full_process: 45000ms max, 35000ms avg (2 times)

--- UPLOAD STATISTICS ---
Photos - Downloaded: 47, Failed: 3, Success: 94%
Files - Uploaded: 44, Failed: 2, Success: 96%
Records - Processed: 12, Successful: 10, Failed: 1, Skipped: 1
```

## 🚨 **Monitoring and Alerting**

### **Key Metrics to Monitor:**

1. **Error Rate** - Should be < 5%
2. **Upload Success Rate** - Should be > 95%
3. **Average Processing Time** - Watch for performance degradation
4. **Memory Usage** - Monitor for memory leaks
5. **Records Skipped** - Indicates configuration issues

### **Common Error Patterns to Watch:**

- `ENOENT` errors - Network path issues
- `ETIMEDOUT` - API connectivity problems
- `EACCES` - Permission issues
- `photo_download_error` - Fulcrum API issues
- `folder_operation` failures - Directory creation problems

### **Automated Monitoring Script:**

```bash
# Create a monitoring script that runs every hour
#!/bin/bash
cd /path/to/fulcrum
ERROR_COUNT=$(node analyze-logs.js errors --hours 1 | grep -c "Error:")
if [ "$ERROR_COUNT" -gt 5 ]; then
  echo "Alert: $ERROR_COUNT errors in the last hour" | mail admin@company.com
fi
```

## 🔧 **Configuration Options**

### **Environment Variables:**

```bash
# Set logging level (error, warn, info, debug)
LOG_LEVEL=info

# Disable console logging in production
NODE_ENV=production

# Custom log directory (default: ./logs)
LOG_DIR=/var/log/fulcrum
```

### **Custom Log Retention:**

Edit `app/logging/AdvancedLogger.js` to adjust:

- File sizes (maxsize)
- Number of files to keep (maxFiles)
- Daily rotation settings

## 🔍 **Troubleshooting Common Issues**

### **High Error Rate:**

```bash
# Check recent errors
npm run logs:errors --hours 6

# Look for specific error patterns
node analyze-logs.js search "ENOENT" --hours 24
node analyze-logs.js search "timeout" --hours 12
```

### **Slow Performance:**

```bash
# Check performance metrics
npm run logs:performance --hours 24

# Look for long-running operations
node analyze-logs.js search "duration" --hours 6
```

### **Failed Uploads:**

```bash
# Check upload statistics
npm run logs:uploads --hours 24

# Track specific project issues
node analyze-logs.js project "P1234"

# Check folder operation failures
node analyze-logs.js search "folder_operation" --hours 24
```

### **Network Issues:**

```bash
# Check for path resolution problems
node analyze-logs.js search "path_fallback" --hours 48

# Look for network folder access issues
node analyze-logs.js search "alternate_folder" --hours 24
```

## 📋 **Best Practices**

1. **Regular Monitoring:**

   - Run daily reports: `npm run logs:report --hours 24`
   - Check error trends weekly
   - Monitor performance degradation

2. **Log Analysis:**

   - Use specific record/project searches for detailed troubleshooting
   - Export reports for management: `node analyze-logs.js export`
   - Correlate errors with system events

3. **Maintenance:**

   - Logs automatically rotate, but monitor disk space
   - Archive important reports for historical analysis
   - Set up automated monitoring scripts

4. **Debugging:**
   - Set `LOG_LEVEL=debug` for detailed troubleshooting
   - Use session IDs to track related operations
   - Combine multiple search terms for complex issues

## 🚀 **Integration Examples**

### **Grafana Dashboard (if using log aggregation):**

Query for error rates:

```
count by (action) (rate(log_entries{level="error"}[5m]))
```

### **Slack Alerts:**

```bash
# Add to cron for hourly error checks
ERROR_COUNT=$(node analyze-logs.js errors --hours 1 | grep -c "Error:")
if [ "$ERROR_COUNT" -gt 0 ]; then
  curl -X POST -H 'Content-type: application/json' \
    --data '{"text":"Fulcrum: '$ERROR_COUNT' errors in last hour"}' \
    YOUR_SLACK_WEBHOOK_URL
fi
```

## 🎯 **Summary**

This logging system transforms basic console output into a powerful monitoring and debugging tool. Instead of scrolling through endless pm2 logs, you can:

- **Instantly identify** problem records, projects, or time periods
- **Track performance trends** and catch issues before they become critical
- **Generate professional reports** for management and stakeholders
- **Debug complex issues** with detailed context and correlation
- **Monitor system health** with built-in metrics

The structured, searchable logs with rich metadata make troubleshooting 10x faster and more effective than traditional logging approaches.
