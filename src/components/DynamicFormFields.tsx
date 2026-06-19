import { useState, useEffect } from 'react';
import type { Control } from 'react-hook-form';
import type { FieldDefinition } from '@/types';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePickerField } from '@/components/DatePickerField';
import { Label } from '@/components/ui/label';

// Mode 1: react-hook-form
interface ControlProps {
  fields: FieldDefinition[];
  control: Control<any>;
  values?: never;
  onChange?: never;
}

// Mode 2: standalone values/onChange
interface StandaloneProps {
  fields: FieldDefinition[];
  control?: never;
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
}

type Props = ControlProps | StandaloneProps;

export function DynamicFormFields(props: Props) {
  const visibleFields = [...props.fields].filter(f => f.visible).sort((a, b) => a.order - b.order);

  if (props.control) {
    return (
      <>
        {visibleFields.map(field => (
          <ControlledDynamicField key={field.name} field={field} control={props.control} />
        ))}
      </>
    );
  }

  // Standalone mode
  return (
    <>
      {visibleFields.map(field => (
        <StandaloneDynamicField
          key={field.name}
          field={field}
          value={props.values[field.name] ?? ''}
          onChange={(val) => props.onChange({ ...props.values, [field.name]: val })}
        />
      ))}
    </>
  );
}

// ---- Standalone field (no react-hook-form) ----
function StandaloneDynamicField({ field, value, onChange }: { field: FieldDefinition; value: any; onChange: (v: any) => void }) {
  switch (field.type) {
    case 'text':
    case 'email':
    case 'phone':
    case 'number':
      return (
        <div className="space-y-2">
          <Label>{field.label}{field.required && ' *'}</Label>
          <Input
            type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : 'text'}
            placeholder={field.placeholder || ''}
            value={value ?? ''}
            onChange={e => onChange(e.target.value)}
          />
        </div>
      );
    case 'date':
      return (
        <div className="space-y-2">
          <Label>{field.label}{field.required && ' *'}</Label>
          <DatePickerField value={value ?? ''} onChange={onChange} placeholder={field.placeholder || 'Pick a date'} />
        </div>
      );
    case 'textarea':
      return (
        <div className="space-y-2">
          <Label>{field.label}{field.required && ' *'}</Label>
          <Textarea placeholder={field.placeholder || ''} value={value ?? ''} onChange={e => onChange(e.target.value)} />
        </div>
      );
    case 'select':
      return (
        <div className="space-y-2">
          <Label>{field.label}{field.required && ' *'}</Label>
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger><SelectValue placeholder={field.placeholder || 'Select...'} /></SelectTrigger>
            <SelectContent>
              {field.options?.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case 'multi-select':
      return (
        <div className="space-y-2">
          <Label>{field.label}{field.required && ' *'}</Label>
          <div className="space-y-2 rounded-md border p-3 max-h-40 overflow-auto">
            {field.options?.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={(value || []).includes(opt.value)}
                  onCheckedChange={(checked) => {
                    const val = value || [];
                    onChange(checked ? [...val, opt.value] : val.filter((v: string) => v !== opt.value));
                  }}
                />
                {opt.label}
              </label>
            ))}
            {(!field.options || field.options.length === 0) && (
              <p className="text-sm text-muted-foreground">No options configured</p>
            )}
          </div>
        </div>
      );
    case 'file':
      return (
        <div className="space-y-2">
          <Label>{field.label}{field.required && ' *'}</Label>
          <Input type="file" onChange={(e) => onChange(e.target.files?.[0]?.name || '')} />
        </div>
      );
    default:
      return null;
  }
}

// ---- Controlled field (react-hook-form) ----
function ControlledDynamicField({ field, control }: { field: FieldDefinition; control: Control<any> }) {
  switch (field.type) {
    case 'text':
    case 'email':
    case 'phone':
    case 'number':
      return (
        <FormField control={control} name={field.name} render={({ field: f }) => (
          <FormItem>
            <FormLabel>{field.label}{field.required && ' *'}</FormLabel>
            <FormControl>
              <Input
                type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : 'text'}
                placeholder={field.placeholder || ''}
                {...f}
                value={f.value ?? ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      );
    case 'date':
      return (
        <FormField control={control} name={field.name} render={({ field: f }) => (
          <FormItem>
            <FormLabel>{field.label}{field.required && ' *'}</FormLabel>
            <FormControl>
              <DatePickerField value={f.value ?? ''} onChange={f.onChange} placeholder={field.placeholder || 'Pick a date'} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      );
    case 'textarea':
      return (
        <FormField control={control} name={field.name} render={({ field: f }) => (
          <FormItem>
            <FormLabel>{field.label}{field.required && ' *'}</FormLabel>
            <FormControl>
              <Textarea placeholder={field.placeholder || ''} {...f} value={f.value ?? ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      );
    case 'select':
      return (
        <FormField control={control} name={field.name} render={({ field: f }) => (
          <FormItem>
            <FormLabel>{field.label}{field.required && ' *'}</FormLabel>
            <Select onValueChange={f.onChange} value={f.value || ''}>
              <FormControl>
                <SelectTrigger><SelectValue placeholder={field.placeholder || 'Select...'} /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {field.options?.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
      );
    case 'multi-select':
      return (
        <FormField control={control} name={field.name} render={({ field: f }) => (
          <FormItem>
            <FormLabel>{field.label}{field.required && ' *'}</FormLabel>
            <div className="space-y-2 rounded-md border p-3 max-h-40 overflow-auto">
              {field.options?.map(opt => (
                <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={(f.value || []).includes(opt.value)}
                    onCheckedChange={(checked) => {
                      const val = f.value || [];
                      f.onChange(checked ? [...val, opt.value] : val.filter((v: string) => v !== opt.value));
                    }}
                  />
                  {opt.label}
                </label>
              ))}
              {(!field.options || field.options.length === 0) && (
                <p className="text-sm text-muted-foreground">No options configured</p>
              )}
            </div>
            <FormMessage />
          </FormItem>
        )} />
      );
    case 'file':
      return (
        <FormField control={control} name={field.name} render={({ field: f }) => (
          <FormItem>
            <FormLabel>{field.label}{field.required && ' *'}</FormLabel>
            <FormControl>
              <Input type="file" onChange={(e) => f.onChange(e.target.files?.[0]?.name || '')} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      );
    default:
      return null;
  }
}
