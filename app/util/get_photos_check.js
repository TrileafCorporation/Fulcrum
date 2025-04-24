export const check_for_new_photos = async (record_id, look_up, client) => {
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
