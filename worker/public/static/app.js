// Strategos — globe des conflits (CesiumJS + H3).
//
// Rendu des événements : à l'échelle du monde/d'une région, des colonnes
// hexagonales 3D (grille H3) dont la hauteur et la couleur suivent
// l'intensité (événements pondérés par les victimes) ; en zoomant, des
// marqueurs lumineux individuels. Le contrôle territorial (Ukraine) est
// dessiné en hexagones posés au sol ; les autres couches en icônes regroupées.
(async () => {

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

viewer.imageryLayers.addImageryProvider(
  new Cesium.UrlTemplateImageryProvider({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    credit: "Esri",
    maximumLevel: 19,
  })
);
viewer.imageryLayers.addImageryProvider(
  new Cesium.UrlTemplateImageryProvider({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
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
  if (loading) return setStatus(prefix, { text: "première récupération en cours…", kind: "loading" });
  if (error) {
    if (el) el.title = error;
    return setStatus(prefix, { text: "indisponible", kind: "warn" });
  }
  if (count === undefined) return setStatus(prefix, {});
  const when = fetchedAt ? new Date(fetchedAt) : new Date();
  if (stale) {
    if (el) el.title = `Source injoignable (${staleReason || "erreur"}) — dernière donnée réelle en cache`;
    const d = when.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
    const t = when.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return setStatus(prefix, { text: `${count} · donnée du ${d} ${t} (source injoignable)`, kind: "warn" });
  }
  setStatus(prefix, { text: note ? `${count} · ${note}` : `${count}`, kind: "ok" });
}

// ───────────────────────── Panneau de détail ─────────────────────────
const RELIABILITY = {
  verified: { label: "Source qualifiée", cls: "rel-verified" },
  press: { label: "Presse — non vérifié", cls: "rel-press" },
  community: { label: "Base collaborative", cls: "rel-community" },
  modeled: { label: "Estimation agrégée", cls: "rel-community" },
};
const CONFIDENCE_LABELS = {
  confirmed: { label: "Confirmé — plusieurs sources dont une qualifiée", cls: "rel-verified" },
  verified: { label: "Source qualifiée", cls: "rel-verified" },
  press: { label: "Presse — non vérifié", cls: "rel-press" },
};
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
    <h2 class="sp-title">${escapeHtml(info.title || "Sans nom")}</h2>
    <div class="sp-source"><span class="sp-rel ${rel.cls}">${rel.label}</span> <span>${escapeHtml(info.sourceLabel || "")}</span></div>
    <dl class="sp-rows">${rows}</dl>
    ${items ? `<h3 class="sp-h3">${escapeHtml(info.itemsTitle || "Événements")}</h3><ul class="sp-items">${items}</ul>` : ""}
    ${sources ? `<h3 class="sp-h3">Sources (${info.sources.length})</h3><ul class="sp-sources">${sources}</ul>` : ""}
    ${info.notes ? `<p class="sp-notes">${escapeHtml(info.notes)}</p>` : ""}
    ${isUrl(info.url) ? `<a class="sp-link" href="${escapeHtml(info.url)}" target="_blank" rel="noopener noreferrer">Ouvrir la source ↗</a>` : ""}
    <button class="btn btn-primary sp-zoom" id="sp-zoom">Zoomer sur le lieu</button>`;
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
  const info = id instanceof Cesium.Entity ? panelInfo.get(id) : id?.panel;
  if (info) showSidePanel(info);
  else hideSidePanel();
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// ───────────────────────── État ─────────────────────────
const EVENT_SOURCES = ["acled", "ucdp", "gdelt"];
const state = {
  days: 30,
  events: [], // features fusionnées renvoyées par /api/conflicts
  press: true, // afficher les événements « presse seule »
  viewMode: "auto",
  cutoff: null, // date max affichée (timeline), YYYY-MM-DD
};
const panelInfo = new WeakMap();

const EVENT_TYPE_LABELS = {
  airstrike: "Frappes aériennes / tirs à distance",
  offensive: "Batailles / offensives",
  protest: "Manifestations",
  casualties: "Violence contre civils",
  ceasefire: "Développements stratégiques",
};
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
  return {
    kind: "Zone d'activité",
    title: `${c.events.length} événement${c.events.length > 1 ? "s" : ""}`,
    badge: c.verified ? CONFIDENCE_LABELS.verified : CONFIDENCE_LABELS.press,
    sourceLabel: `hexagone d'environ ${Math.round(h3.getHexagonEdgeLengthAvg(res, "km") * 2)} km`,
    rows: [
      ["Victimes (sources qualifiées)", c.fatalities || null],
      ["Événements qualifiés", c.verified],
      ["Détectés par la presse seule", pressCount || null],
    ],
    itemsTitle: top.length < c.events.length ? `Les ${top.length} plus marquants` : "Événements",
    items: top.map((f) => {
      const p = f.properties;
      return {
        title: p.name || "Événement",
        meta: [EVENT_TYPE_LABELS[p.event_type] || p.event_type, frDate(p.event_date), p.fatalities ? `${p.fatalities} victimes` : null].filter(Boolean).join(" · "),
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
      name: p.name || "Événement",
    });
    panelInfo.set(entity, {
      kind: EVENT_TYPE_LABELS[p.event_type] || p.event_type || "Événement",
      title: p.name || "Événement",
      badge: CONFIDENCE_LABELS[p.confidence] || CONFIDENCE_LABELS.press,
      sourceLabel: (p.sources || []).map((x) => x.label).filter((v, i, a) => a.indexOf(v) === i).join(" + "),
      rows: [
        ["Date", p.date_start ? `du ${frDate(p.date_start)} au ${frDate(p.event_date)}` : frDate(p.event_date)],
        ["Victimes", p.fatalities],
        ["Précision du lieu", p.precision],
      ],
      sources: p.sources,
      lon, lat,
    });
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
  $("vs-scope").textContent = b ? "Zone visible" : "Monde entier";

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
  $("vs-events").textContent = events.length.toLocaleString("fr-FR");
  $("vs-fat").textContent = fat.toLocaleString("fr-FR");
  $("vs-verified").textContent = verified.toLocaleString("fr-FR");

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
const timelineEl = $("timeline");
const slider = $("timeline-slider");
let timelineStart = null;
let timelineTimer = null;
let sliderRaf = 0;

function stopPlayback() {
  clearInterval(timelineTimer);
  timelineTimer = null;
  $("timeline-play").textContent = "▶";
}

function applyTimeline() {
  if (!timelineStart) {
    state.cutoff = null;
    return;
  }
  const day = new Date(timelineStart.getTime() + Number(slider.value) * 86400000).toISOString().slice(0, 10);
  state.cutoff = Number(slider.value) >= Number(slider.max) ? null : day;
  $("timeline-label").textContent = `jusqu'au ${frDate(day)}`;
  cancelAnimationFrame(sliderRaf);
  sliderRaf = requestAnimationFrame(() => renderConflicts());
}

function setupTimeline() {
  stopPlayback();
  if (!state.events.some((f) => f.properties.event_date)) {
    timelineStart = null;
    timelineEl.hidden = true;
    state.cutoff = null;
    return;
  }
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  timelineStart = new Date(end.getTime() - state.days * 86400000);
  slider.max = String(state.days);
  slider.value = String(state.days);
  timelineEl.hidden = false;
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
const SOURCE_DOT = { acled: "ACLED", ucdp: "UCDP", gdelt: "GDELT" };

async function loadEvents() {
  $("status").textContent = "Chargement…";
  const selected = EVENT_SOURCES.filter((k) => $(`${k}-toggle`).checked);
  EVENT_SOURCES.forEach((k) => setStatus(k, selected.includes(k) ? { text: "chargement…", kind: "loading" } : {}));
  if (!selected.length) {
    state.events = [];
    state.dataVersion = (state.dataVersion || 0) + 1;
    setupTimeline();
    renderConflicts(true);
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
        return setStatus(k, { text: "indisponible", kind: "warn" });
      }
      const un = st.meta?.unlocated;
      $("ucdp-note").hidden = !(k === "ucdp" && un?.count);
      if (k === "ucdp" && un?.count) {
        $("ucdp-note").textContent = `UCDP : ${un.count} événement${un.count > 1 ? "s" : ""} sans localisation précise (${un.fatalities.toLocaleString("fr-FR")} victimes cumulées) ne sont pas cartographiés.`;
      }
      const upTo = st.meta?.latest_date ? `jusqu'au ${frDate(st.meta.latest_date).slice(0, 5)}` : "";
      $(`${k}-status`).title = "";
      setStatus(k, { text: [`${st.count} événement${st.count > 1 ? "s" : ""}`, upTo].filter(Boolean).join(" · "), kind: "ok" });
    });
    renderSourceAlert(data.sources, selected);
    setupTimeline();
    renderConflicts(true);
    const confirmed = state.events.filter((f) => f.properties.confidence === "confirmed").length;
    $("status").textContent = `${state.events.length} événement(s), dont ${confirmed} confirmé(s) — mis à jour à ${new Date().toLocaleTimeString("fr-FR")}`;
  } catch (err) {
    state.events = [];
    state.dataVersion = (state.dataVersion || 0) + 1;
    setupTimeline();
    renderConflicts(true);
    renderSourceAlert(null, selected, err.message);
    $("status").textContent = `⚠️ Conflits indisponibles — ${err.message}`;
  }
}

/** Alerte claire quand aucune source qualifiée ne répond, ou quand une source
 * qualifiée est vide sur la période à cause de son décalage de publication. */
function renderSourceAlert(sources, selected, fatalError) {
  const el = $("source-alert");
  const qualifiedOk = ["acled", "ucdp"].some((k) => sources?.[k]?.ok);
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

$("daynight-toggle").addEventListener("change", (e) => {
  scene.globe.enableLighting = e.target.checked;
});

// Villes 3D photoréalistes (maillage Google via Cesium Ion), chargées à la demande.
let photo3d = null;
if (!ionToken) {
  $("photo3d-toggle").disabled = true;
  $("photo3d-toggle").parentElement.title = "Nécessite un token Cesium Ion";
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
      scene.globe.show = false;
      // Zoom libre jusqu'au sol et collision désactivée : on peut se glisser
      // entre les bâtiments plutôt que d'être bloqué à distance.
      scene.screenSpaceCameraController.minimumZoomDistance = 1;
      scene.screenSpaceCameraController.enableCollisionDetection = false;
      $("nav-hint").hidden = false;
    } else {
      if (photo3d) photo3d.show = false;
      scene.globe.show = true;
      scene.screenSpaceCameraController.minimumZoomDistance = 1;
      scene.screenSpaceCameraController.enableCollisionDetection = true;
      $("nav-hint").hidden = true;
    }
  } catch (err) {
    e.target.checked = false;
    scene.globe.show = true;
    $("status").textContent = `⚠️ Villes 3D indisponibles — ${err.message || err}`;
  }
});

// Déplacement au sol façon "marche" (WASD/ZQSD + flèches) : utile pour
// parcourir les rues en villes 3D, mais actif partout sur le globe.
const MOVE_KEYS = { z: "fwd", w: "fwd", arrowup: "fwd", s: "back", arrowdown: "back", q: "left", a: "left", arrowleft: "left", d: "right", arrowright: "right" };
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
  // Vitesse proportionnelle à l'altitude : rapide en vol, fine au sol entre les bâtiments.
  const speed = Math.max(1.5, viewer.camera.positionCartographic.height * 0.06);
  if (pressedMoves.has("fwd")) viewer.camera.moveForward(speed);
  if (pressedMoves.has("back")) viewer.camera.moveBackward(speed);
  if (pressedMoves.has("left")) viewer.camera.moveLeft(speed);
  if (pressedMoves.has("right")) viewer.camera.moveRight(speed);
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
  { key: "nuclear", endpoint: "/api/nuclear-sites", glyph: "☢️", color: "#f4d03f", kind: "Installation nucléaire civile", provider: "Wikidata", empty: "Site nucléaire" },
  { key: "military", endpoint: "/api/military-sites", glyph: "🎖️", color: "#5b9bf0", kind: "Site militaire", provider: "OpenStreetMap", empty: "Site militaire" },
  { key: "infrastructure", endpoint: "/api/infrastructure-sites", glyph: "✈️", color: "#7ed6c1", kind: "Infrastructure", provider: "OpenStreetMap", empty: "Infrastructure" },
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
        name: p.name || L.empty,
      });
      panelInfo.set(entity, {
        kind: `${L.glyph} ${L.kind}`,
        title: p.name || L.empty,
        badge: RELIABILITY.community,
        sourceLabel: L.provider,
        rows: [["Pays", p.country], ["Statut", p.status], ["Type", p.type], ["Opérateur", p.operator]],
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
// statut dominant, plus vive là où une localité a changé de main récemment.
let controlPrimitive = null;
let controlData = null;
const CONTROL_RES = 5;

function buildControl(data) {
  const cells = new Map();
  for (const [lon, lat, st, changed, name, admin1] of data.places) {
    const cell = h3.latLngToCell(lat, lon, CONTROL_RES);
    let c = cells.get(cell);
    if (!c) cells.set(cell, (c = { cell, R: 0, C: 0, U: 0, recent: [], admin1 }));
    c[st]++;
    if (changed > 0) c.recent.push({ name, changed, st });
  }
  const instances = [];
  for (const c of cells.values()) {
    const positions = cellPolygon(c.cell);
    if (!positions) continue;
    const hasRecent = c.recent.length > 0;
    let color;
    if (c.R >= c.C && c.R > 0) color = Cesium.Color.fromCssColorString("#e0413a").withAlpha(hasRecent ? 0.62 : 0.4);
    else if (c.C > 0) color = Cesium.Color.fromCssColorString("#f0a020").withAlpha(0.55);
    else color = Cesium.Color.fromCssColorString("#4c9be8").withAlpha(0.5); // libéré récemment
    const [lat, lon] = h3.cellToLatLng(c.cell);
    instances.push(new Cesium.GeometryInstance({
      geometry: new Cesium.PolygonGeometry({ polygonHierarchy: new Cesium.PolygonHierarchy(positions), vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT }),
      attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(color) },
      id: {
        panel: {
          kind: "Contrôle territorial (Ukraine)",
          title: c.R >= c.C && c.R > 0 ? "Zone sous contrôle russe" : c.C > 0 ? "Zone contestée" : "Zone récemment libérée",
          badge: RELIABILITY.modeled,
          sourceLabel: "VIINA 2.0",
          rows: [["Région", c.admin1], ["Localités sous contrôle russe", c.R || null], ["Localités contestées", c.C || null], ["Données au", frDate(data.as_of)]],
          itemsTitle: "Changements de main récents",
          items: c.recent.sort((a, b) => b.changed - a.changed).slice(0, 8).map((r) => ({
            title: r.name,
            meta: `${r.st === "R" ? "passée sous contrôle russe" : r.st === "C" ? "devenue contestée" : "libérée"} · ${String(r.changed).replace(/(\d{4})(\d{2})(\d{2})/, "$3/$2/$1")}`,
          })),
          notes: "Estimation par vote entre plusieurs sources (DeepStateMap, ISW, Wikipédia, presse), agrégée en hexagones de ~17 km. Ce n'est pas une ligne de front officielle.",
          url: data.url,
          lon, lat, zoomRange: 60000,
        },
      },
    }));
  }
  return new Cesium.GroundPrimitive({
    geometryInstances: instances,
    appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
    classificationType: Cesium.ClassificationType.TERRAIN,
    asynchronous: false,
  });
}

async function loadControl() {
  if (controlPrimitive) {
    scene.groundPrimitives.remove(controlPrimitive);
    controlPrimitive = null;
  }
  if (!$("control-toggle").checked) return layerStatus("control");
  try {
    if (!controlData) {
      const res = await fetch("/data/ukraine-control.json");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      controlData = await res.json();
    }
    controlPrimitive = scene.groundPrimitives.add(buildControl(controlData));
    layerStatus("control", { count: controlData.places.length, note: `au ${frDate(controlData.as_of).slice(0, 5)}` });
  } catch (err) {
    layerStatus("control", { error: err.message });
  }
}
$("control-toggle").addEventListener("change", loadControl);

// ───────────────────────── Démarrage ─────────────────────────
function loadAll() {
  loadEvents();
  loadControl();
  CONTEXT_LAYERS.forEach((L) => loadContextLayer(L));
}

// Horloge UTC
function tickClock() {
  $("clock-utc").textContent = new Date().toISOString().substring(11, 19);
}
tickClock();
setInterval(tickClock, 1000);

loadFilters().then(loadAll);

})();
