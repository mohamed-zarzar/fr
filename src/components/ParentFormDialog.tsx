import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { buildDynamicSchema, getDynamicDefaults } from '@/lib/schema-builder';
import { generatePassword } from '@/lib/utils';
import type { Parent, FieldDefinition } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DynamicFormFields } from '@/components/DynamicFormFields';

export interface ParentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Parent | null;
  fields: FieldDefinition[];
  isSubmitting: boolean;
  onSubmit: (payload: Partial<Parent> & { password?: string }) => void;
  /** i18n label for the entity, e.g. t('common.parent') */
  title?: string;
}

export function ParentFormDialog({
  open,
  onOpenChange,
  editing,
  fields,
  isSubmitting,
  onSubmit,
  title,
}: ParentFormDialogProps) {
  const { t } = useTranslation();
  const entityTitle = title ?? t('common.parent');

  const schema = useMemo(() => {
    const dynamicSchema = buildDynamicSchema(fields);
    return z
      .object({
        firstname: z.string().min(1, t('common.required')),
        lastname: z.string().min(1, t('common.required')),
        code: z.string().optional(),
        password: z.string().optional(),
        ...dynamicSchema,
      })
      .superRefine((data, ctx) => {
        if (!editing && data.code?.trim()) {
          const n = Number.parseInt(data.code.trim(), 10);
          if (!Number.isFinite(n) || n < 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t('common.invalidNumber'),
              path: ['code'],
            });
          }
        }
        if (!editing) {
          if (!data.password || data.password.length < 8) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t('auth.passwordMin', {
                defaultValue: 'Password must be at least 8 characters',
              }),
              path: ['password'],
            });
          }
        }
      });
  }, [fields, editing, t]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      firstname: '',
      lastname: '',
      code: '',
      password: '',
      ...getDynamicDefaults(fields),
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        firstname: editing?.firstname || '',
        lastname: editing?.lastname || '',
        code: editing?.code != null ? String(editing.code) : '',
        password: '',
        ...getDynamicDefaults(fields, editing?.dynamicFields),
      });
    }
  }, [open, editing, fields, form]);

  const handleSubmit = (data: Record<string, unknown>) => {
    const { firstname, lastname, code, password, ...rest } = data;
    const payload: Record<string, unknown> = {
      firstname,
      lastname,
      studentIds: editing?.studentIds || [],
      dynamicFields: rest,
    };
    if (!editing && code && String(code).trim()) {
      const n = Number.parseInt(String(code).trim(), 10);
      if (Number.isFinite(n) && n >= 1) payload.code = n;
    }
    if (!editing && password && String(password).length >= 8) {
      payload.password = String(password);
    }
    onSubmit(payload as Partial<Parent> & { password?: string });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? `${t('common.edit')} ${entityTitle}` : `${t('common.add')} ${entityTitle}`}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.firstName')} *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.lastName')} *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {!editing && (
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.code')}</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        placeholder={t('students.codeOptionalHint')}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">{t('students.codeOptionalHint')}</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {!editing && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.password', { defaultValue: 'Password' })} *</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input type="text" autoComplete="new-password" className="flex-1" {...field} />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => form.setValue('password', generatePassword())}
                        title={t('common.generatePassword')}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <DynamicFormFields fields={fields} control={form.control} />
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('common.loading') : editing ? t('common.update') : t('common.create')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
