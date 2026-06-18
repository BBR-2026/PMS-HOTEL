/**
 * BBR Tracking Library
 *
 * Provides a unified surface for all marketing pixels and analytics.
 *
 * Wires Meta Pixel + Google Analytics 4 + UTM capture into MongoDB.
 *
 * IDs are read from env (REACT_APP_META_PIXEL_ID, REACT_APP_GA4_ID).
 * If missing, the corresponding pixel is silently disabled, never broken.
 */

const META_PIXEL_ID = process.env.REACT_APP_META_PIXEL_ID;
const GA4_ID = process.env.REACT_APP_GA4_ID;
const BACKEND = process.env.REACT_APP_BACKEND_URL;

let visitorId = null;
let sessionId = null;

function uuid4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getOrInit(key, store) {
  try {
    let v = store.getItem(key);
    if (!v) {
      v = uuid4();
      store.setItem(key, v);
    }
    return v;
  } catch {
    return uuid4();
  }
}

function ensureIds() {
  if (!visitorId) visitorId = getOrInit("bbr_visitor_id", localStorage);
  if (!sessionId) sessionId = getOrInit("bbr_session_id", sessionStorage);
}

// ── Meta Pixel ──────────────────────────────────────────────────
function loadMetaPixel() {
  if (!META_PIXEL_ID || window.fbq) return;
  // eslint-disable-next-line
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window,document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
  window.fbq("init", META_PIXEL_ID);
  window.fbq("track", "PageView");
}

// ── Google Analytics 4 ─────────────────────────────────────────
function loadGA4() {
  if (!GA4_ID || window.gtag) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA4_ID, { send_page_view: false });
}

// ── UTM capture ─────────────────────────────────────────────────
const UTM_KEYS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "fbclid",
];

function captureUtmFromUrl() {
  try {
    const url = new URL(window.location.href);
    const captured = {};
    let any = false;
    UTM_KEYS.forEach((k) => {
      const v = url.searchParams.get(k);
      if (v) {
        captured[k] = v;
        any = true;
      }
    });
    if (any) {
      // Persist for the full session (60 days)
      const payload = {
        ...captured,
        captured_at: new Date().toISOString(),
        landing: url.pathname + url.search,
      };
      try {
        localStorage.setItem("bbr_attribution", JSON.stringify(payload));
      } catch {}
      return payload;
    }
  } catch {}
  try {
    const raw = localStorage.getItem("bbr_attribution");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getAttribution() {
  try {
    const raw = localStorage.getItem("bbr_attribution");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ── Server-side event sink ─────────────────────────────────────
async function sendServerEvent(event) {
  if (!BACKEND) return;
  ensureIds();
  const payload = {
    visitor_id: visitorId,
    session_id: sessionId,
    event_type: event.type,
    page: window.location.pathname,
    referrer: document.referrer || null,
    attribution: getAttribution(),
    props: event.props || {},
    value: event.value || null,
    currency: event.currency || null,
    user_agent: navigator.userAgent,
    occurred_at: new Date().toISOString(),
  };
  try {
    // Use sendBeacon for navigation events when possible
    if (navigator.sendBeacon && event.type === "page_view") {
      const blob = new Blob([JSON.stringify(payload)],
        { type: "application/json" });
      navigator.sendBeacon(`${BACKEND}/api/marketing/events`, blob);
      return;
    }
    await fetch(`${BACKEND}/api/marketing/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {}
}

// ── Public API ──────────────────────────────────────────────────
export function initTracking() {
  ensureIds();
  captureUtmFromUrl();
  loadMetaPixel();
  loadGA4();
}

export function trackPageView() {
  ensureIds();
  // Meta
  if (window.fbq) window.fbq("track", "PageView");
  // GA4
  if (window.gtag && GA4_ID) {
    window.gtag("event", "page_view", {
      page_path: window.location.pathname,
      page_location: window.location.href,
    });
  }
  // Server
  sendServerEvent({ type: "page_view" });
}

export function trackEvent(name, props = {}, value = null) {
  if (window.fbq) {
    const fbName = ({
      view_offer: "ViewContent",
      start_booking: "InitiateCheckout",
      submit_lead: "Lead",
      contact_event: "Contact",
      purchase: "Purchase",
    })[name] || name;
    window.fbq("track", fbName, props);
  }
  if (window.gtag && GA4_ID) window.gtag("event", name, props);
  sendServerEvent({ type: name, props, value });
}
