"""Generate all diagrams for the BBR Booking Engine PDF.

Outputs in /app/manual_assets/booking_engine/:
    01_booking_architecture.png     — Booking Engine internals
    02_funnel_tunnel.png            — 7-step conversion funnel
    03_wireframes.png               — Step-by-step wireframes
    04_state_machine.png            — Reservation status FSM
    05_payment_sequence.png         — Payment & PSP flow
    06_qr_lifecycle.png             — QR code lifecycle
    07_api_map.png                  — REST API map
    08_pms_ota_topology.png         — PMS + OTA integration
"""
import os
import subprocess

OUT = "/app/manual_assets/booking_engine"
os.makedirs(OUT, exist_ok=True)

GOLD = "#B8922A"
INK = "#0A0A0A"
CREAM = "#FAF7F2"
SOFT = "#5F6670"
WHITE = "#FFFFFF"

COMMON_GRAPH = f"""
  graph [bgcolor="{CREAM}" fontname="Helvetica" fontsize=11];
  node  [fontname="Helvetica" fontsize=10 shape=box style="rounded,filled"
         fillcolor="{WHITE}" color="{INK}" penwidth=1.0 margin="0.2,0.12"];
  edge  [fontname="Helvetica" fontsize=9 color="{SOFT}" arrowsize=0.7];
"""


def render(dot_src, name, dpi=150):
    src = os.path.join(OUT, f"{name}.dot")
    out = os.path.join(OUT, f"{name}.png")
    with open(src, "w") as f:
        f.write(dot_src)
    subprocess.run(["dot", "-Tpng", f"-Gdpi={dpi}", src, "-o", out], check=True)
    print(f"✓ {out}")


# ── 1. BOOKING ENGINE ARCHITECTURE ─────────────────────────────────
diagram_1 = f"""
digraph G {{
  rankdir=TB; nodesep=0.4; ranksep=0.7;
{COMMON_GRAPH}

  subgraph cluster_clients {{
    label="ENTRÉES";
    labeljust=l; color="{GOLD}"; style="rounded,dashed"; fontcolor="{GOLD}";
    web   [label="Site vitrine\\n+ widget réservation"];
    app   [label="Web App\\n/reservations"];
    portal [label="Espace client\\n/account"];
    api_ext [label="API publique\\n(partenaires)"];
  }}

  subgraph cluster_core {{
    label="BOOKING ENGINE — Cœur central";
    labeljust=l; color="{GOLD}"; style="rounded,filled"; fillcolor="#FFF8E8";
    funnel [label="Tunnel de conversion\\n(7 étapes)" fillcolor="#FFE9B0"];
    catalog [label="Catalogue\\nproduits + tarifs"];
    avail [label="Availability Engine\\n(stocks · slots · capacités)"];
    pricing [label="Pricing Engine\\n(yield · promo · membership)"];
    rules [label="Business Rules\\n(annulation · no-show · reprog.)"];
    upsell [label="Upsell / Cross-sell\\nEngine"];
    cart [label="Cart / Order\\nMulti-produits"];
  }}

  subgraph cluster_pay {{
    label="PAIEMENT";
    labeljust=l; color="{GOLD}"; style="rounded,dashed"; fontcolor="{GOLD}";
    payorch [label="Payment Orchestrator\\n(routeur · retry · webhook)" fillcolor="#FFE9B0"];
    wave [label="Wave"];
    om [label="Orange Money"];
    mtn [label="MTN Money"];
    moov [label="Moov Money"];
    stripe [label="Stripe\\n(Visa · Mastercard)"];
    paypal [label="PayPal"];
  }}

  subgraph cluster_post {{
    label="POST-PAIEMENT";
    labeljust=l; color="{GOLD}"; style="rounded,dashed"; fontcolor="{GOLD}";
    ref_gen [label="Génération référence\\nBBR-YYYYMMDD-XXXX"];
    qr_gen [label="Génération QR\\n+ Ticket PDF Premium"];
    notif [label="Notifications\\nEmail · WhatsApp · SMS"];
    sync_ota [label="Sync OTA\\n(Booking · Airbnb · …)"];
    sync_ana [label="Analytics + CRM\\n(attribution UTM)"];
  }}

  subgraph cluster_ops {{
    label="OPÉRATIONS SUR SITE";
    labeljust=l; color="{INK}"; style="rounded,dashed";
    scan [label="Scanner QR\\n+ Check-in"];
    pms [label="PMS Front Desk\\n(housekeeping · facturation)"];
    dashboard [label="Dashboard interne\\n(CA · occupation · KPIs)"];
  }}

  // Entrées vers tunnel
  web -> funnel; app -> funnel; portal -> funnel; api_ext -> funnel;
  funnel -> catalog; funnel -> avail; funnel -> pricing;
  funnel -> upsell; funnel -> cart;
  cart -> rules;
  cart -> payorch [color="{GOLD}" penwidth=2];
  payorch -> wave; payorch -> om; payorch -> mtn; payorch -> moov;
  payorch -> stripe; payorch -> paypal;
  payorch -> ref_gen [color="{GOLD}" penwidth=2 label="webhook OK"];
  ref_gen -> qr_gen -> notif;
  ref_gen -> sync_ota; ref_gen -> sync_ana;
  qr_gen -> scan; ref_gen -> pms; ref_gen -> dashboard;
}}
"""

