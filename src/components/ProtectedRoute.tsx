import { Navigate } from "react-router-dom";
import { useAuthContext } from "../context/AuthContext";
import { type ReactNode } from "react";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthContext();

  if (loading) return <div className="loading-screen">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
