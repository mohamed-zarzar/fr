import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";
import { settingsApi } from "@/services/settings-api";

/**
 * Requires a stored access token (mock or real). Renders nested routes via `<Outlet />`.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) return;
    queryClient.prefetchQuery({
      queryKey: ['predefined-settings'],
      queryFn: () => settingsApi.getPredefined(),
    });
  }, [isAuthenticated, queryClient]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