# ── 2. FUNNEL 7-step ────────────────────────────────────────────────
diagram_2 = f"""
digraph G {{
  rankdir=LR; nodesep=0.25; ranksep=0.5;
{COMMON_GRAPH}
  node [shape=box style="rounded,filled" fillcolor="#FFF8E8"];

  s1 [label="①\\nProduit"];
  s2 [label="②\\nDate"];
  s3 [label="③\\nParticipants"];
  s4 [label="④\\nOptions\\n(upsell)"];
  s5 [label="⑤\\nClient"];
  s6 [label="⑥\\nPaiement"];
  s7 [label="⑦\\nConfirmation" fillcolor="#FFE9B0"];

  s1 -> s2 -> s3 -> s4 -> s5 -> s6 -> s7 [penwidth=2 color="{GOLD}"];

  // Conversion targets visualised below
  c1 [label="100%" shape=plaintext fontcolor="{SOFT}"];
  c2 [label="78%" shape=plaintext fontcolor="{SOFT}"];
  c3 [label="68%" shape=plaintext fontcolor="{SOFT}"];
  c4 [label="58%" shape=plaintext fontcolor="{SOFT}"];
  c5 [label="48%" shape=plaintext fontcolor="{SOFT}"];
  c6 [label="35%" shape=plaintext fontcolor="{SOFT}"];
  c7 [label="32%" shape=plaintext fontcolor="{INK}"];

  {{rank=same; s1; s2; s3; s4; s5; s6; s7;}}
  {{rank=same; c1; c2; c3; c4; c5; c6; c7;}}
  s1 -> c1 [style=invis]; s2 -> c2 [style=invis]; s3 -> c3 [style=invis];
  s4 -> c4 [style=invis]; s5 -> c5 [style=invis]; s6 -> c6 [style=invis];
  s7 -> c7 [style=invis];
}}
"""

