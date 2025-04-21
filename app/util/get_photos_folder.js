import fs from 'fs';
import path from 'path';

/**
 * Reads all items from a given folder and returns an array of file paths.
 * 
 * @param {string} folderPath - The path to the folder to read.
 * @param {object} [options]
 * @param {boolean} [options.onlyFiles=false] - Whether to include only files (exclude subdirectories).
 * @param {boolean} [options.onlyImages=false] - Whether to include only common image file extensions.
 * @returns {string[]} An array of file paths in the folder.
 */
export const getFilesInFolder = (folderPath, options = {}) => {
  const { onlyFiles = false, onlyImages = false } = options;

  try {
    // 1. Check if the folder exists
    if (!fs.existsSync(folderPath)) {
      console.warn(`Folder does not exist: ${folderPath}`);
      return [];
    }

    // 2. Read all items (files/subfolders) in the directory
    const items = fs.readdirSync(folderPath);

    // 3. Build an array of absolute paths
    let paths = items.map(item => path.join(folderPath, item));

    // 4. Optional: Filter out directories if onlyFiles is true
    if (onlyFiles) {
      paths = paths.filter(itemPath => {
        const stats = fs.statSync(itemPath);
        return stats.isFile();
      });
    }

    // 5. Optional: Filter by common image file extensions if onlyImages is true
    if (onlyImages) {
      const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff','.pdf']);
      paths = paths.filter(itemPath => {
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
