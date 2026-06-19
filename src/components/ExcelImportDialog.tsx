import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Loader2 } from 'lucide-react';
import { parseExcelFile } from '@/lib/excel-utils';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export type StudentImportRowIssue = { row: number; errors: string[] };

type PropsBase = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  expectedColumns: string[];
  isImporting?: boolean;
  importErrors?: StudentImportRowIssue[];
  /** Called after a new file is parsed successfully or preview is cleared — e.g. reset server error state. */
  onDismissImportErrors?: () => void;
};

export type ExcelImportDialogProps =
  | (PropsBase & {
      /** Default: parse client-side and pass rows to parent (legacy). */
      importTarget?: 'rows';
      onImport: (rows: Record<string, string>[]) => void;
    })
  | (PropsBase & {
      importTarget: 'file';
      onImport: (file: File) => void;
    });

export function ExcelImportDialog(props: ExcelImportDialogProps) {
  const {
    open,
    onOpenChange,
    onImport,
    expectedColumns,
    isImporting = false,
    importErrors,
    onDismissImportErrors,
  } = props;
  const fileMode = props.importTarget === 'file';

  const { t } = useTranslation();
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setRows([]);
      setColumns([]);
      setSelectedFile(null);
    }
  }, [open]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    try {
      const data = await parseExcelFile(file);
      if (data.length === 0) {
        toast.error(t('import.emptyFile'));
        setSelectedFile(null);
        return;
      }
      setColumns(Object.keys(data[0]));
      setRows(data);
      onDismissImportErrors?.();
    } catch {
      toast.error(t('import.parseFailed'));
      setSelectedFile(null);
      setRows([]);
      setColumns([]);
    }
    e.target.value = '';
  };

  const clearPreview = () => {
    setRows([]);
    setColumns([]);
    setSelectedFile(null);
    onDismissImportErrors?.();
  };

  const handleImport = () => {
    if (fileMode) {
      if (!selectedFile) return;
      (onImport as (file: File) => void)(selectedFile);
      return;
    }
    (onImport as (rows: Record<string, string>[]) => void)(rows);
    clearPreview();
    onOpenChange(false);
  };

  const resetOnClose = (o: boolean) => {
    if (!o) {
      clearPreview();
    }
    onOpenChange(o);
  };

  const importDisabled =
    fileMode ? isImporting || !selectedFile : isImporting || rows.length === 0;

  return (
    <Dialog open={open} onOpenChange={resetOnClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('import.fromExcel')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              {t('import.expectedColumns')}: {expectedColumns.join(', ')}
            </p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
            <Button variant="outline" type="button" onClick={() => fileRef.current?.click()} disabled={isImporting}>
              <Upload className="me-2 h-4 w-4" />
              {t('import.selectFile')}
            </Button>
          </div>

          {fileMode && importErrors && importErrors.length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 space-y-2">
              <p className="text-sm font-medium text-destructive">
                {t('import.validationErrors')}
              </p>
              <ScrollArea className="max-h-40">
                <ul className="text-sm space-y-2 pe-2">
                  {importErrors.map((issue) => (
                    <li key={issue.row}>
                      <span className="font-medium">
                        {t('import.rowLabel')} {issue.row}:
                      </span>{' '}
                      {issue.errors.join('; ')}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}

          {rows.length > 0 && (
            <>
              <div className="rounded-md border overflow-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>{columns.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 10).map((row, i) => (
                      <TableRow key={i}>
                        {columns.map((c) => (
                          <TableCell key={c}>{row[c]}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('import.showingRows', {
                  from: Math.min(10, rows.length),
                  total: rows.length,
                })}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={clearPreview} disabled={isImporting}>
                  {t('common.clear')}
                </Button>
                <Button type="button" onClick={handleImport} disabled={importDisabled}>
                  {isImporting ? (
                    <>
                      <Loader2 className="me-2 h-4 w-4 animate-spin" />
                      {t('common.loading')}
                    </>
                  ) : (
                    t('import.importNRows', { count: rows.length })
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
