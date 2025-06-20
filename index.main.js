import express from "express";
import { Client } from "fulcrum-app";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import cron from "node-cron";
import { get_onedrive_folders } from "./app/app.js";
import { get_photos, createLookupRecord } from "./app/util/get_photos.js";
import { clean_up_photos } from "./app/util/clean_up.js";
import { copyImageToFolder } from "./app/util/put_file.js";
import { getFilesInFolder } from "./app/util/get_photos_folder.js";
import { get_photo_ids } from "./app/util/get_photo_ids.js";
import { downloadFulcrumPDF } from "./app/util/get_pdf_file.js";
import { check_for_new_photos } from "./app/util/get_photos_check.js";
import logger from "./app/logging/AdvancedLogger.js";

dotenv.config();

// Function that grabs name:
function extractPhotoObjects(data) {
  const photos = [];

  function traverse(item) {
    if (Array.isArray(item)) {
      for (const el of item) {
        traverse(el);
      }
    } else if (item && typeof item === "object") {
      if (item.hasOwnProperty("photo_id") && item.hasOwnProperty("caption")) {
        photos.push(item);
      }
      for (const key in item) {
        if (item.hasOwnProperty(key)) {
          traverse(item[key]);
        }
      }
    }
  }

  traverse(data);
  return photos;
}

const client = new Client(`${process.env.FULCRUM_TOKEN}`);
const app = express();
app.use(express.json());

// Function to find the "Field Docs\Photos" path
function getFieldDocsPhotosPath(branch, projectNumber) {
  logger.info("Resolving Field Docs Photos path", {
    action: "path_resolution",
    branch,
    projectNumber,
  });

  let filePath = "\\\\trileaf.local\\Project_Folders";

  const basePath = path.join(filePath, branch);
  if (!fs.existsSync(basePath)) {
    logger.warn("Branch directory does not exist, using fallback path", {
      action: "path_fallback",
      basePath,
      fallbackPath: path.join(filePath, "unexciting"),
      branch,
      projectNumber,
    });
    return path.join(filePath, "unexciting");
  }

  const items = fs.readdirSync(basePath, { withFileTypes: true });
  const projectDirEntry = items.find(
    (entry) => entry.isDirectory() && entry.name.startsWith(projectNumber)
  );

  if (!projectDirEntry) {
    logger.warn("No directory found with project number, using fallback path", {
      action: "project_not_found",
      projectNumber,
      basePath,
      fallbackPath: path.join(filePath, "unexciting"),
    });
    return path.join(filePath, "unexciting");
  }

  const projectPath = path.join(basePath, projectDirEntry.name);

  const fieldDocsPath = path.join(projectPath, "Field Docs");
  if (!fs.existsSync(fieldDocsPath)) {
    try {
      fs.mkdirSync(fieldDocsPath, { recursive: true });
      logger.folderOperation("create", fieldDocsPath, true, null, {
        folderType: "Field Docs",
        projectNumber,
        branch,
      });
    } catch (err) {
      logger.folderOperation("create", fieldDocsPath, false, err, {
        folderType: "Field Docs",
        projectNumber,
        branch,
      });
      throw new Error(
        `Failed to create "Field Docs" folder at: ${fieldDocsPath}. Error: ${err.message}`
      );
    }
  }

  const photosPath = path.join(fieldDocsPath, "Photos");
  if (!fs.existsSync(photosPath)) {
    try {
      fs.mkdirSync(photosPath, { recursive: true });
      logger.folderOperation("create", photosPath, true, null, {
        folderType: "Photos",
        projectNumber,
        branch,
      });
    } catch (err) {
      logger.folderOperation("create", photosPath, false, err, {
        folderType: "Photos",
        projectNumber,
        branch,
      });
      throw new Error(
        `Failed to create "Photos" folder at: ${photosPath}. Error: ${err.message}`
      );
    }
  }

  logger.info("Field Docs Photos path resolved successfully", {
    action: "path_resolved",
    finalPath: photosPath,
    projectNumber,
    branch,
  });

  return photosPath;
}

