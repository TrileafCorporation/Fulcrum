import { promises as fs } from "fs";
import path from "path";

const sanitizeFileName = (filename) =>
  filename.replace(/[\n\r\\/]+/g, "-").trim();

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

    try {
      await fs.access(folderPath);
      console.log(`Destination folder exists at: ${folderPath}`);
    } catch (err) {
      // folderPath doesn't exist.
      // Use the UNC base folder instead.
      const uncBase =
        "\\\\trileaf.local\\Project_Folders\\Shared\\Tech\\Fulcrum\\RecoveredUploads";

      folderPath = path.join(uncBase, secondary_folder_name);
      console.log(
        `Original folder not found. Using alternate folder path: ${folderPath}`
      );

      try {
        await fs.access(folderPath);
        console.log(`Alternate destination folder exists at: ${folderPath}`);
      } catch (_) {
        await fs.mkdir(folderPath, { recursive: true });
        console.log(`Alternate destination folder created at: ${folderPath}`);
      }
    }

    let { name, ext } = path.parse(imagePath);
    let photoObj = photo_array.find((photo) => photo.photo_id === name);
    console.log({ photo_array });
    console.log({ name });
    console.log({ photoObj });

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
    let counter = 1;

    while (await fileExists(destinationPath)) {
      // Insert a suffix (e.g., (1), (2), etc.) before the file extension.
      newFileName = `${photo}(${counter})${ext}`;
      destinationPath = path.join(folderPath, newFileName);
      counter++;
    }

    await fs.copyFile(imagePath, destinationPath);
    console.log(`File copied successfully to: ${destinationPath}`);
    return destinationPath;
  } catch (error) {
    console.error("Error copying file:", error);
    throw error;
  }
}
