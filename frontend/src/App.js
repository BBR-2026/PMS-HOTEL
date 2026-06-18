import "@/App.css";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { LanguageProvider } from "./context/LanguageContext";
import { StaffAuthProvider } from "./context/StaffAuthContext";
import Header from "./components/Header";
import LandingPage from "./pages/LandingPage";
import WelcomeLanding from "./pages/WelcomeLanding";
import BookingTunnel from "./pages/BookingTunnel";
import FineoResult from "./pages/FineoResult";
import Pay from "./pages/Pay";
import Companion from "./pages/Companion";
import StaffNotifications from "./pages/staff/StaffNotifications";
import StaffCampaigns from "./pages/staff/StaffCampaigns";
import StaffFeedback from "./pages/staff/StaffFeedback";
import Feedback from "./pages/Feedback";
import Accueil from "./pages/Accueil";
import PaiementHub from "./pages/PaiementHub";
import WifiPage from "./pages/WifiPage";
import Enregistrement from "./pages/Enregistrement";
import StaffRegistrations from "./pages/staff/StaffRegistrations";
import StaffCharters from "./pages/staff/StaffCharters";
import StaffCorporateInquiries from "./pages/staff/StaffCorporateInquiries";
import CorporateForm from "./pages/CorporateForm";
import EventPrivatization from "./pages/EventPrivatization";
import StaffLogin from "./pages/staff/StaffLogin";
import StaffLayout from "./pages/staff/StaffLayout";
import StaffDashboard from "./pages/staff/StaffDashboard";
import StaffEmbarquement from "./pages/staff/StaffEmbarquement";
import StaffScanner from "./pages/staff/StaffScanner";
import StaffPlaceholder from "./pages/staff/StaffPlaceholder";
import StaffReservations from "./pages/staff/StaffReservations";
import StaffClients from "./pages/staff/StaffClients";
import StaffRevenue from "./pages/staff/StaffRevenue";
import StaffKaai from "./pages/staff/StaffKaai";
import StaffHebergement from "./pages/staff/StaffHebergement";
import StaffLoisirs from "./pages/staff/StaffLoisirs";
import StaffConfig from "./pages/staff/StaffConfig";
import StaffTraverseesHistory from "./pages/staff/StaffTraverseesHistory";
import StaffActivities from "./pages/staff/StaffActivities";
import StaffNewBooking from "./pages/staff/StaffNewBooking";
import StaffReceipts from "./pages/staff/StaffReceipts";
import StaffCheckinsHistory from "./pages/staff/StaffCheckinsHistory";
import StaffActivitiesConfig from "./pages/staff/StaffActivitiesConfig";
import StaffSpecialEvents from "./pages/staff/StaffSpecialEvents";
import StaffPolePage from "./pages/staff/StaffPolePage";
import StaffPayments from "./pages/staff/StaffPayments";
import PolePage from "./pages/PolePage";
import Gallery from "./pages/Gallery";
import GalleryAlbum from "./pages/GalleryAlbum";
import EventDetail from "./pages/EventDetail";
import StaffGallery from "./pages/staff/StaffGallery";
import StaffCorporateRequests from "./pages/staff/StaffCorporateRequests";
import StaffLoisirsActivities from "./pages/staff/StaffLoisirsActivities";
import StaffRapports from "./pages/staff/StaffRapports";
import StaffPassengers from "./pages/staff/StaffPassengers";
import CorporateRegistration from "./pages/CorporateRegistration";
import RoleGuard from "./components/RoleGuard";
import CantineLanding from "./pages/cantine/CantineLanding";
import StaffCantine from "./pages/staff/StaffCantine";
import StaffCantinePersonnel from "./pages/staff/StaffCantinePersonnel";
import StaffCantinePointage from "./pages/staff/StaffCantinePointage";
import StaffPendingBookings from "./pages/staff/StaffPendingBookings";
import StaffPlanning from "./pages/staff/StaffPlanning";

// iter-52 — Vitrine (site internet premium)
import VitrineLayout from "./components/vitrine/VitrineLayout";
import VitrineLanding from "./pages/vitrine/VitrineLanding";
import UniversHebergement from "./pages/vitrine/UniversHebergement";
import UniversBeachClub from "./pages/vitrine/UniversBeachClub";
import UniversActivites from "./pages/vitrine/UniversActivites";
import UniversEvenementiel from "./pages/vitrine/UniversEvenementiel";
import UniversCorporate from "./pages/vitrine/UniversCorporate";
import UniversLeKaai from "./pages/vitrine/UniversLeKaai";
import VitrineBoutique from "./pages/vitrine/VitrineBoutique";
import VitrineContact from "./pages/vitrine/VitrineContact";

