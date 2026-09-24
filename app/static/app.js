// Pas de token Cesium Ion : on évite volontairement les services payants
// (imagerie Bing, terrain haute-résolution) et on utilise à la place des
// services Esri gratuits sans clé + une ellipsoïde sans relief. Le moteur
// 3D de CesiumJS lui-même est open source et ne nécessite aucune clé.
Cesium.Ion.defaultAccessToken = undefined;

// Imagerie satellite (World Imagery) : rendu bien plus détaillé qu'un fond
// de carte plat façon plan de rue, gratuit et sans clé.
const satelliteImagery = new Cesium.UrlTemplateImageryProvider({
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  credit: "Esri, Maxar, Earthstar Geographics",
  maximumLevel: 19,
});

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
  terrainProvider: new Cesium.EllipsoidTerrainProvider(),
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

// Horloge synchronisée sur l'heure système réelle, qui avance en continu
// (au lieu de rester figée sur l'instant du chargement de la page) : le
// terminateur jour/nuit sur le globe suit ainsi le soleil en temps réel.
viewer.clock.shouldAnimate = true;
viewer.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK;
viewer.clock.multiplier = 1;

viewer.camera.flyHome(0);

// Chaque couche de données vit dans son propre DataSource : on peut la
// rafraîchir, la vider ou l'afficher/masquer indépendamment des autres
// (ex: actualiser les conflits sans effacer les sites nucléaires).
const conflictsLayer = new Cesium.CustomDataSource("conflicts");
const nuclearLayer = new Cesium.CustomDataSource("nuclear");
viewer.dataSources.add(conflictsLayer);
viewer.dataSources.add(nuclearLayer);

const statusEl = document.getElementById("status");
const daysEl = document.getElementById("days");
const countryEl = document.getElementById("country");
const eventTypeEl = document.getElementById("event-type");
const refreshBtn = document.getElementById("refresh");
const demoToggleEl = document.getElementById("demo-toggle");
const nuclearToggleEl = document.getElementById("nuclear-toggle");

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

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
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

async function loadNuclearSites() {
  nuclearLayer.entities.removeAll();
  if (!nuclearToggleEl?.checked) return;

  const demo = demoToggleEl?.checked ? "?demo=true" : "";

  try {
    const res = await fetch(`/api/nuclear-sites${demo}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const geojson = await res.json();

    const features = geojson.features || [];
    features.forEach((feature) => {
      const [lon, lat] = feature.geometry.coordinates;
      const props = feature.properties || {};
      const name = props.name || "Site nucléaire";

      const descriptionParts = [];
      if (props.country) descriptionParts.push(`<strong>Pays :</strong> ${escapeHtml(props.country)}`);
      if (props.status) descriptionParts.push(`<strong>Statut :</strong> ${escapeHtml(props.status)}`);

      nuclearLayer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        point: {
          pixelSize: 10,
          color: NUCLEAR_COLOR,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        name: `☢️ ${name}`,
        description: descriptionParts.join("<br/>"),
      });
    });
  } catch (err) {
    console.error("Erreur chargement sites nucléaires:", err);
  }
}

function loadAll() {
  loadEvents();
  loadNuclearSites();
}

refreshBtn.addEventListener("click", loadAll);
daysEl.addEventListener("change", loadEvents);
countryEl.addEventListener("change", loadEvents);
eventTypeEl.addEventListener("change", loadEvents);
demoToggleEl.addEventListener("change", loadAll);
nuclearToggleEl.addEventListener("change", loadNuclearSites);

loadFilters().then(loadAll);

// Horloge mondiale (HUD) : UTC + quelques fuseaux stratégiques, mise à
// jour chaque seconde via l'API Intl native du navigateur (aucune
// dépendance ni service externe).
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
