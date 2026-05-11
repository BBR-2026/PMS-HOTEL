import { Navigate } from "react-router-dom";
import { useStaffAuth } from "../context/StaffAuthContext";

/**
 * Wraps a route so it is only rendered when the current staff user has one of
 * the allowed roles. Otherwise the user is bounced back to /staff (dashboard),
 * preventing receptionists from triggering 403 errors when typing manager-only
 * URLs directly into the address bar.
 */
export default function RoleGuard({ allowed, children }) {
  const { user, loading } = useStaffAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/staff/login" replace />;
  if (!allowed.includes(user.role)) return <Navigate to="/staff" replace />;
  return children;
}
