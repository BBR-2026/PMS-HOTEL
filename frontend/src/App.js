import "@/App.css";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { LanguageProvider } from "./context/LanguageContext";
import Header from "./components/Header";
import LandingPage from "./pages/LandingPage";
import BookingTunnel from "./pages/BookingTunnel";
import EventPrivatization from "./pages/EventPrivatization";

function Layout() {
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
          <Route element={<Layout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/booking/:offerId" element={<BookingTunnel />} />
            <Route path="/events" element={<EventPrivatization />} />
          </Route>
        </Routes>
      </LanguageProvider>
    </BrowserRouter>
  );
}

export default App;
