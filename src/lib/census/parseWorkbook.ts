import ExcelJS from "exceljs";

export type RawRow = (string | number | Date | undefined)[];

export type ParsedSheet = {
  name: string;
  headerRow: (string | undefined)[];
  dataRows: RawRow[];
};

function cellToValue(value: ExcelJS.CellValue): string | number | Date | undefined {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return cellToValue(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((t) => t.text).join("");
    }
  }
  return String(value);
}

function rowToValues(row: ExcelJS.Row, columnCount: number): RawRow {
  const values: RawRow = [];
  for (let i = 1; i <= columnCount; i++) {
    values.push(cellToValue(row.getCell(i).value));
  }
  return values;
}

function isHeaderLike(values: RawRow): boolean {
  const nonEmpty = values.filter((v) => v !== undefined && v !== "");
  if (nonEmpty.length < 3) return false;
  const stringCount = nonEmpty.filter((v) => typeof v === "string").length;
  return stringCount / nonEmpty.length >= 0.8;
}

export async function parseWorkbook(buffer: Buffer): Promise<ParsedSheet[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheets: ParsedSheet[] = [];

  for (const worksheet of workbook.worksheets) {
    const columnCount = Math.max(worksheet.columnCount, worksheet.actualColumnCount, 1);

    let headerRow: (string | undefined)[] | null = null;
    const dataRows: RawRow[] = [];

    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = rowToValues(row, columnCount);
      if (!headerRow) {
        if (isHeaderLike(values)) {
          headerRow = values.map((v) => (typeof v === "string" ? v.trim() : undefined));
        }
        return;
      }
      const hasData = values.some((v) => v !== undefined && v !== "");
      if (hasData) dataRows.push(values);
    });

    if (headerRow) {
      sheets.push({ name: worksheet.name, headerRow, dataRows });
    }
  }

  return sheets;
}
