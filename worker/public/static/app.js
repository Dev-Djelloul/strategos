// Strategos — globe des conflits (CesiumJS + H3).
//
// Rendu des événements : à l'échelle du monde/d'une région, des colonnes
// hexagonales 3D (grille H3) dont la hauteur et la couleur suivent
// l'intensité (événements pondérés par les victimes) ; en zoomant, des
// marqueurs lumineux individuels. Le contrôle territorial (Ukraine) est
// dessiné en hexagones posés au sol ; les autres couches en icônes regroupées.
(async () => {

// ───────────────────────── Internationalisation (FR/EN) ─────────────────────────
// Traduction de l'interface (chrome statique + vocabulaire récurrent des
// panneaux/cartes). La page /methodologie (prose longue) reste en français
// pour l'instant — hors périmètre de cette première version.
let LANG = localStorage.getItem("strategos_lang") === "en" ? "en" : "fr";
const UI_I18N = {
  fr: {
    tagline: "Conflits et tensions géopolitiques",
    methodology_link: "Sources et méthodologie",
    clock_utc: "Heure universelle",
    clock_local: "Heure locale",
    search_placeholder: "Rechercher un lieu, un pays, une ville…",
    in_view_title: "Dans la vue",
    scope_world: "Monde entier",
    scope_zone: "Zone visible",
    stat_events: "événements",
    stat_fatalities: "victimes*",
    stat_verified: "qualifiés",
    fatalities_note: "victimes déclarées par les sources qualifiées (UCDP) ; la presse n'en fournit pas.",
    trend_title: "Tendance",
    daily_title: "Résumé du jour",
    daily_subtitle: "Dernières 24 h · monde entier",
    loading: "Chargement…",
    live_title: "Nouveaux événements",
    live_subtitle: "Depuis l'ouverture",
    push_enable: "🔔 Activer les notifications",
    push_disable: "🔕 Désactiver les notifications",
    push_unsupported: "🔕 Notifications non disponibles",
    push_unsupported_status: "Ce navigateur ne prend pas en charge les notifications push.",
    push_denied: "🔕 Notifications bloquées",
    push_denied_status: "Autorise les notifications pour ce site dans les réglages du navigateur.",
    push_subscribed_status: "Tu seras notifié quand un nouvel événement apparaît, même onglet en arrière-plan.",
    push_countries_title: "Laisse vide pour être notifié de tous les pays suivis",
    push_countries_label: "Limiter aux pays (optionnel)",
    push_filter_updated: "Filtre mis à jour.",
    push_filter_all: "Notifié pour tous les pays suivis.",
    period_title: "Période",
    period_24h: "24 h",
    period_7d: "7 j",
    period_30d: "30 j",
    period_90d: "90 j",
    filter_country: "Pays",
    filter_type: "Type",
    all_fem: "Tous",
    all_masc: "Tous",
    sources_title: "Sources de conflits",
    ucdp_title: "Uppsala Conflict Data Program — référence académique, environ 2 semaines de décalage",
    gdelt_title: "Détection automatique dans la presse mondiale — non vérifié",
    gdelt_label: "GDELT · presse",
    press_toggle_title: "Décoché : seuls les événements appuyés par une source qualifiée restent",
    press_toggle_label: "Inclure les événements « presse seule »",
    layers_title: "Couches",
    control_ukraine_title: "Contrôle territorial des localités en Ukraine (VIINA) — estimation agrégée. Bleu : tenu par l'Ukraine · Orange : contesté · Rouge : sous contrôle russe",
    control_ukraine_label: "Contrôle territorial · Ukraine",
    control_yemen_title: "Zones de contrôle par district au Yémen (ACAPS) — mise à jour environ trimestrielle. Bleu : gouvernement internationalement reconnu (IRG) · Rouge : autorités de facto/Ansar Allah (DFA)",
    control_yemen_label: "Contrôle territorial · Yémen",
    control_westbank_title: "Zones A/B/C de Cisjordanie (accords d'Oslo, OCHA) — classification LÉGALE statique, pas une ligne de front. Bleu : contrôle palestinien (A) · Orange : mixte (B) · Rouge : contrôle israélien (C) · Violet : Jérusalem-Est. Gaza non couvert : aucune source fiable et à jour trouvée.",
    control_westbank_label: "Contrôle territorial · Cisjordanie",
    nuclear_label: "☢️ Sites nucléaires civils",
    military_label: "🎖️ Bases militaires",
    infra_label: "✈️ Infrastructures",
    navigation_title: "Navigation",
    goto_label: "Aller à",
    goto_placeholder: "Choisir une région…",
    mode_auto: "Auto",
    mode_auto_title: "Hexagones de loin, marqueurs de près",
    mode_hex: "Hexagones",
    mode_hex_title: "Colonnes hexagonales 3D",
    mode_markers: "Marqueurs",
    mode_markers_title: "Marqueurs individuels",
    photo3d_title: "Villes et reliefs en 3D photoréaliste (Google via Cesium Ion), à zoom rapproché",
    photo3d_label: "Villes 3D photoréalistes",
    nav_hint: "Déplacement au sol : <kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> ou <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd> pour avancer/tourner, molette pour zoomer, glisser pour regarder autour.",
    daynight_title: "Ombre du soleil en temps réel (la face nocturne est sombre)",
    daynight_label: "Jour / nuit en temps réel",
    share_title: "Copie un lien vers cette vue exacte (période, filtres, caméra)",
    share_button: "🔗 Partager cette vue",
    share_copied: "Lien copié dans le presse-papiers !",
    refresh_button: "↻ Actualiser les données",
    legend_intensity: "Intensité",
    legend_low: "faible",
    legend_high: "forte",
    legend_confirmed: "confirmé",
    legend_verified: "qualifié",
    legend_press: "presse",
    default_event: "Événement",
    row_date: "Date",
    row_victims: "Victimes",
    row_precision: "Précision du lieu",
    row_country: "Pays",
    row_status: "Statut",
    row_type: "Type",
    row_operator: "Opérateur",
    row_region: "Région",
    row_localities_russian: "Localités sous contrôle russe",
    row_localities_contested: "Localités contestées",
    row_data_as_of: "Données au",
    row_governorate: "Gouvernorat",
    row_control: "Contrôle",
    unnamed: "Sans nom",
    items_title_default: "Événements",
    open_source_link: "Ouvrir la source ↗",
    zoom_to_place: "Zoomer sur le lieu",
    date_range_from: "du",
    date_range_to: "au",
    kind_nuclear: "Installation nucléaire civile",
    kind_military: "Site militaire",
    kind_infrastructure: "Infrastructure",
    control_kind_ukraine: "Contrôle territorial (Ukraine)",
    control_kind_yemen: "Contrôle territorial (Yémen)",
    control_kind_westbank: "Contrôle territorial (Cisjordanie)",
    zone_russian: "Zone sous contrôle russe",
    zone_contested: "Zone contestée",
    zone_liberated: "Zone récemment libérée",
    zone_default: "Zone",
    district_default: "District",
    items_title_changes: "Changements de main",
    change_to_russian: "passée sous contrôle russe",
    change_to_contested: "devenue contestée",
    change_liberated: "libérée",
    control_notes_ukraine: "Estimation par vote entre plusieurs sources (DeepStateMap, ISW, Wikipédia, presse), agrégée en hexagones de ~17 km. Ce n'est pas une ligne de front officielle.",
    control_notes_yemen: "Zones de contrôle par district (admin2), mise à jour environ trimestrielle par ACAPS. Ce n'est pas une ligne de front quotidienne.",
    hex_kind: "Zone d'activité",
    row_fatalities_qualified: "Victimes (sources qualifiées)",
    row_qualified_events: "Événements qualifiés",
    row_press_only: "Détectés par la presse seule",
  },
  en: {
    tagline: "Armed conflicts and geopolitical tensions",
    methodology_link: "Sources & methodology",
    clock_utc: "Universal time",
    clock_local: "Local time",
    search_placeholder: "Search a place, country, city…",
    in_view_title: "In view",
    scope_world: "Whole world",
    scope_zone: "Visible area",
    stat_events: "events",
    stat_fatalities: "fatalities*",
    stat_verified: "qualified",
    fatalities_note: "fatalities reported by qualified sources (UCDP); press sources don't provide them.",
    trend_title: "Trend",
    daily_title: "Today's summary",
    daily_subtitle: "Last 24 h · whole world",
    loading: "Loading…",
    live_title: "New events",
    live_subtitle: "Since opening",
    push_enable: "🔔 Enable notifications",
    push_disable: "🔕 Disable notifications",
    push_unsupported: "🔕 Notifications unavailable",
    push_unsupported_status: "This browser does not support push notifications.",
    push_denied: "🔕 Notifications blocked",
    push_denied_status: "Allow notifications for this site in your browser settings.",
    push_subscribed_status: "You'll be notified when a new event appears, even with the tab in the background.",
    push_countries_title: "Leave empty to be notified for every tracked country",
    push_countries_label: "Limit to countries (optional)",
    push_filter_updated: "Filter updated.",
    push_filter_all: "Notified for all tracked countries.",
    period_title: "Period",
    period_24h: "24 h",
    period_7d: "7 d",
    period_30d: "30 d",
    period_90d: "90 d",
    filter_country: "Country",
    filter_type: "Type",
    all_fem: "All",
    all_masc: "All",
    sources_title: "Conflict sources",
    ucdp_title: "Uppsala Conflict Data Program — academic reference, about 2 weeks of delay",
    gdelt_title: "Automatic detection in the world press — unverified",
    gdelt_label: "GDELT · press",
    press_toggle_title: "Unchecked: only events backed by a qualified source remain",
    press_toggle_label: "Include \"press only\" events",
    layers_title: "Layers",
    control_ukraine_title: "Territorial control of localities in Ukraine (VIINA) — aggregated estimate. Blue: held by Ukraine · Orange: contested · Red: under Russian control",
    control_ukraine_label: "Territorial control · Ukraine",
    control_yemen_title: "District-level control zones in Yemen (ACAPS) — updated roughly quarterly. Blue: internationally recognized government (IRG) · Red: de facto authorities/Ansar Allah (DFA)",
    control_yemen_label: "Territorial control · Yemen",
    control_westbank_title: "A/B/C zones of the West Bank (Oslo Accords, OCHA) — static LEGAL classification, not a front line. Blue: Palestinian control (A) · Orange: mixed (B) · Red: Israeli control (C) · Purple: East Jerusalem. Gaza not covered: no reliable, up-to-date source found.",
    control_westbank_label: "Territorial control · West Bank",
    nuclear_label: "☢️ Civilian nuclear sites",
    military_label: "🎖️ Military bases",
    infra_label: "✈️ Infrastructure",
    navigation_title: "Navigation",
    goto_label: "Go to",
    goto_placeholder: "Choose a region…",
    mode_auto: "Auto",
    mode_auto_title: "Hexagons when zoomed out, markers up close",
    mode_hex: "Hexagons",
    mode_hex_title: "3D hexagonal columns",
    mode_markers: "Markers",
    mode_markers_title: "Individual markers",
    photo3d_title: "Photorealistic 3D cities and terrain (Google via Cesium Ion), up close",
    photo3d_label: "Photorealistic 3D cities",
    nav_hint: "Ground movement: <kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> or <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd> to move/turn, scroll to zoom, drag to look around.",
    daynight_title: "Real-time sun shadow (the night side is dark)",
    daynight_label: "Real-time day / night",
    share_title: "Copy a link to this exact view (period, filters, camera)",
    share_button: "🔗 Share this view",
    share_copied: "Link copied to clipboard!",
    refresh_button: "↻ Refresh data",
    legend_intensity: "Intensity",
    legend_low: "low",
    legend_high: "high",
    legend_confirmed: "confirmed",
    legend_verified: "qualified",
    legend_press: "press",
    default_event: "Event",
    row_date: "Date",
    row_victims: "Fatalities",
    row_precision: "Location precision",
    row_country: "Country",
    row_status: "Status",
    row_type: "Type",
    row_operator: "Operator",
    row_region: "Region",
    row_localities_russian: "Localities under Russian control",
    row_localities_contested: "Contested localities",
    row_data_as_of: "Data as of",
    row_governorate: "Governorate",
    row_control: "Control",
    unnamed: "Unnamed",
    items_title_default: "Events",
    open_source_link: "Open source ↗",
    zoom_to_place: "Zoom to location",
    date_range_from: "from",
    date_range_to: "to",
    kind_nuclear: "Civilian nuclear facility",
    kind_military: "Military site",
    kind_infrastructure: "Infrastructure",
    control_kind_ukraine: "Territorial control (Ukraine)",
    control_kind_yemen: "Territorial control (Yemen)",
    control_kind_westbank: "Territorial control (West Bank)",
    zone_russian: "Zone under Russian control",
    zone_contested: "Contested zone",
    zone_liberated: "Recently liberated zone",
    zone_default: "Zone",
    district_default: "District",
    items_title_changes: "Changes of control",
    change_to_russian: "fell under Russian control",
    change_to_contested: "became contested",
    change_liberated: "liberated",
    control_notes_ukraine: "Estimate by vote across several sources (DeepStateMap, ISW, Wikipedia, press), aggregated into ~17 km hexagons. Not an official front line.",
    control_notes_yemen: "District-level (admin2) control zones, updated roughly quarterly by ACAPS. Not a daily front line.",
    hex_kind: "Activity zone",
    row_fatalities_qualified: "Fatalities (qualified sources)",
    row_qualified_events: "Qualified events",
    row_press_only: "Press-only detections",
  },
};
const tr = (key) => UI_I18N[LANG][key] ?? UI_I18N.fr[key] ?? key;
const numLocale = () => (LANG === "fr" ? "fr-FR" : "en-US");

function applyI18n() {
  document.documentElement.lang = LANG;
  document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = tr(el.dataset.i18n)));
  document.querySelectorAll("[data-i18n-title]").forEach((el) => (el.title = tr(el.dataset.i18nTitle)));
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => (el.placeholder = tr(el.dataset.i18nPlaceholder)));
  document.querySelectorAll("[data-i18n-html]").forEach((el) => (el.innerHTML = tr(el.dataset.i18nHtml)));
  $("lang-toggle").textContent = LANG === "fr" ? "EN" : "FR";
}
// ───────────────────────── Globe ─────────────────────────
const ionToken = window.CESIUM_ION_TOKEN || "";
Cesium.Ion.defaultAccessToken = ionToken || undefined;

