export const get_photo_ids = async (client, recordId) => {
  let look_up_array = [];

  try {
    let query = `SELECT photo_id FROM "${process.env.FULCRUM_FORM_LOOK_UP}" WHERE record_id = '${recordId}'`;
    let queryResults = await client.query(query, 'json')
    if (queryResults && queryResults.rows) {
      look_up_array = queryResults.rows.map(row => row.photo_id);
    }
    return look_up_array;

  } catch (error) {
    console.error("Error fetching photo IDs:", error.message);
    // Depending on your use case, you might want to rethrow the error or return a default value
    throw error; // or return [];
  }
};
