import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, X } from 'lucide-react';

interface Props {
  value?: string;
  onChange: (url: string) => void;
  initials?: string;
}

export function PhotoUpload({ value, onChange, initials = '?' }: Props) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<string>(value || '');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    onChange(file.name); // simulated - just store filename
  };

  const handleRemove = () => {
    setPreview('');
    onChange('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-16 w-16">
        <AvatarImage src={preview} />
        <AvatarFallback className="text-lg">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1">
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <Camera className="me-2 h-3 w-3" />{t('common.uploadPhoto')}
        </Button>
        {preview && (
          <Button type="button" variant="ghost" size="sm" onClick={handleRemove} className="text-destructive">
            <X className="me-1 h-3 w-3" />{t('common.removePhoto')}
          </Button>
        )}
      </div>
    </div>
  );
}
