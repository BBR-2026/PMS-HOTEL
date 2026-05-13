import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate, Navigate, useLocation } from "react-router-dom";
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
  ReceiptText,
  Settings,
  Menu,
  X,
  History,
  Waves,
} from "lucide-react";

// Role-based visibility helper
const can = (user, allowed) => allowed.includes(user?.role);

const NAV = [
  { to: "/staff", end: true, icon: LayoutDashboard, label: "Tableau de bord", roles: ["receptionist", "manager", "admin"] },
  { to: "/staff/scanner", icon: QrCode, label: "Scanner QR", roles: ["receptionist", "manager", "admin"] },
  { section: "Réservations", roles: ["manager", "admin"] },
  { to: "/staff/reservations", icon: Ticket, label: "Toutes les réservations", roles: ["manager", "admin"] },
  { to: "/staff/clients", icon: Users, label: "Clients", roles: ["manager", "admin"] },
  { to: "/staff/revenue", icon: TrendingUp, label: "Chiffre d'affaires", roles: ["manager", "admin"] },
  { to: "/staff/recus", icon: ReceiptText, label: "Reçus de paiement", roles: ["manager", "admin"] },
  { section: "Opérations", roles: ["receptionist", "manager", "admin"] },
  { to: "/staff/embarquement", icon: Anchor, label: "Départs & embarquement", roles: ["receptionist", "manager", "admin"] },
  { to: "/staff/embarquements-historique", icon: Anchor, label: "Historique embarquements", roles: ["manager", "admin"] },
  { to: "/staff/traversees/historique", icon: History, label: "Historique traversées", roles: ["receptionist", "manager", "admin"] },
  { to: "/staff/activites", icon: Waves, label: "Activités sur place", roles: ["receptionist", "manager", "admin"] },
  { to: "/staff/hebergement", icon: BedDouble, label: "Hébergement", roles: ["manager", "admin"] },
  { to: "/staff/kaai", icon: UtensilsCrossed, label: "Le Kaai", roles: ["manager", "admin"] },
  { to: "/staff/loisirs", icon: Sparkles, label: "Loisirs", roles: ["manager", "admin"] },
  { section: "Administration", roles: ["admin"] },
  { to: "/staff/config", icon: Settings, label: "Configuration", roles: ["admin"] },
];

function SidebarContent({ user, onNavigate, onLogout }) {
  return (
    <>
      <div className="px-4 py-6 border-b border-[#B8922A]/20 flex items-center justify-center">
        <img
          src="https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/5jjvd8zn_LOGO_BBr_VF_Plan_de_travail_1-removebg-preview.png"
          alt="Boulay Beach Resort"
          className="h-28 lg:h-36 w-auto"
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
              onClick={onNavigate}
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
        <div className="text-[0.65rem] uppercase tracking-[0.22em] text-[#B8922A] mt-0.5">{user.role}</div>
        <button
          onClick={onLogout}
          className="mt-3 inline-flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.22em] text-[#0A0A0A]/55 hover:text-[#B8922A] transition-colors"
          data-testid="staff-logout-btn"
        >
          <LogOut size={11} /> Déconnexion
        </button>
      </div>
    </>
  );
}

export default function StaffLayout() {
  const { user, loading, logout } = useStaffAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (loading) return null;
  if (!user) return <Navigate to="/staff/login" replace />;

  const handleLogout = () => {
    logout();
    navigate("/staff/login");
  };

  return (
    <div className="min-h-screen flex bg-[#FAFAF7]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-[#B8922A]/20 flex-col fixed inset-y-0 left-0 z-30">
        <SidebarContent user={user} onNavigate={() => {}} onLogout={handleLogout} />
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-[#B8922A]/20 flex items-center justify-between px-4 z-30">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 text-[#0A0A0A]"
          aria-label="Ouvrir le menu"
          data-testid="staff-mobile-menu-btn"
        >
          <Menu size={20} />
        </button>
        <img
          src="https://customer-assets.emergentagent.com/job_reserve-bbr/artifacts/5jjvd8zn_LOGO_BBr_VF_Plan_de_travail_1-removebg-preview.png"
          alt="BBR"
          className="h-9 w-auto"
        />
        <div className="w-9" />
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/40 z-40"
            onClick={() => setMobileOpen(false)}
            data-testid="staff-mobile-overlay"
          />
          <aside className="lg:hidden fixed inset-y-0 left-0 w-72 bg-white border-r border-[#B8922A]/20 flex flex-col z-50 animate-in slide-in-from-left duration-200">
            <div className="absolute top-3 right-3 z-10">
              <button onClick={() => setMobileOpen(false)} className="p-2 text-[#0A0A0A]/60 hover:text-[#0A0A0A]" data-testid="staff-mobile-close-btn">
                <X size={18} />
              </button>
            </div>
            <SidebarContent user={user} onNavigate={() => setMobileOpen(false)} onLogout={handleLogout} />
          </aside>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-x-hidden lg:ml-64 pt-14 lg:pt-0 w-full min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
