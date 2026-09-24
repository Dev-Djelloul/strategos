// Tout le script est enveloppé dans une IIFE async : le chargement du
// terrain (Cesium.CesiumTerrainProvider.fromIonAssetId) est asynchrone,
// et top-level await n'est pas disponible dans un <script> classique.
(async () => {

// Terrain : sans token Cesium Ion, le globe reste plat (ellipsoïde). Avec
// un token (gratuit, ion.cesium.com), on charge le vrai relief mondial
// (Cesium World Terrain). L'imagerie (satellite Esri + calques) reste
// systématiquement gratuite et sans clé, quel que soit le cas.
const ionToken = window.CESIUM_ION_TOKEN || "";
Cesium.Ion.defaultAccessToken = ionToken || undefined;

const satelliteImagery = new Cesium.UrlTemplateImageryProvider({
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  credit: "Esri, Maxar, Earthstar Geographics",
  maximumLevel: 19,
});

const terrainProvider = ionToken
  ? await Cesium.CesiumTerrainProvider.fromIonAssetId(1, { requestVertexNormals: true }) // 1 = Cesium World Terrain
  : new Cesium.EllipsoidTerrainProvider();

const viewer = new Cesium.Viewer("cesiumContainer", {
  baseLayerPicker: false,
  geocoder: Boolean(ionToken), // recherche de lieux (géocodeur Cesium Ion)
  homeButton: true,
  sceneModePicker: true,
  navigationHelpButton: false,
  animation: false,
  timeline: false,
  fullscreenButton: false,
  infoBox: true,
  selectionIndicator: true,
  baseLayer: new Cesium.ImageryLayer(satelliteImagery),
  terrainProvider,
});

// Couche de référence superposée : frontières, noms de pays, villes -
// gratuite et sans clé également.
viewer.imageryLayers.addImageryProvider(
  new Cesium.UrlTemplateImageryProvider({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    credit: "Esri",
    maximumLevel: 19,
  })
);

// Couche routes/rail/transport - plus de détail au fur et à mesure du
// zoom (visible surtout en vue rapprochée sur une ville/région).
viewer.imageryLayers.addImageryProvider(
  new Cesium.UrlTemplateImageryProvider({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
    credit: "Esri",
    maximumLevel: 19,
  })
);

viewer.scene.globe.enableLighting = true;
if (ionToken) {
  viewer.scene.globe.depthTestAgainstTerrain = true;
  // Le relief réel est quasi invisible à l'échelle du globe : on
  // l'accentue légèrement pour qu'il se voie sans être déformé.
  viewer.scene.verticalExaggeration = 1.5;
}

// Horloge synchronisée sur l'heure système réelle, qui avance en continu
// (au lieu de rester figée sur l'instant du chargement de la page) : le
// terminateur jour/nuit sur le globe suit ainsi le soleil en temps réel.
viewer.clock.shouldAnimate = true;
viewer.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK;
viewer.clock.multiplier = 1;

viewer.camera.flyHome(0);

// Navigation "Google Earth" : régions stratégiques pré-cadrées avec une
// vue inclinée (perspective 3D plutôt que vue à la verticale). Le moteur
// de recherche de lieux (loupe en haut à droite du globe) complète.
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

const regionEl = document.getElementById("region");
REGIONS.forEach((r, i) => {
  const opt = document.createElement("option");
  opt.value = String(i);
  opt.textContent = r.name;
  regionEl.appendChild(opt);
});
regionEl.addEventListener("change", () => {
  const r = REGIONS[Number(regionEl.value)];
  if (!r) return;
  viewer.camera.flyToBoundingSphere(
    new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(r.lon, r.lat, 0), r.range / 4),
    {
      duration: 2.5,
      offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(r.pitch ?? -40), r.range),
    }
  );
});

