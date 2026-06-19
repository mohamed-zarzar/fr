import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { accessControlApi } from '@/services/access-control-api';
import type { Role, Permission, UserWithRoles } from '@/types/access-control';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/DataTable';
import { ScrollArea } from '@/components/ui/scroll-area';

const PAGE_SIZE = 10;

// ─── Roles Tab ────────────────────────────────────────────────────────────────

function RolesTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [permSearch, setPermSearch] = useState('');

  const { data: rolesRes, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles', { page, search }],
    queryFn: () => accessControlApi.roles.getAll({ page, limit: PAGE_SIZE, search: search.trim() || undefined }),
  });

  const { data: permsRes } = useQuery({
    queryKey: ['permissions-all'],
    queryFn: () => accessControlApi.permissions.getAll({ page: 1, limit: 100 }),
  });

  const allPermissions = permsRes?.data ?? [];
  const filteredPermissions = useMemo(() => {
    if (!permSearch.trim()) return allPermissions;
    return allPermissions.filter((p) =>
      p.name.toLowerCase().includes(permSearch.toLowerCase()) ||
      (p.description?.toLowerCase().includes(permSearch.toLowerCase()) ?? false)
    );
  }, [allPermissions, permSearch]);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t('common.required')),
        description: z.string().optional(),
        permissionIds: z.array(z.string()).optional(),
      }),
    [t],
  );

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', permissionIds: [] },
  });

  function openCreate() {
    form.reset({ name: '', description: '', permissionIds: [] });
    setEditing(null);
    setPermSearch('');
    setDialogOpen(true);
  }

  function openEdit(role: Role) {
    form.reset({
      name: role.name,
      description: role.description ?? '',
      permissionIds: role.permissionIds,
    });
    setEditing(role);
    setPermSearch('');
    setDialogOpen(true);
  }

  const createMut = useMutation({
    mutationFn: (d: FormValues) => accessControlApi.roles.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      setDialogOpen(false);
      toast.success(t('roles.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: FormValues & { id: string }) =>
      accessControlApi.roles.update(id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      setDialogOpen(false);
      toast.success(t('roles.updated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => accessControlApi.roles.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      setDeleteTarget(null);
      toast.success(t('roles.deleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function onSubmit(values: FormValues) {
    if (editing) {
      updateMut.mutate({ id: editing.id, ...values });
    } else {
      createMut.mutate(values);
    }
  }

  const columns: Column<Role>[] = [
    { key: 'name', label: t('roles.roleName') },
    {
      key: 'description',
      label: t('roles.roleDescription'),
      render: (r) => r.description ?? '—',
    },
    {
      key: 'permissionIds',
      label: t('roles.assignPermissions'),
      render: (r) => (
        <span className="text-sm text-muted-foreground">
          {r.permissionIds.length} {t('roles.permissionsTab').toLowerCase()}
        </span>
      ),
    },
  ];

  const isPending = createMut.isPending || updateMut.isPending;

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  return (
    <>
      <div className="flex justify-end mb-2">
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          {t('roles.addRole')}
        </Button>
      </div>
      <DataTable
        data={rolesRes?.data ?? []}
        columns={columns}
        isLoading={rolesLoading}
        searchPlaceholder={t('roles.searchRoles')}
        onEdit={openEdit}
        onDelete={(r) => setDeleteTarget(r)}
        serverSide={{
          total: rolesRes?.total ?? 0,
          page,
          totalPages: rolesRes?.totalPages ?? 1,
          search,
          sortKey,
          sortOrder,
          onSearchChange: setSearch,
          onSortChange: (k, o) => { setSortKey(k); setSortOrder(o); },
          onPageChange: setPage,
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('roles.editRole') : t('roles.addRole')}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('roles.roleName')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('roles.roleDescription')}</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="permissionIds"
                render={({ field }) => {
                  const selected: string[] = field.value ?? [];
                  return (
                    <FormItem>
                      <FormLabel>{t('roles.selectPermissions')}</FormLabel>
                      <Input
                        placeholder={t('roles.searchPermissions')}
                        value={permSearch}
                        onChange={(e) => setPermSearch(e.target.value)}
                        className="mb-2"
                      />
                      <ScrollArea className="h-52 border rounded-md p-2">
                        <div className="space-y-1">
                          {filteredPermissions.map((perm) => (
                            <label
                              key={perm.id}
                              className="flex items-start gap-2 cursor-pointer py-1"
                            >
                              <Checkbox
                                checked={selected.includes(perm.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    field.onChange([...selected, perm.id]);
                                  } else {
                                    field.onChange(selected.filter((id) => id !== perm.id));
                                  }
                                }}
                                className="mt-0.5"
                              />
                              <div>
                                <span className="text-sm font-medium">{perm.name}</span>
                                {perm.description && (
                                  <p className="text-xs text-muted-foreground">{perm.description}</p>
                                )}
                              </div>
                            </label>
                          ))}
                          {filteredPermissions.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              {t('roles.noPermissions')}
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                      <p className="text-xs text-muted-foreground">
                        {selected.length} {t('roles.permissionsTab').toLowerCase()} {t('roles.assignedRoles').toLowerCase()}
                      </p>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? t('common.saving') : t('common.save')}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('roles.deleteRole')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('roles.deleteRoleConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Permissions Tab ──────────────────────────────────────────────────────────

function PermissionsTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Permission | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Permission | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data: res, isLoading } = useQuery({
    queryKey: ['permissions', { page, search }],
    queryFn: () => accessControlApi.permissions.getAll({ page, limit: PAGE_SIZE, search: search.trim() || undefined }),
  });

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t('common.required')),
        description: z.string().optional(),
      }),
    [t],
  );

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  });

  function openCreate() {
    form.reset({ name: '', description: '' });
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(perm: Permission) {
    form.reset({ name: perm.name, description: perm.description ?? '' });
    setEditing(perm);
    setDialogOpen(true);
  }

  const syncMut = useMutation({
    mutationFn: () => accessControlApi.permissions.sync(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permissions'] });
      qc.invalidateQueries({ queryKey: ['permissions-all'] });
      toast.success(t('roles.synced'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createMut = useMutation({
    mutationFn: (d: FormValues) => accessControlApi.permissions.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permissions'] });
      qc.invalidateQueries({ queryKey: ['permissions-all'] });
      setDialogOpen(false);
      toast.success(t('roles.permissionCreated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: FormValues & { id: string }) =>
      accessControlApi.permissions.update(id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permissions'] });
      qc.invalidateQueries({ queryKey: ['permissions-all'] });
      setDialogOpen(false);
      toast.success(t('roles.permissionUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => accessControlApi.permissions.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['permissions'] });
      qc.invalidateQueries({ queryKey: ['permissions-all'] });
      setDeleteTarget(null);
      toast.success(t('roles.permissionDeleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function onSubmit(values: FormValues) {
    if (editing) {
      updateMut.mutate({ id: editing.id, ...values });
    } else {
      createMut.mutate(values);
    }
  }

  const columns: Column<Permission>[] = [
    { key: 'name', label: t('roles.permissionName') },
    {
      key: 'description',
      label: t('roles.permissionDescription'),
      render: (p) => p.description ?? '—',
    },
  ];

  const isPending = createMut.isPending || updateMut.isPending;

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  return (
    <>
      <div className="flex justify-end gap-2 mb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncMut.mutate()}
          disabled={syncMut.isPending}
          title={t('roles.syncPermissionsDesc')}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${syncMut.isPending ? 'animate-spin' : ''}`} />
          {t('roles.syncPermissions')}
        </Button>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          {t('roles.addPermission')}
        </Button>
      </div>
      <DataTable
        data={res?.data ?? []}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder={t('roles.searchPermissionsList')}
        onEdit={openEdit}
        onDelete={(p) => setDeleteTarget(p)}
        serverSide={{
          total: res?.total ?? 0,
          page,
          totalPages: res?.totalPages ?? 1,
          search,
          sortKey,
          sortOrder,
          onSearchChange: setSearch,
          onSortChange: (k, o) => { setSortKey(k); setSortOrder(o); },
          onPageChange: setPage,
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? t('roles.editPermission') : t('roles.addPermission')}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('roles.permissionName')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="resource.action" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('roles.permissionDescription')}</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? t('common.saving') : t('common.save')}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('roles.deletePermission')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('roles.deletePermissionConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleSearch, setRoleSearch] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  const { data: usersRes, isLoading: usersLoading } = useQuery({
    queryKey: ['users-with-roles', { page, search }],
    queryFn: () => accessControlApi.users.getAll({ page, limit: PAGE_SIZE, search: search.trim() || undefined }),
  });

  const { data: rolesRes } = useQuery({
    queryKey: ['roles-all'],
    queryFn: () => accessControlApi.roles.getAll({ page: 1, limit: 100 }),
  });

  const allRoles = rolesRes?.data ?? [];
  const filteredRoles = useMemo(() => {
    if (!roleSearch.trim()) return allRoles;
    return allRoles.filter((r) =>
      r.name.toLowerCase().includes(roleSearch.toLowerCase())
    );
  }, [allRoles, roleSearch]);

  function openAssign(user: UserWithRoles) {
    setEditingUser(user);
    setSelectedRoleIds(user.roleIds);
    setRoleSearch('');
    setDialogOpen(true);
  }

  const assignMut = useMutation({
    mutationFn: ({ userId, roleIds }: { userId: string; roleIds: string[] }) =>
      accessControlApi.users.setRoles(userId, roleIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users-with-roles'] });
      setDialogOpen(false);
      toast.success(t('roles.userRolesUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const columns: Column<UserWithRoles>[] = [
    {
      key: 'firstName',
      label: t('roles.firstName'),
      render: (u) => `${u.firstName} ${u.lastName}`,
    },
    {
      key: 'email',
      label: 'Email',
      render: (u) => u.email ?? '—',
    },
    {
      key: 'userType',
      label: t('roles.userType'),
      render: (u) => <Badge variant="outline">{u.userType}</Badge>,
    },
    {
      key: 'roleNames',
      label: t('roles.currentRoles'),
      render: (u) =>
        u.roleNames.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {u.roleNames.map((name) => (
              <Badge key={name} variant="secondary" className="text-xs">
                {name}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
    },
  ];

  return (
    <>
      <DataTable
        data={usersRes?.data ?? []}
        columns={columns}
        isLoading={usersLoading}
        searchPlaceholder={t('roles.searchUsers')}
        onEdit={openAssign}
        serverSide={{
          total: usersRes?.total ?? 0,
          page,
          totalPages: usersRes?.totalPages ?? 1,
          search,
          sortKey,
          sortOrder,
          onSearchChange: setSearch,
          onSortChange: (k, o) => { setSortKey(k); setSortOrder(o); },
          onPageChange: setPage,
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('roles.assignRoles')}
              {editingUser && (
                <span className="ml-2 font-normal text-muted-foreground">
                  — {editingUser.firstName} {editingUser.lastName}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder={t('roles.searchRolesList')}
              value={roleSearch}
              onChange={(e) => setRoleSearch(e.target.value)}
            />
            <ScrollArea className="h-52 border rounded-md p-2">
              <div className="space-y-1">
                {filteredRoles.map((role) => (
                  <label
                    key={role.id}
                    className="flex items-center gap-2 cursor-pointer py-1"
                  >
                    <Checkbox
                      checked={selectedRoleIds.includes(role.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedRoleIds((prev) => [...prev, role.id]);
                        } else {
                          setSelectedRoleIds((prev) => prev.filter((id) => id !== role.id));
                        }
                      }}
                    />
                    <div>
                      <span className="text-sm font-medium">{role.name}</span>
                      {role.description && (
                        <p className="text-xs text-muted-foreground">{role.description}</p>
                      )}
                    </div>
                  </label>
                ))}
                {filteredRoles.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t('roles.noRoles')}
                  </p>
                )}
              </div>
            </ScrollArea>
            <p className="text-xs text-muted-foreground">
              {selectedRoleIds.length} {t('roles.assignedRoles').toLowerCase()}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                disabled={assignMut.isPending}
                onClick={() =>
                  editingUser &&
                  assignMut.mutate({
                    userId: editingUser.id,
                    roleIds: selectedRoleIds,
                  })
                }
              >
                {assignMut.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('roles.title')}</h1>
      </div>
      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles">{t('roles.rolesTab')}</TabsTrigger>
          <TabsTrigger value="permissions">{t('roles.permissionsTab')}</TabsTrigger>
          <TabsTrigger value="users">{t('roles.usersTab')}</TabsTrigger>
        </TabsList>
        <TabsContent value="roles" className="mt-4">
          <RolesTab />
        </TabsContent>
        <TabsContent value="permissions" className="mt-4">
          <PermissionsTab />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <UsersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