const satelliteLayer = new Cesium.ImageryLayer(
  new Cesium.UrlTemplateImageryProvider({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    credit: "Esri, Maxar, Earthstar Geographics",
    maximumLevel: 19,
  }),
  // Fond volontairement assombri : les données ressortent davantage.
  { brightness: 0.72, contrast: 1.12, saturation: 0.78 }
);

const terrainProvider = ionToken
  ? await Cesium.CesiumTerrainProvider.fromIonAssetId(1, { requestVertexNormals: true })
  : new Cesium.EllipsoidTerrainProvider();

const viewer = new Cesium.Viewer("cesiumContainer", {
  baseLayerPicker: false,
  geocoder: Boolean(ionToken),
  homeButton: true,
  sceneModePicker: true,
  navigationHelpButton: false,
  animation: false,
  timeline: false,
  fullscreenButton: false,
  infoBox: false,
  selectionIndicator: false,
  baseLayer: satelliteLayer,
  terrainProvider,
});

// Labels + frontières seuls (pas de routes : la référence Esri
// "World_Transportation" était épaisse, jaune et peu lisible, et inutile
// sur un globe de conflits — on ne garde que les noms de pays/villes).
// Note : CARTO propose un rendu plus élégant (dark_only_labels) mais exige
// désormais une clé API au-delà d'un faible niveau de zoom en accès anonyme
// (tuile "API KEY REQUIRED" constatée en test) — non viable sans compte payant.
viewer.imageryLayers.addImageryProvider(
  new Cesium.UrlTemplateImageryProvider({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    credit: "Esri",
    maximumLevel: 19,
  })
);

const scene = viewer.scene;
scene.globe.baseColor = Cesium.Color.fromCssColorString("#0b1424");
scene.globe.enableLighting = false; // activable via « Jour / nuit en temps réel »
scene.globe.showGroundAtmosphere = true;
scene.highDynamicRange = false;
scene.backgroundColor = Cesium.Color.fromCssColorString("#05070b");
scene.fog.density = 0.00018;
if (ionToken) {
  scene.globe.depthTestAgainstTerrain = true;
  scene.verticalExaggeration = 1.5; // relief quasi invisible sinon
}

viewer.clock.shouldAnimate = true;
viewer.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK;

// Vue d'ouverture : Europe / Moyen-Orient, légèrement inclinée.
// Écran en portrait (mobile) : on recule pour que le globe tienne dans la largeur.
const HOME = { lon: 32, lat: 33, height: innerHeight > innerWidth ? 26000000 : 14500000, pitch: -75 };
viewer.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(HOME.lon, HOME.lat, HOME.height),
  orientation: { heading: 0, pitch: Cesium.Math.toRadians(HOME.pitch), roll: 0 },
});
viewer.homeButton.viewModel.command.beforeExecute.addEventListener((e) => {
  e.cancel = true;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(HOME.lon, HOME.lat, HOME.height),
    orientation: { heading: 0, pitch: Cesium.Math.toRadians(HOME.pitch), roll: 0 },
    duration: 2,
  });
});

// Le clic est géré par nos soins (panneau latéral) : on retire les actions
// par défaut (sélection d'entité, suivi au double-clic).
viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

// ───────────────────────── Utilitaires ─────────────────────────
const $ = (id) => document.getElementById(id);
applyI18n();
const escapeHtml = (s) => {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
};
const frDate = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
const isUrl = (u) => /^https?:\/\//.test(u || "");

async function apiJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Ligne d'état sous chaque source/couche : nombre, fraîcheur ou cause de l'échec. */
function setStatus(prefix, { text, kind = "" } = {}) {
  const el = $(`${prefix}-status`);
  if (!el) return;
  el.textContent = text || "";
  el.className = `status ${kind}`;
}

function layerStatus(prefix, { count, error, fetchedAt, stale, staleReason, loading, note } = {}) {
  const el = $(`${prefix}-status`);
  if (el) el.title = "";
  if (loading) return setStatus(prefix, { text: LANG === "fr" ? "première récupération en cours…" : "fetching for the first time…", kind: "loading" });
  if (error) {
    if (el) el.title = error;
    return setStatus(prefix, { text: LANG === "fr" ? "indisponible" : "unavailable", kind: "warn" });
  }
  if (count === undefined) return setStatus(prefix, {});
  const when = fetchedAt ? new Date(fetchedAt) : new Date();
  if (stale) {
    if (el) el.title = LANG === "fr" ? `Source injoignable (${staleReason || "erreur"}) — dernière donnée réelle en cache` : `Source unreachable (${staleReason || "error"}) — last real data cached`;
    const d = when.toLocaleDateString(numLocale(), { day: "2-digit", month: "2-digit" });
    const t = when.toLocaleTimeString(numLocale(), { hour: "2-digit", minute: "2-digit" });
    return setStatus(prefix, { text: LANG === "fr" ? `${count} · donnée du ${d} ${t} (source injoignable)` : `${count} · data from ${d} ${t} (source unreachable)`, kind: "warn" });
  }
  setStatus(prefix, { text: note ? `${count} · ${note}` : `${count}`, kind: "ok" });
}

// ───────────────────────── Panneau de détail ─────────────────────────
const RELIABILITY_BY_LANG = {
  fr: {
    verified: { label: "Source qualifiée", cls: "rel-verified" },
    press: { label: "Presse — non vérifié", cls: "rel-press" },
    community: { label: "Base collaborative", cls: "rel-community" },
    modeled: { label: "Estimation agrégée", cls: "rel-community" },
  },
  en: {
    verified: { label: "Qualified source", cls: "rel-verified" },
    press: { label: "Press — unverified", cls: "rel-press" },
    community: { label: "Community database", cls: "rel-community" },
    modeled: { label: "Aggregated estimate", cls: "rel-community" },
  },
};
const CONFIDENCE_LABELS_BY_LANG = {
  fr: {
    confirmed: { label: "Confirmé — plusieurs sources dont une qualifiée", cls: "rel-verified" },
    verified: { label: "Source qualifiée", cls: "rel-verified" },
    press: { label: "Presse — non vérifié", cls: "rel-press" },
  },
  en: {
    confirmed: { label: "Confirmed — multiple sources including a qualified one", cls: "rel-verified" },
    verified: { label: "Qualified source", cls: "rel-verified" },
    press: { label: "Press — unverified", cls: "rel-press" },
  },
};
let RELIABILITY = RELIABILITY_BY_LANG[LANG];
let CONFIDENCE_LABELS = CONFIDENCE_LABELS_BY_LANG[LANG];
const sidePanelEl = $("side-panel");

function showSidePanel(info) {
  const rel = info.badge || RELIABILITY[info.reliability] || RELIABILITY.community;
  const rows = (info.rows || [])
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `<div class="sp-row"><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(String(v))}</dd></div>`)
    .join("");
  const sources = (info.sources || []).map((x) => {
    const r = RELIABILITY[x.reliability] || RELIABILITY.community;
    const href = isUrl(x.url) ? ` <a href="${escapeHtml(x.url)}" target="_blank" rel="noopener noreferrer">article ↗</a>` : "";
    const detail = [x.date, x.count ? `${x.count} mentions` : null].filter(Boolean).join(" · ");
    const notes = x.notes && x.reliability === "verified" ? `<div class="sp-src-notes">${escapeHtml(x.notes)}</div>` : "";
    return `<li><span class="sp-rel ${r.cls}">${escapeHtml(x.label)}</span> <span class="sp-src-detail">${escapeHtml(detail)}</span>${href}${notes}</li>`;
  }).join("");
  const items = (info.items || []).map((it) => `
    <li><div class="sp-item-title">${escapeHtml(it.title)}</div>
      <div class="sp-item-meta">${escapeHtml(it.meta || "")}${isUrl(it.url) ? ` · <a href="${escapeHtml(it.url)}" target="_blank" rel="noopener noreferrer">source ↗</a>` : ""}</div></li>`).join("");

  $("side-panel-body").innerHTML = `
    <div class="sp-kind">${escapeHtml(info.kind || "")}</div>
    <h2 class="sp-title">${escapeHtml(info.title || tr("unnamed"))}</h2>
    <div class="sp-source"><span class="sp-rel ${rel.cls}">${rel.label}</span> <span>${escapeHtml(info.sourceLabel || "")}</span></div>
    <dl class="sp-rows">${rows}</dl>
    ${items ? `<h3 class="sp-h3">${escapeHtml(info.itemsTitle || tr("items_title_default"))}</h3><ul class="sp-items">${items}</ul>` : ""}
    ${sources ? `<h3 class="sp-h3">Sources (${info.sources.length})</h3><ul class="sp-sources">${sources}</ul>` : ""}
    ${info.notes ? `<p class="sp-notes">${escapeHtml(info.notes)}</p>` : ""}
    ${isUrl(info.url) ? `<a class="sp-link" href="${escapeHtml(info.url)}" target="_blank" rel="noopener noreferrer">${tr("open_source_link")}</a>` : ""}
    <button class="btn btn-primary sp-zoom" id="sp-zoom">${tr("zoom_to_place")}</button>`;
  $("sp-zoom").addEventListener("click", () => flyToPoint(info.lon, info.lat, info.zoomRange || 30000));
  sidePanelEl.classList.add("open");
  document.body.classList.add("sp-open");
}

function hideSidePanel() {
  sidePanelEl.classList.remove("open");
  document.body.classList.remove("sp-open");
}
$("side-panel-close").addEventListener("click", hideSidePanel);

function flyToPoint(lon, lat, range) {
  viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(lon, lat, 0), range / 8), {
    duration: 2,
    offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), range),
  });
}