// Villes 3D photoréalistes (maillage Google via Cesium Ion) : chargé à la
// demande car lourd. Il remplace le globe (imagerie + relief) tant qu'il
// est actif ; on restaure le globe classique en le décochant.
let photo3dTileset = null;
const photo3dToggleEl = document.getElementById("photo3d-toggle");
if (!ionToken) {
  photo3dToggleEl.disabled = true;
  photo3dToggleEl.parentElement.title = "Nécessite un token Cesium Ion (CESIUM_ION_TOKEN)";
}
photo3dToggleEl.addEventListener("change", async () => {
  try {
    if (photo3dToggleEl.checked) {
      if (!photo3dTileset) {
        photo3dTileset = await Cesium.createGooglePhotorealistic3DTileset();
        viewer.scene.primitives.add(photo3dTileset);
      }
      photo3dTileset.show = true;
      viewer.scene.globe.show = false;
    } else {
      if (photo3dTileset) photo3dTileset.show = false;
      viewer.scene.globe.show = true;
    }
  } catch (err) {
    photo3dToggleEl.checked = false;
    viewer.scene.globe.show = true;
    statusEl.textContent = `⚠️ Villes 3D indisponibles — ${err.message || err}`;
  }
});

// La barre d'outils se replie/déplie avec une transition CSS ; Cesium ne
// redétecte pas automatiquement le changement de taille de son conteneur
// dans ce cas (pas d'événement resize navigateur), d'où cet observer.
new ResizeObserver(() => viewer.resize()).observe(document.getElementById("cesiumContainer"));

// Chaque couche de données vit dans son propre DataSource : on peut la
// rafraîchir, la vider ou l'afficher/masquer indépendamment des autres
// (ex: actualiser les conflits sans effacer les sites nucléaires).
// Une couche par source de conflits : ACLED (données qualifiées), UCDP
// (référence académique) et GDELT (presse mondiale, non vérifié).
const EVENT_SOURCES = [
  { key: "acled", label: "ACLED", endpoint: "/api/events", toggleId: "acled-toggle", badgeId: "acled-badge", layer: new Cesium.CustomDataSource("acled") },
  { key: "ucdp", label: "UCDP", endpoint: "/api/ucdp-events", toggleId: "ucdp-toggle", badgeId: "ucdp-badge", layer: new Cesium.CustomDataSource("ucdp") },
  { key: "gdelt", label: "GDELT", endpoint: "/api/gdelt-events", toggleId: "gdelt-toggle", badgeId: "gdelt-badge", layer: new Cesium.CustomDataSource("gdelt") },
];
const nuclearLayer = new Cesium.CustomDataSource("nuclear");
const militaryLayer = new Cesium.CustomDataSource("military");
const infrastructureLayer = new Cesium.CustomDataSource("infrastructure");
EVENT_SOURCES.forEach((src) => viewer.dataSources.add(src.layer));
viewer.dataSources.add(nuclearLayer);
viewer.dataSources.add(militaryLayer);
viewer.dataSources.add(infrastructureLayer);

const statusEl = document.getElementById("status");
const daysEl = document.getElementById("days");
const countryEl = document.getElementById("country");
const eventTypeEl = document.getElementById("event-type");
const refreshBtn = document.getElementById("refresh");
const nuclearToggleEl = document.getElementById("nuclear-toggle");
const militaryToggleEl = document.getElementById("military-toggle");
const infrastructureToggleEl = document.getElementById("infrastructure-toggle");
const toolbarEl = document.getElementById("toolbar");
const toolbarToggleBtn = document.getElementById("toolbar-toggle");

const EVENT_TYPE_LABELS = {
  all: "Tous",
  airstrike: "Frappes aériennes / tirs à distance",
  offensive: "Batailles / offensives",
  protest: "Manifestations",
  casualties: "Violence contre civils",
  ceasefire: "Développements stratégiques",
};

const EVENT_COLORS = {
  airstrike: Cesium.Color.fromCssColorString("#e05a56"),
  offensive: Cesium.Color.fromCssColorString("#c9302c"),
  protest: Cesium.Color.fromCssColorString("#e0a13c"),
  casualties: Cesium.Color.fromCssColorString("#8b1a1a"),
  ceasefire: Cesium.Color.fromCssColorString("#4caf7d"),
};

