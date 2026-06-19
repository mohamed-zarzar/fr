import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { buildDynamicSchema, getDynamicDefaults } from '@/lib/schema-builder';
import { generatePassword } from '@/lib/utils';
import type { Student, FieldDefinition } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DynamicFormFields } from '@/components/DynamicFormFields';
import { PhotoUpload } from '@/components/PhotoUpload';
import { InlineParentCreate } from '@/components/InlineCreateDialog';
import { LevelSelect } from '@/components/selects/LevelSelect';
import { ClassSelect } from '@/components/selects/ClassSelect';
import { ParentSelect } from '@/components/selects/ParentSelect';

interface StudentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Student | null;
  fields: FieldDefinition[];
  isSubmitting: boolean;
  onSubmit: (data: any) => void;
}

export function StudentFormDialog({
  open,
  onOpenChange,
  editing,
  fields,
  isSubmitting,
  onSubmit,
}: StudentFormDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const dynamicSchema = buildDynamicSchema(fields);
  const schema = z
    .object({
      firstname: z.string().min(1, t('common.required')),
      lastname: z.string().min(1, t('common.required')),
      levelId: z.string().min(1, t('common.required')),
      classId: z.string().optional(),
      parentIds: z.array(z.string()).optional(),
      defaultParentId: z.string().optional(),
      parentRelations: z.record(z.string()).optional(),
      photo: z.string().optional(),
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
      if (!editing && data.password && data.password.length > 0 && data.password.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('auth.passwordMin', { defaultValue: 'Password must be at least 8 characters' }),
          path: ['password'],
        });
      }
    });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      firstname: '',
      lastname: '',
      levelId: '',
      classId: '',
      parentIds: [] as string[],
      defaultParentId: '',
      parentRelations: {} as Record<string, string>,
      photo: '',
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
        levelId: editing?.levelId || '',
        classId: editing?.classId || '',
        parentIds: editing?.parentIds || [],
        defaultParentId: editing?.defaultParentId || '',
        parentRelations: editing?.parentRelations || {},
        photo: editing?.dynamicFields?.photo || '',
        code: editing?.code != null ? String(editing.code) : '',
        password: '',
        ...getDynamicDefaults(fields, editing?.dynamicFields),
      });
    }
  }, [open, editing, fields, form]);

  const watchLevel = form.watch('levelId');

  const handleSubmit = (data: any) => {
    const { firstname, lastname, levelId, classId, parentIds, defaultParentId, parentRelations, photo, code, password, ...rest } = data;
    const payload: Record<string, unknown> = {
      firstname,
      lastname,
      levelId,
      classId,
      parentIds,
      defaultParentId,
      parentRelations,
      dynamicFields: { ...rest, photo },
    };
    if (!editing && code?.trim()) {
      const n = Number.parseInt(code.trim(), 10);
      if (Number.isFinite(n) && n >= 1) payload.code = n;
    }
    if (!editing && password) payload.password = password;
    onSubmit(payload);
  };

  const handleParentCreated = (id: string) => {
    const current = form.getValues('parentIds') || [];
    if (!current.includes(id)) {
      form.setValue('parentIds', [...current, id]);
    }
    qc.invalidateQueries({ queryKey: ['parents'] });
  };

  const levelRequired = useMemo(
    () => (editing?.levelId ? [editing.levelId] : []),
    [editing?.levelId],
  );
  const classRequired = useMemo(
    () => (editing?.classId ? [editing.classId] : []),
    [editing?.classId],
  );
  const parentRequired = useMemo(() => editing?.parentIds ?? [], [editing?.parentIds]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t('students.editStudent') : t('students.addStudent')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="photo"
              render={({ field }) => (
                <FormItem>
                  <PhotoUpload
                    value={field.value}
                    onChange={field.onChange}
                    initials={
                      (form.watch('firstname')?.[0] || '') + (form.watch('lastname')?.[0] || '')
                    }
                  />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.firstName')} *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
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
                    <FormControl><Input {...field} /></FormControl>
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
                    <FormLabel>{t('auth.password', { defaultValue: 'Password' })}</FormLabel>
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="levelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.level')} *</FormLabel>
                    <FormControl>
                      <LevelSelect
                        value={field.value}
                        onChange={(v) => {
                          field.onChange(v);
                          form.setValue('classId', '');
                        }}
                        requiredResult={levelRequired}
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="classId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('students.class')}</FormLabel>
                    <FormControl>
                      <ClassSelect
                        value={field.value || ''}
                        onChange={field.onChange}
                        levelId={watchLevel || undefined}
                        requiredResult={classRequired}
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="parentIds"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>{t('nav.parents')}</FormLabel>
                    <InlineParentCreate onCreated={handleParentCreated} />
                  </div>
                  <FormControl>
                    <ParentSelect
                      value={field.value || []}
                      onChange={field.onChange}
                      requiredResult={parentRequired}
                      seedParents={editing?.parents}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
