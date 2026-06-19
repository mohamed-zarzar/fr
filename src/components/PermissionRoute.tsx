import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface Props {
  permission: string;
  /** If true, also requires userType === 'MANAGER'. Defaults to false. */
  managerOnly?: boolean;
}

/**
 * Protects a route by permission (and optionally userType).
 * Redirects to "/" if the check fails.
 */
export function PermissionRoute({ permission, managerOnly = false }: Props) {
  const { isLoading, hasPermission, isManager } = useAuth();

  if (isLoading) return null;

  if (managerOnly && !isManager) return <Navigate to="/" replace />;
  if (!hasPermission(permission)) return <Navigate to="/" replace />;

  return <Outlet />;
}
