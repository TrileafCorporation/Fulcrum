export const get_photo_ids = async (client) => {
  const look_up_array = [];

  try {
    const page = await client.records.all({
      form_id: process.env.FULCRUM_FORM_LOOK_UP,
    });

    page.objects.forEach((record) => {
      // Ensure that form_values and the specific key exist
      if (record.form_values && record.form_values["2426"]) {
        look_up_array.push(record.form_values["2426"]);
      } else {
        console.warn(`Record ${record.id} is missing form_values["2426"]`);
      }
    });

    return look_up_array;
  } catch (error) {
    console.error("Error fetching photo IDs:", error.message);
    // Depending on your use case, you might want to rethrow the error or return a default value
    throw error; // or return [];
  }
};
