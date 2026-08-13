// client/src/components/ProtectedRoute.tsx

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../types";

interface Props {
  allowedRoles?: Role[];
}

/**
 * Gate for authenticated (and optionally role-restricted) routes.
 *
 * This is a UX convenience only — it hides nav items and pages the user
 * shouldn't see. It is NOT the security boundary; the backend re-checks
 * every role/ownership rule on every request regardless of what the
 * frontend allows through.
 */
export function ProtectedRoute({ allowedRoles }: Props) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
