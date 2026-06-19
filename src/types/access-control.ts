export interface Permission {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  permissionIds: string[];
}

export interface UserWithRoles {
  id: string;
  code: number | null;
  email: string | null;
  firstName: string;
  lastName: string;
  userType: string;
  roleIds: string[];
  roleNames: string[];
}
