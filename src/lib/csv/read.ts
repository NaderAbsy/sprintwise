/**
 * Reads a chosen CSV file as text. Excel's "Unicode text" saves are UTF-16 with
 * a byte-order mark, which File.text() would garble, so those are decoded as
 * UTF-16; everything else is read as UTF-8.
 */
export async function readCsvFile(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const encoding =
    bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le" : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "utf-8";
  return new TextDecoder(encoding).decode(bytes);
}
