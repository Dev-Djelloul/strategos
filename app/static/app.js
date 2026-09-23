const map = L.map("map", { worldCopyJump: true }).setView([20, 20], 2);

L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  maxZoom: 18,
}).addTo(map);

let markersLayer = L.layerGroup().addTo(map);

const statusEl = document.getElementById("status");
const timespanEl = document.getElementById("timespan");
const countryEl = document.getElementById("country");
const eventTypeEl = document.getElementById("event-type");
const refreshBtn = document.getElementById("refresh");

const EVENT_TYPE_LABELS = {
  all: "Tous",
  airstrike: "Frappes aériennes",
  ceasefire: "Cessez-le-feu / trêve",
  offensive: "Offensive / incursion",
  protest: "Manifestations / troubles",
  casualties: "Victimes",
};

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
  markersLayer.clearLayers();

  const timespan = timespanEl.value;
  const country = countryEl.value;
  const eventType = eventTypeEl.value;
  const demo = document.getElementById("demo-toggle")?.checked ? "&demo=true" : "";

  const params = new URLSearchParams({ timespan, event_type: eventType });
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
      const count = props.count;
      const marker = L.circleMarker([lat, lon], {
        radius: 5,
        color: "#c9302c",
        fillColor: "#e05a56",
        fillOpacity: 0.8,
        weight: 1,
      });
      marker.bindPopup(
        `<strong>${escapeHtml(name)}</strong>` +
          (count ? `<br/>Mentions: ${escapeHtml(String(count))}` : "")
      );
      marker.addTo(markersLayer);
    });

    statusEl.textContent = `${features.length} événement(s) — mis à jour ${new Date().toLocaleTimeString("fr-FR")}`;
  } catch (err) {
    statusEl.textContent = `Erreur de chargement (${err.message})`;
  }
}

refreshBtn.addEventListener("click", loadEvents);
timespanEl.addEventListener("change", loadEvents);
countryEl.addEventListener("change", loadEvents);
eventTypeEl.addEventListener("change", loadEvents);

loadFilters().then(loadEvents);
