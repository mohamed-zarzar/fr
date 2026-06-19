import { useAuth } from "@/context/AuthContext";

export function usePermissions() {
  const { hasPermission, isManager, user } = useAuth();
  return { hasPermission, isManager, user };
}