# ── 3. WIREFRAMES (mockups text-style for the 7 tunnel steps) ───────
diagram_3 = f"""
digraph G {{
  rankdir=TB; nodesep=0.25; ranksep=0.25;
{COMMON_GRAPH}
  node [shape=none margin=0];

  step1 [label=<
    <TABLE BORDER="0" CELLBORDER="1" CELLPADDING="6" CELLSPACING="0" BGCOLOR="white">
      <TR><TD BGCOLOR="{GOLD}" COLSPAN="3"><FONT COLOR="white"><B>ÉTAPE 1 — Choisissez votre expérience</B></FONT></TD></TR>
      <TR><TD BGCOLOR="#F4ECDA"><B>HÉBERGEMENT</B><BR/>Suites + Chambres</TD>
          <TD BGCOLOR="#F4ECDA"><B>BEACH CLUB</B><BR/>Day Pass · Sunset · Brunch</TD>
          <TD BGCOLOR="#F4ECDA"><B>ACTIVITÉS</B><BR/>Jet ski · Quad · Padel · …</TD></TR>
      <TR><TD BGCOLOR="#F4ECDA"><B>CORPORATE</B><BR/>Séminaires · Team building</TD>
          <TD BGCOLOR="#F4ECDA"><B>ÉVÉNEMENTIEL</B><BR/>Mariages · Soirées</TD>
          <TD BGCOLOR="#F4ECDA"><B>MEMBERSHIP</B><BR/>Carte fidélité</TD></TR>
    </TABLE>>];

  step2 [label=<
    <TABLE BORDER="0" CELLBORDER="1" CELLPADDING="6" CELLSPACING="0" BGCOLOR="white">
      <TR><TD BGCOLOR="{GOLD}" COLSPAN="3"><FONT COLOR="white"><B>ÉTAPE 2 — Quand ?</B></FONT></TD></TR>
      <TR><TD><B>Date d'arrivée</B><BR/>[___/___/____]</TD>
          <TD><B>Date de départ</B><BR/>[___/___/____]</TD>
          <TD>Calendrier (mois courant + suivant)<BR/>● disponible<BR/>○ tarif majoré<BR/>✕ complet</TD></TR>
    </TABLE>>];

  step3 [label=<
    <TABLE BORDER="0" CELLBORDER="1" CELLPADDING="6" CELLSPACING="0" BGCOLOR="white">
      <TR><TD BGCOLOR="{GOLD}" COLSPAN="3"><FONT COLOR="white"><B>ÉTAPE 3 — Combien de participants ?</B></FONT></TD></TR>
      <TR><TD><B>Adultes</B><BR/>[ – ]  2  [ + ]</TD>
          <TD><B>Enfants</B> (3-12 ans)<BR/>[ – ]  0  [ + ]</TD>
          <TD><B>Bébés</B> (gratuit)<BR/>[ – ]  0  [ + ]</TD></TR>
      <TR><TD COLSPAN="3"><I>Total estimé : 145 000 XOF — 2 adultes en Suite Lagune, 2 nuits</I></TD></TR>
    </TABLE>>];

  step4 [label=<
    <TABLE BORDER="0" CELLBORDER="1" CELLPADDING="6" CELLSPACING="0" BGCOLOR="white">
      <TR><TD BGCOLOR="{GOLD}" COLSPAN="3"><FONT COLOR="white"><B>ÉTAPE 4 — Ajoutez à votre séjour (upsell + cross-sell)</B></FONT></TD></TR>
      <TR><TD>[ ] Transfert privé<BR/>30 000 XOF</TD>
          <TD>[ ] Brunch dominical<BR/>22 000 XOF / pers.</TD>
          <TD>[ ] Massage couple<BR/>45 000 XOF</TD></TR>
      <TR><TD>[ ] Sunset Experience<BR/>15 000 XOF / pers.</TD>
          <TD>[ ] Jet ski 30 min<BR/>35 000 XOF</TD>
          <TD>[ ] Padel court 1h<BR/>12 000 XOF</TD></TR>
    </TABLE>>];

  step5 [label=<
    <TABLE BORDER="0" CELLBORDER="1" CELLPADDING="6" CELLSPACING="0" BGCOLOR="white">
      <TR><TD BGCOLOR="{GOLD}" COLSPAN="2"><FONT COLOR="white"><B>ÉTAPE 5 — Vos informations</B></FONT></TD></TR>
      <TR><TD><B>Nom · Prénom</B><BR/>[__________________]</TD>
          <TD><B>Téléphone (WhatsApp)</B><BR/>[+225 ____________]</TD></TR>
      <TR><TD><B>Email</B><BR/>[__________________]</TD>
          <TD><B>Nationalité</B><BR/>[ Sénégalaise ▼ ]</TD></TR>
      <TR><TD COLSPAN="2">[ ] J'accepte les CGV — [ ] Je souhaite recevoir les offres BBr</TD></TR>
    </TABLE>>];

  step6 [label=<
    <TABLE BORDER="0" CELLBORDER="1" CELLPADDING="6" CELLSPACING="0" BGCOLOR="white">
      <TR><TD BGCOLOR="{GOLD}" COLSPAN="3"><FONT COLOR="white"><B>ÉTAPE 6 — Paiement sécurisé</B></FONT></TD></TR>
      <TR><TD>○ Acompte 50% <B>72 500 XOF</B><BR/>Solde à payer avant arrivée</TD>
          <TD>● Paiement intégral <B>145 000 XOF</B><BR/>Annulation flexible jusqu'à 72h</TD>
          <TD>○ Paiement sur place<BR/><I>(sur autorisation)</I></TD></TR>
      <TR><TD>[ Wave ]</TD><TD>[ Orange Money ]</TD><TD>[ MTN Money ]</TD></TR>
      <TR><TD>[ Moov Money ]</TD><TD>[ Visa · Mastercard ]</TD><TD>[ PayPal ]</TD></TR>
    </TABLE>>];

  step7 [label=<
    <TABLE BORDER="0" CELLBORDER="1" CELLPADDING="6" CELLSPACING="0" BGCOLOR="white">
      <TR><TD BGCOLOR="{GOLD}" COLSPAN="2"><FONT COLOR="white"><B>ÉTAPE 7 — Confirmé ✓</B></FONT></TD></TR>
      <TR><TD COLSPAN="2"><B>Réservation BBR-20260712-A4F2</B></TD></TR>
      <TR><TD>● Ticket PDF Premium téléchargé<BR/>● QR Code généré<BR/>● Email + WhatsApp envoyés</TD>
          <TD>[ Télécharger le ticket ]<BR/>[ Ajouter au calendrier ]<BR/>[ Voir mes réservations ]</TD></TR>
    </TABLE>>];

  step1 -> step2 -> step3 -> step4 -> step5 -> step6 -> step7
    [color="{GOLD}" penwidth=2];
}}
"""

