import { NavLink, Outlet, useNavigate, Navigate } from "react-router-dom";
import { useStaffAuth } from "../../context/StaffAuthContext";
import {
  LayoutDashboard,
  Ticket,
  BedDouble,
  Users,
  Anchor,
  Sparkles,
  UtensilsCrossed,
  TrendingUp,
  LogOut,
  QrCode,
} from "lucide-react";

// Role-based visibility helper
const can = (user, allowed) => allowed.includes(user?.role);

const NAV = [
  { to: "/staff", end: true, icon: LayoutDashboard, label: "Tableau de bord", roles: ["receptionist", "manager", "admin"] },
  { to: "/staff/scanner", icon: QrCode, label: "Scanner QR", roles: ["receptionist", "manager", "admin"] },
  { section: "Réservations", roles: ["manager", "admin"] },
  { to: "/staff/reservations", icon: Ticket, label: "Toutes les réservations", roles: ["manager", "admin"] },
  { section: "Embarquement & Traversée", roles: ["receptionist", "manager", "admin"] },
  { to: "/staff/embarquement", icon: Anchor, label: "Départs & embarquement", roles: ["receptionist", "manager", "admin"] },
  { section: "Modules à venir", roles: ["manager", "admin"] },
  { to: "/staff/hebergement", icon: BedDouble, label: "Hébergement", roles: ["manager", "admin"] },
  { to: "/staff/clients", icon: Users, label: "Clients", roles: ["manager", "admin"] },
  { to: "/staff/loisirs", icon: Sparkles, label: "Loisirs", roles: ["manager", "admin"] },
  { to: "/staff/kaai", icon: UtensilsCrossed, label: "Le Kaai", roles: ["manager", "admin"] },
  { to: "/staff/revenue", icon: TrendingUp, label: "Chiffre d'affaires", roles: ["manager", "admin"] },
];

export default function StaffLayout() {
  const { user, loading, logout } = useStaffAuth();
  const navigate = useNavigate();
  if (loading) return null;
  if (!user) return <Navigate to="/staff/login" replace />;

  return (
    <div className="min-h-screen flex bg-[#FAFAF7]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-[#B8922A]/20 flex flex-col">
        <div className="px-6 py-7 border-b border-[#B8922A]/20 flex items-center justify-center bg-[#0A0A0A]">
          <img
            src="https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/zyq1citg_LOGO%20BBr%20VF_Plan%20de%20travail%201.png"
            alt="Boulay Beach Resort"
            className="h-20 w-auto"
            data-testid="staff-sidebar-logo"
          />
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          {NAV.map((item, idx) => {
            if (item.section) {
              if (!can(user, item.roles)) return null;
              return (
                <div key={idx} className="px-6 mt-5 mb-2 text-[0.55rem] uppercase tracking-[0.32em] text-[#B8922A]/70">
                  {item.section}
                </div>
              );
            }
            if (!can(user, item.roles)) return null;
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                data-testid={`nav-${item.to.split("/").pop() || "dashboard"}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-6 py-2.5 text-sm transition-colors border-l-2 ${
                    isActive
                      ? "border-[#B8922A] bg-[#B8922A]/5 text-[#B8922A] font-medium"
                      : "border-transparent text-[#0A0A0A]/70 hover:bg-[#FAFAF7] hover:text-[#0A0A0A]"
                  }`
                }
              >
                <Icon size={15} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="px-6 py-5 border-t border-[#B8922A]/20">
          <div className="text-sm font-medium text-[#0A0A0A]">{user.name}</div>
          <div className="text-[0.65rem] uppercase tracking-[0.22em] text-[#B8922A] mt-0.5">
            {user.role}
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/staff/login");
            }}
            className="mt-3 inline-flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 hover:text-[#B8922A] transition-colors"
            data-testid="staff-logout-btn"
          >
            <LogOut size={11} /> Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
