import type { FieldDefinition } from '@/types';

interface Props {
  fields: FieldDefinition[];
  data: Record<string, any>;
}

export function DynamicView({ fields, data }: Props) {
  const visibleFields = [...fields].filter(f => f.visible).sort((a, b) => a.order - b.order);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {visibleFields.map(field => (
        <div key={field.name} className="space-y-1">
          <p className="text-sm text-muted-foreground">{field.label}</p>
          <p className="font-medium">{renderValue(field, data[field.name])}</p>
        </div>
      ))}
    </div>
  );
}

function renderValue(field: FieldDefinition, value: any): string {
  if (value === undefined || value === null || value === '') return '—';
  switch (field.type) {
    case 'select':
      return field.options?.find(o => o.value === value)?.label || String(value);
    case 'multi-select':
      return Array.isArray(value)
        ? value.map(v => field.options?.find(o => o.value === v)?.label || v).join(', ') || '—'
        : String(value);
    default:
      return String(value);
  }
}
