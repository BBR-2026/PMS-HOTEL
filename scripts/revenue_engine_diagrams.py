"""Generate all architecture diagrams for the BBR Revenue Engine PDF.

Diagrams:
    1. /app/manual_assets/revenue_engine/01_system_architecture.png
    2. /app/manual_assets/revenue_engine/02_modules_uml.png
    3. /app/manual_assets/revenue_engine/03_erd.png
    4. /app/manual_assets/revenue_engine/04_booking_sequence.png
    5. /app/manual_assets/revenue_engine/05_role_matrix.png
"""
import os
import subprocess

OUT = "/app/manual_assets/revenue_engine"
os.makedirs(OUT, exist_ok=True)

GOLD = "#B8922A"
INK = "#0A0A0A"
CREAM = "#FAF7F2"
SOFT = "#5F6670"
WHITE = "#FFFFFF"

COMMON_GRAPH = f"""
  graph [bgcolor="{CREAM}" fontname="Helvetica" fontsize=11 splines=ortho];
  node  [fontname="Helvetica" fontsize=10 shape=box style="rounded,filled"
         fillcolor="{WHITE}" color="{INK}" penwidth=1.0 margin="0.2,0.12"];
  edge  [fontname="Helvetica" fontsize=9 color="{SOFT}" arrowsize=0.7];
"""


def render(dot_src: str, out_basename: str, dpi: int = 150):
    src = os.path.join(OUT, f"{out_basename}.dot")
    out = os.path.join(OUT, f"{out_basename}.png")
    with open(src, "w") as f:
        f.write(dot_src)
    subprocess.run(
        ["dot", "-Tpng", f"-Gdpi={dpi}", src, "-o", out], check=True,
    )
    print(f"✓ {out}")


# ─────────────────────────────────────────────────────────────────────
# 1. SYSTEM ARCHITECTURE — global cohabitation view
# ─────────────────────────────────────────────────────────────────────
diagram_1 = f"""
digraph G {{
  rankdir=TB; nodesep=0.5; ranksep=0.7;
{COMMON_GRAPH}

  subgraph cluster_clients {{
    label="① CLIENTS (Web · Mobile · Concierges)";
    labeljust=l; color="{GOLD}"; style="rounded,dashed"; fontcolor="{GOLD}";
    web   [label="Site vitrine\\n(bbr.com)" fillcolor="#FFFFFF"];
    app   [label="Web App\\nRéservation" fillcolor="#FFFFFF"];
    qr    [label="QR Code Boarding Pass\\n(WhatsApp / Email)" fillcolor="#FFFFFF"];
  }}

  subgraph cluster_edge {{
    label="② EDGE — Cloudflare CDN + WAF";
    labeljust=l; color="{GOLD}"; style="rounded,dashed"; fontcolor="{GOLD}";
    cf    [label="Cloudflare\\nCDN · DDoS · WAF" fillcolor="#FFE9B0"];
  }}

  subgraph cluster_ops {{
    label="③ COUCHE OPÉRATIONNELLE — BBR Operations (existant)";
    labeljust=l; color="{INK}"; style="rounded,filled"; fillcolor="{WHITE}";
    react_ops [label="React 18 + Vite\\n/staff/* · /cantine · /accueil"];
    fastapi   [label="FastAPI\\n/api/* (700+ endpoints)" fillcolor="#FFE9B0"];
    mongo     [label="MongoDB\\n(opérationnel temps réel)" shape=cylinder
              style=filled fillcolor="#E5D9C0"];
    pillow    [label="Pillow / ReportLab\\nBoarding Pass + Manuels"];
  }}

  subgraph cluster_rev {{
    label="④ COUCHE COMMERCIALE — BBR Revenue Engine (nouveau)";
    labeljust=l; color="{GOLD}"; style="rounded,filled"; fillcolor="#FFF8E8";
    react_rev [label="React 18 + Vite\\n/revenue/* (sous-app)" fillcolor="{WHITE}"];
    fastapi_rev [label="FastAPI Revenue\\n/api/revenue/*" fillcolor="#FFE9B0"];
    pg        [label="PostgreSQL 16\\n(CRM · OTA · Marketing · Analytics)"
              shape=cylinder style=filled fillcolor="#E5D9C0"];
    redis     [label="Redis\\n(cache · jobs · rate-limit)"
              shape=cylinder style=filled fillcolor="#E5D9C0"];
  }}

  subgraph cluster_ext {{
    label="⑤ INTÉGRATIONS EXTERNES";
    labeljust=l; color="{SOFT}"; style="rounded,dashed"; fontcolor="{SOFT}";
    ota   [label="OTA Channel Manager\\nBooking · Airbnb · Expedia"];
    meta  [label="Meta Business\\n(Pixel · Conversions API)"];
    gads  [label="Google Ads\\n(GA4 · Tag · Conversions)"];
    pay   [label="Paiement\\nFineoPay · Stripe"];
    msg   [label="Messaging\\nTwilio · SendGrid"];
  }}

  // Flows
  web -> cf; app -> cf; qr -> cf;
  cf -> react_ops [label="opérations"];
  cf -> react_rev [label="commercial"];
  react_ops -> fastapi;
  react_rev -> fastapi_rev;
  fastapi -> mongo;
  fastapi -> pillow;
  fastapi_rev -> pg;
  fastapi_rev -> redis;

  // Bridge between Ops and Revenue Engine
  fastapi -> fastapi_rev [label="Events (booking · paiement)\\nWebhooks"
                          color="{GOLD}" penwidth=2 style=bold];
  fastapi_rev -> fastapi [label="Sync prix · stocks · CRM"
                          color="{GOLD}" penwidth=2 style=bold dir=back];

  // External integrations
  fastapi_rev -> ota   [label="REST · iCal"];
  fastapi_rev -> meta  [label="CAPI"];
  fastapi_rev -> gads  [label="API"];
  fastapi -> pay       [label="HTTPS"];
  fastapi -> msg       [label="HTTPS"];
}}
"""

