/**
 * Vitrine — Shared layout for all public-facing pages.
 *
 * Includes the nav, footer, tracking init, and adds top padding when the
 * current page is NOT the immersive landing (whose hero handles the nav).
 */
import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import VitrineNav from "./VitrineNav";
import VitrineFooter from "./VitrineFooter";
import { initTracking, trackPageView } from "../../lib/tracking";

// Routes whose hero already starts at y=0 with full-bleed image.
const TRANSPARENT_NAV_ROUTES = new Set([
  "/",
]);
const HERO_PREFIX = ["/univers/", "/le-kaai"];

export default function VitrineLayout() {
  const loc = useLocation();

  useEffect(() => { initTracking(); }, []);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    trackPageView();
  }, [loc.pathname]);

  const heroPage =
    TRANSPARENT_NAV_ROUTES.has(loc.pathname) ||
    HERO_PREFIX.some((p) => loc.pathname.startsWith(p));

  return (
    <div className="bg-[#FAF7F2] text-[#0A0A0A] min-h-screen flex flex-col"
         data-testid="vitrine-layout">
      <VitrineNav />
      <main className={`flex-1 ${heroPage ? "" : "pt-24 md:pt-28 lg:pt-32"}`}>
        <Outlet />
      </main>
      <VitrineFooter />
    </div>
  );
}
