import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScanLine } from 'lucide-react';
import { toast } from 'sonner';

export function QRScanner() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<string>('qr-reader-' + Math.random().toString(36).slice(2));

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
            if (/^\/(students|teachers|managers)\//.test(path)) {
              scanner.stop().catch(() => {});
              setOpen(false);
              navigate(path);
              toast.success('QR code scanned successfully');
            } else {
              toast.error('Unrecognized QR code');
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
      scannerRef.current?.stop().catch(() => {});
      scannerRef.current = null;
    };
  }, [open, navigate]);

  return (
    <>
      <Button variant="outline" size="icon" onClick={() => setOpen(true)} title="Scan QR Code">
        <ScanLine className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={(o) => { if (!o) scannerRef.current?.stop().catch(() => {}); setOpen(o); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Scan QR Code</DialogTitle></DialogHeader>
          <div id={containerRef.current} className="w-full" />
          <p className="text-xs text-muted-foreground text-center">Point camera at a student, teacher, or manager QR code</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