# ─────────────────────────────────────────────────────────────────────
# 2. MODULES UML — 9 functional modules with cross-references
# ─────────────────────────────────────────────────────────────────────
diagram_2 = f"""
digraph G {{
  rankdir=LR; nodesep=0.4; ranksep=0.8;
{COMMON_GRAPH}
  node [shape=record fillcolor="{WHITE}"];

  hotel [label="{{<h>Module HÔTEL|+ Chambres Exclusives\\l+ Suites Lagune\\l+ Suites Jardin\\l+ Tape Chart (calendrier)\\l+ Tarifs saisonniers\\l+ Yield rules\\l}}" fillcolor="#FFF8E8"];

  beach [label="{{<h>Module BEACH CLUB|+ Day Pass\\l+ Sunset Experience\\l+ Brunch dominical\\l+ Quota journalier\\l+ Pré-achat groupes\\l}}" fillcolor="#FFF8E8"];

  acti  [label="{{<h>Module ACTIVITÉS|+ Jet Ski · Paddle · Canoë\\l+ Quad · Buggy · VTT\\l+ Padel · Multisports\\l+ Slots horaires\\l+ Encadrants\\l}}" fillcolor="#FFF8E8"];

  corp  [label="{{<h>Module CORPORATE|+ Séminaires · Conférences\\l+ Team Building\\l+ Journées d'étude\\l+ Devis · Contrats\\l+ Pipeline commercial\\l}}" fillcolor="#FFF8E8"];

  event [label="{{<h>Module ÉVÉNEMENTIEL|+ Mariages · Anniversaires\\l+ Privés · Concerts · Soirées\\l+ Forfaits packagés\\l+ Espaces réservables\\l+ Devis personnalisés\\l}}" fillcolor="#FFF8E8"];

  member [label="{{<h>Module MEMBERSHIP|+ Cartes (Bronze · Or · Platine)\\l+ Avantages (%, accès, surclassement)\\l+ Historique d'utilisation\\l+ Renouvellement auto\\l}}" fillcolor="#FFF8E8"];

  crm   [label="{{<h>Module CRM|+ Clients individuels\\l+ Entreprises\\l+ Historique achats / séjours\\l+ Préférences (allergies, etc.)\\l+ Segmentation RFM\\l+ Score fidélité\\l+ Lifetime Value\\l}}" fillcolor="#FFE9B0"];

  mkt   [label="{{<h>Module MARKETING|+ Campagnes Meta\\l+ Campagnes Google Ads\\l+ Pixels · Conversions API\\l+ UTM tracking\\l+ Email · WhatsApp blasts\\l+ Sources d'acquisition\\l}}" fillcolor="#FFE9B0"];

  ana   [label="{{<h>Module ANALYTICS|+ KPIs temps réel\\l+ Funnels de conversion\\l+ Attribution multi-touch\\l+ Cohortes & rétention\\l+ Pacing budgétaire\\l+ Forecast IA\\l}}" fillcolor="#FFE9B0"];

  // CRM is central
  crm -> hotel  [label="profil client"];
  crm -> beach  [label="profil client"];
  crm -> acti   [label="profil client"];
  crm -> corp   [label="entreprise"];
  crm -> event  [label="organisateur"];
  crm -> member [label="détenteur"];

  // Marketing feeds CRM
  mkt -> crm [label="acquisition\\n+ tracking" color="{GOLD}" penwidth=1.6];

  // Analytics consumes everything
  hotel -> ana  [style=dashed];
  beach -> ana  [style=dashed];
  acti  -> ana  [style=dashed];
  corp  -> ana  [style=dashed];
  event -> ana  [style=dashed];
  member -> ana [style=dashed];
  mkt   -> ana  [style=dashed];
  crm   -> ana  [style=dashed];
}}
"""