const NUCLEAR_COLOR = Cesium.Color.fromCssColorString("#f4d03f");
const MILITARY_COLOR = Cesium.Color.fromCssColorString("#5b8def");
const INFRASTRUCTURE_COLOR = Cesium.Color.fromCssColorString("#7ed6c1");

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// Pastille à côté de chaque couche : nombre d'éléments réels et
// heure de mise à jour, ou "indisponible" avec la cause au survol. Aucune
// donnée fabriquée n'est jamais affichée.
function setLayerBadge(badgeId, { count, source, error } = {}) {
  const el = document.getElementById(badgeId);
  if (!el) return;
  el.classList.remove("badge-live", "badge-demo");
  if (error) {
    el.textContent = "indisponible";
    el.title = error;
    el.classList.add("badge-demo");
  } else if (source) {
    el.textContent = `${count}`;
    el.title = `Source : ${source} — ${new Date().toLocaleTimeString("fr-FR")}`;
    el.classList.add("badge-live");
  } else {
    el.textContent = "";
    el.title = "";
  }
  el.style.display = el.textContent ? "" : "none";
}

async function apiJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function loadFilters() {
  try {
    const res = await fetch("/api/filters");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const filters = await res.json();

    filters.countries.forEach(({ code, name }) => {
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = name;
      countryEl.appendChild(opt);
    });

    filters.event_types.forEach((type) => {
      if (type === "all") return;
      const opt = document.createElement("option");
      opt.value = type;
      opt.textContent = EVENT_TYPE_LABELS[type] || type;
      eventTypeEl.appendChild(opt);
    });
  } catch (err) {
    statusEl.textContent = `Filtres indisponibles (${err.message})`;
  }
}

// Timeline : les événements chargés sont conservés en mémoire, et le
// curseur ne fait que régler la date maximale affichée (pas de nouvel
// appel réseau à chaque déplacement).
const timelineEl = document.getElementById("timeline");
const timelineSlider = document.getElementById("timeline-slider");
const timelineLabel = document.getElementById("timeline-label");
const timelinePlayBtn = document.getElementById("timeline-play");
let timelineStart = null; // Date (UTC) correspondant à la position 0
let timelineTimer = null;

function stopTimelinePlayback() {
  clearInterval(timelineTimer);
  timelineTimer = null;
  timelinePlayBtn.textContent = "▶";
}

function timelineCutoff() {
  const day = new Date(timelineStart.getTime() + Number(timelineSlider.value) * 86400000);
  return day.toISOString().substring(0, 10);
}

function applyTimeline() {
  if (!timelineStart) return;
  const cutoff = timelineCutoff();
  timelineLabel.textContent = `jusqu'au ${cutoff}`;
  EVENT_SOURCES.forEach(({ layer }) => layer.entities.values.forEach((entity) => {
    const date = entity.properties?.event_date?.getValue();
    entity.show = !date || date <= cutoff;
  }));
}

function setupTimeline(days) {
  stopTimelinePlayback();
  const hasDated = EVENT_SOURCES.some(({ layer }) => layer.entities.values.some((e) => e.properties?.event_date?.getValue()));
  if (!hasDated) {
    timelineStart = null;
    timelineEl.hidden = true;
    return;
  }
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  timelineStart = new Date(end.getTime() - Number(days) * 86400000);
  timelineSlider.max = String(days);
  timelineSlider.value = String(days);
  timelineEl.hidden = false;
  applyTimeline();
}

timelineSlider.addEventListener("input", () => {
  stopTimelinePlayback();
  applyTimeline();
});

timelinePlayBtn.addEventListener("click", () => {
  if (timelineTimer) return stopTimelinePlayback();
  if (Number(timelineSlider.value) >= Number(timelineSlider.max)) timelineSlider.value = "0";
  timelinePlayBtn.textContent = "⏸";
  timelineTimer = setInterval(() => {
    if (Number(timelineSlider.value) >= Number(timelineSlider.max)) return stopTimelinePlayback();
    timelineSlider.value = String(Number(timelineSlider.value) + 1);
    applyTimeline();
  }, 400);
});

