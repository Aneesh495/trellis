/**
 * CLI convert command facilitating lossless format conversions across .csv, .json, and .trellis.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Workbook, BinaryCodec, JsonCodec, CsvCodec } from "@trellis/storage";

export interface ConvertOptions {
  inputPath: string;
  outputPath: string;
}

export function runConvertCommand(options: ConvertOptions): { success: boolean; message: string } {
  if (!fs.existsSync(options.inputPath)) {
    throw new Error(`Input file does not exist: ${options.inputPath}`);
  }

  const inExt = path.extname(options.inputPath).toLowerCase();
  const outExt = path.extname(options.outputPath).toLowerCase();

  let workbook: Workbook;

  // Load input
  if (inExt === ".trellis") {
    const bytes = fs.readFileSync(options.inputPath);
    workbook = BinaryCodec.deserialize(new Uint8Array(bytes));
  } else if (inExt === ".json") {
    const text = fs.readFileSync(options.inputPath, "utf8");
    workbook = JsonCodec.deserialize(text);
  } else if (inExt === ".csv" || inExt === ".tsv") {
    const text = fs.readFileSync(options.inputPath, "utf8");
    workbook = new Workbook("Sheet1");
    const delimiter = inExt === ".tsv" ? "\t" : ",";
    CsvCodec.deserialize(text, workbook.activeSheet, delimiter);
  } else {
    throw new Error(`Unsupported input format: ${inExt}`);
  }

  // Save output
  if (outExt === ".trellis") {
    const bytes = BinaryCodec.serialize(workbook);
    fs.writeFileSync(options.outputPath, bytes);
  } else if (outExt === ".json") {
    const text = JsonCodec.serialize(workbook, true);
    fs.writeFileSync(options.outputPath, text, "utf8");
  } else if (outExt === ".csv" || outExt === ".tsv") {
    const delimiter = outExt === ".tsv" ? "\t" : ",";
    const text = CsvCodec.serialize(workbook.activeSheet, delimiter);
    fs.writeFileSync(options.outputPath, text, "utf8");
  } else {
    throw new Error(`Unsupported output format: ${outExt}`);
  }

  return {
    success: true,
    message: `Successfully converted ${options.inputPath} to ${options.outputPath}`
  };
}