# ── 4. RESERVATION FSM ──────────────────────────────────────────────
diagram_4 = f"""
digraph G {{
  rankdir=LR; nodesep=0.4; ranksep=0.7;
{COMMON_GRAPH}
  node [shape=ellipse style="filled" fillcolor="{WHITE}" penwidth=1.2];

  pending  [label="PENDING\\n(panier soumis)" fillcolor="#FAF7F2"];
  conf     [label="CONFIRMED\\n(acompte payé)" fillcolor="#FFF8E8"];
  paid     [label="PAID\\n(intégralité réglée)" fillcolor="#FFE9B0"];
  ci       [label="CHECKED_IN\\n(QR scanné)" fillcolor="#FFE9B0"];
  done     [label="COMPLETED\\n(séjour terminé)" fillcolor="#E5D9C0"];
  cancel   [label="CANCELLED" fillcolor="#FAF7F2" shape=doublecircle];
  noshow   [label="NO_SHOW" fillcolor="#FAF7F2" shape=doublecircle];
  ref      [label="REFUNDED" fillcolor="#FAF7F2" shape=doublecircle];

  pending -> conf   [label="paiement\\n(50% ou 100%)"];
  pending -> cancel [label="abandon panier\\n(15 min)" color="{SOFT}" style=dashed];
  conf -> paid      [label="solde payé"];
  conf -> cancel    [label="annulation client\\n(règles)" color="{SOFT}"];
  paid -> ci        [label="scan QR\\nle jour J"];
  ci -> done        [label="check-out\\nautomatique J+N"];
  paid -> noshow    [label="absent au jour J" color="{SOFT}"];
  conf -> noshow    [label="absent + non payé" color="{SOFT}"];
  cancel -> ref     [label="remboursement\\nautomatique"];
}}
"""

