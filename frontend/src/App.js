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
              <Route path="/booking/:offerId" element={<BookingTunnel />} />
              <Route path="/events" element={<EventPrivatization />} />
            </Route>
            <Route path="/staff/login" element={<StaffLogin />} />
            <Route path="/staff" element={<StaffLayout />}>
              <Route index element={<StaffDashboard />} />
              <Route path="scanner" element={<StaffScanner />} />
              <Route path="embarquement" element={<StaffEmbarquement />} />
              <Route path="reservations" element={<StaffReservations />} />
              <Route path="hebergement" element={<StaffPlaceholder title="Hébergement" description="Calendrier des chambres, réservations soldées/non soldées, statistiques." />} />
              <Route path="clients" element={<StaffPlaceholder title="Clients" description="Base de données clients, historique, retours d'expérience." />} />
              <Route path="loisirs" element={<StaffPlaceholder title="Loisirs" description="Activités aquatiques, sportives, spa & wellness, privatisation d'espaces." />} />
              <Route path="kaai" element={<StaffPlaceholder title="Le Kaai" description="Calendrier des tables et statistiques du restaurant." />} />
              <Route path="revenue" element={<StaffPlaceholder title="Chiffre d'affaires" description="Vue consolidée et répartition par offre." />} />
            </Route>
          </Routes>
        </StaffAuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

export default App;
