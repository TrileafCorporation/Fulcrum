import { promises as fs } from "fs";
import path from "path";

const sanitizeFileName = (filename) =>
  filename.replace(/[\n\r\\/:<>"|?*]+/g, "-").trim();

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
  secondary_folder_name,
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
      // folderPath doesn't exist.
      // Use the UNC base folder instead.
      // const uncBase = "\\\\trileaf.local\\Project_Folders\\Shared\\Tech\\Fulcrum\\RecoveredUploads";
      
      // const uncBase = process.env.FILE_PATH + "\\Shared\\Tech\\Fulcrum\\RecoveredUploads";
      const uncBase = path.join(process.env.FILE_PATH, "Shared", "Tech", "Fulcrum", "RecoveredUploads");

      folderPath = path.join(uncBase, secondary_folder_name);
      console.log(
        `Original folder not found. Using alternate folder path: ${folderPath}`
      );

      try {
        await fs.access(folderPath);
        console.log(`Alternate destination folder exists at: ${folderPath}`);
      } catch (_) {
        try {
          await fs.mkdir(folderPath, { recursive: true });
          console.log(`Alternate destination folder created at: ${folderPath}`);
        } catch (mkdirError) {
          const error = new Error(
            `Failed to create destination folder: ${folderPath}. Error: ${mkdirError.message}`
          );
          error.code = "MKDIR_FAILED";
          console.error("Failed to create destination folder:", error.message);
          throw error;
        }
      }
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

    // Special handling for PDFs to prevent duplication
    if (ext.includes("pdf")) {
      // For PDFs, check if file already exists
      if (await fileExists(destinationPath)) {
        console.log(`PDF already exists at: ${destinationPath}`);
        console.log("Skipping PDF copy to prevent duplication");
        return destinationPath; // Return the existing file path
      }
    } else {
      // For images, check allowDuplicates parameter
      if (await fileExists(destinationPath)) {
        if (!allowDuplicates) {
          console.log(`Image already exists at: ${destinationPath}`);
          console.log("Skipping image copy to prevent duplication");
          return destinationPath; // Return the existing file path
        } else {
          // Create numbered duplicates if allowDuplicates is true
          let counter = 1;
          while (await fileExists(destinationPath)) {
            newFileName = `${photo}(${counter})${ext}`;
            destinationPath = path.join(folderPath, newFileName);
            counter++;
          }
        }
      }
    }

    // Verify source file still exists before copying (in case it was deleted between checks)
    if (!(await fileExists(imagePath))) {
      const error = new Error(
        `Source file was removed before copy operation: ${imagePath}`
      );
      error.code = "ENOENT_SOURCE_DURING_COPY";
      console.error("Source file missing during copy:", error.message);
      throw error;
    }

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
