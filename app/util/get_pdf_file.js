import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const filepath = path.resolve(__dirname, "./photos");

export async function downloadFulcrumPDF(reportId, outputFile = null) {
  try {
    // Generate unique filename with record ID to prevent overwriting
    const defaultOutputFile = `${filepath}/fulcrum_report_${reportId}.pdf`;
    const finalOutputFile = outputFile || defaultOutputFile;

    const url = `https://api.fulcrumapp.com/run/8ef6ad42-669b-40fa-807d-f8bde7b3a898?record_id=${reportId}&token=${process.env.FULCRUM_TOKEN}`;

    const response = await fetch(url, {
      headers: { "X-ApiToken": process.env.FULCRUM_TOKEN },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch PDF: ${response.status} ${response.statusText}`
      );
    }

    const nodeStream = Readable.fromWeb(response.body);

    await pipeline(nodeStream, createWriteStream(finalOutputFile));

    console.log(`✅ PDF report downloaded: ${finalOutputFile}`);
    return finalOutputFile;
  } catch (error) {
    console.error("❌ Error fetching PDF report:", error);
    throw error;
  }
}

//https://api.fulcrumapp.com/run/8ef6ad42-669b-40fa-807d-f8bde7b3a898?record_id=27160caf-a2e1-49c4-adc1-da2c6e2d2a52&token=afd6997c95b71d99b517d43db49e4aab576769c2c253b05baed5eef47097ab06f6c14ee640dd71f4
//test
//await downloadFulcrumPDF('27160caf-a2e1-49c4-adc1-da2c6e2d2a52');
