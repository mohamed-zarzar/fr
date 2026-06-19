import * as XLSX from 'xlsx';
import type { Column } from '@/components/DataTable';

export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  columns: Column<T>[],
  filename: string
) {
  const rows = data.map(item =>
    Object.fromEntries(
      columns.map(col => [
        col.label,
        col.render ? stripHtml(String(col.render(item))) : String(item[col.key] ?? ''),
      ])
    )
  );
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

export function parseExcelFile(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