// Role catalogs — extend MANAGER_PLUS to include the new roles so they get
// the same routing access as legacy manager (read access; writes are gated by
// the backend middleware for management_general).
const MANAGER_PLUS = ["manager", "manager_pole", "management_general", "admin"];
const ADMIN_ONLY = ["admin"];
// Roles allowed to access reservation pages
const RES_ACCESS = [...MANAGER_PLUS, "hotesse", "receptionist"];
// iter-42: Cantine
const CANTINE_DASH_ACCESS = [...MANAGER_PLUS, "directeur", "rh", "cuisine"];
const CANTINE_POINTAGE_ACCESS = [...CANTINE_DASH_ACCESS, "hotesse", "verification"];
// iter-46: planning des équipes
const PLANNING_ACCESS = [...MANAGER_PLUS, "directeur", "rh", "chef_dept"];

function PublicLayout() {
  return (
    <div className="App min-h-screen flex flex-col bg-white text-[#0A0A0A]">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <StaffAuthProvider>
          <Toaster
            theme="light"
            position="top-center"
            toastOptions={{
              style: {
                background: "#FFFFFF",
                border: "1px solid rgba(184, 146, 42, 0.3)",
                color: "#0A0A0A",
                fontFamily: "Poppins, sans-serif",
              },
            }}
          />
          <Routes>
            <Route path="/welcome" element={<WelcomeLanding />} />
            {/* iter-52 — VITRINE (site premium public) */}
            <Route element={<VitrineLayout />}>
              <Route path="/" element={<VitrineLanding />} />
              <Route path="/univers/hebergement" element={<UniversHebergement />} />
              <Route path="/univers/beach-club" element={<UniversBeachClub />} />
              <Route path="/univers/activites" element={<UniversActivites />} />
              <Route path="/univers/evenementiel" element={<UniversEvenementiel />} />
              <Route path="/univers/corporate" element={<UniversCorporate />} />
              <Route path="/le-kaai" element={<UniversLeKaai />} />
              <Route path="/boutique" element={<VitrineBoutique />} />
              <Route path="/contact" element={<VitrineContact />} />
            </Route>
            <Route element={<PublicLayout />}>
              <Route path="/reserver" element={<LandingPage />} />
              <Route path="/pole/:poleId" element={<PolePage />} />
              <Route path="/booking/:offerId" element={<BookingTunnel />} />
              <Route path="/payment/fineo/result" element={<FineoResult />} />
              <Route path="/booking/special-event/:eventId" element={<BookingTunnel />} />
              <Route path="/event/:eventId" element={<EventDetail />} />
              <Route path="/events" element={<EventPrivatization />} />
              <Route path="/galerie" element={<Gallery />} />
              <Route path="/galerie/:albumId" element={<GalleryAlbum />} />
            </Route>
            <Route path="/retour-experience" element={<Feedback />} />
            <Route path="/pay/:token" element={<Pay />} />
            <Route path="/companion/:code" element={<Companion />} />
            <Route path="/cantine" element={<CantineLanding />} />
            <Route path="/cantine/inscription" element={<Navigate to="/cantine" replace />} />
            <Route path="/cantine/reserver" element={<Navigate to="/cantine" replace />} />
            <Route path="/accueil" element={<Accueil />} />
            <Route path="/accueil/paiement" element={<PaiementHub />} />
            <Route path="/accueil/wifi" element={<WifiPage />} />
            <Route path="/corporate/:offerId" element={<CorporateForm />} />
            <Route path="/corporate-form/:token" element={<CorporateRegistration />} />
            <Route path="/accueil/enregistrement" element={<Enregistrement />} />
            <Route path="/enregistrement" element={<Enregistrement />} />
            <Route path="/staff/login" element={<StaffLogin />} />
            <Route path="/staff" element={<StaffLayout />}>
              <Route index element={<StaffDashboard />} />
              <Route path="scanner" element={<StaffScanner />} />
              <Route path="embarquement" element={<StaffEmbarquement />} />
              <Route path="corporate-requests" element={<RoleGuard allowed={MANAGER_PLUS}><StaffCorporateRequests /></RoleGuard>} />
              <Route path="configuration/loisirs" element={<RoleGuard allowed={MANAGER_PLUS}><StaffLoisirsActivities /></RoleGuard>} />
              <Route path="traversees/historique" element={<StaffTraverseesHistory />} />
              <Route path="activites" element={<StaffActivities />} />
              <Route path="reservations" element={<RoleGuard allowed={RES_ACCESS}><StaffReservations /></RoleGuard>} />
              <Route path="reservations/en-attente" element={<RoleGuard allowed={RES_ACCESS}><StaffPendingBookings /></RoleGuard>} />
              <Route path="reservations/nouvelle" element={<RoleGuard allowed={RES_ACCESS}><StaffNewBooking /></RoleGuard>} />
              <Route path="recus" element={<RoleGuard allowed={MANAGER_PLUS}><StaffReceipts /></RoleGuard>} />
              <Route path="embarquements-historique" element={<RoleGuard allowed={MANAGER_PLUS}><StaffCheckinsHistory /></RoleGuard>} />
              <Route path="configuration/activites" element={<RoleGuard allowed={MANAGER_PLUS}><StaffActivitiesConfig /></RoleGuard>} />
              <Route path="evenements-speciaux" element={<RoleGuard allowed={MANAGER_PLUS}><StaffSpecialEvents /></RoleGuard>} />
              <Route path="pole/:poleId" element={<RoleGuard allowed={MANAGER_PLUS}><StaffPolePage /></RoleGuard>} />
              <Route path="paiements" element={<RoleGuard allowed={MANAGER_PLUS}><StaffPayments /></RoleGuard>} />
              <Route path="hebergement" element={<RoleGuard allowed={MANAGER_PLUS}><StaffHebergement /></RoleGuard>} />
              <Route path="clients" element={<RoleGuard allowed={MANAGER_PLUS}><StaffClients /></RoleGuard>} />
              <Route path="loisirs" element={<RoleGuard allowed={MANAGER_PLUS}><StaffLoisirs /></RoleGuard>} />
              <Route path="kaai" element={<RoleGuard allowed={MANAGER_PLUS}><StaffKaai /></RoleGuard>} />
              <Route path="revenue" element={<RoleGuard allowed={MANAGER_PLUS}><StaffRevenue /></RoleGuard>} />
              <Route path="config" element={<RoleGuard allowed={ADMIN_ONLY}><StaffConfig /></RoleGuard>} />
              <Route path="notifications" element={<RoleGuard allowed={MANAGER_PLUS}><StaffNotifications /></RoleGuard>} />
              <Route path="campaigns" element={<RoleGuard allowed={MANAGER_PLUS}><StaffCampaigns /></RoleGuard>} />
              <Route path="feedback" element={<RoleGuard allowed={MANAGER_PLUS}><StaffFeedback /></RoleGuard>} />
              <Route path="enregistrements" element={<RoleGuard allowed={MANAGER_PLUS}><StaffRegistrations /></RoleGuard>} />
              <Route path="rapports" element={<StaffRapports />} />
              <Route path="passagers" element={<StaffPassengers />} />
              <Route path="privatisations" element={<RoleGuard allowed={MANAGER_PLUS}><StaffCharters /></RoleGuard>} />
              <Route path="corporate" element={<RoleGuard allowed={MANAGER_PLUS}><StaffCorporateInquiries /></RoleGuard>} />
              <Route path="galerie" element={<RoleGuard allowed={MANAGER_PLUS}><StaffGallery /></RoleGuard>} />
              <Route path="cantine" element={<RoleGuard allowed={CANTINE_DASH_ACCESS}><StaffCantine /></RoleGuard>} />
              <Route path="cantine/personnel" element={<RoleGuard allowed={CANTINE_DASH_ACCESS}><StaffCantinePersonnel /></RoleGuard>} />
              <Route path="cantine/pointage" element={<RoleGuard allowed={CANTINE_POINTAGE_ACCESS}><StaffCantinePointage /></RoleGuard>} />
              <Route path="planning" element={<RoleGuard allowed={PLANNING_ACCESS}><StaffPlanning /></RoleGuard>} />
            </Route>
          </Routes>
        </StaffAuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

export default App;
