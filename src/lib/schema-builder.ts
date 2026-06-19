import { z } from 'zod';
import type { FieldDefinition } from '@/types';

export function buildDynamicSchema(fields: FieldDefinition[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  fields.filter(f => f.visible).forEach(field => {
    switch (field.type) {
      case 'email':
        shape[field.name] = field.required
          ? z.string().min(1, `${field.label} is required`).email('Invalid email')
          : z.string().email('Invalid email').or(z.literal('')).optional();
        break;
      case 'multi-select':
        shape[field.name] = field.required
          ? z.array(z.string()).min(1, 'Select at least one')
          : z.array(z.string()).optional();
        break;
      default:
        shape[field.name] = field.required
          ? z.string().min(1, `${field.label} is required`)
          : z.string().optional();
    }
  });
  return shape;
}

export function getDynamicDefaults(fields: FieldDefinition[], existing?: Record<string, any>) {
  const defaults: Record<string, any> = {};
  fields.filter(f => f.visible).forEach(f => {
    defaults[f.name] = existing?.[f.name] ?? f.defaultValue ?? (f.type === 'multi-select' ? [] : '');
  });
  return defaults;
}
