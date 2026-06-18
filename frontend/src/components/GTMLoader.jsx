/**
 * GTM (Google Tag Manager) loader — reads container ID from site_settings.tracking.
 *
 * Injects the standard GTM <script> + <noscript> snippets once the public
 * CMS config is available AND gtm_enabled is true AND container ID is valid.
 * Re-injection is guarded by a module-level flag.
 */
import { useEffect } from "react";
import { useSiteConfig, sel } from "../lib/site-config";

let injected = false;

const GTM_RE = /^GTM-[A-Z0-9]+$/;

export default function GTMLoader() {
  const cfg = useSiteConfig();
  const tracking = sel.tracking(cfg);

  useEffect(() => {
    if (injected) return;
    if (!tracking?.gtm_enabled) return;
    const cid = (tracking.gtm_container_id || "").trim();
    if (!GTM_RE.test(cid)) return;

    // Standard GTM snippet (head)
    const script = document.createElement("script");
    script.async = true;
    script.innerHTML = `
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${cid}');
    `;
    document.head.appendChild(script);

    // <noscript> iframe fallback (body)
    const noscript = document.createElement("noscript");
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.googletagmanager.com/ns.html?id=${cid}`;
    iframe.height = "0";
    iframe.width = "0";
    iframe.style.display = "none";
    iframe.style.visibility = "hidden";
    noscript.appendChild(iframe);
    document.body.insertBefore(noscript, document.body.firstChild);

    injected = true;
  }, [tracking?.gtm_enabled, tracking?.gtm_container_id]);

  return null;
}