# ─────────────────────────────────────────────────────────────────────
# 3. ENTITY-RELATIONSHIP DIAGRAM — PostgreSQL schema
# ─────────────────────────────────────────────────────────────────────
diagram_3 = f"""
digraph G {{
  rankdir=LR; nodesep=0.35; ranksep=0.6;
{COMMON_GRAPH}
  node [shape=plaintext];

  users [label=<
    <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4"
           BGCOLOR="white">
      <TR><TD BGCOLOR="{GOLD}" COLSPAN="2"><FONT COLOR="white"><B>users</B></FONT></TD></TR>
      <TR><TD ALIGN="left">id</TD><TD ALIGN="left">UUID PK</TD></TR>
      <TR><TD ALIGN="left">email</TD><TD ALIGN="left">CITEXT UQ</TD></TR>
      <TR><TD ALIGN="left">password_hash</TD><TD ALIGN="left">TEXT</TD></TR>
      <TR><TD ALIGN="left">role</TD><TD ALIGN="left">user_role</TD></TR>
      <TR><TD ALIGN="left">first_name · last_name</TD><TD ALIGN="left">TEXT</TD></TR>
      <TR><TD ALIGN="left">phone</TD><TD ALIGN="left">TEXT</TD></TR>
      <TR><TD ALIGN="left">status</TD><TD ALIGN="left">user_status</TD></TR>
      <TR><TD ALIGN="left">mfa_enabled</TD><TD ALIGN="left">BOOL</TD></TR>
      <TR><TD ALIGN="left">created_at</TD><TD ALIGN="left">TIMESTAMPTZ</TD></TR>
    </TABLE>>];

  customers [label=<
    <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="white">
      <TR><TD BGCOLOR="{GOLD}" COLSPAN="2"><FONT COLOR="white"><B>customers</B></FONT></TD></TR>
      <TR><TD ALIGN="left">id</TD><TD ALIGN="left">UUID PK</TD></TR>
      <TR><TD ALIGN="left">type</TD><TD ALIGN="left">individual · company</TD></TR>
      <TR><TD ALIGN="left">email · phone</TD><TD ALIGN="left">TEXT</TD></TR>
      <TR><TD ALIGN="left">first_name · last_name</TD><TD ALIGN="left">TEXT</TD></TR>
      <TR><TD ALIGN="left">company_name · vat_id</TD><TD ALIGN="left">TEXT</TD></TR>
      <TR><TD ALIGN="left">nationality · language</TD><TD ALIGN="left">TEXT</TD></TR>
      <TR><TD ALIGN="left">date_of_birth</TD><TD ALIGN="left">DATE</TD></TR>
      <TR><TD ALIGN="left">preferences</TD><TD ALIGN="left">JSONB</TD></TR>
      <TR><TD ALIGN="left">loyalty_score</TD><TD ALIGN="left">INT</TD></TR>
      <TR><TD ALIGN="left">lifetime_value</TD><TD ALIGN="left">NUMERIC</TD></TR>
      <TR><TD ALIGN="left">rfm_segment</TD><TD ALIGN="left">TEXT</TD></TR>
      <TR><TD ALIGN="left">acquisition_source_id</TD><TD ALIGN="left">UUID FK</TD></TR>
    </TABLE>>];

  products [label=<
    <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="white">
      <TR><TD BGCOLOR="{GOLD}" COLSPAN="2"><FONT COLOR="white"><B>products</B></FONT></TD></TR>
      <TR><TD ALIGN="left">id</TD><TD ALIGN="left">UUID PK</TD></TR>
      <TR><TD ALIGN="left">category</TD><TD ALIGN="left">product_category</TD></TR>
      <TR><TD ALIGN="left">module</TD><TD ALIGN="left">module_type</TD></TR>
      <TR><TD ALIGN="left">code · name_fr · name_en</TD><TD ALIGN="left">TEXT</TD></TR>
      <TR><TD ALIGN="left">description</TD><TD ALIGN="left">TEXT</TD></TR>
      <TR><TD ALIGN="left">base_price</TD><TD ALIGN="left">NUMERIC</TD></TR>
      <TR><TD ALIGN="left">capacity</TD><TD ALIGN="left">INT</TD></TR>
      <TR><TD ALIGN="left">attributes</TD><TD ALIGN="left">JSONB</TD></TR>
      <TR><TD ALIGN="left">status</TD><TD ALIGN="left">product_status</TD></TR>
    </TABLE>>];

  inventory [label=<
    <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="white">
      <TR><TD BGCOLOR="{GOLD}" COLSPAN="2"><FONT COLOR="white"><B>inventory</B></FONT></TD></TR>
      <TR><TD ALIGN="left">id</TD><TD ALIGN="left">UUID PK</TD></TR>
      <TR><TD ALIGN="left">product_id</TD><TD ALIGN="left">UUID FK</TD></TR>
      <TR><TD ALIGN="left">date</TD><TD ALIGN="left">DATE</TD></TR>
      <TR><TD ALIGN="left">slot</TD><TD ALIGN="left">TEXT</TD></TR>
      <TR><TD ALIGN="left">capacity_total</TD><TD ALIGN="left">INT</TD></TR>
      <TR><TD ALIGN="left">capacity_sold</TD><TD ALIGN="left">INT</TD></TR>
      <TR><TD ALIGN="left">price_override</TD><TD ALIGN="left">NUMERIC</TD></TR>
    </TABLE>>];

  reservations [label=<
    <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="white">
      <TR><TD BGCOLOR="{GOLD}" COLSPAN="2"><FONT COLOR="white"><B>reservations</B></FONT></TD></TR>
      <TR><TD ALIGN="left">id</TD><TD ALIGN="left">UUID PK</TD></TR>
      <TR><TD ALIGN="left">reference</TD><TD ALIGN="left">TEXT UQ</TD></TR>
      <TR><TD ALIGN="left">customer_id</TD><TD ALIGN="left">UUID FK</TD></TR>
      <TR><TD ALIGN="left">product_id</TD><TD ALIGN="left">UUID FK</TD></TR>
      <TR><TD ALIGN="left">date_in · date_out</TD><TD ALIGN="left">DATE</TD></TR>
      <TR><TD ALIGN="left">slot</TD><TD ALIGN="left">TEXT</TD></TR>
      <TR><TD ALIGN="left">adults · children</TD><TD ALIGN="left">INT</TD></TR>
      <TR><TD ALIGN="left">amount_total · paid</TD><TD ALIGN="left">NUMERIC</TD></TR>
      <TR><TD ALIGN="left">status</TD><TD ALIGN="left">reservation_status</TD></TR>
      <TR><TD ALIGN="left">channel_id</TD><TD ALIGN="left">UUID FK</TD></TR>
      <TR><TD ALIGN="left">campaign_id</TD><TD ALIGN="left">UUID FK</TD></TR>
      <TR><TD ALIGN="left">membership_id</TD><TD ALIGN="left">UUID FK</TD></TR>
      <TR><TD ALIGN="left">created_at</TD><TD ALIGN="left">TIMESTAMPTZ</TD></TR>
    </TABLE>>];

  payments [label=<
    <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="white">
      <TR><TD BGCOLOR="{GOLD}" COLSPAN="2"><FONT COLOR="white"><B>payments</B></FONT></TD></TR>
      <TR><TD ALIGN="left">id</TD><TD ALIGN="left">UUID PK</TD></TR>
      <TR><TD ALIGN="left">reservation_id</TD><TD ALIGN="left">UUID FK</TD></TR>
      <TR><TD ALIGN="left">type</TD><TD ALIGN="left">deposit · final · refund</TD></TR>
      <TR><TD ALIGN="left">method</TD><TD ALIGN="left">card · cash · transfer</TD></TR>
      <TR><TD ALIGN="left">provider · provider_ref</TD><TD ALIGN="left">TEXT</TD></TR>
      <TR><TD ALIGN="left">amount</TD><TD ALIGN="left">NUMERIC</TD></TR>
      <TR><TD ALIGN="left">currency</TD><TD ALIGN="left">CHAR(3)</TD></TR>
      <TR><TD ALIGN="left">status</TD><TD ALIGN="left">payment_status</TD></TR>
    </TABLE>>];

  qr_codes [label=<
    <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="white">
      <TR><TD BGCOLOR="{GOLD}" COLSPAN="2"><FONT COLOR="white"><B>qr_codes</B></FONT></TD></TR>
      <TR><TD ALIGN="left">id</TD><TD ALIGN="left">UUID PK</TD></TR>
      <TR><TD ALIGN="left">reservation_id</TD><TD ALIGN="left">UUID FK</TD></TR>
      <TR><TD ALIGN="left">token</TD><TD ALIGN="left">TEXT UQ</TD></TR>
      <TR><TD ALIGN="left">type</TD><TD ALIGN="left">ticket · wallet · regist.</TD></TR>
      <TR><TD ALIGN="left">scan_count</TD><TD ALIGN="left">INT</TD></TR>
      <TR><TD ALIGN="left">last_scan_at</TD><TD ALIGN="left">TIMESTAMPTZ</TD></TR>
      <TR><TD ALIGN="left">last_scan_by</TD><TD ALIGN="left">UUID FK users</TD></TR>
    </TABLE>>];

  channels [label=<
    <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="white">
      <TR><TD BGCOLOR="{GOLD}" COLSPAN="2"><FONT COLOR="white"><B>channels</B></FONT></TD></TR>
      <TR><TD ALIGN="left">id</TD><TD ALIGN="left">UUID PK</TD></TR>
      <TR><TD ALIGN="left">code</TD><TD ALIGN="left">direct · booking · airbnb · …</TD></TR>
      <TR><TD ALIGN="left">name · commission_pct</TD><TD ALIGN="left">TEXT · NUMERIC</TD></TR>
      <TR><TD ALIGN="left">api_endpoint · api_creds_ref</TD><TD ALIGN="left">TEXT</TD></TR>
      <TR><TD ALIGN="left">sync_strategy</TD><TD ALIGN="left">push · ical · poll</TD></TR>
    </TABLE>>];

  channel_mappings [label=<
    <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="white">
      <TR><TD BGCOLOR="{GOLD}" COLSPAN="2"><FONT COLOR="white"><B>channel_product_map</B></FONT></TD></TR>
      <TR><TD ALIGN="left">id</TD><TD ALIGN="left">UUID PK</TD></TR>
      <TR><TD ALIGN="left">channel_id · product_id</TD><TD ALIGN="left">UUID FK</TD></TR>
      <TR><TD ALIGN="left">external_id</TD><TD ALIGN="left">TEXT</TD></TR>
      <TR><TD ALIGN="left">price_uplift_pct</TD><TD ALIGN="left">NUMERIC</TD></TR>
      <TR><TD ALIGN="left">availability_pct</TD><TD ALIGN="left">NUMERIC</TD></TR>
    </TABLE>>];

  campaigns [label=<
    <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="white">
      <TR><TD BGCOLOR="{GOLD}" COLSPAN="2"><FONT COLOR="white"><B>campaigns</B></FONT></TD></TR>
      <TR><TD ALIGN="left">id</TD><TD ALIGN="left">UUID PK</TD></TR>
      <TR><TD ALIGN="left">platform</TD><TD ALIGN="left">meta · gads · email · whatsapp</TD></TR>
      <TR><TD ALIGN="left">name · objective</TD><TD ALIGN="left">TEXT</TD></TR>
      <TR><TD ALIGN="left">target_module</TD><TD ALIGN="left">module_type</TD></TR>
      <TR><TD ALIGN="left">budget · spent</TD><TD ALIGN="left">NUMERIC</TD></TR>
      <TR><TD ALIGN="left">starts_at · ends_at</TD><TD ALIGN="left">TIMESTAMPTZ</TD></TR>
      <TR><TD ALIGN="left">utm_source · medium · campaign</TD><TD ALIGN="left">TEXT</TD></TR>
      <TR><TD ALIGN="left">status</TD><TD ALIGN="left">campaign_status</TD></TR>
    </TABLE>>];

  memberships [label=<
    <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="white">
      <TR><TD BGCOLOR="{GOLD}" COLSPAN="2"><FONT COLOR="white"><B>memberships</B></FONT></TD></TR>
      <TR><TD ALIGN="left">id</TD><TD ALIGN="left">UUID PK</TD></TR>
      <TR><TD ALIGN="left">customer_id</TD><TD ALIGN="left">UUID FK</TD></TR>
      <TR><TD ALIGN="left">card_no</TD><TD ALIGN="left">TEXT UQ</TD></TR>
      <TR><TD ALIGN="left">tier</TD><TD ALIGN="left">bronze · gold · platinum</TD></TR>
      <TR><TD ALIGN="left">starts_at · expires_at</TD><TD ALIGN="left">DATE</TD></TR>
      <TR><TD ALIGN="left">benefits</TD><TD ALIGN="left">JSONB</TD></TR>
      <TR><TD ALIGN="left">status</TD><TD ALIGN="left">membership_status</TD></TR>
    </TABLE>>];

  events [label=<
    <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="white">
      <TR><TD BGCOLOR="{GOLD}" COLSPAN="2"><FONT COLOR="white"><B>analytics_events</B></FONT></TD></TR>
      <TR><TD ALIGN="left">id</TD><TD ALIGN="left">UUID PK</TD></TR>
      <TR><TD ALIGN="left">session_id · visitor_id</TD><TD ALIGN="left">UUID</TD></TR>
      <TR><TD ALIGN="left">customer_id</TD><TD ALIGN="left">UUID FK (nullable)</TD></TR>
      <TR><TD ALIGN="left">event_type</TD><TD ALIGN="left">page_view · click · conv.</TD></TR>
      <TR><TD ALIGN="left">page · referrer</TD><TD ALIGN="left">TEXT</TD></TR>
      <TR><TD ALIGN="left">utm_source · medium · campaign</TD><TD ALIGN="left">TEXT</TD></TR>
      <TR><TD ALIGN="left">value</TD><TD ALIGN="left">NUMERIC</TD></TR>
      <TR><TD ALIGN="left">props</TD><TD ALIGN="left">JSONB</TD></TR>
      <TR><TD ALIGN="left">occurred_at</TD><TD ALIGN="left">TIMESTAMPTZ</TD></TR>
    </TABLE>>];

  audit [label=<
    <TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4" BGCOLOR="white">
      <TR><TD BGCOLOR="{GOLD}" COLSPAN="2"><FONT COLOR="white"><B>audit_log</B></FONT></TD></TR>
      <TR><TD ALIGN="left">id</TD><TD ALIGN="left">UUID PK</TD></TR>
      <TR><TD ALIGN="left">actor_id</TD><TD ALIGN="left">UUID FK users</TD></TR>
      <TR><TD ALIGN="left">entity_type · entity_id</TD><TD ALIGN="left">TEXT · UUID</TD></TR>
      <TR><TD ALIGN="left">action</TD><TD ALIGN="left">create · update · delete</TD></TR>
      <TR><TD ALIGN="left">diff</TD><TD ALIGN="left">JSONB</TD></TR>
      <TR><TD ALIGN="left">ip · user_agent</TD><TD ALIGN="left">TEXT</TD></TR>
      <TR><TD ALIGN="left">occurred_at</TD><TD ALIGN="left">TIMESTAMPTZ</TD></TR>
    </TABLE>>];

  // Relationships
  reservations -> customers [label="N..1"];
  reservations -> products  [label="N..1"];
  reservations -> channels  [label="N..1"];
  reservations -> campaigns [label="N..1 (attribution)"];
  reservations -> memberships [label="N..1"];
  payments -> reservations [label="N..1"];
  qr_codes -> reservations [label="N..1"];
  inventory -> products [label="N..1"];
  channel_mappings -> channels [label="N..1"];
  channel_mappings -> products [label="N..1"];
  memberships -> customers [label="N..1"];
  events -> customers [label="N..1 (opt)"];
  events -> campaigns [label="N..1 (attribution)"];
  audit -> users [label="N..1"];
}}
"""