// Clic : entité (marqueur, icône) ou primitive (hexagone) portant `.panel`.
const clickHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
clickHandler.setInputAction((click) => {
  const picked = scene.pick(click.position);
  if (!Cesium.defined(picked)) return hideSidePanel();
  const id = picked.id;
  const info = id instanceof Cesium.Entity
    ? panelInfo.get(id)
    : id?.controlCell
      ? controlPanel(id, controlDateCompact(state.cutoff))
      : id?.panel;
  if (info) showSidePanel(info);
  else hideSidePanel();
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// ───────────────────────── État ─────────────────────────
const EVENT_SOURCES = ["ucdp", "gdelt"];
const state = {
  days: 30,
  events: [], // features fusionnées renvoyées par /api/conflicts
  press: true, // afficher les événements « presse seule »
  viewMode: "auto",
  cutoff: null, // date max affichée (timeline), YYYY-MM-DD
};
const panelInfo = new WeakMap();

const EVENT_TYPE_LABELS_BY_LANG = {
  fr: {
    airstrike: "Frappes aériennes / tirs à distance",
    offensive: "Batailles / offensives",
    protest: "Manifestations",
    casualties: "Violence contre civils",
    ceasefire: "Développements stratégiques",
  },
  en: {
    airstrike: "Airstrikes / remote strikes",
    offensive: "Battles / offensives",
    protest: "Protests",
    casualties: "Violence against civilians",
    ceasefire: "Strategic developments",
  },
};
let EVENT_TYPE_LABELS = EVENT_TYPE_LABELS_BY_LANG[LANG];
const EVENT_TYPE_COLORS = {
  airstrike: "#f0803c", offensive: "#e2463b", casualties: "#c2185b", protest: "#e0a13c", ceasefire: "#4caf7d",
};

// ───────────────────────── Événements : hexagones 3D & marqueurs ─────────────────────────
const RAMP = ["#f6c453", "#f08a3c", "#e2463b", "#a31245"].map((c) => Cesium.Color.fromCssColorString(c));
function rampColor(t, alpha) {
  const x = Math.min(Math.max(t, 0), 1) * (RAMP.length - 1);
  const i = Math.min(Math.floor(x), RAMP.length - 2);
  return Cesium.Color.lerp(RAMP[i], RAMP[i + 1], x - i, new Cesium.Color()).withAlpha(alpha);
}

/** Poids d'un événement : 1 + victimes (plafonnées) ; la presse seule compte moitié. */
const eventWeight = (p) => (1 + Math.min(p.fatalities || 0, 50) / 5) * (p.confidence === "press" ? 0.5 : 1);

function visibleEvents() {
  return state.events.filter((f) => {
    const p = f.properties;
    if (state.cutoff && p.event_date && p.event_date > state.cutoff) return false;
    if (!state.press && p.confidence === "press") return false;
    return true;
  });
}

const hexPrimitives = []; // primitives d'événements actuellement à l'écran
const markerLayer = new Cesium.CustomDataSource("markers");
viewer.dataSources.add(markerLayer);

function clearEventRender() {
  hexPrimitives.splice(0).forEach((p) => scene.primitives.remove(p));
  markerLayer.entities.removeAll();
}

// Résolution H3 et mode selon l'altitude de la caméra.
function pickRender() {
  const h = viewer.camera.positionCartographic.height;
  let res = null;
  if (h > 9e6) res = 2;
  else if (h > 4e6) res = 3;
  else if (h > 1.8e6) res = 4;
  if (state.viewMode === "markers") return { mode: "markers" };
  if (state.viewMode === "hex") return { mode: "hex", res: res ?? (h > 6e5 ? 5 : 6) };
  return res ? { mode: "hex", res } : { mode: "markers" };
}

function cellPolygon(cell) {
  const boundary = h3.cellToBoundary(cell, false); // [lat, lng]
  const lons = boundary.map((b) => b[1]);
  if (Math.max(...lons) - Math.min(...lons) > 180) return null; // traverse l'antiméridien
  return Cesium.Cartesian3.fromDegreesArray(boundary.flatMap(([lat, lng]) => [lng, lat]));
}

function renderHexagons(events, res) {
  const cells = new Map();
  for (const f of events) {
    const [lon, lat] = f.geometry.coordinates;
    const cell = h3.latLngToCell(lat, lon, res);
    let c = cells.get(cell);
    if (!c) cells.set(cell, (c = { cell, score: 0, events: [], fatalities: 0, verified: 0 }));
    const p = f.properties;
    c.score += eventWeight(p);
    c.events.push(f);
    if (p.confidence !== "press") {
      c.verified++;
      c.fatalities += p.fatalities || 0;
    }
  }
  if (!cells.size) return;

  const edge = h3.getHexagonEdgeLengthAvg(res, "m");
  const maxScore = Math.max(...[...cells.values()].map((c) => c.score));
  const instances = [];
  for (const c of cells.values()) {
    const positions = cellPolygon(c.cell);
    if (!positions) continue;
    const t = maxScore > 0 ? c.score / maxScore : 0;
    const pressOnly = c.verified === 0;
    const height = edge * (0.25 + 2.25 * Math.pow(t, 0.75));
    instances.push(new Cesium.GeometryInstance({
      geometry: new Cesium.PolygonGeometry({
        polygonHierarchy: new Cesium.PolygonHierarchy(positions),
        height: 0,
        extrudedHeight: height,
        vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
      }),
      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(rampColor(t, pressOnly ? 0.5 : 0.88)) },
      id: { panel: hexPanel(c, res) },
    }));
  }
  if (!instances.length) return;
  const prim = new Cesium.Primitive({
    geometryInstances: instances,
    appearance: new Cesium.PerInstanceColorAppearance({ translucent: true, closed: true }),
    asynchronous: false,
  });
  scene.primitives.add(prim);
  hexPrimitives.push(prim);
}

function hexPanel(c, res) {
  const [lat, lon] = h3.cellToLatLng(c.cell);
  const top = [...c.events].sort((a, b) => eventWeight(b.properties) - eventWeight(a.properties)).slice(0, 8);
  const pressCount = c.events.length - c.verified;
  const hexKm = Math.round(h3.getHexagonEdgeLengthAvg(res, "km") * 2);
  return {
    kind: tr("hex_kind"),
    title: `${c.events.length} ${tr("stat_events")}`,
    badge: c.verified ? CONFIDENCE_LABELS.verified : CONFIDENCE_LABELS.press,
    sourceLabel: LANG === "fr" ? `hexagone d'environ ${hexKm} km` : `~${hexKm} km hexagon`,
    rows: [
      [tr("row_fatalities_qualified"), c.fatalities || null],
      [tr("row_qualified_events"), c.verified],
      [tr("row_press_only"), pressCount || null],
    ],
    itemsTitle: top.length < c.events.length ? (LANG === "fr" ? `Les ${top.length} plus marquants` : `Top ${top.length}`) : tr("items_title_default"),
    items: top.map((f) => {
      const p = f.properties;
      return {
        title: p.name || tr("default_event"),
        meta: [EVENT_TYPE_LABELS[p.event_type] || p.event_type, frDate(p.event_date), p.fatalities ? (LANG === "fr" ? `${p.fatalities} victimes` : `${p.fatalities} fatalities`) : null].filter(Boolean).join(" · "),
        url: p.sources?.find((s) => isUrl(s.url))?.url,
      };
    }),
    lon, lat, zoomRange: h3.getHexagonEdgeLengthAvg(res, "m") * 10,
  };
}

// Marqueurs lumineux (mise en cache des textures par couleur et taille).
const glowCache = new Map();
function glowIcon(hex, size, ring) {
  const key = `${hex}|${size}|${ring}`;
  if (glowCache.has(key)) return glowCache.get(key);
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, hex + "ff");
  grad.addColorStop(0.28, hex + "aa");
  grad.addColorStop(1, hex + "00");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.beginPath();
  g.arc(64, 64, 11, 0, Math.PI * 2);
  g.fillStyle = "#fff";
  g.fill();
  g.beginPath();
  g.arc(64, 64, 8, 0, Math.PI * 2);
  g.fillStyle = hex;
  g.fill();
  if (ring) {
    g.beginPath();
    g.arc(64, 64, 20, 0, Math.PI * 2);
    g.lineWidth = 4;
    g.strokeStyle = "#4caf7d";
    g.stroke();
  }
  glowCache.set(key, c);
  return c;
}

/** Construit la fiche affichée dans le panneau latéral pour un événement,
 * qu'il vienne d'un marqueur cliqué sur le globe, du fil en direct ou du
 * journal de la timeline — même expérience partout. */
function eventPanelInfo(f) {
  const [lon, lat] = f.geometry.coordinates;
  const p = f.properties;
  return {
    kind: EVENT_TYPE_LABELS[p.event_type] || p.event_type || tr("default_event"),
    title: p.name || tr("default_event"),
    badge: CONFIDENCE_LABELS[p.confidence] || CONFIDENCE_LABELS.press,
    sourceLabel: (p.sources || []).map((x) => x.label).filter((v, i, a) => a.indexOf(v) === i).join(" + "),
    rows: [
      [tr("row_date"), p.date_start ? `${tr("date_range_from")} ${frDate(p.date_start)} ${tr("date_range_to")} ${frDate(p.event_date)}` : frDate(p.event_date)],
      [tr("row_victims"), p.fatalities],
      [tr("row_precision"), p.precision],
    ],
    sources: p.sources,
    lon, lat,
  };
}

function renderMarkers(events) {
  const today = Date.now();
  markerLayer.entities.suspendEvents();
  for (const f of events) {
    const [lon, lat] = f.geometry.coordinates;
    const p = f.properties;
    const hex = EVENT_TYPE_COLORS[p.event_type] || "#e2463b";
    const base = p.confidence === "press" ? 0.34 : 0.5 + Math.min(Math.sqrt(p.fatalities || 0) * 0.09, 0.55);
    const recent = p.event_date && today - Date.parse(p.event_date) < 3 * 86400000;
    const phase = Math.random() * 6;
    const entity = markerLayer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      billboard: {
        image: glowIcon(hex, 0, p.confidence === "confirmed"),
        scale: recent ? new Cesium.CallbackProperty(() => base * (1 + 0.14 * Math.sin(Date.now() / 480 + phase)), false) : base,
        color: Cesium.Color.WHITE.withAlpha(p.confidence === "press" ? 0.75 : 1),
        disableDepthTestDistance: 30000,
      },
      name: p.name || tr("default_event"),
    });
    panelInfo.set(entity, eventPanelInfo(f));
  }
  markerLayer.entities.resumeEvents();
}

let lastRenderKey = "";
function renderConflicts(force = false) {
  const events = visibleEvents();
  const r = pickRender();
  const key = `${r.mode}|${r.res ?? ""}|${state.viewMode}`;
  if (!force && key === lastRenderKey && renderConflicts.dataVersion === state.dataVersion && renderConflicts.cutoff === state.cutoff && renderConflicts.press === state.press) return;
  lastRenderKey = key;
  Object.assign(renderConflicts, { dataVersion: state.dataVersion, cutoff: state.cutoff, press: state.press });
  clearEventRender();
  if (r.mode === "hex") renderHexagons(events, r.res);
  else renderMarkers(events);
  updateViewSummary();
}

// ───────────────────────── « Dans la vue » ─────────────────────────
/** Emprise réellement visible : on lance des rayons depuis l'écran vers le
 * globe (fiable même en vue inclinée avec l'horizon) ; null = vue mondiale. */
function viewBounds() {
  if (viewer.camera.positionCartographic.height > 8e6) return null;
  const c = scene.canvas;
  const pts = [];
  for (const [fx, fy] of [[.12, .18], [.88, .18], [.88, .88], [.12, .88], [.5, .5], [.5, .18], [.5, .88], [.12, .5], [.88, .5]]) {
    const p = viewer.camera.pickEllipsoid(new Cesium.Cartesian2(c.clientWidth * fx, c.clientHeight * fy), scene.globe.ellipsoid);
    if (p) pts.push(Cesium.Cartographic.fromCartesian(p));
  }
  if (pts.length < 5) return null;
  const d = Cesium.Math.toDegrees;
  const lon0 = d(pts[4]?.longitude ?? pts[0].longitude);
  const rel = (lon) => ((d(lon) - lon0 + 540) % 360) - 180; // longitude relative au centre, sans saut à l'antiméridien
  const rels = pts.map((p) => rel(p.longitude));
  const lats = pts.map((p) => d(p.latitude));
  return { lon0, w: Math.min(...rels), e: Math.max(...rels), s: Math.min(...lats), n: Math.max(...lats) };
}

