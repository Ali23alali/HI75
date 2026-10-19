import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { FullScreenLoader } from "@/components/ui/Spinner";

export function ProtectedRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader label="hi" />;
  if (!session) return <Navigate to="/welcome" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { session, loading } = useAuth();
  if (loading) return <FullScreenLoader label="hi" />;
  if (session) return <Navigate to="/messages" replace />;
  return <Outlet />;
}
