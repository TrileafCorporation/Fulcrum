import fs from "fs";
import path from "path";

export const getFilesInFolder = (folderPath, options = {}) => {
  const { onlyFiles = false, onlyImages = false } = options;

  try {
    if (!fs.existsSync(folderPath)) {
      console.warn(`Folder does not exist: ${folderPath}`);
      return [];
    }

    const items = fs.readdirSync(folderPath);

    let paths = items.map((item) => path.join(folderPath, item));

    if (onlyFiles) {
      paths = paths.filter((itemPath) => {
        const stats = fs.statSync(itemPath);
        return stats.isFile();
      });
    }

    if (onlyImages) {
      const imageExtensions = new Set([
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".bmp",
        ".webp",
        ".tiff",
        ".pdf",
      ]);
      paths = paths.filter((itemPath) => {
        const ext = path.extname(itemPath).toLowerCase();
        return imageExtensions.has(ext);
      });
    }

    return paths;
  } catch (error) {
    console.error(`Error reading folder: ${error.message}`);
    return [];
  }
};
