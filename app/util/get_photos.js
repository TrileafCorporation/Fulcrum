import { Client } from "fulcrum-app";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { Readable } from "stream"; // Import Readable to convert web streams

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Initialize Fulcrum client
const client = new Client(process.env.FULCRUM_TOKEN);

// Define the photos directory path
const photosDir = path.resolve(__dirname, "./photos");

// Ensure the photos directory exists using promises-based fs methods
const ensurePhotosDirectory = async () => {
  try {
    await fs.promises.access(photosDir);
    // Directory exists
  } catch (err) {
    if (err.code === "ENOENT") {
      try {
        await fs.promises.mkdir(photosDir, { recursive: true });
        console.log(`Created photos directory at ${photosDir}`);
      } catch (mkdirErr) {
        console.error(`Error creating directory: ${mkdirErr}`);
      }
    } else {
      console.error(`Error accessing directory: ${err}`);
    }
  }
};

// Utility function to write a Node.js stream to a file using Promises
const writeStreamToFile = async (nodeStream, photoPath) => {
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(photoPath);
    nodeStream.pipe(writeStream);
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });
};

// Utility function to create a record using async/await
const createRecord = async (accessKey) => {
  const obj = {
    form_id: process.env.FULCRUM_FORM_LOOK_UP,
    latitude: 27.770787,
    longitude: -82.638039,
    form_values: {
      2426: accessKey,
    },
  };

  try {
    const record = await client.records.create(obj);
    console.log(`${record.id} has been created!`);
  } catch (error) {
    console.error(
      `Error creating record for access_key ${accessKey}:`,
      error.message
    );
  }
};

// Define the async function to get photos
export const get_photos = async (record_id, look_up) => {
  // Ensure photos directory exists
  await ensurePhotosDirectory();

  try {
    const page = await client.photos.all({
      form_id: process.env.FULCRUM_FORM_ID,
      record_id: record_id,
    });

    // Process each photo
    const photoPromises = page.objects.map(async (photo) => {
      console.log(`Processing photo: ${photo.access_key}`);

      if (!look_up.includes(photo.access_key)) {
        console.log("access_key not found in look_up");

        const photoFilename = path.join(photosDir, `${photo.access_key}.jpg`);

        try {
          // Get the photo response (a Web ReadableStream)
          const response = await client.photos.media(
            photo.access_key,
            "original"
          );

          // Convert the Web ReadableStream to a Node.js stream
          const nodeStream = Readable.fromWeb(response);

          // Ensure the converted stream is pipeable
          if (!nodeStream || typeof nodeStream.pipe !== "function") {
            throw new Error("Converted photo stream is not pipeable.");
          }

          // Write the Node.js stream to a file
          await writeStreamToFile(nodeStream, photoFilename);
          console.log(`Photo saved: ${photoFilename}`);

          // Create the associated record.
          await createRecord(photo.access_key);
        } catch (photoError) {
          console.error(
            `Error processing photo ${photo.access_key}:`,
            photoError.message
          );
        }
      } else {
        console.log(
          `access_key ${photo.access_key} already exists in look_up. Skipping.`
        );
      }
    });

    // Wait for all photo processing to complete
    await Promise.all(photoPromises);
    console.log("All photos have been processed.");
  } catch (error) {
    console.error(
      `Error retrieving photos for record ${record_id}:`,
      error.message
    );
  }
};

// // Execute the function using an IIFE to handle top-level await
// (async () => {
//     const recordId = "d9891469-41f0-4b13-9a25-04fbe2b43004";
//     const lookUpArray = ["00000-00000-000000-000000-000000"];

//     await get_photos(recordId, lookUpArray);
// })();
