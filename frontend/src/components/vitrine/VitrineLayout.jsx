/**
 * Vitrine — Shared layout for all public marketing pages.
 *
 * - Mounts VitrineNav (top) + VitrineFooter (bottom).
 * - Initialises tracking lib and fires a page_view on every route change.
 * - Scrolls to top on navigation.
 */
import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import VitrineNav from "./VitrineNav";
import VitrineFooter from "./VitrineFooter";
import { initTracking, trackPageView } from "../../lib/tracking";

export default function VitrineLayout() {
  const loc = useLocation();

  useEffect(() => { initTracking(); }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    trackPageView();
  }, [loc.pathname]);

  return (
    <div className="bg-[#FAF7F2] text-[#0A0A0A] min-h-screen flex flex-col"
         data-testid="vitrine-layout">
      <VitrineNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <VitrineFooter />
    </div>
  );
}
