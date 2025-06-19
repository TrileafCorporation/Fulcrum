import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { Readable } from "stream";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const photosDir = path.resolve(__dirname, "./photos");

const ensurePhotosDirectory = async () => {
  try {
    await fs.promises.access(photosDir);
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

const writeStreamToFile = async (nodeStream, photoPath) => {
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(photoPath);
    nodeStream.pipe(writeStream);
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });
};

export const createLookupRecord = async (accessKey, client, record) => {
  // First check if a lookup record already exists for this access_key
  try {
    const existingRecords = await client.records.all({
      form_id: process.env.FULCRUM_FORM_LOOK_UP,
      q: `field_2426:"${accessKey}"`,
    });

    if (existingRecords.objects.length > 0) {
      console.log(`Lookup record already exists for access_key: ${accessKey}`);
      return existingRecords.objects[0];
    }
  } catch (searchError) {
    console.warn(
      `Warning: Could not search for existing lookup record: ${searchError.message}`
    );
    // Continue with creation attempt
  }

  const obj = {
    form_id: process.env.FULCRUM_FORM_LOOK_UP,
    latitude: 27.770787,
    longitude: -82.638039,
    form_values: {
      2426: accessKey,
      cb30: record.form_values["bfd0"],
    },
  };

  try {
    const lookupRecord = await client.records.create(obj);
    console.log(
      `Lookup record ${lookupRecord.id} has been created for access_key: ${accessKey}`
    );
    return lookupRecord;
  } catch (error) {
    console.error(
      `Error creating record for access_key ${accessKey}:`,
      error.message
    );
    // Re-throw the error so it can be handled by the calling function
    throw error;
  }
};

export const get_photos = async (record_id, look_up, client, record) => {
  await ensurePhotosDirectory();

  try {
    const page = await client.photos.all({
      form_id: process.env.FULCRUM_FORM_ID,
      record_id: record_id,
    });

    const photoPromises = page.objects.map(async (photo) => {
      console.log(`Processing photo: ${photo.access_key}`);

      if (!look_up.includes(photo.access_key)) {
        console.log("access_key not found in look_up");

        const photoFilename = path.join(photosDir, `${photo.access_key}.jpg`);

        try {
          const response = await client.photos.media(
            photo.access_key,
            "original"
          );

          const nodeStream = Readable.fromWeb(response);

          if (!nodeStream || typeof nodeStream.pipe !== "function") {
            throw new Error("Converted photo stream is not pipeable.");
          }

          await writeStreamToFile(nodeStream, photoFilename);
          console.log(`Photo saved: ${photoFilename}`);

          // Lookup record will be created after the photo has been successfully
          // copied to its final destination within index.main.js.
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

    await Promise.all(photoPromises);
    console.log("All photos have been processed.");
  } catch (error) {
    console.error(
      `Error retrieving photos for record ${record_id}:`,
      error.message
    );
  }
};