# ─────────────────────────────────────────────────────────────────────
# 4. BOOKING SEQUENCE DIAGRAM
# ─────────────────────────────────────────────────────────────────────
diagram_4 = f"""
digraph G {{
  rankdir=TB; nodesep=0.3; ranksep=0.4;
{COMMON_GRAPH}
  node [shape=box style="rounded,filled" fillcolor="{WHITE}"];

  c1 [label="① Visiteur clique\\nMeta Ad (UTM tracking)"];
  c2 [label="② Atterrit sur le\\nsite vitrine BBR"];
  c3 [label="③ Choisit Day Pass\\n→ moteur de réservation"];
  c4 [label="④ Revenue Engine\\nvérifie inventory PG"];
  c5 [label="⑤ Affiche prix\\n(+ yield + tier membership)"];
  c6 [label="⑥ Soumet booking\\n+ paiement FineoPay/Stripe"];
  c7 [label="⑦ Webhook paiement OK\\n→ Operations crée booking Mongo"];
  c8 [label="⑧ Génère QR Code\\n(Pillow, ECC=M, 440px)"];
  c9 [label="⑨ Envoie WhatsApp + Email\\n(Twilio · SendGrid)"];
  c10 [label="⑩ Sync inventory\\n→ OTA channel manager"];
  c11 [label="⑪ Évènement \\"conversion\\"\\n→ analytics_events + CAPI Meta"];
  c12 [label="⑫ Recalcul CRM\\nLTV · loyalty_score · RFM"];
  c13 [label="⑬ Update campaign.spent\\nROAS / CPA / Pacing"];
  c14 [label="⑭ Jour J — Scanner QR\\n→ checkin + audit_log"];

  c1->c2->c3->c4->c5->c6->c7->c8->c9->c10->c11->c12->c13->c14;

  // side branches
  c7 -> c10 [style=dashed color="{GOLD}" label="parallèle"];
  c7 -> c11 [style=dashed color="{GOLD}"];
  c12 -> c13 [style=dashed color="{SOFT}"];
}}
"""

