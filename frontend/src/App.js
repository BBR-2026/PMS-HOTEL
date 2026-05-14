import "@/App.css";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { LanguageProvider } from "./context/LanguageContext";
import { StaffAuthProvider } from "./context/StaffAuthContext";
import Header from "./components/Header";
import LandingPage from "./pages/LandingPage";
import BookingTunnel from "./pages/BookingTunnel";
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
import PolePage from "./pages/PolePage";
import RoleGuard from "./components/RoleGuard";

const MANAGER_PLUS = ["manager", "admin"];
const ADMIN_ONLY = ["admin"];

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
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/pole/:poleId" element={<PolePage />} />
              <Route path="/booking/:offerId" element={<BookingTunnel />} />
              <Route path="/booking/special-event/:eventId" element={<BookingTunnel />} />
              <Route path="/events" element={<EventPrivatization />} />
            </Route>
            <Route path="/staff/login" element={<StaffLogin />} />
            <Route path="/staff" element={<StaffLayout />}>
              <Route index element={<StaffDashboard />} />
              <Route path="scanner" element={<StaffScanner />} />
              <Route path="embarquement" element={<StaffEmbarquement />} />
              <Route path="traversees/historique" element={<StaffTraverseesHistory />} />
              <Route path="activites" element={<StaffActivities />} />
              <Route path="reservations" element={<RoleGuard allowed={MANAGER_PLUS}><StaffReservations /></RoleGuard>} />
              <Route path="reservations/nouvelle" element={<RoleGuard allowed={MANAGER_PLUS}><StaffNewBooking /></RoleGuard>} />
              <Route path="recus" element={<RoleGuard allowed={MANAGER_PLUS}><StaffReceipts /></RoleGuard>} />
              <Route path="embarquements-historique" element={<RoleGuard allowed={MANAGER_PLUS}><StaffCheckinsHistory /></RoleGuard>} />
              <Route path="configuration/activites" element={<RoleGuard allowed={MANAGER_PLUS}><StaffActivitiesConfig /></RoleGuard>} />
              <Route path="evenements-speciaux" element={<RoleGuard allowed={MANAGER_PLUS}><StaffSpecialEvents /></RoleGuard>} />
              <Route path="hebergement" element={<RoleGuard allowed={MANAGER_PLUS}><StaffHebergement /></RoleGuard>} />
              <Route path="clients" element={<RoleGuard allowed={MANAGER_PLUS}><StaffClients /></RoleGuard>} />
              <Route path="loisirs" element={<RoleGuard allowed={MANAGER_PLUS}><StaffLoisirs /></RoleGuard>} />
              <Route path="kaai" element={<RoleGuard allowed={MANAGER_PLUS}><StaffKaai /></RoleGuard>} />
              <Route path="revenue" element={<RoleGuard allowed={MANAGER_PLUS}><StaffRevenue /></RoleGuard>} />
              <Route path="config" element={<RoleGuard allowed={ADMIN_ONLY}><StaffConfig /></RoleGuard>} />
            </Route>
          </Routes>
        </StaffAuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

export default App;
