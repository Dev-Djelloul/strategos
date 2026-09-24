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
  infoBox: false, // remplacé par le panneau latéral (#side-panel)
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
// Les trois sources de conflits (ACLED qualifiée, UCDP académique, GDELT
// presse non vérifiée) sont fusionnées côté serveur : un événement rapporté
// par plusieurs sources devient un seul marqueur avec un niveau de fiabilité.
const EVENT_SOURCES = [
  { key: "acled", toggleId: "acled-toggle", badgeId: "acled-badge" },
  { key: "ucdp", toggleId: "ucdp-toggle", badgeId: "ucdp-badge" },
  { key: "gdelt", toggleId: "gdelt-toggle", badgeId: "gdelt-badge" },
];
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
function setLayerBadge(badgeId, { count, source, error, fetchedAt, stale, staleReason, loading } = {}) {
  const el = document.getElementById(badgeId);
  if (!el) return;
  el.classList.remove("badge-live", "badge-demo");
  if (loading) {
    el.textContent = "chargement…";
    el.title = "Première récupération d'une source lente, en cours côté serveur";
  } else if (error) {
    el.textContent = "indisponible";
    el.title = error;
    el.classList.add("badge-demo");
  } else if (source) {
    const when = fetchedAt ? new Date(fetchedAt) : new Date();
    if (stale) {
      // Source injoignable : dernière donnée RÉELLE en cache, horodatée.
      el.textContent = `${count} · du ${when.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} ${when.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
      el.title = `Source injoignable (${staleReason || "erreur"}) — dernière donnée réelle en cache, récupérée le ${when.toLocaleString("fr-FR")}`;
      el.classList.add("badge-demo");
    } else {
      el.textContent = `${count}`;
      el.title = `Source : ${source} — données du ${when.toLocaleString("fr-FR")}`;
      el.classList.add("badge-live");
    }
  } else {
    el.textContent = "";
    el.title = "";
  }
  el.style.display = el.textContent ? "" : "none";
}

// Panneau latéral : détail de l'élément sélectionné sur le globe. Chaque
// entité enregistre ses infos ici (clé = entité), lues à la sélection.
const panelInfo = new WeakMap();
const RELIABILITY = {
  verified: { label: "Source qualifiée", cls: "rel-verified" },
  press: { label: "Presse — non vérifié", cls: "rel-press" },
  community: { label: "Base collaborative", cls: "rel-community" },
};
const sidePanelEl = document.getElementById("side-panel");
const sidePanelBody = document.getElementById("side-panel-body");

function showSidePanel(info) {
  const rel = info.badge || RELIABILITY[info.reliability] || RELIABILITY.community;
  const rows = (info.rows || [])
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `<div class="sp-row"><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(String(v))}</dd></div>`)
    .join("");
  const link = /^https?:\/\//.test(info.url || "")
    ? `<a class="sp-link" href="${escapeHtml(info.url)}" target="_blank" rel="noopener noreferrer">Ouvrir la source ↗</a>`
    : "";
  const sources = (info.sources || []).map((x) => {
    const r = RELIABILITY[x.reliability] || RELIABILITY.community;
    const href = /^https?:\/\//.test(x.url || "") ? ` <a href="${escapeHtml(x.url)}" target="_blank" rel="noopener noreferrer">article ↗</a>` : "";
    const detail = [x.date, x.count ? `${x.count} mentions` : null].filter(Boolean).join(" · ");
    return `<li><span class="sp-rel ${r.cls}">${escapeHtml(x.label)}</span> <span class="sp-src-detail">${escapeHtml(detail)}</span>${href}${x.notes && x.reliability === "verified" ? `<div class="sp-src-notes">${escapeHtml(x.notes)}</div>` : ""}</li>`;
  }).join("");
  sidePanelBody.innerHTML = `
    <div class="sp-kind">${escapeHtml(info.kind || "")}</div>
    <h2 class="sp-title">${escapeHtml(info.title || "Sans nom")}</h2>
    <div class="sp-source"><span class="sp-rel ${rel.cls}">${rel.label}</span> <span>${escapeHtml(info.sourceLabel || "")}</span></div>
    <dl class="sp-rows">${rows}</dl>
    ${sources ? `<h3 class="sp-h3">Sources (${info.sources.length})</h3><ul class="sp-sources">${sources}</ul>` : ""}
    ${info.notes ? `<p class="sp-notes">${escapeHtml(info.notes)}</p>` : ""}
    ${link}
    <button class="btn-primary sp-zoom" id="sp-zoom">Zoomer sur le lieu</button>`;
  document.getElementById("sp-zoom").addEventListener("click", () => {
    viewer.camera.flyToBoundingSphere(
      new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(info.lon, info.lat, 0), 3000),
      { duration: 2, offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-40), 25000) }
    );
  });
  sidePanelEl.classList.add("open");
}

function hideSidePanel() {
  sidePanelEl.classList.remove("open");
}

document.getElementById("side-panel-close").addEventListener("click", () => {
  viewer.selectedEntity = undefined;
});
viewer.selectedEntityChanged.addEventListener((entity) => {
  const info = entity && panelInfo.get(entity);
  if (info) showSidePanel(info);
  else hideSidePanel();
});

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
  conflictsLayer.entities.values.forEach((entity) => {
    const date = entity.properties?.event_date?.getValue();
    const conf = entity.properties?.confidence?.getValue();
    entity.show = (!date || date <= cutoff) && (showPressOnly || conf !== "press");
  });
}

function setupTimeline(days) {
  stopTimelinePlayback();
  const hasDated = conflictsLayer.entities.values.some((e) => e.properties?.event_date?.getValue());
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

const CONFIDENCE_STYLE = {
  confirmed: { pixelSize: 13, alpha: 1, outline: Cesium.Color.fromCssColorString("#4caf7d"), outlineWidth: 3 },
  verified: { pixelSize: 10, alpha: 1, outline: Cesium.Color.WHITE, outlineWidth: 1 },
  press: { pixelSize: 7, alpha: 0.55, outline: Cesium.Color.WHITE, outlineWidth: 0 },
};
const CONFIDENCE_LABELS = {
  confirmed: { label: "Confirmé — plusieurs sources dont une qualifiée", cls: "rel-verified" },
  verified: { label: "Source qualifiée", cls: "rel-verified" },
  press: { label: "Presse — non vérifié", cls: "rel-press" },
};
let showPressOnly = true;

async function loadEvents() {
  statusEl.textContent = "Chargement…";
  conflictsLayer.entities.removeAll();
  const days = daysEl.value;
  const selected = EVENT_SOURCES.filter((s) => document.getElementById(s.toggleId).checked);
  EVENT_SOURCES.forEach((s) => setLayerBadge(s.badgeId));
  if (!selected.length) {
    setupTimeline(days);
    statusEl.textContent = "Aucune source de conflits sélectionnée";
    return;
  }

  const params = new URLSearchParams({ days, event_type: eventTypeEl.value, sources: selected.map((s) => s.key).join(",") });
  if (countryEl.value) params.set("country", countryEl.value);

  try {
    const geojson = await apiJson(`/api/conflicts?${params.toString()}`);
    const features = geojson.features || [];

    features.forEach((feature) => {
      const [lon, lat] = feature.geometry.coordinates;
      const props = feature.properties || {};
      const style = CONFIDENCE_STYLE[props.confidence] || CONFIDENCE_STYLE.verified;
      const color = (EVENT_COLORS[props.event_type] || Cesium.Color.fromCssColorString("#e05a56")).withAlpha(style.alpha);

      const entity = conflictsLayer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        point: {
          pixelSize: style.pixelSize,
          color,
          outlineColor: style.outline,
          outlineWidth: style.outlineWidth,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        name: props.name || "Événement",
        properties: { event_date: props.event_date || null, confidence: props.confidence },
      });
      const conf = CONFIDENCE_LABELS[props.confidence] || CONFIDENCE_LABELS.press;
      panelInfo.set(entity, {
        kind: EVENT_TYPE_LABELS[props.event_type] || props.event_type || "Événement",
        title: props.name || "Événement",
        badge: conf,
        sourceLabel: (props.sources || []).map((x) => x.label).filter((v, i, a) => a.indexOf(v) === i).join(" + "),
        rows: [
          ["Date", props.event_date],
          ["Victimes", props.fatalities],
        ],
        sources: props.sources,
        lon,
        lat,
      });
    });

    EVENT_SOURCES.forEach((s) => {
      const st = geojson.sources?.[s.key];
      if (!st) return;
      if (st.ok) setLayerBadge(s.badgeId, { count: st.count, source: s.key });
      else setLayerBadge(s.badgeId, { error: st.error });
    });
    setupTimeline(days);

    const confirmed = features.filter((f) => f.properties.confidence === "confirmed").length;
    statusEl.textContent = `${features.length} événement(s) dont ${confirmed} confirmé(s) — mis à jour ${new Date().toLocaleTimeString("fr-FR")}`;
  } catch (err) {
    setupTimeline(days);
    statusEl.textContent = `⚠️ Conflits indisponibles — ${err.message}`;
  }
}

// Couche générique pour les points simples (nucléaire, militaire,
// infrastructures) : même structure GeoJSON, seul le style et
// l'endpoint changent.
async function loadSimpleLayer({ dataSource, toggleEl, endpoint, color, icon, emptyLabel, badgeId, kindLabel, sourceLabel, retry = 0 }) {
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

      const entity = dataSource.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        point: {
          pixelSize: 10,
          color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        name: `${icon} ${name}`,
      });
      panelInfo.set(entity, {
        kind: `${icon} ${kindLabel}`,
        title: name,
        sourceLabel,
        reliability: "community",
        rows: [
          ["Pays", props.country],
          ["Statut", props.status],
          ["Type", props.type],
          ["Opérateur", props.operator],
        ],
        lon,
        lat,
      });
    });

    setLayerBadge(badgeId, { count: (geojson.features || []).length, source: geojson.source, fetchedAt: geojson.fetched_at, stale: geojson.stale, staleReason: geojson.stale_reason });
  } catch (err) {
    if (err.message.includes("en cours") && retry < 12) {
      // Source lente en premier chargement : le serveur la prépare en
      // arrière-plan, on réessaie sans bloquer l'interface.
      setLayerBadge(badgeId, { loading: true });
      setTimeout(() => loadSimpleLayer({ dataSource, toggleEl, endpoint, color, icon, emptyLabel, badgeId, kindLabel, sourceLabel, retry: retry + 1 }), 15000);
      return;
    }
    console.error(`Erreur chargement couche ${endpoint}:`, err);
    setLayerBadge(badgeId, { error: err.message });
  }
}

const loadNuclearSites = () => loadSimpleLayer({
  dataSource: nuclearLayer, toggleEl: nuclearToggleEl, endpoint: "/api/nuclear-sites",
  color: NUCLEAR_COLOR, icon: "☢️", emptyLabel: "Site nucléaire", badgeId: "nuclear-badge", kindLabel: "Installation nucléaire civile", sourceLabel: "Wikidata",
});
const loadMilitarySites = () => loadSimpleLayer({
  dataSource: militaryLayer, toggleEl: militaryToggleEl, endpoint: "/api/military-sites",
  color: MILITARY_COLOR, icon: "🎖️", emptyLabel: "Site militaire", badgeId: "military-badge", kindLabel: "Site militaire", sourceLabel: "OpenStreetMap",
});
const loadInfrastructureSites = () => loadSimpleLayer({
  dataSource: infrastructureLayer, toggleEl: infrastructureToggleEl, endpoint: "/api/infrastructure-sites",
  color: INFRASTRUCTURE_COLOR, icon: "🛫", emptyLabel: "Infrastructure", badgeId: "infrastructure-badge", kindLabel: "Infrastructure", sourceLabel: "OpenStreetMap",
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
document.getElementById("press-toggle").addEventListener("change", (e) => {
  showPressOnly = e.target.checked;
  applyTimeline();
});
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
