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

const createRecord = async (accessKey, client, record) => {
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
    const record = await client.records.create(obj);
    console.log(`${record.id} has been created!`);
  } catch (error) {
    console.error(
      `Error creating record for access_key ${accessKey}:`,
      error.message
    );
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

          await createRecord(photo.access_key, client, record);
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