function inBounds(b, lon, lat) {
  const rel = ((lon - b.lon0 + 540) % 360) - 180;
  return lat >= b.s && lat <= b.n && rel >= b.w && rel <= b.e;
}

function updateViewSummary() {
  const b = viewBounds();
  const events = visibleEvents().filter((f) => !b || inBounds(b, ...f.geometry.coordinates));
  $("vs-scope").textContent = b ? tr("scope_zone") : tr("scope_world");

  let fat = 0, verified = 0;
  const byType = {};
  for (const f of events) {
    const p = f.properties;
    if (p.confidence !== "press") {
      verified++;
      fat += p.fatalities || 0;
    }
    byType[p.event_type] = (byType[p.event_type] || 0) + 1;
  }
  $("vs-events").textContent = events.length.toLocaleString(numLocale());
  $("vs-fat").textContent = fat.toLocaleString(numLocale());
  $("vs-verified").textContent = verified.toLocaleString(numLocale());

  const max = Math.max(1, ...Object.values(byType));
  $("vs-types").innerHTML = Object.entries(byType)
    .sort((a, b2) => b2[1] - a[1])
    .map(([t, n]) => `<div class="type-bar"><span>${escapeHtml(EVENT_TYPE_LABELS[t] || t)}</span><span>${n}</span>
      <div class="track"><div class="fill" style="width:${(n / max) * 100}%;background:${EVENT_TYPE_COLORS[t] || "#e2463b"}"></div></div></div>`)
    .join("");
}

let moveTimer = null;
viewer.camera.moveEnd.addEventListener(() => {
  clearTimeout(moveTimer);
  moveTimer = setTimeout(() => {
    renderConflicts();
    updateViewSummary();
  }, 120);
});

// ───────────────────────── Timeline ─────────────────────────
const timelineEl = $("timeline-wrap");
const journalEl = $("timeline-journal");
const slider = $("timeline-slider");
let timelineStart = null;
let timelineTimer = null;
let sliderRaf = 0;
let dayEvents = []; // dayEvents[i] = événements du (timelineStart + i jours), pour l'histogramme et le journal
let lastJournalIdx = -1;
// Masquage manuel par l'utilisateur (bouton ✕) : persiste tant qu'il ne la
// rouvre pas explicitement, même si les données sous-jacentes rechargent.
let timelineUserHidden = false;
$("timeline-close").addEventListener("click", () => {
  timelineUserHidden = true;
  stopPlayback();
  timelineEl.hidden = true;
  journalEl.hidden = true;
  $("timeline-reopen").hidden = false;
});
$("timeline-reopen").addEventListener("click", () => {
  timelineUserHidden = false;
  if (timelineStart) {
    timelineEl.hidden = false;
    journalEl.hidden = false;
  }
  $("timeline-reopen").hidden = true;
});

function stopPlayback() {
  clearInterval(timelineTimer);
  timelineTimer = null;
  $("timeline-play").textContent = "▶";
}

/** Petit histogramme au-dessus du curseur : une barre par jour, hauteur
 * proportionnelle (racine carrée, pour que les jours calmes restent visibles
 * à côté d'un pic) au nombre d'événements ce jour-là. Donne un aperçu de
 * l'activité sur toute la période avant même d'appuyer sur lecture. */
function renderTimelineHistogram() {
  const max = Math.max(1, ...dayEvents.map((d) => d.length));
  $("timeline-hist").innerHTML = dayEvents
    .map((d) => `<span style="height:${d.length ? Math.max(10, Math.sqrt(d.length / max) * 100) : 0}%"></span>`)
    .join("");
}

/** Journal affiché par le curseur : les événements des jours traversés
 * depuis la dernière position (fromIdx..toIdx), pas seulement le jour
 * d'arrivée — la lecture avance parfois de plusieurs jours par pas, on ne
 * veut rien laisser passer silencieusement. Un simple déplacement (pas de
 * lecture) ou un retour en arrière ne montre que le jour d'arrivée. */
let journalItems = [];
function renderJournal(fromIdx, toIdx) {
  const events = [];
  for (let i = Math.max(0, fromIdx); i <= toIdx; i++) events.push(...dayEvents[i]);
  const day = new Date(timelineStart.getTime() + toIdx * 86400000).toISOString().slice(0, 10);
  const spanning = toIdx > fromIdx;
  journalEl.hidden = timelineUserHidden;
  $("tj-date").textContent = spanning ? `${frDate(new Date(timelineStart.getTime() + fromIdx * 86400000).toISOString().slice(0, 10))} → ${frDate(day)}` : frDate(day);
  $("tj-count").textContent = events.length ? (LANG === "fr" ? `${events.length} événement${events.length > 1 ? "s" : ""}` : `${events.length} event${events.length > 1 ? "s" : ""}`) : "";
  journalItems = events.length
    ? [...events].sort((a, b) => eventWeight(b.properties) - eventWeight(a.properties)).slice(0, 12)
    : [];
  $("tj-list").innerHTML = journalItems.length
    ? journalItems
        .map((f, i) => {
          const p = f.properties;
          const meta = [EVENT_TYPE_LABELS[p.event_type] || p.event_type, p.fatalities ? (LANG === "fr" ? `${p.fatalities} victimes` : `${p.fatalities} fatalities`) : null].filter(Boolean).join(" · ");
          return `<li data-i="${i}"><b>${escapeHtml(p.name || tr("default_event"))}</b><span>${escapeHtml(meta)}</span></li>`;
        })
        .join("")
    : `<li class="tj-empty">${LANG === "fr" ? "Aucun événement recensé ce jour-là." : "No event recorded that day."}</li>`;
}
$("tj-list").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-i]");
  const f = li && journalItems[Number(li.dataset.i)];
  if (!f) return;
  flyToPoint(...f.geometry.coordinates, 400000);
  showSidePanel(eventPanelInfo(f));
});

function applyTimeline() {
  if (!timelineStart) {
    state.cutoff = null;
    updateControlColors();
    return;
  }
  const idx = Number(slider.value);
  const day = new Date(timelineStart.getTime() + idx * 86400000).toISOString().slice(0, 10);
  state.cutoff = idx >= Number(slider.max) ? null : day;
  $("timeline-label").textContent = `${LANG === "fr" ? "jusqu'au" : "up to"} ${frDate(day)}`;
  if (idx !== lastJournalIdx) {
    const fromIdx = lastJournalIdx >= 0 && idx > lastJournalIdx ? lastJournalIdx + 1 : idx;
    renderJournal(fromIdx, idx);
    lastJournalIdx = idx;
  }
  cancelAnimationFrame(sliderRaf);
  sliderRaf = requestAnimationFrame(() => renderConflicts());
  updateControlColors();
}

function setupTimeline() {
  stopPlayback();
  // La timeline reste utile même sans conflit daté tant que le contrôle
  // territorial (qui a ses propres dates de changement) est actif.
  const hasControlHistory = $("control-toggle").checked && controlCells.some((c) => c.localities.some((l) => l.changed));
  if (!state.events.some((f) => f.properties.event_date) && !hasControlHistory) {
    timelineStart = null;
    timelineEl.hidden = true;
    journalEl.hidden = true;
    $("timeline-reopen").hidden = true;
    state.cutoff = null;
    updateControlColors();
    return;
  }
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  timelineStart = new Date(end.getTime() - state.days * 86400000);
  slider.max = String(state.days);
  slider.value = String(state.days);
  timelineEl.hidden = timelineUserHidden;
  $("timeline-reopen").hidden = !timelineUserHidden;

  dayEvents = Array.from({ length: state.days + 1 }, () => []);
  for (const f of state.events) {
    const d = f.properties.event_date;
    if (!d) continue;
    const idx = Math.round((Date.parse(d) - timelineStart.getTime()) / 86400000);
    if (idx >= 0 && idx <= state.days) dayEvents[idx].push(f);
  }
  renderTimelineHistogram();
  lastJournalIdx = -1;
  applyTimeline();
}

slider.addEventListener("input", () => {
  stopPlayback();
  applyTimeline();
});
$("timeline-play").addEventListener("click", () => {
  if (timelineTimer) return stopPlayback();
  if (Number(slider.value) >= Number(slider.max)) slider.value = "0";
  $("timeline-play").textContent = "⏸";
  const step = Math.max(1, Math.round(state.days / 60)); // ~60 images quelle que soit la période
  timelineTimer = setInterval(() => {
    if (Number(slider.value) >= Number(slider.max)) return stopPlayback();
    slider.value = String(Math.min(Number(slider.max), Number(slider.value) + step));
    applyTimeline();
  }, 220);
});

// ───────────────────────── Chargement des conflits ─────────────────────────
const SOURCE_DOT = { ucdp: "UCDP", gdelt: "GDELT" };

/** Petit histogramme d'activité (événements/jour) sur toute la période
 * choisie, indépendant de la timeline (visible même quand elle est masquée
 * ou qu'il n'y a pas de date exploitable pour elle) — donne d'un coup d'œil
 * une tendance que les seuls totaux de « Dans la vue » ne montrent pas. */
function renderTrendChart() {
  const days = state.days;
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = end.getTime() - days * 86400000;
  const counts = new Array(days + 1).fill(0);
  const fatalities = new Array(days + 1).fill(0);
  for (const f of state.events) {
    const d = f.properties.event_date;
    if (!d) continue;
    const idx = Math.round((Date.parse(d) - start) / 86400000);
    if (idx < 0 || idx > days) continue;
    counts[idx]++;
    fatalities[idx] += f.properties.fatalities || 0;
  }
  const max = Math.max(1, ...counts);
  $("trend-chart").innerHTML = counts
    .map((c, i) => {
      const day = frDate(new Date(start + i * 86400000).toISOString().slice(0, 10));
      const title =
        LANG === "fr"
          ? fatalities[i] ? `${day} : ${c} événement(s), ${fatalities[i]} victimes` : `${day} : ${c} événement(s)`
          : fatalities[i] ? `${day}: ${c} event(s), ${fatalities[i]} fatalities` : `${day}: ${c} event(s)`;
      return `<span style="height:${c ? Math.max(8, Math.sqrt(c / max) * 100) : 0}%" title="${escapeHtml(title)}"></span>`;
    })
    .join("");
  $("trend-period").textContent = LANG === "fr" ? `${days} j` : `${days} d`;
  const totalFatal = fatalities.reduce((a, b) => a + b, 0);
  $("trend-summary").textContent = state.events.length
    ? LANG === "fr"
      ? `${state.events.length} événement(s)${totalFatal ? ` · ${totalFatal} victimes qualifiées` : ""}`
      : `${state.events.length} event(s)${totalFatal ? ` · ${totalFatal} qualified fatalities` : ""}`
    : LANG === "fr"
      ? "Aucun événement sur la période."
      : "No event over the period.";
}

