import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate, Navigate, useLocation } from "react-router-dom";
import { useStaffAuth } from "../../context/StaffAuthContext";
import NotificationsBell from "./NotificationsBell";
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
  Bell,
  Briefcase,
  CalendarHeart,
  Wallet,
  Megaphone,
  MessageSquare,
  Building2,
  Ship,
  UserCheck,
  Camera,
  FileBarChart,
  AlertTriangle,
  ClipboardList,
  Inbox,
  BarChart3,
} from "lucide-react";

// Role-based visibility helper
const can = (user, allowed) => allowed.includes(user?.role);

// ===== Role visibility matrix =====
// Each role sees only what it's allowed to. Legacy roles (receptionist /
// manager / admin) stay valid alongside the new 7-role catalog.
const R_ADMIN = ["admin", "management_general"]; // full read access
const R_MGMT = [...R_ADMIN, "manager", "manager_pole"];
const R_RES = [...R_MGMT, "hotesse", "receptionist"]; // Reservations
const R_OPS = [...R_MGMT, "logistique", "receptionist"]; // Operations
const R_SCAN = [...R_MGMT, "verification", "logistique", "hotesse", "receptionist"]; // Scanner
const R_ACT = [...R_MGMT, "serveur_caisse", "receptionist"]; // Consommation
const R_DASH = [...R_RES, ...R_OPS, ...R_ACT, "serveur_caisse", "verification"]; // Dashboard — everyone
const R_ADMIN_ONLY = ["admin"]; // strict admin-only config
// iter-42: Cantine roles
const R_CANTINE = [...R_ADMIN, "directeur", "rh", "cuisine"];
const R_CANTINE_POINTAGE = [...R_CANTINE, "hotesse", "verification"];

const NAV = [
  { key: "dashboard", to: "/staff", end: true, icon: LayoutDashboard, label: "Tableau de bord", roles: R_DASH },
  { key: "scanner", to: "/staff/scanner", icon: QrCode, label: "Scanner QR", roles: R_SCAN },
  { section: "Pôle", roles: R_MGMT },
  { key: "pole_beach_club", to: "/staff/pole/beach_club", icon: Waves, label: "Beach Club", roles: R_MGMT, poleId: "beach_club" },
  { key: "pole_hebergement", to: "/staff/pole/hebergement", icon: BedDouble, label: "Hébergement", roles: R_MGMT, poleId: "hebergement" },
  { key: "pole_corporate", to: "/staff/pole/corporate", icon: Briefcase, label: "Corporate", roles: R_MGMT, poleId: "corporate" },
  { key: "pole_activites_events", to: "/staff/pole/activites_events", icon: CalendarHeart, label: "Activités & Événements", roles: R_MGMT, poleId: "activites_events" },
  { key: "pole_le_kaai", to: "/staff/pole/le_kaai", icon: UtensilsCrossed, label: "Le Kaai", roles: R_MGMT, poleId: "le_kaai" },
  { section: "Réservations", roles: R_RES },
  { key: "reservations", to: "/staff/reservations", icon: Ticket, label: "Toutes les réservations", roles: R_RES },
  { key: "reservations_en_attente", to: "/staff/reservations/en-attente", icon: AlertTriangle, label: "Réservations en attente", roles: R_RES },
  { key: "paiements", to: "/staff/paiements", icon: Wallet, label: "Paiements", roles: R_MGMT },
  { key: "clients", to: "/staff/clients", icon: Users, label: "Clients", roles: R_MGMT },
  { key: "revenue", to: "/staff/revenue", icon: TrendingUp, label: "Chiffre d'affaires", roles: R_MGMT },
  { key: "rapports", to: "/staff/rapports", icon: FileBarChart, label: "Rapports personnalisés", roles: R_DASH },
  { key: "passagers", to: "/staff/passagers", icon: Users, label: "Passagers (registre)", roles: R_DASH },
  { key: "recus", to: "/staff/recus", icon: ReceiptText, label: "Reçus de paiement", roles: R_MGMT },
  { section: "Opérations", roles: R_OPS },
  { key: "embarquement", to: "/staff/embarquement", icon: Anchor, label: "Départs & embarquement", roles: R_OPS },
  { key: "embarquements_historique", to: "/staff/embarquements-historique", icon: Anchor, label: "Historique embarquements", roles: R_MGMT },
  { key: "traversees_historique", to: "/staff/traversees/historique", icon: History, label: "Historique traversées", roles: R_OPS },
  { section: "Consommation sur place", roles: R_ACT },
  { key: "consommation", to: "/staff/activites", icon: Waves, label: "Consommation sur place", roles: R_ACT },
  { section: "Administration", roles: R_ADMIN },
  { key: "notifications", to: "/staff/notifications", icon: Bell, label: "Notifications SMS/WhatsApp", roles: R_MGMT },
  { key: "marketing", to: "/staff/marketing", icon: BarChart3, label: "Marketing & Acquisition", roles: R_MGMT },
  { key: "leads", to: "/staff/leads", icon: Inbox, label: "Inbox & Leads", roles: R_MGMT },
  { key: "campaigns", to: "/staff/campaigns", icon: Megaphone, label: "Campagnes e-mail", roles: R_MGMT },
  { key: "feedback", to: "/staff/feedback", icon: MessageSquare, label: "Retour expérience", roles: R_MGMT },
  { key: "enregistrements", to: "/staff/enregistrements", icon: UserCheck, label: "Enregistrements", roles: R_MGMT },
  { key: "privatisations", to: "/staff/privatisations", icon: Ship, label: "Privatisations", roles: R_MGMT },
  { key: "corporate_inquiries", to: "/staff/corporate", icon: Building2, label: "Demandes Corporate (anciennes)", roles: R_MGMT },
  { key: "corporate_requests", to: "/staff/corporate-requests", icon: Building2, label: "Corporate · Liens d'inscription", roles: R_MGMT },
  { key: "catalogue_activites", to: "/staff/configuration/activites", icon: Waves, label: "Catalogue activités", roles: R_MGMT },
  { key: "loisirs_activities", to: "/staff/configuration/loisirs", icon: Waves, label: "Offres & Loisirs", roles: R_MGMT },
  { key: "evenements_speciaux", to: "/staff/evenements-speciaux", icon: Sparkles, label: "Événements spéciaux", roles: R_MGMT },
  { key: "galerie", to: "/staff/galerie", icon: Camera, label: "Galerie photo", roles: R_MGMT },
  { section: "Cantine du personnel", roles: R_CANTINE_POINTAGE },
  { key: "cantine_dashboard", to: "/staff/cantine", icon: UtensilsCrossed, label: "Cantine — Dashboard", roles: R_CANTINE },
  { key: "cantine_personnel", to: "/staff/cantine/personnel", icon: Users, label: "Cantine — Personnel", roles: R_CANTINE },
  { key: "cantine_pointage", to: "/staff/cantine/pointage", icon: QrCode, label: "Cantine — Pointage", roles: R_CANTINE_POINTAGE },
  { section: "Planning des équipes", roles: [...R_CANTINE, "chef_dept"] },
  { key: "planning", to: "/staff/planning", icon: ClipboardList, label: "Planning hebdomadaire", roles: [...R_CANTINE, "chef_dept"] },
  { key: "config", to: "/staff/config", icon: Settings, label: "Configuration", roles: R_ADMIN_ONLY },
];

