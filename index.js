import express from "express";
import { Client } from "fulcrum-app";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { get_onedrive_folders } from "./app/app.js";
import { get_photos } from "./app/util/get_photos.js";
import { clean_up_photos } from "./app/util/clean_up.js";
import { copyImageToFolder } from "./app/util/put_file.js";
import { getFilesInFolder } from "./app/util/get_photos_folder.js";
import { get_photo_ids } from "./app/util/get_photo_ids.js";

// Initialize environment variables
dotenv.config();

// Initialize Fulcrum client
const client = new Client(`${process.env.FULCRUM_TOKEN}`);

const app = express();

// Middleware to parse JSON (optional, based on your needs)
app.use(express.json());

// Function to find the "Field Docs\Photos" path

function getFieldDocsPhotosPath(branch, projectNumber) {
  console.log(`Using branch: ${branch}`);

  // Build the base path from the branch.
  const basePath = path.join("\\\\trileaf.local\\Project_Folders", branch);
  if (!fs.existsSync(basePath)) {
    throw new Error(`Branch directory does not exist: ${basePath}`);
  }

  // Find the project directory that starts with the given projectNumber.
  const items = fs.readdirSync(basePath, { withFileTypes: true });
  const projectDirEntry = items.find(
    (entry) => entry.isDirectory() && entry.name.startsWith(projectNumber)
  );

  if (!projectDirEntry) {
    throw new Error(
      `No directory starts with "${projectNumber}" under ${basePath}`
    );
  }

  const projectPath = path.join(basePath, projectDirEntry.name);

  // Check for "Field Docs" folder. Create it if it doesn't exist.
  const fieldDocsPath = path.join(projectPath, "Field Docs");
  if (!fs.existsSync(fieldDocsPath)) {
    try {
      fs.mkdirSync(fieldDocsPath, { recursive: true });
      console.log(`"Field Docs" folder created at: ${fieldDocsPath}`);
    } catch (err) {
      throw new Error(
        `Failed to create "Field Docs" folder at: ${fieldDocsPath}. Error: ${err.message}`
      );
    }
  } else {
    console.log(`"Field Docs" folder already exists at: ${fieldDocsPath}`);
  }

  // Check for "Photos" folder inside the "Field Docs" folder. Create it if it doesn't exist.
  const photosPath = path.join(fieldDocsPath, "Photos");
  if (!fs.existsSync(photosPath)) {
    try {
      fs.mkdirSync(photosPath, { recursive: true });
      console.log(`"Photos" folder created at: ${photosPath}`);
    } catch (err) {
      throw new Error(
        `Failed to create "Photos" folder at: ${photosPath}. Error: ${err.message}`
      );
    }
  } else {
    console.log(`"Photos" folder already exists at: ${photosPath}`);
  }

  // Return the final path to the "Photos" folder.
  return photosPath;
}

// Asynchronous function to handle the photo-saving process
async function savePhotosProcess() {
  try {
    const records = await client.records.all({
      form_id: `${process.env.FULCRUM_FORM_ID}`,
    });

    for (const record of records.objects) {
      try {
        // Fetch photo IDs
        const look_up_array = await get_photo_ids();

        // Fetch photos using record ID and photo IDs
        await get_photos(`${record.id}`, look_up_array);

        // Get a list of all photo files in the local photos folder
        const photos = await getFilesInFolder("./app/util/photos", {
          onlyFiles: true,
        });
        console.log("Raw photo paths:", photos);

        // Move each photo to the designated "Photos" folder
        for (const relativePhotoPath of photos) {
          const filename = path.basename(relativePhotoPath);
          const absolutePhotoPath = path.resolve("./app/util/photos", filename);
          const newPhotoFolder = getFieldDocsPhotosPath(
            record.form_values["4730"]?.choice_values[0],
            record.form_values["bfd0"]
          );

          await copyImageToFolder(absolutePhotoPath, newPhotoFolder);
        }

        // Clean up the original photos folder
        await clean_up_photos("./app/util/photos");

        console.log(`Processed record ID: ${record.id} successfully.`);
      } catch (recordError) {
        console.error(
          `Error processing record ID ${record.id}: ${recordError}`
        );
      }
    }

    console.log("Photo-saving process completed successfully.");
    await clean_up_photos("./app/util/photos");
    return { success: true };
  } catch (error) {
    console.error(`Error in photo-saving process: ${error}`);
    throw error;
  }
}

// Health check route (optional)
app.get("/health", (req, res) => {
  res.sendStatus(200);
});

// New route to trigger the photo-saving process
app.post("/savephotos", async (req, res) => {
  try {
    await savePhotosProcess();
    res.status(200).json({ message: "Photos saved successfully." });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to save photos.", error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is up and running on port ${PORT}`);
});