async function loadEvents() {
  $("status").textContent = "Chargement…";
  const selected = EVENT_SOURCES.filter((k) => $(`${k}-toggle`).checked);
  EVENT_SOURCES.forEach((k) => setStatus(k, selected.includes(k) ? { text: "chargement…", kind: "loading" } : {}));
  if (!selected.length) {
    state.events = [];
    state.dataVersion = (state.dataVersion || 0) + 1;
    setupTimeline();
    renderConflicts(true);
    renderTrendChart();
    return renderSourceAlert({}, selected);
  }

  const params = new URLSearchParams({ days: state.days, event_type: $("event-type").value, sources: selected.join(",") });
  if ($("country").value) params.set("country", $("country").value);

  try {
    const data = await apiJson(`/api/conflicts?${params}`);
    state.events = data.features || [];
    state.dataVersion = (state.dataVersion || 0) + 1;
    EVENT_SOURCES.forEach((k) => {
      const st = data.sources?.[k];
      if (!st) return;
      if (!st.ok) {
        $(`${k}-status`).title = st.error || "";
        return setStatus(k, { text: LANG === "fr" ? "indisponible" : "unavailable", kind: "warn" });
      }
      const un = st.meta?.unlocated;
      $("ucdp-note").hidden = !(k === "ucdp" && un?.count);
      if (k === "ucdp" && un?.count) {
        $("ucdp-note").textContent =
          LANG === "fr"
            ? `UCDP : ${un.count} événement${un.count > 1 ? "s" : ""} sans localisation précise (${un.fatalities.toLocaleString(numLocale())} victimes cumulées) ne sont pas cartographiés.`
            : `UCDP: ${un.count} event${un.count > 1 ? "s" : ""} without precise location (${un.fatalities.toLocaleString(numLocale())} cumulated fatalities) are not mapped.`;
      }
      const upTo = st.meta?.latest_date ? `${LANG === "fr" ? "jusqu'au" : "up to"} ${frDate(st.meta.latest_date).slice(0, 5)}` : "";
      $(`${k}-status`).title = "";
      setStatus(k, { text: [LANG === "fr" ? `${st.count} événement${st.count > 1 ? "s" : ""}` : `${st.count} event${st.count > 1 ? "s" : ""}`, upTo].filter(Boolean).join(" · "), kind: "ok" });
    });
    renderSourceAlert(data.sources, selected);
    setupTimeline();
    renderConflicts(true);
    renderTrendChart();
    const confirmed = state.events.filter((f) => f.properties.confidence === "confirmed").length;
    $("status").textContent =
      LANG === "fr"
        ? `${state.events.length} événement(s), dont ${confirmed} confirmé(s) — mis à jour à ${new Date().toLocaleTimeString(numLocale())}`
        : `${state.events.length} event(s), including ${confirmed} confirmed — updated at ${new Date().toLocaleTimeString(numLocale())}`;
  } catch (err) {
    state.events = [];
    state.dataVersion = (state.dataVersion || 0) + 1;
    setupTimeline();
    renderConflicts(true);
    renderTrendChart();
    renderSourceAlert(null, selected, err.message);
    $("status").textContent = `⚠️ Conflits indisponibles — ${err.message}`;
  }
}

/** Alerte claire quand aucune source qualifiée ne répond, ou quand une source
 * qualifiée est vide sur la période à cause de son décalage de publication. */
function renderSourceAlert(sources, selected, fatalError) {
  const el = $("source-alert");
  const qualifiedOk = ["ucdp"].some((k) => sources?.[k]?.ok); // ACLED : voir méthodologie (accès API fermé aux adresses personnelles)
  const ucdp = sources?.ucdp;
  let html = "";
  if (fatalError) html = `<strong>Serveur indisponible</strong> — ${escapeHtml(fatalError)}`;
  else if (selected.length && !qualifiedOk) {
    html = `<strong>Aucune source qualifiée disponible.</strong> Seuls des événements de presse, <em>non vérifiés</em>, sont affichés. <a href="/methodologie">Pourquoi ?</a>`;
  } else if (ucdp?.ok && ucdp.count === 0 && state.days < 30 && ucdp.meta?.latest_date) {
    html = `UCDP publie avec environ 2 semaines de décalage (données jusqu'au ${frDate(ucdp.meta.latest_date).slice(0, 5)}) : choisissez <strong>30 j</strong> ou plus pour voir ses événements.`;
  }
  el.innerHTML = html;
  el.hidden = !html;
}

// ───────────────────────── Filtres & navigation ─────────────────────────
const REGIONS = [
  { name: "Ukraine", lon: 31.5, lat: 48.5, range: 1100000 },
  { name: "Gaza / Israël / Liban", lon: 35.0, lat: 32.0, range: 350000 },
  { name: "Syrie", lon: 38.0, lat: 35.0, range: 700000 },
  { name: "Soudan", lon: 30.0, lat: 15.5, range: 1500000 },
  { name: "Yémen / mer Rouge", lon: 44.0, lat: 15.0, range: 1200000 },
  { name: "Sahel (Mali)", lon: -2.0, lat: 15.0, range: 1500000 },
  { name: "Afghanistan", lon: 66.0, lat: 34.0, range: 1200000 },
  { name: "Iran / Golfe", lon: 53.0, lat: 30.5, range: 1800000 },
  { name: "Taïwan / mer de Chine", lon: 121.0, lat: 24.0, range: 1000000 },
  { name: "Corée", lon: 127.5, lat: 37.5, range: 900000 },
  { name: "Monde", lon: 10.0, lat: 20.0, range: 22000000, pitch: -90 },
];
REGIONS.forEach((r, i) => {
  const opt = document.createElement("option");
  opt.value = String(i);
  opt.textContent = r.name;
  $("region").appendChild(opt);
});
$("region").addEventListener("change", () => {
  const r = REGIONS[Number($("region").value)];
  if (!r) return;
  viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(r.lon, r.lat, 0), r.range / 4), {
    duration: 2.5,
    offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(r.pitch ?? -40), r.range),
  });
});

const countryBounds = {};
function frameBBox([w, s, e, n]) {
  const center = Cesium.Cartesian3.fromDegrees((w + e) / 2, (s + n) / 2, 0);
  const radius = Cesium.Cartesian3.distance(center, Cesium.Cartesian3.fromDegrees(e, n, 0));
  const wide = radius > 2500000; // très grand pays : vue plongeante, distance plafonnée
  viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(center, wide ? 2500000 : radius), {
    duration: 2.5,
    offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(wide ? -90 : -50), wide ? 12000000 : radius * 2.4),
  });
}

async function loadFilters() {
  try {
    const f = await apiJson("/api/filters");
    f.countries.forEach(({ code, name, bbox }) => {
      if (bbox) countryBounds[code] = bbox;
      $("country").add(new Option(name, code));
      $("push-countries").add(new Option(name, code));
    });
    f.event_types.filter((t) => t !== "all").forEach((t) => $("event-type").add(new Option(EVENT_TYPE_LABELS[t] || t, t)));
  } catch (err) {
    $("status").textContent = `Filtres indisponibles (${err.message})`;
  }
}

// ───────────────────────── Recherche de lieux ─────────────────────────
// Cherche d'abord dans nos régions et pays (instantané), sinon interroge
// Nominatim/OpenStreetMap (gratuit, sans clé) et cadre le résultat.
const searchForm = $("search-form");
const searchInput = $("search-input");
const searchResults = $("search-results");
const searchStatus = $("search-status");
let searchAbort = null;

function localMatches(q) {
  const needle = q.toLowerCase();
  const out = [];
  REGIONS.forEach((r, i) => {
    if (r.name.toLowerCase().includes(needle)) out.push({ label: r.name, detail: "Région suivie", action: () => selectRegion(i) });
  });
  [...$("country").options].forEach((opt) => {
    if (opt.value && opt.textContent.toLowerCase().includes(needle)) {
      out.push({ label: opt.textContent, detail: "Pays suivi — filtre les conflits", action: () => selectCountry(opt.value) });
    }
  });
  return out;
}

function selectRegion(i) {
  $("region").value = String(i);
  const r = REGIONS[i];
  viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(r.lon, r.lat, 0), r.range / 4), {
    duration: 2.5,
    offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(r.pitch ?? -40), r.range),
  });
}

function selectCountry(code) {
  $("country").value = code;
  $("country").dispatchEvent(new Event("change"));
}

function flyToPlace(place) {
  const range = place.bboxRange || 120000;
  viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(place.lon, place.lat, 0), range / 4), {
    duration: 2.5,
    offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), range),
  });
}

async function remoteMatches(q) {
  searchAbort?.abort();
  searchAbort = new AbortController();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal: searchAbort.signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = await res.json();
  return rows.map((r) => {
    const [s, n, w, e] = r.boundingbox.map(Number);
    const span = Cesium.Cartesian3.distance(Cesium.Cartesian3.fromDegrees(w, s, 0), Cesium.Cartesian3.fromDegrees(e, n, 0));
    return {
      label: r.display_name.split(",")[0],
      detail: r.display_name,
      lon: Number(r.lon), lat: Number(r.lat),
      bboxRange: Math.max(span * 1.4, 2000),
      action: null,
    };
  });
}

function renderSearchResults(items) {
  searchResults.innerHTML = items.map((it, i) => `<li tabindex="0" data-i="${i}"><b>${escapeHtml(it.label)}</b><span>${escapeHtml(it.detail || "")}</span></li>`).join("");
  searchResults.hidden = items.length === 0;
  searchResults._items = items;
}

searchResults.addEventListener("click", (e) => {
  const li = e.target.closest("li[data-i]");
  if (!li) return;
  const item = searchResults._items[Number(li.dataset.i)];
  if (item.action) item.action();
  else flyToPlace(item);
  searchResults.hidden = true;
  searchInput.blur();
});

let searchDebounce = null;
searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  const q = searchInput.value.trim();
  if (q.length < 2) {
    searchResults.hidden = true;
    return;
  }
  const local = localMatches(q);
  if (local.length) renderSearchResults(local);
  searchDebounce = setTimeout(async () => {
    try {
      const remote = await remoteMatches(q);
      renderSearchResults([...local, ...remote].slice(0, 8));
      searchStatus.textContent = "";
    } catch (err) {
      if (err.name !== "AbortError") searchStatus.textContent = `Recherche indisponible (${err.message})`;
    }
  }, 350);
});

searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (!q) return;
  const items = searchResults._items;
  if (items?.length) return items[0].action ? items[0].action() : flyToPlace(items[0]);
  searchStatus.textContent = "Recherche…";
  try {
    const remote = await remoteMatches(q);
    if (!remote.length) {
      searchStatus.textContent = "Aucun résultat.";
      return;
    }
    flyToPlace(remote[0]);
    renderSearchResults(remote);
    searchStatus.textContent = "";
  } catch (err) {
    searchStatus.textContent = `Recherche indisponible (${err.message})`;
  }
});
document.addEventListener("click", (e) => {
  if (!searchForm.contains(e.target) && !searchResults.contains(e.target)) searchResults.hidden = true;
});

$("period").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-days]");
  if (!b) return;
  $("period").querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
  state.days = Number(b.dataset.days);
  loadEvents();
});
$("view-mode").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-mode]");
  if (!b) return;
  $("view-mode").querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
  state.viewMode = b.dataset.mode;
  renderConflicts(true);
});
$("country").addEventListener("change", () => {
  const bbox = countryBounds[$("country").value];
  if (bbox) frameBBox(bbox);
  loadEvents();
});
$("event-type").addEventListener("change", loadEvents);
EVENT_SOURCES.forEach((k) => $(`${k}-toggle`).addEventListener("change", loadEvents));
$("press-toggle").addEventListener("change", (e) => {
  state.press = e.target.checked;
  renderConflicts(true);
});
$("refresh").addEventListener("click", loadAll);

// ───────────────────────── Partager cette vue ─────────────────────────
// Encode période/filtres/caméra dans l'URL : ouvrir ce lien reproduit
// exactement la même vue (voir applySharedState, appelé une fois les
// filtres chargés, au démarrage).
function buildShareUrl() {
  const c = viewer.camera;
  const carto = c.positionCartographic;
  const params = new URLSearchParams({
    lon: Cesium.Math.toDegrees(carto.longitude).toFixed(4),
    lat: Cesium.Math.toDegrees(carto.latitude).toFixed(4),
    h: String(Math.round(carto.height)),
    hd: String(Math.round(Cesium.Math.toDegrees(c.heading))),
    pi: String(Math.round(Cesium.Math.toDegrees(c.pitch))),
    d: String(state.days),
    t: $("event-type").value,
    src: EVENT_SOURCES.filter((k) => $(`${k}-toggle`).checked).join(","),
    pr: state.press ? "1" : "0",
  });
  if ($("country").value) params.set("c", $("country").value);
  return `${location.origin}${location.pathname}?${params}`;
}
$("share-view").addEventListener("click", async () => {
  const url = buildShareUrl();
  try {
    await navigator.clipboard.writeText(url);
    $("share-status").textContent = "Lien copié dans le presse-papiers !";
  } catch {
    $("share-status").textContent = url; // repli si le presse-papiers est inaccessible (permission, contexte non sécurisé)
  }
  setTimeout(() => {
    $("share-status").textContent = "";
  }, 5000);
});

/** Applique une vue partagée depuis l'URL (si présente) : appelé après
 * loadFilters() pour que les <select> pays/type aient déjà leurs options. */
