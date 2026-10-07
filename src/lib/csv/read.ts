const SAVE_AS_CSV: Record<string, string> = {
  numbers: "a Numbers spreadsheet. In Numbers, choose File → Export To → CSV…, then use the exported file.",
  excel: 'an Excel workbook. In Excel, choose File → Save As and pick "CSV UTF-8 (Comma delimited)", then use that file.',
  zip: "a compressed file. Export the backlog from Jira (or your spreadsheet app) as CSV, then use that file.",
  binary: "not a text file. Export the backlog from Jira (or your spreadsheet app) as CSV, then use that file.",
};

/**
 * What kind of spreadsheet a file really is, whatever its name says. Numbers
 * and Excel files are zip archives ("PK"), old Excel files start with an OLE
 * signature, and other binary files have zero bytes in their first kilobyte.
 */
export function spreadsheetKind(bytes: Uint8Array): keyof typeof SAVE_AS_CSV | null {
  const utf16 = (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff);
  if (utf16) return null;
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    // Zip entry names are plain ASCII near the start: Numbers keeps "Index/…iwa", Excel keeps "xl/…".
    const head = new TextDecoder("latin1").decode(bytes.subarray(0, 64 * 1024));
    if (head.includes("Index/") || head.includes(".iwa")) return "numbers";
    if (head.includes("xl/") || head.includes("[Content_Types].xml")) return "excel";
    return "zip";
  }
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) return "excel";
  if (bytes.subarray(0, 1024).includes(0)) return "binary";
  return null;
}

/**
 * Reads a chosen CSV file as text. Excel's "Unicode text" saves are UTF-16 with
 * a byte-order mark, which File.text() would garble, so those are decoded as
 * UTF-16; everything else is read as UTF-8. A spreadsheet saved with a .csv
 * name is turned away with how to export a real CSV.
 */
export async function readCsvFile(file: Blob & { name?: string }): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = spreadsheetKind(bytes);
  if (kind) return { ok: false, message: `${file.name ?? "This file"} isn't a CSV, even if its name ends in .csv: it's ${SAVE_AS_CSV[kind]}` };
  const encoding =
    bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le" : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "utf-8";
  return { ok: true, text: new TextDecoder(encoding).decode(bytes) };
}
