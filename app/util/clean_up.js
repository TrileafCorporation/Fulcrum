import fs from 'fs';
import path from 'path';

export const clean_up_photos = async (directoryPath) => {
    try {
       
        if (!fs.existsSync(directoryPath)) {
            console.log(`Directory "${directoryPath}" does not exist. Nothing to clean up.`);
            return;
        }

       
        const files = await fs.promises.readdir(directoryPath);

        
        for (const file of files) {
            const filePath = path.join(directoryPath, file);
            try {
                await fs.promises.unlink(filePath); 
                console.log(`Deleted: ${filePath}`);
            } catch (error) {
                console.error(`Error deleting file "${filePath}":`, error.message);
            }
        }

        console.log(`Cleanup completed for directory: "${directoryPath}"`);
    } catch (error) {
        console.error(`Error during cleanup:`, error.message);
    }
};