async function loadEventSource(src, params) {
  src.layer.entities.removeAll();
  const toggle = document.getElementById(src.toggleId);
  if (!toggle?.checked) {
    setLayerBadge(src.badgeId);
    return 0;
  }

  try {
    const geojson = await apiJson(`${src.endpoint}?${params.toString()}`);
    const features = geojson.features || [];
    features.forEach((feature) => {
      const [lon, lat] = feature.geometry.coordinates;
      const props = feature.properties || {};
      const color = EVENT_COLORS[props.event_type] || Cesium.Color.fromCssColorString("#e05a56");

      const parts = [`<strong>Source :</strong> ${src.label}`];
      if (props.event_type) parts.push(`<strong>Type :</strong> ${escapeHtml(EVENT_TYPE_LABELS[props.event_type] || props.event_type)}`);
      if (props.fatalities !== undefined && props.fatalities !== null) parts.push(`<strong>Victimes :</strong> ${escapeHtml(String(props.fatalities))}`);
      if (props.event_date) parts.push(`<strong>Date :</strong> ${escapeHtml(props.event_date)}`);
      if (props.count) parts.push(`<strong>Mentions :</strong> ${escapeHtml(String(props.count))}`);
      if (props.notes) parts.push(`<p>${escapeHtml(props.notes)}</p>`);
      if (/^https?:\/\//.test(props.source_url || "")) {
        parts.push(`<a href="${escapeHtml(props.source_url)}" target="_blank" rel="noopener noreferrer">Article source</a>`);
      }

      src.layer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        point: {
          pixelSize: 9,
          color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        name: props.name || "Événement",
        description: parts.join("<br/>"),
        properties: { event_date: props.event_date || null },
      });
    });
    setLayerBadge(src.badgeId, { count: features.length, source: geojson.source });
    return features.length;
  } catch (err) {
    setLayerBadge(src.badgeId, { error: err.message });
    return 0;
  }
}

async function loadEvents() {
  statusEl.textContent = "Chargement…";
  const days = daysEl.value;
  const params = new URLSearchParams({ days, event_type: eventTypeEl.value });
  if (countryEl.value) params.set("country", countryEl.value);

  const counts = await Promise.all(EVENT_SOURCES.map((src) => loadEventSource(src, params)));
  setupTimeline(days);

  const total = counts.reduce((a, b) => a + b, 0);
  statusEl.textContent = `${total} événement(s) — mis à jour ${new Date().toLocaleTimeString("fr-FR")}`;
}

// Couche générique pour les points simples (nucléaire, militaire,
// infrastructures) : même structure GeoJSON, seul le style et
// l'endpoint changent.
async function loadSimpleLayer({ dataSource, toggleEl, endpoint, color, icon, emptyLabel, badgeId }) {
  dataSource.entities.removeAll();
  if (!toggleEl?.checked) {
    setLayerBadge(badgeId);
    return;
  }

  try {
    const geojson = await apiJson(endpoint);

    (geojson.features || []).forEach((feature) => {
      const [lon, lat] = feature.geometry.coordinates;
      const props = feature.properties || {};
      const name = props.name || emptyLabel;

      const descriptionParts = [];
      if (props.country) descriptionParts.push(`<strong>Pays :</strong> ${escapeHtml(props.country)}`);
      if (props.status) descriptionParts.push(`<strong>Statut :</strong> ${escapeHtml(props.status)}`);
      if (props.type) descriptionParts.push(`<strong>Type :</strong> ${escapeHtml(props.type)}`);
      if (props.operator) descriptionParts.push(`<strong>Opérateur :</strong> ${escapeHtml(props.operator)}`);

      dataSource.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        point: {
          pixelSize: 10,
          color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        name: `${icon} ${name}`,
        description: descriptionParts.join("<br/>"),
      });
    });

    setLayerBadge(badgeId, { count: (geojson.features || []).length, source: geojson.source });
  } catch (err) {
    console.error(`Erreur chargement couche ${endpoint}:`, err);
    setLayerBadge(badgeId, { error: err.message });
  }
}

