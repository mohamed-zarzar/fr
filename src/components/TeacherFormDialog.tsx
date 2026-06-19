import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, PlusCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { buildDynamicSchema, getDynamicDefaults } from '@/lib/schema-builder';
import { generatePassword } from '@/lib/utils';
import type { Teacher, FieldDefinition } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { DynamicFormFields } from '@/components/DynamicFormFields';
import { InlineSubjectCreate } from '@/components/InlineCreateDialog';
import { PhotoUpload } from '@/components/PhotoUpload';
import { SubjectSelect } from '@/components/selects/SubjectSelect';
import { ClassSelect } from '@/components/selects/ClassSelect';

export interface TeacherFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Teacher | null;
  fields: FieldDefinition[];
  isSubmitting: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
}

export function TeacherFormDialog({
  open,
  onOpenChange,
  editing,
  fields,
  isSubmitting,
  onSubmit,
}: TeacherFormDialogProps) {
  const { t } = useTranslation();
  const [subjectLabelById, setSubjectLabelById] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const m: Record<string, string> = {};
    for (const s of editing?.subjects ?? []) {
      m[s.id] = s.name;
    }
    setSubjectLabelById(m);
  }, [open, editing?.id, editing?.subjects]);

  const dynamicSchema = buildDynamicSchema(fields);
  const schema = z
    .object({
      firstname: z.string().min(1, t('common.required')),
      lastname: z.string().min(1, t('common.required')),
      subjectIds: z.array(z.string()).optional(),
      classAssignments: z
        .array(
          z.object({
            classId: z.string().min(1, t('common.required')),
            subjectIds: z.array(z.string()).min(1, t('common.required')),
          }),
        )
        .optional(),
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
          message: t('auth.passwordMin'),
          path: ['password'],
        });
      }
    });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      firstname: '',
      lastname: '',
      subjectIds: [] as string[],
      classAssignments: [] as { classId: string; subjectIds: string[] }[],
      photo: '',
      code: '',
      password: '',
      ...getDynamicDefaults(fields),
    },
  });

  const { fields: assignmentFields, append, remove } = useFieldArray({ control: form.control, name: 'classAssignments' });
  const selectedSubjectIds: string[] = form.watch('subjectIds') || [];

  const subjectRequired = useMemo(() => editing?.subjectIds ?? [], [editing?.subjectIds]);

  const labelForSubject = (sid: string) => subjectLabelById[sid] ?? sid;

  useEffect(() => {
    if (open) {
      form.reset({
        firstname: editing?.firstname || '',
        lastname: editing?.lastname || '',
        subjectIds: editing?.subjectIds || [],
        classAssignments: editing?.classAssignments || [],
        photo: editing?.dynamicFields?.photo || '',
        code: editing?.code != null ? String(editing.code) : '',
        password: '',
        ...getDynamicDefaults(fields, editing?.dynamicFields),
      });
    }
  }, [open, editing, fields, form]);

  const handleSubmit = (data: Record<string, unknown>) => {
    const { firstname, lastname, subjectIds, classAssignments, photo, code, password, ...rest } = data;
    const payload: Record<string, unknown> = {
      firstname,
      lastname,
      subjectIds,
      classAssignments: classAssignments || [],
      dynamicFields: { ...rest, photo },
    };
    if (!editing && typeof code === 'string' && code.trim()) {
      const n = Number.parseInt(code.trim(), 10);
      if (Number.isFinite(n) && n >= 1) payload.code = n;
    }
    if (!editing && password && String(password).length >= 8) payload.password = String(password);
    onSubmit(payload);
  };

  const assignedClassIds = (form.watch('classAssignments') || []).map((a: { classId: string }) => a.classId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t('teachers.editTeacher') : t('teachers.addTeacher')}</DialogTitle>
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
                    initials={(form.watch('firstname')?.[0] || '') + (form.watch('lastname')?.[0] || '')}
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
                        placeholder={t('teachers.codeOptionalHint')}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">{t('teachers.codeOptionalHint')}</p>
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
                    <FormLabel>{t('auth.password')}</FormLabel>
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
            <FormField
              control={form.control}
              name="subjectIds"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>{t('nav.subjects')}</FormLabel>
                    <InlineSubjectCreate
                      onCreated={(id) => {
                        field.onChange([...(field.value || []), id]);
                        setSubjectLabelById((prev) => ({ ...prev, [id]: id }));
                      }}
                    />
                  </div>
                  <FormControl>
                    <SubjectSelect
                      value={field.value || []}
                      onChange={field.onChange}
                      requiredResult={subjectRequired}
                      className="w-full"
                      onSubjectLabelResolved={(id, label) =>
                        setSubjectLabelById((prev) => ({ ...prev, [id]: label }))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel>{t('common.classAssignments')}</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ classId: '', subjectIds: [] })}
                  disabled={selectedSubjectIds.length === 0}
                >
                  <PlusCircle className="me-1 h-4 w-4" />
                  {t('teachers.addClassAssignment')}
                </Button>
              </div>
              {selectedSubjectIds.length === 0 && (
                <p className="text-xs text-muted-foreground">{t('teachers.selectSubjectsFirst')}</p>
              )}
              {assignmentFields.map((af, index) => {
                const currentClassId = form.watch(`classAssignments.${index}.classId`);
                const disabledClassIds = assignedClassIds.filter((id: string) => id && id !== currentClassId);
                const classRequired = editing?.classAssignments?.[index]?.classId
                  ? [editing.classAssignments[index].classId]
                  : currentClassId
                    ? [currentClassId]
                    : [];
                return (
                  <div key={af.id} className="rounded-md border p-3 space-y-3 relative">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 end-1 h-6 w-6"
                      onClick={() => remove(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <FormField
                      control={form.control}
                      name={`classAssignments.${index}.classId`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">{t('students.class')}</FormLabel>
                          <FormControl>
                            <ClassSelect
                              value={field.value || ''}
                              onChange={field.onChange}
                              requiredResult={classRequired}
                              disabledIds={disabledClassIds}
                              className="w-full"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`classAssignments.${index}.subjectIds`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">{t('teachers.subjectsForClass')}</FormLabel>
                          <div className="flex flex-wrap gap-2">
                            {selectedSubjectIds.map((sid: string) => {
                              const subjName = labelForSubject(sid);
                              const checked = (field.value || []).includes(sid);
                              return (
                                <label key={sid} className="flex items-center gap-1.5 text-sm cursor-pointer">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(c) => {
                                      const v = field.value || [];
                                      field.onChange(c ? [...v, sid] : v.filter((x: string) => x !== sid));
                                    }}
                                  />
                                  {subjName}
                                </label>
                              );
                            })}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                );
              })}
            </div>

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
