import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useInfiniteQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { buildDynamicSchema, getDynamicDefaults } from '@/lib/schema-builder';
import { generatePassword } from '@/lib/utils';
import type { Manager, FieldDefinition, SchoolClass } from '@/types';
import { classApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DynamicFormFields } from '@/components/DynamicFormFields';
import { PhotoUpload } from '@/components/PhotoUpload';
import { LevelSelect } from '@/components/selects/LevelSelect';
import { useInfiniteScrollSentinel } from '@/hooks/useInfiniteScrollSentinel';

const PAGE_SIZE = 10;

export interface ManagerFormDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Manager | null;
  fields: FieldDefinition[];
  isSubmitting: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
}

export function ManagerFormDialog({
  open,
  onOpenChange,
  editing,
  fields,
  isSubmitting,
  onSubmit,
}: ManagerFormDialogProps) {
  const { t } = useTranslation();
  const formFields = useMemo(
    () => fields.filter((f) => f.name !== 'email' && f.name !== 'password'),
    [fields],
  );
  const dynamicSchema = buildDynamicSchema(formFields);

  const [classFilterLevel, setClassFilterLevel] = useState<string>('__all__');
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const requiredClassIds = useMemo(
    () => [...(editing?.classIds ?? [])].filter(Boolean).sort(),
    [editing?.id, editing?.classIds],
  );
  const reqKey = requiredClassIds.join(',');

  useEffect(() => {
    if (open) setClassFilterLevel('__all__');
  }, [open, editing?.id]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['manager-form', 'classes', 'select', classFilterLevel, reqKey],
    queryFn: ({ pageParam }) =>
      classApi.select({
        page: pageParam,
        limit: PAGE_SIZE,
        levelId: classFilterLevel === '__all__' ? undefined : classFilterLevel,
        requiredResult: requiredClassIds.length ? requiredClassIds : undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.success && last.page < last.totalPages ? last.page + 1 : undefined,
    enabled: open,
  });

  const classRows = useMemo(() => {
    const rows = data?.pages.flatMap((p) => p.data) ?? [];
    const seen = new Set<string>();
    const out: SchoolClass[] = [];
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
    return out;
  }, [data]);

  const loadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  useInfiniteScrollSentinel(
    listRef,
    sentinelRef,
    open,
    !!hasNextPage,
    isFetchingNextPage,
    loadMore,
  );

  const schema = useMemo(() => {
    const baseCreate = z
      .object({
        firstname: z.string().min(1, t('common.required')),
        lastname: z.string().min(1, t('common.required')),
        classIds: z.array(z.string()).optional(),
        photo: z.string().optional(),
        password: z.string().optional(),
        code: z.string().optional(),
        ...dynamicSchema,
      })
      .superRefine((data, ctx) => {
        if (!editing && data.password && data.password.length > 0 && data.password.length < 8) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t('auth.passwordMin', { defaultValue: 'Password must be at least 8 characters' }),
            path: ['password'],
          });
        }
        if (data.code?.trim()) {
          const n = Number.parseInt(data.code.trim(), 10);
          if (!Number.isFinite(n) || n < 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t('common.invalidNumber'),
              path: ['code'],
            });
          }
        }
      });

    const baseEdit = z.object({
      firstname: z.string().min(1, t('common.required')),
      lastname: z.string().min(1, t('common.required')),
      classIds: z.array(z.string()).optional(),
      photo: z.string().optional(),
      ...dynamicSchema,
    });

    return editing ? baseEdit : baseCreate;
  }, [editing, dynamicSchema, t]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      firstname: '',
      lastname: '',
      classIds: [] as string[],
      photo: '',
      password: '',
      code: '',
      ...getDynamicDefaults(formFields),
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        firstname: editing?.firstname || '',
        lastname: editing?.lastname || '',
        classIds: editing?.classIds || [],
        photo: (editing?.dynamicFields?.photo as string) || '',
        password: '',
        code: editing?.code != null ? String(editing.code) : '',
        ...getDynamicDefaults(formFields, editing?.dynamicFields),
      });
    }
  }, [open, editing, formFields, form]);

  const selectedClassIds: string[] = form.watch('classIds') || [];

  const toggleClass = (classId: string) => {
    const current = form.getValues('classIds') || [];
    const updated = current.includes(classId)
      ? current.filter((id: string) => id !== classId)
      : [...current, classId];
    form.setValue('classIds', updated);
  };

  const handleSubmit = (data: Record<string, unknown>) => {
    const { firstname, lastname, classIds, photo, password, code, ...rest } = data;
    const payload: Record<string, unknown> = {
      firstname,
      lastname,
      classIds,
      dynamicFields: { ...rest, photo },
    };
    if (!editing) {
      if (password && String(password).length >= 8) payload.password = String(password);
      if (code && String(code).trim()) {
        const n = Number.parseInt(String(code).trim(), 10);
        if (Number.isFinite(n) && n >= 1) payload.code = n;
      }
    }
    onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t('managers.editManager') : t('managers.addManager')}</DialogTitle>
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
              <>
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
              </>
            )}

            <FormField
              control={form.control}
              name="classIds"
              render={() => (
                <FormItem>
                  <FormLabel>{t('managers.assignClasses')}</FormLabel>
                  <div className="space-y-2">
                    <LevelSelect
                      className="w-full max-w-sm"
                      value={classFilterLevel}
                      onChange={setClassFilterLevel}
                      allOption={{ value: '__all__', label: t('common.allLevels') }}
                    />
                    <div ref={listRef} className="rounded-md border max-h-64 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10" />
                            <TableHead>{t('managers.classes')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isLoading && classRows.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                                {t('common.loading')}
                              </TableCell>
                            </TableRow>
                          ) : null}
                          {!isLoading && classRows.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                                {t('managers.noClassesAvailable')}
                              </TableCell>
                            </TableRow>
                          ) : null}
                          {classRows.map((cls) => (
                            <TableRow key={cls.id}>
                              <TableCell className="py-1.5 ps-4">
                                <Checkbox
                                  checked={selectedClassIds.includes(cls.id)}
                                  onCheckedChange={() => toggleClass(cls.id)}
                                />
                              </TableCell>
                              <TableCell className="py-1.5 text-sm">{cls.name}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell colSpan={2} className="p-0 border-0">
                              <div ref={sentinelRef} className="h-3 w-full shrink-0" aria-hidden />
                            </TableCell>
                          </TableRow>
                          {isFetchingNextPage ? (
                            <TableRow>
                              <TableCell colSpan={2} className="py-2 text-center text-xs text-muted-foreground">
                                {t('common.loading')}
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DynamicFormFields fields={formFields} control={form.control} />
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
