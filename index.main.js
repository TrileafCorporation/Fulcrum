import express from "express";
import { Client } from "fulcrum-app";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import cron from "node-cron";
import { get_onedrive_folders } from "./app/app.js";
import { get_photos } from "./app/util/get_photos.js";
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

// Asynchronous function to handle the photo-saving process
async function savePhotosProcess() {
  try {
    logger.processStart(0); // Will be updated with actual count

    const records = await client.records.all({
      form_id: `${process.env.FULCRUM_FORM_ID}`,
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
      // if (record.id != "a2c03deb-5475-4dea-8e49-0b0faba1d7f3") {
      //   continue;
      // }

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
          logger.info("Downloading PDF for record", {
            action: "pdf_download_start",
            recordId: record.id,
            projectNum,
          });
          await downloadFulcrumPDF(record.id);
        }

        await get_photos(`${record.id}`, look_up_array, client, record);

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
            throw copyError;
          }
        }

        await clean_up_photos("./app/util/photos");

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

// Health check endpoint with system metrics
app.get("/health", (req, res) => {
  logger.systemHealth();

  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()) + "s",
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + "MB",
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB",
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