// Public catalogue exposed to the admin Config screen so it can render the
// matrix of sections to enable/disable per user. Kept alphabetic-friendly
// via the same order as NAV.
export const NAV_SECTIONS_CATALOG = NAV
  .filter((i) => i.key)
  .map((i) => ({ key: i.key, label: i.label }));

const ROLE_LABEL_FR = {
  admin: "Administrateur",
  management_general: "Management général",
  manager: "Manager",
  manager_pole: "Manager pôle",
  hotesse: "Hôtesse",
  serveur_caisse: "Serveur & caisse",
  logistique: "Logistique",
  verification: "Vérification",
  receptionist: "Réception",
  directeur: "Directeur",
  rh: "RH",
  cuisine: "Cuisine",
  chef_dept: "Chef de département",
};

function SidebarContent({ user, onNavigate, onLogout }) {
  // Per-user nav_sections override: when set, ONLY the listed keys are shown
  // (regardless of role defaults). Empty / undefined => role defaults apply.
  const allowedKeys = Array.isArray(user?.nav_sections) && user.nav_sections.length
    ? new Set(user.nav_sections)
    : null;

  // Step 1: build the list of items the user is allowed to see.
  const visibleItems = NAV.filter((item) => {
    // Section headers — keep as markers, decision based on following items.
    if (item.section) return true;
    // Hide poles not assigned to a manager_pole.
    if (user?.role === "manager_pole" && item.poleId && item.poleId !== user.pole_id) {
      return false;
    }
    // Role gate first.
    if (!can(user, item.roles)) return false;
    // Then per-user override (when active).
    if (allowedKeys && item.key && !allowedKeys.has(item.key)) return false;
    return true;
  });

  // Step 2: drop section headers that are not followed by any visible item.
  const trimmed = [];
  visibleItems.forEach((item, idx) => {
    if (item.section) {
      // Look ahead to the next section (or end) and check if there's an item.
      let hasChild = false;
      for (let j = idx + 1; j < visibleItems.length; j++) {
        if (visibleItems[j].section) break;
        hasChild = true;
        break;
      }
      if (!hasChild) return;
      if (!can(user, item.roles)) return;
    }
    trimmed.push(item);
  });

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
        {trimmed.map((item, idx) => {
          if (item.section) {
            return (
              <div key={`sec-${idx}`} className="px-6 mt-5 mb-2 text-[0.55rem] uppercase tracking-[0.32em] text-[#B8922A]/70">
                {item.section}
              </div>
            );
          }
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
        <div className="text-[0.65rem] uppercase tracking-[0.22em] text-[#B8922A] mt-0.5">
          {ROLE_LABEL_FR[user.role] || user.role}
        </div>
        {user.role === "management_general" && (
          <div className="mt-1 text-[0.6rem] uppercase tracking-[0.18em] text-amber-700/90" data-testid="readonly-banner">
            Lecture seule
          </div>
        )}
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
        <NotificationsBell />
      </header>

      {/* Desktop top-right notifications bell (fixed, above content) */}
      <div className="hidden lg:flex fixed top-3 right-5 z-40">
        <NotificationsBell />
      </div>

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