function applySharedState() {
  const p = new URLSearchParams(location.search);
  if (!p.has("lon") || !p.has("lat")) return false;
  const days = parseInt(p.get("d") || "30", 10);
  $("period").querySelectorAll("button").forEach((x) => x.classList.toggle("active", Number(x.dataset.days) === days));
  state.days = days;
  if (p.has("c")) $("country").value = p.get("c");
  if (p.has("t")) $("event-type").value = p.get("t");
  const sources = (p.get("src") || "ucdp,gdelt").split(",");
  EVENT_SOURCES.forEach((k) => ($(`${k}-toggle`).checked = sources.includes(k)));
  const press = p.get("pr") !== "0";
  $("press-toggle").checked = press;
  state.press = press;
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(parseFloat(p.get("lon")), parseFloat(p.get("lat")), parseFloat(p.get("h") || "1000000")),
    orientation: {
      heading: Cesium.Math.toRadians(parseFloat(p.get("hd") || "0")),
      pitch: Cesium.Math.toRadians(parseFloat(p.get("pi") || "-45")),
      roll: 0,
    },
  });
  return true;
}

$("daynight-toggle").addEventListener("change", (e) => {
  scene.globe.enableLighting = e.target.checked;
});

// Villes 3D photoréalistes (maillage Google via Cesium Ion), chargées à la demande.
// Le globe n'est masqué qu'en dessous de GROUND_ALTITUDE_M : au-delà (vue
// région/monde), le maillage Google n'est de toute façon pas chargé à cette
// résolution, et masquer le globe en permanence faisait disparaître le fond
// (imagerie + effet jour/nuit) dès qu'on dézoomait, laissant l'écran noir.
const GROUND_ALTITUDE_M = 4000;
let photo3d = null;
let groundGlobeHandler = null;
if (!ionToken) {
  $("photo3d-toggle").disabled = true;
  $("photo3d-toggle").parentElement.title = "Nécessite un token Cesium Ion";
}

function disablePhoto3D() {
  if (photo3d) photo3d.show = false;
  if (groundGlobeHandler) {
    scene.preRender.removeEventListener(groundGlobeHandler);
    groundGlobeHandler = null;
  }
  scene.globe.show = true;
  if (controlPrimitive) controlPrimitive.show = true;
  if (yemenControlSource) yemenControlSource.show = true;
  if (westbankControlSource) westbankControlSource.show = true;
  scene.screenSpaceCameraController.minimumZoomDistance = 1;
  scene.screenSpaceCameraController.enableCollisionDetection = true;
  $("nav-hint").hidden = true;
  $("photo3d-toggle").checked = false;
}

$("photo3d-toggle").addEventListener("change", async (e) => {
  try {
    if (e.target.checked) {
      if (!photo3d) {
        photo3d = await Cesium.createGooglePhotorealistic3DTileset();
        photo3d.maximumScreenSpaceError = 4; // détail fin au niveau rue
        scene.primitives.add(photo3d);
      }
      photo3d.show = true;
      groundGlobeHandler = () => {
        // Sous GROUND_ALTITUDE_M, les couches de contrôle territorial (
        // polygones semi-transparents calés au sol) s'affichent très mal
        // par-dessus le maillage photoréaliste, en larges taches sombres
        // irrégulières — on les masque donc au niveau rue, comme le globe.
        const aboveGround = viewer.camera.positionCartographic.height > GROUND_ALTITUDE_M;
        scene.globe.show = aboveGround;
        if (controlPrimitive) controlPrimitive.show = aboveGround;
        if (yemenControlSource) yemenControlSource.show = aboveGround;
        if (westbankControlSource) westbankControlSource.show = aboveGround;
        // Le maillage Google ne couvre pas les océans (ni les zones sans
        // relevé récent) : ses tuiles s'y affichent en noir plat. Vu de loin
        // il n'apporte de toute façon rien par rapport à l'imagerie normale
        // du globe — on ne le garde visible qu'au niveau rue.
        photo3d.show = !aboveGround;
      };
      scene.preRender.addEventListener(groundGlobeHandler);
      // Zoom libre jusqu'au sol et collision désactivée : on peut se glisser
      // entre les bâtiments plutôt que d'être bloqué à distance.
      scene.screenSpaceCameraController.minimumZoomDistance = 1;
      scene.screenSpaceCameraController.enableCollisionDetection = false;
      $("nav-hint").hidden = false;
      // La caméra du globe reste souvent en vue plongeante (vue "carte",
      // tangage proche de -90°) : sans bascule, les villes 3D s'affichent
      // mais on continue à les regarder d'en haut au lieu d'une vue au
      // niveau des rues façon Google Maps. On incline et on rapproche la
      // caméra seulement si elle est encore quasi verticale.
      if (viewer.camera.pitch < Cesium.Math.toRadians(-60)) {
        const c = viewer.camera.positionCartographic;
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, Math.min(c.height, 700)),
          orientation: { heading: viewer.camera.heading, pitch: Cesium.Math.toRadians(-18), roll: 0 },
          duration: 1.5,
        });
      }
    } else {
      disablePhoto3D();
    }
  } catch (err) {
    e.target.checked = false;
    if (groundGlobeHandler) {
      scene.preRender.removeEventListener(groundGlobeHandler);
      groundGlobeHandler = null;
    }
    scene.globe.show = true;
    if (controlPrimitive) controlPrimitive.show = true;
    if (yemenControlSource) yemenControlSource.show = true;
    if (westbankControlSource) westbankControlSource.show = true;
    $("status").textContent = `⚠️ Villes 3D indisponibles — ${err.message || err}`;
  }
});

// Le maillage Google (Cesium3DTileset) ne s'affiche pas correctement hors du
// mode Globe (3D) : en vue Planisphère/Colombus, il devient noir ou ne se
// détaille plus en zoomant. On le désactive donc dès qu'on quitte le mode
// 3D, et on bloque le bouton pour éviter de le rallumer dans un mode où il
// ne peut de toute façon pas fonctionner correctement.
scene.morphStart.addEventListener((_transitioner, _previousMode, newMode) => {
  const is3D = newMode === Cesium.SceneMode.SCENE3D;
  if (!is3D && $("photo3d-toggle").checked) {
    disablePhoto3D();
    $("status").textContent = "Villes 3D photoréalistes désactivées : disponibles uniquement en mode Globe (3D).";
  }
  $("photo3d-toggle").disabled = !ionToken || !is3D;
  $("photo3d-toggle").parentElement.title = !ionToken
    ? "Nécessite un token Cesium Ion"
    : !is3D
      ? "Disponible uniquement en mode Globe (3D)"
      : "";
});

// Déplacement au sol façon "marche" (WASD/ZQSD + flèches) : utile pour
// parcourir les rues en villes 3D, mais actif partout sur le globe.
// Q/D (ou ←/→) tournent la caméra sur elle-même (comme dans un jeu à la
// première personne) plutôt que de translater latéralement — on peut déjà
// glisser la souris pour ça, la disparité clavier/souris n'avait pas de sens.
const MOVE_KEYS = { z: "fwd", w: "fwd", arrowup: "fwd", s: "back", arrowdown: "back", q: "turnleft", a: "turnleft", arrowleft: "turnleft", d: "turnright", arrowright: "turnright" };
const pressedMoves = new Set();
function isTypingTarget(el) {
  return el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA");
}
addEventListener("keydown", (e) => {
  const move = MOVE_KEYS[e.key.toLowerCase()];
  if (!move || isTypingTarget(document.activeElement)) return;
  pressedMoves.add(move);
});
addEventListener("keyup", (e) => pressedMoves.delete(MOVE_KEYS[e.key.toLowerCase()]));
addEventListener("blur", () => pressedMoves.clear());
scene.preRender.addEventListener(() => {
  if (!pressedMoves.size) return;
  // Vitesse proportionnelle à l'altitude (rapide en vol, fine au sol entre les
  // bâtiments), plafonnée : sans plafond, une pression de touche en vue globe
  // (altitude ~10-20 000 km) projetait la caméra à des millions de mètres par
  // frame, hors du champ en un instant.
  const speed = Math.min(20000, Math.max(1.5, viewer.camera.positionCartographic.height * 0.06));
  const turnSpeed = Cesium.Math.toRadians(1.6);
  if (pressedMoves.has("fwd") || pressedMoves.has("back")) {
    // moveForward/moveBackward avancent le long de l'axe de visée exact : en
    // vue plongeante, ça revient à descendre en biais vers le sol au lieu
    // d'avancer "à plat" comme en marchant. On avance donc dans le plan
    // horizontal local (est-nord), dans la direction du cap, sans tenir
    // compte du tangage — l'altitude ne bouge que si on monte/descend soi-même.
    const heading = viewer.camera.heading;
    const forwardENU = new Cesium.Cartesian3(Math.sin(heading), Math.cos(heading), 0);
    const transform = Cesium.Transforms.eastNorthUpToFixedFrame(viewer.camera.positionWC);
    const forwardWorld = Cesium.Matrix4.multiplyByPointAsVector(transform, forwardENU, new Cesium.Cartesian3());
    Cesium.Cartesian3.normalize(forwardWorld, forwardWorld);
    if (pressedMoves.has("fwd")) viewer.camera.move(forwardWorld, speed);
    if (pressedMoves.has("back")) viewer.camera.move(forwardWorld, -speed);
  }
  if (pressedMoves.has("turnleft") || pressedMoves.has("turnright")) {
    // lookLeft/lookRight tournent autour du "up" propre de la caméra : dès
    // que le tangage n'est plus exactement horizontal, ce vecteur dérive de
    // la verticale locale et la rotation devient un tour en biais (roulis
    // qui s'accumule). En recalculant le cap depuis le repère local
    // est-nord-haut (roll figé à 0), la rotation reste toujours à plat.
    const delta = (pressedMoves.has("turnright") ? 1 : 0) - (pressedMoves.has("turnleft") ? 1 : 0);
    viewer.camera.setView({
      orientation: { heading: viewer.camera.heading + delta * turnSpeed, pitch: viewer.camera.pitch, roll: 0 },
    });
  }
});

// Panneau de contrôle repliable (utile surtout sur mobile).
$("controls-toggle").addEventListener("click", () => {
  const hidden = $("controls").classList.toggle("hidden");
  document.body.classList.toggle("controls-hidden", hidden);
  $("controls-toggle").setAttribute("aria-expanded", String(!hidden));
});
if (matchMedia("(max-width: 900px)").matches) $("controls-toggle").click();

// ───────────────────────── Couches de contexte (icônes regroupées) ─────────────────────────
function iconCanvas(glyph, color) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  g.beginPath();
  g.arc(32, 32, 26, 0, Math.PI * 2);
  g.fillStyle = "rgba(10,14,22,0.92)";
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = color;
  g.stroke();
  g.font = "28px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji'";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(glyph, 32, 34);
  return c;
}
function clusterCanvas(n, color) {
  const c = document.createElement("canvas");
  c.width = c.height = 72;
  const g = c.getContext("2d");
  g.beginPath();
  g.arc(36, 36, 30, 0, Math.PI * 2);
  g.fillStyle = color + "33";
  g.fill();
  g.beginPath();
  g.arc(36, 36, 22, 0, Math.PI * 2);
  g.fillStyle = "rgba(10,14,22,0.95)";
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = color;
  g.stroke();
  g.fillStyle = "#fff";
  g.font = "bold 20px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(n > 99 ? "99+" : String(n), 36, 37);
  return c;
}

const CONTEXT_LAYERS = [
  { key: "nuclear", endpoint: "/api/nuclear-sites", glyph: "☢️", color: "#f4d03f", kindKey: "kind_nuclear", provider: "Wikidata" },
  { key: "military", endpoint: "/api/military-sites", glyph: "🎖️", color: "#5b9bf0", kindKey: "kind_military", provider: "OpenStreetMap" },
  { key: "infrastructure", endpoint: "/api/infrastructure-sites", glyph: "✈️", color: "#7ed6c1", kindKey: "kind_infrastructure", provider: "OpenStreetMap" },
];
for (const L of CONTEXT_LAYERS) {
  L.source = new Cesium.CustomDataSource(L.key);
  L.source.clustering = new Cesium.EntityCluster({ enabled: true, pixelRange: 42, minimumClusterSize: 3, clusterBillboards: true, clusterLabels: false, clusterPoints: false });
  L.source.clustering.clusterEvent.addEventListener((clustered, cluster) => {
    cluster.label.show = false;
    cluster.billboard.show = true;
    cluster.billboard.verticalOrigin = Cesium.VerticalOrigin.CENTER;
    cluster.billboard.image = clusterCanvas(clustered.length, L.color);
    cluster.billboard.scale = 0.62;
    cluster.billboard.disableDepthTestDistance = 30000;
    // Pas de regroupements imposants à l'échelle du monde : couches de contexte
    // visibles seulement en vue régionale.
    cluster.billboard.distanceDisplayCondition = new Cesium.DistanceDisplayCondition(0, 4.5e6);
  });
  L.icon = iconCanvas(L.glyph, L.color);
  viewer.dataSources.add(L.source);
}

