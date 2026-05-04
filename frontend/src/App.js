import "@/App.css";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { LanguageProvider } from "./context/LanguageContext";
import Header from "./components/Header";
import Footer from "./components/Footer";
import LandingPage from "./pages/LandingPage";
import BookingTunnel from "./pages/BookingTunnel";
import EventPrivatization from "./pages/EventPrivatization";

function Layout() {
  return (
    <div className="App grain min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            style: {
              background: "#141414",
              border: "1px solid rgba(184, 146, 42, 0.3)",
              color: "#F5F0E8",
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
