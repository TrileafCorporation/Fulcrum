import { Client } from "fulcrum-app";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Initialize Fulcrum client
const client = new Client(process.env.FULCRUM_TOKEN);

export const check_for_new_photos = async (record_id, look_up) => {
  try {
    const page = await client.photos.all({
      form_id: process.env.FULCRUM_FORM_ID,
      record_id: record_id,
    });

    // Check if any photos aren't in the look_up array
    for (const photo of page.objects) {
      let access_key = photo.access_key;

      if (!look_up.includes(access_key)) {
        console.log("Found new photos to process.");
        return true; // Return true if we find at least one new photo
      }
    }

    console.log("All photos have been processed already.");
    return false; // Return false if all photos are in look_up
  } catch (error) {
    console.error(
      `Error retrieving photos for record ${record_id}:`,
      error.message
    );
    throw error; // Re-throw or return a specific value to indicate error
  }
};