# ── 5. PAYMENT SEQUENCE ─────────────────────────────────────────────
diagram_5 = f"""
digraph G {{
  rankdir=TB; nodesep=0.25; ranksep=0.35;
{COMMON_GRAPH}
  node [shape=box style="rounded,filled" fillcolor="{WHITE}"];

  c1 [label="① Client valide le panier\\n(étape 6)"];
  c2 [label="② Booking Engine\\nfreeze inventory (5 min hold)"];
  c3 [label="③ Crée payment_intent\\n(idempotency key)"];
  c4 [label="④ Routeur PSP\\nchoisit Wave / OM / Stripe / …"];
  c5 [label="⑤ Redirige vers PSP\\n(ou OTP mobile money)"];
  c6 [label="⑥ Client autorise\\nle paiement"];
  c7 [label="⑦ PSP webhook\\nstatus=captured"];
  c8 [label="⑧ Booking Engine\\nconfirme reservation\\n→ status=PAID"];
  c9 [label="⑨ Décrément final\\ninventory.capacity_sold"];
  c10 [label="⑩ Trigger post-paiement\\n(QR, PDF, notif, OTA sync, analytics)"];

  c1->c2->c3->c4->c5->c6->c7->c8->c9->c10
    [color="{GOLD}" penwidth=1.5];

  // Failure paths
  c7_fail [label="⑦b PSP webhook\\nstatus=failed" fillcolor="#FAF7F2"];
  c6 -> c7_fail [style=dashed color="{SOFT}"];
  c7_fail_action [label="Release hold\\nNotif client\\nProposer autre PSP"
                  fillcolor="#FAF7F2"];
  c7_fail -> c7_fail_action [color="{SOFT}"];
}}
"""

# ── 6. QR CODE LIFECYCLE ────────────────────────────────────────────
diagram_6 = f"""
digraph G {{
  rankdir=LR; nodesep=0.3; ranksep=0.5;
{COMMON_GRAPH}
  node [shape=box style="rounded,filled" fillcolor="{WHITE}"];

  gen [label="① GENERATION\\nToken 32-hex\\n+ ref 8-char\\nECC=M · 440px"];
  pld [label="② PAYLOAD JSON\\n{{type:'ticket',\\ntoken,ref}}\\n~75 chars"];
  tpl [label="③ TICKET PDF\\n+ Boarding Pass\\nimage Pillow"];
  snd [label="④ DELIVERY\\nEmail + WhatsApp\\n+ Wallet (Apple/Google)"];
  scn [label="⑤ SCAN sur site\\n(jour J)" fillcolor="#FFE9B0"];
  res [label="⑥ RESOLVER\\n_resolve_qr_token\\nmulti-format"];
  val [label="⑦ VALIDATION\\nstatus, date, capacity"];
  out [label="⑧ DÉCISION\\n✓ Valider  /  ✕ Refuser"];

  gen -> pld -> tpl -> snd -> scn -> res -> val -> out
    [color="{GOLD}" penwidth=1.5];

  rev [label="↻ REVOCATION\\n(perte · fraude · refund)\\nrevoked=true" fillcolor="#FAF7F2"];
  scn -> rev [style=dashed dir=back color="{SOFT}"];
}}
"""

# ── 7. API MAP ──────────────────────────────────────────────────────
diagram_7 = f"""
digraph G {{
  rankdir=LR; nodesep=0.3; ranksep=0.6;
{COMMON_GRAPH}
  node [shape=record style=filled fillcolor="{WHITE}"];

  pub [label="{{<h>API PUBLIQUE  · /api/booking|
GET  /catalog/products\\l
GET  /catalog/availability\\l
POST /quote\\l
POST /reservations\\l
POST /reservations/\\{{id\\}}/pay\\l
GET  /reservations/\\{{ref\\}}\\l
PATCH /reservations/\\{{id\\}}\\l
POST /reservations/\\{{id\\}}/cancel\\l
GET  /reservations/\\{{id\\}}/ticket.pdf\\l
}}" fillcolor="#FFF8E8"];

  client [label="{{<h>ESPACE CLIENT  · /api/account|
POST /auth/otp/send\\l
POST /auth/otp/verify\\l
GET  /me/reservations\\l
GET  /me/tickets\\l
POST /me/reservations/\\{{id\\}}/pay-balance\\l
POST /me/reservations/\\{{id\\}}/reschedule\\l
}}" fillcolor="#FFF8E8"];

  staff [label="{{<h>STAFF  · /api/staff/booking|
GET  /bookings\\l
GET  /bookings/today\\l
POST /bookings/\\{{id\\}}/checkin\\l
POST /scan/\\{{token\\}}\\l
POST /bookings/manual\\l
POST /bookings/\\{{id\\}}/refund\\l
GET  /kpis\\l
}}" fillcolor="#FFE9B0"];

  webhooks [label="{{<h>WEBHOOKS ENTRANTS|
POST /webhooks/wave\\l
POST /webhooks/orange-money\\l
POST /webhooks/mtn-money\\l
POST /webhooks/moov-money\\l
POST /webhooks/stripe\\l
POST /webhooks/paypal\\l
POST /webhooks/ota/booking-com\\l
POST /webhooks/ota/airbnb\\l
}}" fillcolor="#FAF7F2"];

  pub -> staff [style=invis];
  client -> staff [style=invis];
  staff -> webhooks [style=invis];
}}
"""

