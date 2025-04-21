import { promises as fs } from "fs";
import path from "path";

const sanitizeFileName = (filename) =>
  filename
    .replace(/[\n\r\\/]+/g, "-") // Replace line breaks and slashes with '-'
    .trim();

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
  fieldVisitNotes
) {
  try {
    console.log("Source:", imagePath);
    console.log("Destination Folder (requested):", folderPath);

    // Check if the originally requested destination folder exists.
    try {
      await fs.access(folderPath);
      console.log(`Destination folder exists at: ${folderPath}`);
    } catch (err) {
      // folderPath doesn't exist.
      // Use the UNC base folder instead.
      const uncBase =
        "\\\\trileaf.local\\Project_Folders\\Shared\\Tech\\Fulcrum\\RecoveredUploads";

      // Create the new destination folder path by appending secondary_folder_name.
      folderPath = path.join(uncBase, secondary_folder_name);
      console.log(
        `Original folder not found. Using alternate folder path: ${folderPath}`
      );

      // Check if this alternate folder exists.
      try {
        await fs.access(folderPath);
        console.log(`Alternate destination folder exists at: ${folderPath}`);
      } catch (_) {
        // Folder doesn't exist; create it.
        await fs.mkdir(folderPath, { recursive: true });
        console.log(`Alternate destination folder created at: ${folderPath}`);
      }
    }

    // Determine the new file name.
    let { name, ext } = path.parse(imagePath);
    let photoObj = photo_array.find((photo) => photo.photo_id === name);
    console.log(photoObj);

    // Project #, Field, Visit Notes
    let photo = photoObj?.caption
      ? photoObj.caption
      : "Please caption this photo project";
    if (ext.includes("pdf")) {
      fieldVisitNotes = fieldVisitNotes ? fieldVisitNotes : "Project Report";
      photo = `Project #${projectNum}, ${fieldVisitNotes}`;
    }
    photo = sanitizeFileName(photo);

    let newFileName = `${photo}${ext}`;

    // Change below to dynamic later

    // Check for file naming conflicts and adjust if necessary.
    let destinationPath = path.join(folderPath, newFileName);
    let counter = 1;

    while (await fileExists(destinationPath)) {
      // Insert a suffix (e.g., (1), (2), etc.) before the file extension.
      newFileName = `${photo}(${counter})${ext}`;
      destinationPath = path.join(folderPath, newFileName);
      counter++;
    }

    // Copy the file to the determined destination folder.
    await fs.copyFile(imagePath, destinationPath);
    console.log(`File copied successfully to: ${destinationPath}`);
    return destinationPath;
  } catch (error) {
    console.error("Error copying file:", error);
    throw error;
  }
}