// Function to check if PDF already exists on file server
function checkPDFExists(branch, projectNum, fieldVisitNotes) {
  try {
    const photosPath = getFieldDocsPhotosPath(branch, projectNum);
    fieldVisitNotes = fieldVisitNotes ? fieldVisitNotes : "Project Report";
    const pdfFileName = `Project #${projectNum}, ${fieldVisitNotes}.pdf`;
    const pdfPath = path.join(photosPath, pdfFileName);

    const exists = fs.existsSync(pdfPath);

    logger.info("PDF existence check", {
      action: "pdf_existence_check",
      projectNum,
      pdfPath,
      exists,
    });

    return exists;
  } catch (error) {
    logger.error("Error checking PDF existence", error, {
      action: "pdf_check_error",
      projectNum,
    });
    return false; // If error, assume doesn't exist and allow download
  }
}

// Optional: Function to clean up existing duplicate PDFs
async function cleanupDuplicatePDFs(branch, projectNum) {
  const timeout = 30000; // 30 second timeout

  try {
    // Wrap the entire operation in a timeout
    await Promise.race([
      new Promise(async (resolve, reject) => {
        try {
          const photosPath = getFieldDocsPhotosPath(branch, projectNum);

          // Use fs.promises for async operations
          const files = await fs.promises.readdir(photosPath);

          // Find PDF files that have numbers in parentheses (duplicates)
          const duplicatePDFs = files.filter((file) => {
            return (
              file.includes(".pdf") &&
              /\(\d+\)/.test(file) &&
              file.includes(`Project #${projectNum}`)
            );
          });

          logger.info("Found duplicate PDFs to clean up", {
            action: "duplicate_pdf_cleanup",
            projectNum,
            duplicateCount: duplicatePDFs.length,
            duplicateFiles: duplicatePDFs,
          });

          // Remove duplicate PDFs with individual timeouts
          for (const file of duplicatePDFs) {
            const filePath = path.join(photosPath, file);
            try {
              // Add timeout for each file deletion
              await Promise.race([
                fs.promises.unlink(filePath),
                new Promise((_, reject) =>
                  setTimeout(
                    () => reject(new Error("File deletion timeout")),
                    10000
                  )
                ),
              ]);

              logger.info("Removed duplicate PDF", {
                action: "duplicate_pdf_removed",
                projectNum,
                removedFile: filePath,
              });
            } catch (error) {
              logger.error("Failed to remove duplicate PDF", error, {
                action: "duplicate_pdf_removal_failed",
                projectNum,
                filePath,
              });
              // Continue with other files even if one fails
            }
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Cleanup operation timeout")),
          timeout
        )
      ),
    ]);
  } catch (error) {
    logger.error("Error during duplicate PDF cleanup", error, {
      action: "duplicate_cleanup_error",
      projectNum,
      timeout: timeout,
    });
  }
}

// Asynchronous function to handle the photo-saving process
async function savePhotosProcess() {
  try {
    logger.processStart(0); // Will be updated with actual count

    // Only fetch records updated in the last 7 days to avoid processing old projects
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const records = await client.records.all({
      form_id: `${process.env.FULCRUM_FORM_ID}`,
      updated_since: sevenDaysAgo.toISOString(),
    });

    logger.info("Fetched records from Fulcrum", {
      action: "records_fetched",
      totalRecords: records.objects.length,
      formId: process.env.FULCRUM_FORM_ID,
    });

    // Update process start with actual record count
    logger.processStart(records.objects.length);

    for (const record of records.objects) {
      // Project # 1234
      // Comment out when testing is done
      // if (record.id != "20503860-7f7a-45f0-acad-db1d7a63b382") {
      //   continue;
      // }
      console.log(record.id);

      let photo_array = extractPhotoObjects(record);
      let status = record.status;
      let projectNum = record.form_values["bfd0"];
      let branch = record.form_values["4730"]?.choice_values?.[0];

      logger.recordStart(record.id, projectNum, status, photo_array.length, {
        branch,
        fieldVisitNotes: record.form_values["638f"],
      });

      if (status !== "Complete") {
        logger.recordSkipped(record.id, "Status not complete", {
          currentStatus: status,
          projectNum,
        });
        continue;
      }

      try {
        // Clean up any existing duplicate PDFs first
        // Uncomment if this functionality is needed in the future!
        // await cleanupDuplicatePDFs(branch, projectNum);

        const look_up_array = await get_photo_ids(client);
        const photos_check = await check_for_new_photos(
          record.id,
          look_up_array,
          client
        );

        logger.info("Checked for new photos", {
          action: "photos_check",
          recordId: record.id,
          projectNum,
          hasNewPhotos: photos_check,
          lookupCount: look_up_array.length,
        });

        if (photos_check) {
          // Check if PDF already exists on file server before downloading
          const pdfExists = checkPDFExists(
            branch,
            projectNum,
            record.form_values["638f"]
          );

          if (!pdfExists) {
            logger.info("Downloading PDF for record", {
              action: "pdf_download_start",
              recordId: record.id,
              projectNum,
            });
            await downloadFulcrumPDF(record.id);
          } else {
            logger.info(
              "PDF already exists on file server, skipping download",
              {
                action: "pdf_download_skipped",
                recordId: record.id,
                projectNum,
              }
            );
          }
        }

        await get_photos(`${record.id}`, look_up_array, client, record);

        // Add a small delay to ensure file operations are complete
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const photos = await getFilesInFolder("./app/util/photos", {
          onlyFiles: true,
        });

        logger.info("Photos retrieved for processing", {
          action: "photos_retrieved",
          recordId: record.id,
          projectNum,
          photoCount: photos.length,
          photoPaths: photos.map((p) => path.basename(p)),
        });

        for (const relativePhotoPath of photos) {
          let fieldVisitNotes = record.form_values["638f"];

          const filename = path.basename(relativePhotoPath);
          const absolutePhotoPath = path.resolve("./app/util/photos", filename);
          const newPhotoFolder = getFieldDocsPhotosPath(branch, projectNum);
          const secondary_folder_name = `${projectNum}`;

          // Verify the source file exists before attempting to process it
          if (!fs.existsSync(absolutePhotoPath)) {
            logger.warn("Source photo file does not exist, skipping", {
              action: "source_file_missing",
              recordId: record.id,
              projectNum,
              filename,
              absolutePhotoPath,
            });
            continue;
          }

          logger.fileUploadStart(absolutePhotoPath, newPhotoFolder, {
            recordId: record.id,
            projectNum,
            filename,
            fieldVisitNotes,
          });

          try {
            const destinationPath = await copyImageToFolder(
              absolutePhotoPath,
              newPhotoFolder,
              photo_array,
              secondary_folder_name,
              projectNum,
              fieldVisitNotes
            );

            logger.fileUploadSuccess(absolutePhotoPath, destinationPath, {
              recordId: record.id,
              projectNum,
              filename,
              fieldVisitNotes,
            });

            // After successfully copying (or skipping) the photo, persist its access_key to the lookup form
            const fileExt = path.extname(filename).toLowerCase();
            if (fileExt === ".jpg" || fileExt === ".jpeg") {
              const accessKey = path.parse(filename).name; // filename without extension
              try {
                await createLookupRecord(accessKey, client, record);
                logger.info("Lookup record created successfully", {
                  action: "lookup_record_created",
                  recordId: record.id,
                  projectNum,
                  accessKey,
                });
              } catch (lookupErr) {
                logger.error("Failed to create lookup record", {
                  action: "lookup_update_failure",
                  recordId: record.id,
                  projectNum,
                  accessKey,
                  error: lookupErr.message,
                });
                // Re-throw the error to prevent endless processing
                throw lookupErr;
              }
            }
          } catch (copyError) {
            logger.fileUploadError(
              absolutePhotoPath,
              newPhotoFolder,
              copyError,
              {
                recordId: record.id,
                projectNum,
                filename,
              }
            );
            // Don't throw the error immediately, log it and continue with other photos
            // This prevents one bad photo from stopping the entire process
            logger.warn("Continuing with remaining photos after copy error", {
              action: "copy_error_continue",
              recordId: record.id,
              projectNum,
              filename,
              error: copyError.message,
            });
          }
        }

        // Only clean up photos after ALL photos for this record have been processed
        try {
          await clean_up_photos("./app/util/photos");
        } catch (cleanupError) {
          logger.warn("Error during photo cleanup, continuing", {
            action: "cleanup_error",
            recordId: record.id,
            projectNum,
            error: cleanupError.message,
          });
        }

        logger.recordComplete(record.id, projectNum, {
          photosProcessed: photos.length,
          branch,
        });
      } catch (recordError) {
        logger.recordError(record.id, recordError, {
          projectNum,
          photoCount: photo_array.length,
          branch,
        });
      }
    }

    logger.processComplete({
      totalRecords: records.objects.length,
    });

    await clean_up_photos("./app/util/photos");
    return { success: true };
  } catch (error) {
    logger.error("Error in photo-saving process", error, {
      action: "process_error",
    });
    throw error;
  }
}

// Route to trigger the photo-saving process manually
app.post("/savephotos", async (req, res) => {
  const requestId = `manual-${Date.now()}`;

  logger.info("Manual photo-saving process triggered via API", {
    action: "manual_trigger",
    requestId,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  try {
    await savePhotosProcess();

    logger.info("Manual photo-saving process completed successfully", {
      action: "manual_success",
      requestId,
    });

    res.status(200).json({
      message: "Photos saved successfully.",
      requestId,
    });
  } catch (error) {
    logger.error("Manual photo-saving process failed", error, {
      action: "manual_failure",
      requestId,
    });

    res.status(500).json({
      message: "Failed to save photos.",
      error: error.message,
      requestId,
    });
  }
});

cron.schedule("*/30 * * * *", async () => {
  const cronId = `cron-${Date.now()}`;

  logger.info("Cron job triggered: Starting the photo-saving process", {
    action: "cron_trigger",
    cronId,
    schedule: "*/30 * * * *",
  });

  try {
    await savePhotosProcess();

    logger.info("Cron job: Photo-saving process completed successfully", {
      action: "cron_success",
      cronId,
    });
  } catch (error) {
    logger.error("Cron job: Error occurred while saving photos", error, {
      action: "cron_failure",
      cronId,
    });
  }
});

// Memory monitoring function
function monitorMemory() {
  const memUsage = process.memoryUsage();
  const memUsageMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024),
  };

  // Log warning if memory usage is high
  if (memUsageMB.rss > 150) {
    logger.warn("High memory usage detected", {
      action: "memory_warning",
      memoryUsage: memUsageMB,
      uptime: Math.round(process.uptime()) + "s",
    });
  }

  // Force garbage collection if available and memory is very high
  if (memUsageMB.rss > 180 && global.gc) {
    logger.info("Forcing garbage collection", {
      action: "gc_forced",
      memoryBefore: memUsageMB,
    });
    global.gc();
  }
}

// Monitor memory every 5 minutes
setInterval(monitorMemory, 5 * 60 * 1000);

// Health check endpoint with system metrics
app.get("/health", (req, res) => {
  logger.systemHealth();

  const memUsage = process.memoryUsage();
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()) + "s",
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024) + "MB",
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + "MB",
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + "MB",
      external: Math.round(memUsage.external / 1024 / 1024) + "MB",
    },
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info("Server started successfully", {
    action: "server_start",
    port: PORT,
    nodeEnv: process.env.NODE_ENV || "development",
    logLevel: process.env.LOG_LEVEL || "info",
  });
});
