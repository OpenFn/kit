import { request } from 'undici';
import { SetOptions } from '../collections/command';

/**
 * A simple CSV parser that converts CSV text into a 2D array.
 * This implementation splits on newline and commas and then sanitizes each cell
 * by trimming whitespace and removing extraneous surrounding quotes.
 *
 * @param csvText - The CSV text.
 * @returns A 2D array representing the rows and cells of the CSV.
 */
function parseCSV(csvText: string): string[][] {
  return csvText
    .split('\n')
    .filter(Boolean)
    .map(row => row.split(',').map(cell => sanitizeCell(cell)));
}

/**
 * Removes surrounding quotes from a cell value if present.
 * For example: '"GB"' becomes 'GB'
 *
 * @param cell - The cell value to sanitize.
 * @returns The sanitized cell value.
 */
function sanitizeCell(cell: string): string {
  const trimmed = cell.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.substring(1, trimmed.length - 1);
  }
  return trimmed;
}

/**
 * Retrieves values from a public Google Sheet.
 * This function constructs its own URL to fetch the CSV export of a public sheet.
 *
 * @param spreadsheetId - The ID of the Google Sheet.
 * @param range - The range of cells to fetch (ignored in this simple implementation).
 * @param worksheetName - (Optional) The worksheet name (defaults to "Sheet1").
 * @returns A promise that resolves to a 2D array of cell values.
 */
export async function getPublicSheetValues(
  spreadsheetId: string,
  range: string,
  worksheetName: string = 'Sheet1'
): Promise<string[][]> {
  // Construct the CSV export URL for the public Google Sheet.
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
    worksheetName
  )}`;

  // Use undici's request to fetch the CSV data.
  const { statusCode, body } = await request(url);
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`Failed to fetch public Google Sheet: Status code ${statusCode}`);
  }

  // Read the response body as text.
  const csvText = await body.text();
  const data = parseCSV(csvText);

  // In this simple implementation, the entire CSV is returned.
  // If you need to support a specific range, you could slice or filter the data here.
  return data;
}

/**
 * Parses a Google Sheet into a mapping.
 *
 * @param sheetId - The Google Sheet ID or URL.
 * @param options - Options for parsing:
 *   - range: The range to fetch (default: 'A1:Z'). (Ignored: we fetch the entire sheet.)
 *   - nested: If true, creates nested objects from each row (using all columns except the key column).
 *             If false, uses a single value from a specified value column.
 *   - keyColumn: The column to use as key (either index or header name).
 *   - valueColumn: (Required if nested is false) The column to use as value (either index or header name).
 *   - worksheetName: Optional worksheet name.
 *
 * @returns A promise that resolves to the mapping object.
 */
export async function parseGoogleSheet(
  sheetId: string,
  options: Partial<SetOptions>
): Promise<Record<string, any>> {
  // Fetch sheet data using our custom function.
  const sheetData = await getPublicSheetValues(sheetId, options.range || 'A1:Z', options.worksheetName || 'Sheet1');
  if (!sheetData || sheetData.length === 0) {
    throw new Error('No data found in the specified sheet.');
  }

  // Assume the first row contains headers.
  const headers = sheetData[0];
  const rows = sheetData.slice(1);

  // Determine the key column index.
  let keyIndex: number;
  if (typeof options.keyColumn === 'number') {
    keyIndex = options.keyColumn;
  } else {
    keyIndex = headers.indexOf(options.keyColumn as string);
    if (keyIndex === -1) {
      throw new Error(`Key column "${options.keyColumn}" not found in headers.`);
    }
  }

  // For non-nested mappings, determine the value column index.
  let valueIndex: number | undefined;
  if (!options.nested) {
    if (typeof options.valueColumn === 'number') {
      valueIndex = options.valueColumn;
    } else if (typeof options.valueColumn === 'string') {
      valueIndex = headers.indexOf(options.valueColumn);
      if (valueIndex === -1) {
        throw new Error(`Value column "${options.valueColumn}" not found in headers.`);
      }
    } else {
      throw new Error('A value column must be provided if nested mapping is disabled.');
    }
  }

  const mapping: Record<string, any> = {};

  // Process each data row.
  rows.forEach((row: any) => {
    // Sanitize the key.
    const rawKey = row[keyIndex];
    const key = rawKey ? sanitizeCell(rawKey) : undefined;
    if (!key) {
      // Skip rows without a valid key.
      return;
    }

    if (options.nested) {
      // Build a nested object for this row using all columns except the key column.
      const record: Record<string, any> = {};
      headers.forEach((header: any, idx: number) => {
        if (idx !== keyIndex) {
          // Sanitize both header and value.
          const sanitizedHeader = sanitizeCell(header);
          record[sanitizedHeader] = row[idx] !== undefined ? sanitizeCell(row[idx]) : null;
        }
      });
      mapping[key] = record;
    } else {
      // Use only the specified value column, sanitizing the value.
      mapping[key] = row[valueIndex!] !== undefined ? sanitizeCell(row[valueIndex!]) : null;
    }
  });

  console.log(mapping);
  return mapping;
}
