import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QrCode } from 'lucide-react';

interface Props {
  entityType: 'students' | 'teachers' | 'managers';
  entityId: string;
  entityName: string;
}

export function QRCodeDisplay({ entityType, entityId, entityName }: Props) {
  const [open, setOpen] = useState(false);
  const url = `${window.location.origin}/${entityType}/${entityId}`;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <QrCode className="mr-2 h-4 w-4" />QR Code
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>QR Code — {entityName}</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <QRCodeSVG value={url} size={200} level="M" />
            <p className="text-xs text-muted-foreground text-center break-all">{url}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