# ── 8. PMS + OTA TOPOLOGY ────────────────────────────────────────────
diagram_8 = f"""
digraph G {{
  rankdir=TB; nodesep=0.4; ranksep=0.6;
{COMMON_GRAPH}

  be [label="BOOKING ENGINE\\n(source de vérité)"
      shape=doublecircle fillcolor="#FFE9B0" penwidth=2];

  subgraph cluster_ota {{
    label="DISTRIBUTION OTA — sortants";
    labeljust=l; color="{GOLD}"; style="rounded,dashed"; fontcolor="{GOLD}";
    book [label="Booking.com\\n(XML / API v2)"];
    abnb [label="Airbnb\\n(GraphQL)"];
    expe [label="Expedia\\n(EQC API)"];
    trav [label="TravelOka\\n(REST)"];
    direct [label="Site direct BBR\\n(le canal le plus rentable)" fillcolor="#FFF8E8"];
  }}

  subgraph cluster_pms {{
    label="PMS / FRONT DESK / HOUSEKEEPING";
    labeljust=l; color="{INK}"; style="rounded,dashed";
    pms_room [label="Module Chambres\\n(tape chart · état)"];
    pms_hk [label="Housekeeping\\n(propre · sale · OOS)"];
    pms_fb [label="F&B Restaurant\\n(POS + Le Kaai)"];
    pms_acct [label="Comptabilité\\n(facturation · TVA)"];
  }}

  subgraph cluster_chan {{
    label="CHANNEL MANAGER (workers Celery)";
    labeljust=l; color="{GOLD}"; style="rounded";
    chmgr [label="Channel Manager\\n(push prix + stocks toutes les 5 min)"
           fillcolor="#FFF8E8"];
  }}

  be -> chmgr [color="{GOLD}" penwidth=2 label="prix + dispo"];
  chmgr -> book; chmgr -> abnb; chmgr -> expe; chmgr -> trav;
  be -> direct [color="{GOLD}" penwidth=2];

  // Réservations OTA -> Booking Engine
  book -> be   [dir=back style=dashed color="{SOFT}" label="webhooks bookings"];
  abnb -> be   [dir=back style=dashed color="{SOFT}"];
  expe -> be   [dir=back style=dashed color="{SOFT}"];
  trav -> be   [dir=back style=dashed color="{SOFT}"];

  // Booking Engine -> PMS
  be -> pms_room [label="checkin · attribution"];
  be -> pms_hk [label="post-checkout\\n→ chambre à nettoyer" color="{SOFT}"];
  be -> pms_fb [label="forfaits inclus"];
  be -> pms_acct [label="facturation"];
}}
"""

render(diagram_1, "01_booking_architecture")
render(diagram_2, "02_funnel_tunnel", dpi=160)
render(diagram_3, "03_wireframes", dpi=160)
render(diagram_4, "04_state_machine")
render(diagram_5, "05_payment_sequence")
render(diagram_6, "06_qr_lifecycle")
render(diagram_7, "07_api_map", dpi=160)
render(diagram_8, "08_pms_ota_topology")
print("\nAll booking-engine diagrams generated.")
