import { promises as fs } from "fs";
import path from "path";

const sanitizeFileName = (filename) =>
  filename.replace(/[\n\r\\/:<>"|?*]+/g, "-")?.trim()?.slice(0, 200);

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_) {
    return false;
  }
}

export async function copyImageToFolder(
  imagePath,
  folderPath,
  photo_array,
  projectNum,
  fieldVisitNotes,
  allowDuplicates = false
) {
  try {
    console.log("Source:", imagePath);
    console.log("Destination Folder (requested):", folderPath);

    // First, check if the source file exists
    
    if (!(await fileExists(imagePath))) {
      const error = new Error(`Source file does not exist: ${imagePath}`);
      error.code = "ENOENT_SOURCE";
      console.error("Source file missing:", error.message);
      throw error;
    }

    try {
      await fs.access(folderPath);
      console.log(`Destination folder exists at: ${folderPath}`);
    } catch (err) {
     console.log(err);
    }

    let { name, ext } = path.parse(imagePath);
    let photoObj = photo_array.find((photo) => photo.photo_id === name);
    // console.log({ photo_array });
    // console.log({ name });
    // console.log({ photoObj });

    let photo = photoObj?.caption
      ? photoObj.caption
      : "Please caption this photo project";
    if (ext.includes("pdf")) {
      fieldVisitNotes = fieldVisitNotes ? fieldVisitNotes : "Project Report";
      photo = `Project #${projectNum}, ${fieldVisitNotes}`;
    }
    photo = sanitizeFileName(photo);

    let newFileName = `${photo}${ext}`;
    let destinationPath = path.join(folderPath, newFileName);

    // Verify source file still exists before copying (in case it was deleted between checks)
    if (!(await fileExists(imagePath))) {
      const error = new Error(
        `Source file was removed before copy operation: ${imagePath}`
      );
      error.code = "ENOENT_SOURCE_DURING_COPY";
      console.error("Source file missing during copy:", error.message);
      throw error;
    }

    // overwrite the destination file if it exists
    await fs.copyFile(imagePath, destinationPath);
    console.log(`File copied successfully to: ${destinationPath}`);
    return destinationPath;
  } catch (error) {
    console.error("Error copying file:", error);

    // Add more context to the error
    if (error.code === "ENOENT") {
      error.message = `File operation failed - ${error.message}. Source: ${imagePath}, Destination: ${folderPath}`;
    }

    throw error;
  }
}
