import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScanLine, X } from 'lucide-react';
import { toast } from 'sonner';

interface ScannedEntity {
  id: string;
  type: 'students' | 'teachers' | 'managers';
}

interface AttendanceQRScannerProps {
  entityType: 'students' | 'teachers' | 'managers';
  mode: 'single' | 'bulk';
  onScanned: (ids: string[]) => void;
  trigger?: React.ReactNode;
  label?: string;
}

export function AttendanceQRScanner({ entityType, mode, onScanned, trigger, label }: AttendanceQRScannerProps) {
  const [open, setOpen] = useState(false);
  const [scannedIds, setScannedIds] = useState<string[]>([]);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<string>('att-qr-' + Math.random().toString(36).slice(2));
  const scannedIdsRef = useRef<string[]>([]);

  // Keep ref in sync
  useEffect(() => { scannedIdsRef.current = scannedIds; }, [scannedIds]);

  const stopScanner = useCallback(() => {
    scannerRef.current?.stop().catch(() => {});
    scannerRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    stopScanner();
    if (mode === 'bulk' && scannedIdsRef.current.length > 0) {
      onScanned(scannedIdsRef.current);
    }
    setScannedIds([]);
    setOpen(false);
  }, [mode, onScanned, stopScanner]);

  useEffect(() => {
    if (!open) return;

    const timeout = setTimeout(() => {
      const scanner = new Html5Qrcode(containerRef.current);
      scannerRef.current = scanner;

      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          try {
            const url = new URL(decodedText);
            const path = url.pathname;
            const match = path.match(/^[/](students|teachers|managers)[/]([^/]+)/);
            if (!match) { toast.error('Unrecognized QR code'); return; }

            const [, type, id] = match;
            if (type !== entityType) {
              toast.error(`Expected ${entityType} QR code, got ${type}`);
              return;
            }

            if (mode === 'single') {
              scanner.stop().catch(() => {});
              setOpen(false);
              onScanned([id]);
              toast.success('QR code scanned');
            } else {
              // Bulk mode — add if not already scanned
              if (!scannedIdsRef.current.includes(id)) {
                setScannedIds(prev => [...prev, id]);
                toast.success(`Scanned entity added (${scannedIdsRef.current.length + 1} total)`);
              } else {
                toast.info('Already scanned');
              }
            }
          } catch {
            toast.error('Invalid QR code');
          }
        },
        () => {}
      ).catch(() => {
        toast.error('Camera access denied or not available');
      });
    }, 300);

    return () => {
      clearTimeout(timeout);
      stopScanner();
    };
  }, [open, entityType, mode, onScanned, stopScanner]);

  const removeScanned = (id: string) => {
    setScannedIds(prev => prev.filter(x => x !== id));
  };

  return (
    <>
      <span onClick={() => setOpen(true)} className="cursor-pointer">
        {trigger || (
          <Button variant="outline" size="sm">
            <ScanLine className="mr-2 h-4 w-4" />{label || 'Scan QR'}
          </Button>
        )}
      </span>
      <Dialog open={open} onOpenChange={o => { if (!o) handleClose(); else setOpen(true); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {mode === 'single' ? 'Scan QR Code' : `Bulk Scan (${scannedIds.length} scanned)`}
            </DialogTitle>
          </DialogHeader>
          <div id={containerRef.current} className="w-full" />
          {mode === 'bulk' && scannedIds.length > 0 && (
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {scannedIds.map(id => (
                <Badge key={id} variant="secondary" className="gap-1">
                  {id}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeScanned(id)} />
                </Badge>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground text-center">
            {mode === 'single'
              ? `Point camera at a ${entityType.slice(0, -1)} QR code`
              : 'Keep scanning — each QR adds a row. Close when done.'}
          </p>
          {mode === 'bulk' && scannedIds.length > 0 && (
            <Button onClick={handleClose} className="w-full">
              Done — Add {scannedIds.length} Rows
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
