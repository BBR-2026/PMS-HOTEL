/**
 * Site configuration React hook — reads /api/site/config and caches in memory.
 *
 * Usage : ``const cfg = useSiteConfig();`` — returns ``null`` until ready,
 * then the merged object with keys hero/univers/offers/contact/footer/instagram.
 */
import { useEffect, useState } from "react";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

let cache = null;
let inFlight = null;
const listeners = new Set();

async function loadConfig() {
  if (cache) return cache;
  if (inFlight) return inFlight;
  inFlight = fetch(`${BACKEND}/api/site/config`)
    .then((r) => r.json())
    .then((d) => {
      cache = d || {};
      listeners.forEach((cb) => cb(cache));
      return cache;
    })
    .catch(() => {
      cache = {};
      return cache;
    })
    .finally(() => { inFlight = null; });
  return inFlight;
}

export function invalidateSiteConfig() {
  cache = null;
}

export function useSiteConfig() {
  const [cfg, setCfg] = useState(cache);
  useEffect(() => {
    let mounted = true;
    loadConfig().then((d) => { if (mounted) setCfg(d); });
    const cb = (d) => { if (mounted) setCfg(d); };
    listeners.add(cb);
    return () => { mounted = false; listeners.delete(cb); };
  }, []);
  return cfg;
}

/* Convenience selectors with sensible defaults */
export const sel = {
  hero: (cfg) => cfg?.hero || {},
  univers: (cfg) => cfg?.univers || { items: [] },
  offers: (cfg) => cfg?.offers || {},
  contact: (cfg) => cfg?.contact || {},
  footer: (cfg) => cfg?.footer || {},
  instagram: (cfg) => cfg?.instagram || { posts: [] },
};
