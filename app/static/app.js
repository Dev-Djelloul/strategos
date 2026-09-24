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
  ? await Cesium.CesiumTerrainProvider.fromIonAssetId(1) // 1 = Cesium World Terrain
  : new Cesium.EllipsoidTerrainProvider();

const viewer = new Cesium.Viewer("cesiumContainer", {
  baseLayerPicker: false,
  geocoder: false,
  homeButton: true,
  sceneModePicker: true,
  navigationHelpButton: false,
  animation: false,
  timeline: false,
  fullscreenButton: false,
  infoBox: true,
  selectionIndicator: true,
  imageryProvider: satelliteImagery,
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
}

// Horloge synchronisée sur l'heure système réelle, qui avance en continu
// (au lieu de rester figée sur l'instant du chargement de la page) : le
// terminateur jour/nuit sur le globe suit ainsi le soleil en temps réel.
viewer.clock.shouldAnimate = true;
viewer.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK;
viewer.clock.multiplier = 1;

viewer.camera.flyHome(0);

// La barre d'outils se replie/déplie avec une transition CSS ; Cesium ne
// redétecte pas automatiquement le changement de taille de son conteneur
// dans ce cas (pas d'événement resize navigateur), d'où cet observer.
new ResizeObserver(() => viewer.resize()).observe(document.getElementById("cesiumContainer"));

// Chaque couche de données vit dans son propre DataSource : on peut la
// rafraîchir, la vider ou l'afficher/masquer indépendamment des autres
// (ex: actualiser les conflits sans effacer les sites nucléaires).
const conflictsLayer = new Cesium.CustomDataSource("conflicts");
const nuclearLayer = new Cesium.CustomDataSource("nuclear");
const militaryLayer = new Cesium.CustomDataSource("military");
const infrastructureLayer = new Cesium.CustomDataSource("infrastructure");
viewer.dataSources.add(conflictsLayer);
viewer.dataSources.add(nuclearLayer);
viewer.dataSources.add(militaryLayer);
viewer.dataSources.add(infrastructureLayer);

const statusEl = document.getElementById("status");
const daysEl = document.getElementById("days");
const countryEl = document.getElementById("country");
const eventTypeEl = document.getElementById("event-type");
const refreshBtn = document.getElementById("refresh");
const demoToggleEl = document.getElementById("demo-toggle");
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

// Affiche, à côté de chaque case à cocher de couche, si les données
// viennent réellement de la source live, du mode démo forcé, ou d'un
// repli automatique suite à une erreur (avec le détail au survol) - pour
// que "case cochée ou non" ait toujours un résultat visible et expliqué.
function setLayerBadge(badgeId, source, fallbackReason) {
  const el = document.getElementById(badgeId);
  if (!el) return;
  el.classList.remove("badge-live", "badge-demo");
  if (source === "demo") {
    el.textContent = "démo";
    el.title = "Mode démo forcé";
    el.classList.add("badge-demo");
  } else if (source === "demo_fallback") {
    el.textContent = "démo (repli)";
    el.title = fallbackReason || "Source indisponible, repli automatique";
    el.classList.add("badge-demo");
  } else if (source) {
    el.textContent = "live";
    el.title = `Source : ${source}`;
    el.classList.add("badge-live");
  } else {
    el.textContent = "";
    el.title = "";
  }
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

async function loadEvents() {
  statusEl.textContent = "Chargement…";
  conflictsLayer.entities.removeAll();

  const days = daysEl.value;
  const country = countryEl.value;
  const eventType = eventTypeEl.value;
  const demo = demoToggleEl?.checked ? "&demo=true" : "";

  const params = new URLSearchParams({ days, event_type: eventType });
  if (country) params.set("country", country);

  try {
    const res = await fetch(`/api/events?${params.toString()}${demo}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const geojson = await res.json();

    const features = geojson.features || [];
    features.forEach((feature) => {
      const [lon, lat] = feature.geometry.coordinates;
      const props = feature.properties || {};
      const name = props.name || "Événement";
      const color = EVENT_COLORS[props.event_type] || Cesium.Color.fromCssColorString("#e05a56");

      const descriptionParts = [];
      if (props.event_type) descriptionParts.push(`<strong>Type :</strong> ${escapeHtml(EVENT_TYPE_LABELS[props.event_type] || props.event_type)}`);
      if (props.fatalities !== undefined && props.fatalities !== null) descriptionParts.push(`<strong>Victimes :</strong> ${escapeHtml(String(props.fatalities))}`);
      if (props.event_date) descriptionParts.push(`<strong>Date :</strong> ${escapeHtml(props.event_date)}`);
      if (props.count) descriptionParts.push(`<strong>Mentions :</strong> ${escapeHtml(String(props.count))}`);
      if (props.notes) descriptionParts.push(`<p>${escapeHtml(props.notes)}</p>`);

      conflictsLayer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        point: {
          pixelSize: 9,
          color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        name,
        description: descriptionParts.join("<br/>"),
      });
    });

    const time = new Date().toLocaleTimeString("fr-FR");
    if (geojson.source === "demo_fallback") {
      statusEl.textContent = `⚠️ ACLED indisponible — données démo affichées (${features.length}) — ${time}`;
    } else if (geojson.source === "demo") {
      statusEl.textContent = `Mode démo — ${features.length} événement(s) — ${time}`;
    } else {
      statusEl.textContent = `${features.length} événement(s) ACLED — mis à jour ${time}`;
    }
  } catch (err) {
    statusEl.textContent = `Erreur de chargement (${err.message})`;
  }
}

// Couche générique pour les points simples (nucléaire, militaire,
// infrastructures) : même structure GeoJSON, seul le style et
// l'endpoint changent.
async function loadSimpleLayer({ dataSource, toggleEl, endpoint, color, icon, emptyLabel, badgeId }) {
  dataSource.entities.removeAll();
  if (!toggleEl?.checked) {
    setLayerBadge(badgeId, null);
    return;
  }

  const demo = demoToggleEl?.checked ? "?demo=true" : "";

  try {
    const res = await fetch(`${endpoint}${demo}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const geojson = await res.json();

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

    setLayerBadge(badgeId, geojson.source, geojson.fallback_reason);
  } catch (err) {
    console.error(`Erreur chargement couche ${endpoint}:`, err);
    setLayerBadge(badgeId, "demo_fallback", err.message);
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
countryEl.addEventListener("change", loadEvents);
eventTypeEl.addEventListener("change", loadEvents);
demoToggleEl.addEventListener("change", loadAll);
nuclearToggleEl.addEventListener("change", loadNuclearSites);
militaryToggleEl.addEventListener("change", loadMilitarySites);
infrastructureToggleEl.addEventListener("change", loadInfrastructureSites);

toolbarToggleBtn.addEventListener("click", () => {
  const collapsed = toolbarEl.classList.toggle("collapsed");
  toolbarToggleBtn.textContent = collapsed ? "▼" : "▲";
  toolbarToggleBtn.setAttribute("aria-expanded", String(!collapsed));
});

loadFilters().then(loadAll);

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