async function loadContextLayer(L, retry = 0) {
  L.source.entities.removeAll();
  if (!$(`${L.key}-toggle`).checked) return layerStatus(L.key);
  try {
    const data = await apiJson(L.endpoint);
    L.source.entities.suspendEvents();
    for (const f of data.features || []) {
      const [lon, lat] = f.geometry.coordinates;
      const p = f.properties || {};
      const entity = L.source.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        billboard: { image: L.icon, scale: 0.5, disableDepthTestDistance: 30000, distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 4.5e6) },
        name: p.name || tr(L.kindKey),
      });
      panelInfo.set(entity, {
        kind: `${L.glyph} ${tr(L.kindKey)}`,
        title: p.name || tr(L.kindKey),
        badge: RELIABILITY.community,
        sourceLabel: L.provider,
        rows: [[tr("row_country"), p.country], [tr("row_status"), p.status], [tr("row_type"), p.type], [tr("row_operator"), p.operator]],
        lon, lat,
      });
    }
    L.source.entities.resumeEvents();
    layerStatus(L.key, { count: (data.features || []).length, fetchedAt: data.fetched_at, stale: data.stale, staleReason: data.stale_reason });
  } catch (err) {
    if (err.message.includes("en cours") && retry < 12) {
      layerStatus(L.key, { loading: true });
      setTimeout(() => loadContextLayer(L, retry + 1), 15000);
      return;
    }
    layerStatus(L.key, { error: err.message });
  }
}
CONTEXT_LAYERS.forEach((L) => $(`${L.key}-toggle`).addEventListener("change", () => loadContextLayer(L)));

// ───────────────────────── Contrôle territorial (Ukraine) ─────────────────────────
// Estimation VIINA agrégée en hexagones H3 posés au sol : teinte selon le
// statut dominant. Branché sur la timeline : à une date antérieure au
// dernier changement d'une localité, son statut PRÉCÉDENT est utilisé (le
// fichier ne garde que le tout dernier changement de chaque localité dans
// la fenêtre ; un lieu qui a changé de main plusieurs fois affichera donc
// une approximation avant ce dernier changement — voir méthodologie).
const CONTROL_RES = 5;
const CONTROL_COLOR = {
  R: Cesium.Color.fromCssColorString("#e0413a"),
  C: Cesium.Color.fromCssColorString("#f0a020"),
  U: Cesium.Color.fromCssColorString("#4c9be8"), // libéré (visible seulement près de la date du changement)
};
let controlPrimitive = null;
let controlData = null;
let controlCells = []; // { id (objet = clé d'attribut Cesium), lat, lon, admin1, localities }
const controlDateCompact = (cutoff) => (cutoff ? cutoff.replaceAll("-", "") : null);

/** Statut d'une localité à une date donnée : son statut précédent si son
 * (unique) changement connu est postérieur au cutoff, sinon son statut actuel. */
function localityStatusAt(loc, cutoffCompact) {
  if (cutoffCompact && loc.changed && String(loc.changed) > cutoffCompact && loc.prevStatus) return loc.prevStatus;
  return loc.status;
}

function cellStateAt(cell, cutoffCompact) {
  const s = { R: 0, C: 0, U: 0, changes: [] };
  for (const loc of cell.localities) {
    s[localityStatusAt(loc, cutoffCompact)]++;
    if (loc.changed && (!cutoffCompact || String(loc.changed) <= cutoffCompact)) s.changes.push(loc);
  }
  return s;
}

function cellColor(s) {
  const hasRecent = s.changes.length > 0;
  if (s.R >= s.C && s.R > 0) return CONTROL_COLOR.R.withAlpha(hasRecent ? 0.62 : 0.4);
  if (s.C > 0) return CONTROL_COLOR.C.withAlpha(0.55);
  return CONTROL_COLOR.U.withAlpha(0.5);
}

function controlPanel(cell, cutoffCompact) {
  const s = cellStateAt(cell, cutoffCompact);
  return {
    kind: tr("control_kind_ukraine"),
    title: s.R >= s.C && s.R > 0 ? tr("zone_russian") : s.C > 0 ? tr("zone_contested") : tr("zone_liberated"),
    badge: RELIABILITY.modeled,
    sourceLabel: "VIINA 2.0",
    rows: [[tr("row_region"), cell.admin1], [tr("row_localities_russian"), s.R || null], [tr("row_localities_contested"), s.C || null], [tr("row_data_as_of"), frDate(controlData.as_of)]],
    itemsTitle: tr("items_title_changes"),
    items: s.changes.sort((a, b) => b.changed - a.changed).slice(0, 8).map((r) => ({
      title: r.name,
      meta: `${r.status === "R" ? tr("change_to_russian") : r.status === "C" ? tr("change_to_contested") : tr("change_liberated")} · ${String(r.changed).replace(/(\d{4})(\d{2})(\d{2})/, "$3/$2/$1")}`,
    })),
    notes: tr("control_notes_ukraine"),
    url: controlData.url,
    lon: cell.lon, lat: cell.lat, zoomRange: 60000,
  };
}

function buildControl(data) {
  const grouped = new Map();
  for (const [lon, lat, status, changed, name, admin1, prevStatus] of data.places) {
    const cellId = h3.latLngToCell(lat, lon, CONTROL_RES);
    let c = grouped.get(cellId);
    if (!c) grouped.set(cellId, (c = { cellId, admin1, localities: [] }));
    c.localities.push({ status, changed: changed || 0, prevStatus: prevStatus || null, name });
  }

  controlCells = [];
  const instances = [];
  for (const c of grouped.values()) {
    const positions = cellPolygon(c.cellId);
    if (!positions) continue;
    const [lat, lon] = h3.cellToLatLng(c.cellId);
    const cell = { admin1: c.admin1, localities: c.localities, lat, lon, controlCell: true };
    controlCells.push(cell);
    instances.push(new Cesium.GeometryInstance({
      geometry: new Cesium.PolygonGeometry({
        polygonHierarchy: new Cesium.PolygonHierarchy(positions),
        height: 80, // légèrement au-dessus du relief : évite le z-fighting sans "flotter" visiblement
        vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
      }),
      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(cellColor(cellStateAt(cell, null))) },
      id: cell, // même référence réutilisée pour les mises à jour de couleur et le clic
    }));
  }
  // Un GroundPrimitive (drapé sur le vrai relief) attend que le terrain se
  // charge pour devenir "ready" - ça peut ne jamais aboutir en pratique.
  // On préfère donc un polygone plat classique, légèrement surélevé pour
  // éviter le z-fighting avec le relief, comme pour les colonnes d'événements.
  return new Cesium.Primitive({
    geometryInstances: instances,
    appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
    asynchronous: false,
  });
}

/** Recolore les hexagones existants pour une date donnée, sans reconstruire
 * la géométrie (appelé à chaque déplacement du curseur de la timeline). */
function updateControlColors() {
  if (!controlPrimitive?.ready || !controlCells.length) return;
  const cutoffCompact = controlDateCompact(state.cutoff);
  for (const cell of controlCells) {
    const attrs = controlPrimitive.getGeometryInstanceAttributes(cell);
    if (attrs) attrs.color = Cesium.ColorGeometryInstanceAttribute.toValue(cellColor(cellStateAt(cell, cutoffCompact)), attrs.color);
  }
}

async function loadControl() {
  if (controlPrimitive) {
    scene.primitives.remove(controlPrimitive);
    controlPrimitive = null;
    controlCells = [];
  }
  if (!$("control-toggle").checked) {
    setupTimeline();
    return layerStatus("control");
  }
  try {
    if (!controlData) {
      const res = await fetch("/data/ukraine-control.json");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      controlData = await res.json();
    }
    controlPrimitive = scene.primitives.add(buildControl(controlData));
    layerStatus("control", { count: controlData.places.length, note: `au ${frDate(controlData.as_of).slice(0, 5)}` });
    setupTimeline(); // le contrôle territorial peut à lui seul justifier d'afficher la timeline
    updateControlColors(); // reflète un curseur déjà déplacé avant que cette couche ne charge
  } catch (err) {
    layerStatus("control", { error: err.message });
  }
}
$("control-toggle").addEventListener("change", loadControl);

// ───────────────────────── Contrôle territorial (Yémen) ─────────────────────────
// Polygones par district (admin2) ACAPS, pas de front quotidien comme VIINA :
// un simple GeoJsonDataSource suffit, pas besoin d'agrégation en hexagones.
const YEMEN_CONTROLLER_COLOR = {
  IRG: Cesium.Color.fromCssColorString("#5b9bf0"),
  DFA: Cesium.Color.fromCssColorString("#e0413a"),
  STC: Cesium.Color.fromCssColorString("#4caf7d"),
  AQAP: Cesium.Color.fromCssColorString("#8b5cf6"),
};
const YEMEN_UNKNOWN_COLOR = Cesium.Color.fromCssColorString("#8b95a5");
let yemenControlSource = null;
let yemenControlData = null;

async function loadYemenControl() {
  if (yemenControlSource) {
    viewer.dataSources.remove(yemenControlSource, true);
    yemenControlSource = null;
  }
  if (!$("yemen-control-toggle").checked) return layerStatus("yemen-control");
  try {
    if (!yemenControlData) {
      const res = await fetch("/data/yemen-control.json");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      yemenControlData = await res.json();
    }
    const ds = await Cesium.GeoJsonDataSource.load(
      { type: "FeatureCollection", features: yemenControlData.features },
      { clampToGround: true },
    );
    for (const entity of ds.entities.values) {
      const p = entity.properties?.getValue?.(Cesium.JulianDate.now()) || {};
      const color = (YEMEN_CONTROLLER_COLOR[p.controller] || YEMEN_UNKNOWN_COLOR).withAlpha(0.45);
      entity.polygon.material = color;
      entity.polygon.outline = true;
      entity.polygon.outlineColor = color.withAlpha(0.9);
      // Sans ceci, un polygone drapé au sol (clampToGround) ne se classifie
      // que sur le terrain : avec les tuiles 3D photoréalistes (Villes 3D),
      // qui remplacent visuellement le terrain, ça se traduit par des
      // plaques noires irrégulières. BOTH le classifie sur les deux.
      entity.polygon.classificationType = Cesium.ClassificationType.BOTH;
      panelInfo.set(entity, {
        kind: tr("control_kind_yemen"),
        title: p.admin2 || tr("district_default"),
        badge: RELIABILITY.modeled,
        sourceLabel: "ACAPS",
        rows: [[tr("row_governorate"), p.admin1], [tr("row_control"), p.controller_label], [tr("row_data_as_of"), frDate(yemenControlData.as_of)]],
        notes: tr("control_notes_yemen"),
        url: yemenControlData.url,
      });
    }
    viewer.dataSources.add(ds);
    yemenControlSource = ds;
    layerStatus("yemen-control", { count: yemenControlData.features.length, note: `au ${frDate(yemenControlData.as_of).slice(0, 5)}` });
  } catch (err) {
    layerStatus("yemen-control", { error: err.message });
  }
}
$("yemen-control-toggle").addEventListener("change", loadYemenControl);

