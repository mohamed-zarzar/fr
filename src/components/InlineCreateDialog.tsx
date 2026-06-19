import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { parentApi, subjectApi, templateApi } from '@/services/api';
import { buildDynamicSchema, getDynamicDefaults } from '@/lib/schema-builder';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DynamicFormFields } from '@/components/DynamicFormFields';

export function InlineParentCreate({ onCreated }: { onCreated?: (id: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data: tplRes } = useQuery({ queryKey: ['templates'], queryFn: () => templateApi.get() });
  const fields = tplRes?.data?.parent?.fields || [];

  const dynamicSchema = buildDynamicSchema(fields);
  const schema = z
    .object({
      firstname: z.string().min(1, t('common.required')),
      lastname: z.string().min(1, t('common.required')),
      email: z.string().min(1, t('common.required')),
      password: z.string().min(1, t('common.required')),
      ...dynamicSchema,
    })
    .superRefine((data, ctx) => {
      const email = data.email?.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: email ? t('common.invalidEmail') : t('common.required'),
          path: ['email'],
        });
      }
      if (!data.password || data.password.length < 8) {
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
      email: '',
      password: '',
      ...getDynamicDefaults(fields),
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ firstname: '', lastname: '', email: '', password: '', ...getDynamicDefaults(fields) });
    }
  }, [open, fields, form]);

  const mut = useMutation({
    mutationFn: (d: any) => {
      const { firstname, lastname, email, password, ...rest } = d;
      return parentApi.create({
        firstname,
        lastname,
        email: email?.trim(),
        password,
        studentIds: [],
        dynamicFields: rest,
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['parents'] });
      setOpen(false);
      form.reset();
      toast.success(t('parents.created'));
      onCreated?.(res.data.id);
    },
  });

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-3 w-3" />
        {t('parents.addParent')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('parents.addParent')}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={(e) => { e.stopPropagation(); form.handleSubmit(d => mut.mutate(d))(e); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="firstname" render={({ field }) => (
                  <FormItem><FormLabel>{t('common.firstName')} *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="lastname" render={({ field }) => (
                  <FormItem><FormLabel>{t('common.lastName')} *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>{t('common.email')} *</FormLabel><FormControl><Input type="email" autoComplete="off" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>{t('auth.password')} *</FormLabel><FormControl><Input type="password" autoComplete="new-password" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <DynamicFormFields fields={fields} control={form.control} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
                <Button type="submit" disabled={mut.isPending}>{mut.isPending ? t('common.loading') : t('common.create')}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function InlineSubjectCreate({ onCreated }: { onCreated?: (id: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const subjectSchema = z.object({
    name: z.string().min(1, t('common.required')),
    code: z.string().min(1, t('common.required')),
    description: z.string().optional(),
  });
  const form = useForm({ resolver: zodResolver(subjectSchema), defaultValues: { name: '', code: '', description: '' } });
  const mut = useMutation({
    mutationFn: (d: any) => subjectApi.create(d),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['subjects'] });
      setOpen(false);
      form.reset();
      toast.success(t('subjects.created'));
      onCreated?.(res.data.id);
    },
  });

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="me-1 h-3 w-3" />{t('subjects.addSubject')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('subjects.addSubject')}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={(e) => { e.stopPropagation(); form.handleSubmit(d => mut.mutate(d))(e); }} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>{t('common.name')} *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="code" render={({ field }) => (
                <FormItem><FormLabel>{t('common.code')} *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>{t('common.description')}</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
                <Button type="submit" disabled={mut.isPending}>{mut.isPending ? t('common.loading') : t('common.create')}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