const loadNuclearSites = () => loadSimpleLayer({
  dataSource: nuclearLayer, toggleEl: nuclearToggleEl, endpoint: "/api/nuclear-sites",
  color: NUCLEAR_COLOR, icon: "☢️", emptyLabel: "Site nucléaire", badgeId: "nuclear-badge",
});
const loadMilitarySites = () => loadSimpleLayer({
  dataSource: militaryLayer, toggleEl: militaryToggleEl, endpoint: "/api/military-sites",
  color: MILITARY_COLOR, icon: "🎖️", emptyLabel: "Site militaire", badgeId: "military-badge",
});
const loadInfrastructureSites = () => loadSimpleLayer({
  dataSource: infrastructureLayer, toggleEl: infrastructureToggleEl, endpoint: "/api/infrastructure-sites",
  color: INFRASTRUCTURE_COLOR, icon: "🛫", emptyLabel: "Infrastructure", badgeId: "infrastructure-badge",
});

function loadAll() {
  loadEvents();
  loadNuclearSites();
  loadMilitarySites();
  loadInfrastructureSites();
}

refreshBtn.addEventListener("click", loadAll);
daysEl.addEventListener("change", loadEvents);
EVENT_SOURCES.forEach((src) => document.getElementById(src.toggleId).addEventListener("change", loadEvents));
countryEl.addEventListener("change", loadEvents);
eventTypeEl.addEventListener("change", loadEvents);
nuclearToggleEl.addEventListener("change", loadNuclearSites);
militaryToggleEl.addEventListener("change", loadMilitarySites);
infrastructureToggleEl.addEventListener("change", loadInfrastructureSites);

// La hauteur repliée/dépliée est calculée depuis le contenu réel
// (scrollHeight) plutôt qu'une valeur fixe : le nombre de groupes/couches
// peut varier, une valeur fixe finit toujours par couper quelque chose
// (c'était le bug avec l'horloge mondiale).
function syncToolbarHeight() {
  if (!toolbarEl.classList.contains("collapsed")) {
    toolbarEl.style.maxHeight = `${toolbarEl.scrollHeight}px`;
  }
}

toolbarToggleBtn.addEventListener("click", () => {
  const collapsed = toolbarEl.classList.toggle("collapsed");
  toolbarToggleBtn.textContent = collapsed ? "▼" : "▲";
  toolbarToggleBtn.setAttribute("aria-expanded", String(!collapsed));
  if (!collapsed) syncToolbarHeight();
});

new ResizeObserver(syncToolbarHeight).observe(toolbarEl);

loadFilters().then(loadAll).then(syncToolbarHeight);

// Horloge mondiale : UTC + quelques fuseaux stratégiques, intégrée dans
// la barre d'outils, mise à jour chaque seconde via l'API Intl native du
// navigateur (aucune dépendance ni service externe).
const WORLD_CLOCK_CITIES = [
  { label: "Washington", tz: "America/New_York" },
  { label: "Londres", tz: "Europe/London" },
  { label: "Kyiv", tz: "Europe/Kyiv" },
  { label: "Moscou", tz: "Europe/Moscow" },
  { label: "Jérusalem", tz: "Asia/Jerusalem" },
  { label: "Pékin", tz: "Asia/Shanghai" },
];

const clockUtcEl = document.getElementById("clock-utc-time");
const clockCitiesEl = document.getElementById("clock-cities");

if (clockCitiesEl) {
  clockCitiesEl.innerHTML = WORLD_CLOCK_CITIES.map(
    (c) => `<span class="world-clock-city" data-tz="${c.tz}"><strong>--:--</strong> ${escapeHtml(c.label)}</span>`
  ).join("");
}

function updateWorldClock() {
  const now = new Date();
  if (clockUtcEl) {
    clockUtcEl.textContent = now.toISOString().substring(11, 19);
  }
  clockCitiesEl?.querySelectorAll("[data-tz]").forEach((el) => {
    const tz = el.getAttribute("data-tz");
    const time = new Intl.DateTimeFormat("fr-FR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(now);
    const strong = el.querySelector("strong");
    if (strong) strong.textContent = time;
  });
}

updateWorldClock();
setInterval(updateWorldClock, 1000);

})();