// ───────────────────────── Contrôle territorial (Cisjordanie) ─────────────────────────
// Classification légale des accords d'Oslo (1995) — statique, pas un front qui
// évolue. Ne couvre que la Cisjordanie : aucune source fiable et à jour n'a
// été trouvée pour Gaza (voir build_westbank_control.py et la méthodologie).
const WESTBANK_ZONE_COLOR = {
  A: Cesium.Color.fromCssColorString("#4c9be8"),
  H1: Cesium.Color.fromCssColorString("#4c9be8"),
  B: Cesium.Color.fromCssColorString("#f0a020"),
  C: Cesium.Color.fromCssColorString("#e0413a"),
  H2: Cesium.Color.fromCssColorString("#e0413a"),
  "ISRAELI DECLARED EAST JERUSALEM": Cesium.Color.fromCssColorString("#8b5cf6"),
  "NO MAN'S LAND": Cesium.Color.fromCssColorString("#8b95a5"),
};
const WESTBANK_UNKNOWN_COLOR = Cesium.Color.fromCssColorString("#8b95a5");
let westbankControlSource = null;
let westbankControlData = null;

async function loadWestBankControl() {
  if (westbankControlSource) {
    viewer.dataSources.remove(westbankControlSource, true);
    westbankControlSource = null;
  }
  if (!$("westbank-control-toggle").checked) return layerStatus("westbank-control");
  try {
    if (!westbankControlData) {
      const res = await fetch("/data/westbank-control.json");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      westbankControlData = await res.json();
    }
    const ds = await Cesium.GeoJsonDataSource.load(
      { type: "FeatureCollection", features: westbankControlData.features },
      { clampToGround: true },
    );
    for (const entity of ds.entities.values) {
      const p = entity.properties?.getValue?.(Cesium.JulianDate.now()) || {};
      const color = (WESTBANK_ZONE_COLOR[p.zone] || WESTBANK_UNKNOWN_COLOR).withAlpha(0.45);
      entity.polygon.material = color;
      entity.polygon.outline = true;
      entity.polygon.outlineColor = color.withAlpha(0.9);
      // cf. loadYemenControl() : évite les plaques noires sous les tuiles 3D.
      entity.polygon.classificationType = Cesium.ClassificationType.BOTH;
      panelInfo.set(entity, {
        kind: tr("control_kind_westbank"),
        title: p.zone_label || tr("zone_default"),
        badge: RELIABILITY.modeled,
        sourceLabel: "OCHA (oPt)",
        rows: [[tr("row_data_as_of"), frDate(westbankControlData.as_of)]],
        notes: westbankControlData.note,
        url: westbankControlData.url,
      });
    }
    viewer.dataSources.add(ds);
    westbankControlSource = ds;
    layerStatus("westbank-control", { count: westbankControlData.features.length, note: `au ${frDate(westbankControlData.as_of).slice(0, 5)}` });
  } catch (err) {
    layerStatus("westbank-control", { error: err.message });
  }
}
$("westbank-control-toggle").addEventListener("change", loadWestBankControl);

// ───────────────────────── Fil en direct + résumé du jour ─────────────────────────
// Indépendant des filtres de la carte (période/pays/zone visible choisis par
// l'utilisateur) : toujours dernières 24 h, monde entier, sources qualifiées
// + presse — pour répondre à "qu'est-ce qui vient de se passer", pas à "que
// vois-je en ce moment sur la carte" (déjà couvert par "Dans la vue").
const LIVE_POLL_MS = 3 * 60 * 1000;
const LIVE_FEED_MAX = 30;
const seenEventKeys = new Set();
let liveFeedItems = [];
let firstLivePoll = true;

const eventKey = (f) => {
  const [lon, lat] = f.geometry.coordinates;
  const p = f.properties;
  return `${p.event_date}|${p.event_type}|${lon.toFixed(2)}|${lat.toFixed(2)}`;
};

function renderDailySummary(features) {
  let fat = 0, verified = 0;
  const byType = {};
  for (const f of features) {
    const p = f.properties;
    if (p.confidence !== "press") {
      verified++;
      fat += p.fatalities || 0;
    }
    byType[p.event_type] = (byType[p.event_type] || 0) + 1;
  }
  $("daily-events").textContent = features.length.toLocaleString(numLocale());
  $("daily-fat").textContent = fat.toLocaleString(numLocale());
  $("daily-verified").textContent = verified.toLocaleString(numLocale());
  const max = Math.max(1, ...Object.values(byType));
  $("daily-types").innerHTML = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `<div class="type-bar"><span>${escapeHtml(EVENT_TYPE_LABELS[t] || t)}</span><span>${n}</span>
      <div class="track"><div class="fill" style="width:${(n / max) * 100}%;background:${EVENT_TYPE_COLORS[t] || "#e2463b"}"></div></div></div>`)
    .join("");
}

function renderLiveFeed() {
  $("live-badge").hidden = liveFeedItems.length === 0;
  $("live-badge").textContent = String(liveFeedItems.length);
  $("live-feed").innerHTML = liveFeedItems
    .map((f, i) => {
      const p = f.properties;
      const meta = [EVENT_TYPE_LABELS[p.event_type] || p.event_type, p.event_date ? frDate(p.event_date) : null].filter(Boolean).join(" · ");
      return `<li data-i="${i}"><b>${escapeHtml(p.name || tr("default_event"))}</b><span>${escapeHtml(meta)}</span></li>`;
    })
    .join("");
}
$("live-feed").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-i]");
  const f = li && liveFeedItems[Number(li.dataset.i)];
  if (!f) return;
  flyToPoint(...f.geometry.coordinates, 400000);
  showSidePanel(eventPanelInfo(f));
});

async function pollLiveFeed() {
  try {
    const data = await apiJson("/api/conflicts?days=1&event_type=all&sources=ucdp,gdelt");
    const features = data.features || [];
    const nowStr = new Date().toLocaleTimeString(numLocale());
    if (firstLivePoll) {
      features.forEach((f) => seenEventKeys.add(eventKey(f)));
      firstLivePoll = false;
      $("live-status").textContent =
        LANG === "fr" ? `Suivi démarré à ${nowStr} — les événements à venir apparaîtront ici.` : `Tracking started at ${nowStr} — upcoming events will appear here.`;
    } else {
      const fresh = features.filter((f) => !seenEventKeys.has(eventKey(f)));
      features.forEach((f) => seenEventKeys.add(eventKey(f)));
      if (fresh.length) {
        liveFeedItems = [...fresh, ...liveFeedItems].slice(0, LIVE_FEED_MAX);
        renderLiveFeed();
      }
      $("live-status").textContent = fresh.length
        ? LANG === "fr"
          ? `${fresh.length} nouveau${fresh.length > 1 ? "x" : ""} événement${fresh.length > 1 ? "s" : ""} détecté${fresh.length > 1 ? "s" : ""} à ${nowStr}.`
          : `${fresh.length} new event${fresh.length > 1 ? "s" : ""} detected at ${nowStr}.`
        : LANG === "fr"
          ? `Aucun nouvel événement — vérifié à ${nowStr}.`
          : `No new event — checked at ${nowStr}.`;
    }
    renderDailySummary(features);
    $("daily-status").textContent = LANG === "fr" ? `Mis à jour à ${nowStr}.` : `Updated at ${nowStr}.`;
  } catch (err) {
    $("live-status").textContent = `⚠️ ${err.message}`;
    $("daily-status").textContent = `⚠️ ${err.message}`;
  }
}
pollLiveFeed();
setInterval(pollLiveFeed, LIVE_POLL_MS);

// ───────────────────────── Notifications Web Push ─────────────────────────
// Alerte même l'onglet en arrière-plan (ou le navigateur fermé, sur les
// plateformes qui le permettent) quand un nouvel événement apparaît — le fil
// "Nouveaux événements" ci-dessus ne fonctionne, lui, que page ouverte.
const vapidPublicKey = window.VAPID_PUBLIC_KEY || "";
function urlBase64ToUint8Array(base64url) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

let lastPushState = "idle";
async function setPushButton(pushState) {
  lastPushState = pushState;
  const btn = $("push-toggle");
  const status = $("push-status");
  if (pushState === "unsupported") {
    btn.disabled = true;
    btn.textContent = tr("push_unsupported");
    status.textContent = tr("push_unsupported_status");
  } else if (pushState === "denied") {
    btn.disabled = true;
    btn.textContent = tr("push_denied");
    status.textContent = tr("push_denied_status");
  } else if (pushState === "subscribed") {
    btn.textContent = tr("push_disable");
    status.textContent = tr("push_subscribed_status");
  } else {
    btn.textContent = tr("push_enable");
    status.textContent = "";
  }
}

// Enregistré inconditionnellement (PWA : installabilité + coquille hors-ligne),
// même si les notifications elles-mêmes ne sont pas prises en charge/activées.
const swRegistration = "serviceWorker" in navigator ? navigator.serviceWorker.register("/sw.js").catch(() => null) : Promise.resolve(null);

// Pays suivis pour les notifications : vide = tous. Persisté pour survivre
// aux rechargements (le <select> est repeuplé dynamiquement par loadFilters).
function pushCountries() {
  return [...$("push-countries").selectedOptions].map((o) => o.value);
}
function restorePushCountries() {
  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem("push_countries") || "[]");
  } catch {
    /* ignore */
  }
  [...$("push-countries").options].forEach((o) => (o.selected = saved.includes(o.value)));
}
async function subscribePush(reg) {
  const newSub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) });
  const countries = pushCountries();
  const body = { ...JSON.parse(JSON.stringify(newSub)), countries };
  const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  localStorage.setItem("push_countries", JSON.stringify(countries));
  return newSub;
}

async function initPush() {
  const reg = await swRegistration;
  if (!reg || !("PushManager" in window) || !vapidPublicKey) return setPushButton("unsupported");
  if (Notification.permission === "denied") return setPushButton("denied");
  restorePushCountries();
  const existing = await reg.pushManager.getSubscription();
  setPushButton(existing ? "subscribed" : "idle");

  $("push-toggle").addEventListener("click", async () => {
    try {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub) }).catch(() => {});
        await sub.unsubscribe();
        setPushButton("idle");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setPushButton(perm === "denied" ? "denied" : "idle");
      await subscribePush(reg);
      setPushButton("subscribed");
    } catch (err) {
      $("push-status").textContent = `⚠️ ${err.message}`;
    }
  });
  // Changer la sélection alors qu'on est déjà abonné met à jour l'abonnement
  // existant (même endpoint : la clé KV est réécrite, pas dupliquée).
  $("push-countries").addEventListener("change", async () => {
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    try {
      await subscribePush(reg);
      $("push-status").textContent = pushCountries().length ? tr("push_filter_updated") : tr("push_filter_all");
    } catch (err) {
      $("push-status").textContent = `⚠️ ${err.message}`;
    }
  });
}
initPush();

// ───────────────────────── Démarrage ─────────────────────────
function loadAll() {
  loadEvents();
  loadControl();
  loadYemenControl();
  loadWestBankControl();
  CONTEXT_LAYERS.forEach((L) => loadContextLayer(L));
}

// Horloge UTC + heure locale (fuseau du visiteur)
const localZoneAbbr = (() => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(new Date());
  return parts.find((p) => p.type === "timeZoneName")?.value || "";
})();
$("clock-local-zone").textContent = localZoneAbbr;
function tickClock() {
  const now = new Date();
  $("clock-utc").textContent = now.toISOString().substring(11, 19);
  $("clock-local").textContent = now.toLocaleTimeString(numLocale(), { hour12: false });
}
tickClock();
setInterval(tickClock, 1000);

// ───────────────────────── Bascule de langue ─────────────────────────
function refreshLangLabels() {
  RELIABILITY = RELIABILITY_BY_LANG[LANG];
  CONFIDENCE_LABELS = CONFIDENCE_LABELS_BY_LANG[LANG];
  EVENT_TYPE_LABELS = EVENT_TYPE_LABELS_BY_LANG[LANG];
}
$("lang-toggle").addEventListener("click", () => {
  LANG = LANG === "fr" ? "en" : "fr";
  localStorage.setItem("strategos_lang", LANG);
  applyI18n();
  refreshLangLabels();
  setPushButton(lastPushState);
  hideSidePanel();
  tickClock();
  loadAll();
  renderLiveFeed(); // rafraîchit immédiatement le libellé des événements déjà affichés
  pollLiveFeed(); // rafraîchit le résumé du jour (sinon en attente du prochain sondage)
});

loadFilters().then(() => {
  applySharedState();
  loadAll();
});

})();
