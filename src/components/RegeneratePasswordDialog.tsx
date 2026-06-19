import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, Copy, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface RegeneratePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  entityName: string;
  onRegenerate: (id: string) => Promise<{ password: string }>;
}

export function RegeneratePasswordDialog({
  open,
  onOpenChange,
  entityId,
  entityName,
  onRegenerate,
}: RegeneratePasswordDialogProps) {
  const { t } = useTranslation();
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const mut = useMutation({
    mutationFn: () => onRegenerate(entityId),
    onSuccess: (data) => {
      setNewPassword(data.password);
      toast.success(t('students.passwordRegenerated'));
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t('common.notFound'));
    },
  });

  const handleClose = () => {
    setNewPassword(null);
    setShowPassword(false);
    onOpenChange(false);
  };

  const copyToClipboard = () => {
    if (newPassword) {
      navigator.clipboard.writeText(newPassword).then(() => {
        toast.success(t('common.copied'));
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            {t('students.regeneratePassword')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            {t('students.regeneratePasswordDesc', { name: entityName })}
          </p>

          {newPassword ? (
            <div className="space-y-2">
              <Label>{t('students.newPassword')}</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    readOnly
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    className="pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button type="button" variant="outline" size="icon" onClick={copyToClipboard}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t('students.savePasswordHint')}
              </p>
            </div>
          ) : (
            <Button
              className="w-full"
              onClick={() => mut.mutate()}
              disabled={mut.isPending}
            >
              <RefreshCw className={`me-2 h-4 w-4 ${mut.isPending ? 'animate-spin' : ''}`} />
              {mut.isPending
                ? t('common.loading')
                : t('students.generateNewPassword')}
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t('common.close', { defaultValue: 'Close' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