# ─────────────────────────────────────────────────────────────────────
# 5. ROLE MATRIX
# ─────────────────────────────────────────────────────────────────────
diagram_5 = f"""
digraph G {{
  rankdir=LR; nodesep=0.3; ranksep=0.5;
{COMMON_GRAPH}
  node [shape=record style=filled fillcolor="{WHITE}"];

  super  [label="{{Super Admin|R/W tous modules\\lGestion utilisateurs\\lConfiguration système\\l}}" fillcolor="#FFE9B0"];
  direction [label="{{Direction Générale|R global\\lExports stratégiques\\lValidation des prix\\l}}" fillcolor="{WHITE}"];
  marketing [label="{{Marketing|R/W Campagnes\\lR/W Marketing\\lR CRM (segments)\\lR Analytics\\l}}" fillcolor="{WHITE}"];
  reception [label="{{Réception|R/W Réservations\\lR/W Check-in/out\\lR CRM (lecture)\\lScanner QR\\l}}" fillcolor="{WHITE}"];
  compta    [label="{{Comptabilité|R/W Paiements\\lR/W Factures\\lR Réservations\\lExports compta\\l}}" fillcolor="{WHITE}"];
  commercial [label="{{Commercial|R/W Corporate\\lR/W Évènementiel\\lR/W Devis · Contrats\\lR CRM B2B\\l}}" fillcolor="{WHITE}"];
  scan       [label="{{Contrôle Embarquement|Scan QR uniquement\\lValidation tickets\\lAccès visiteurs\\l}}" fillcolor="{WHITE}"];

  super -> direction -> marketing -> reception -> compta -> commercial -> scan [style=invis];
}}
"""

# Render everything
render(diagram_1, "01_system_architecture")
render(diagram_2, "02_modules_uml")
render(diagram_3, "03_erd", dpi=160)
render(diagram_4, "04_booking_sequence")
render(diagram_5, "05_role_matrix")
print("\nAll diagrams generated successfully.")
