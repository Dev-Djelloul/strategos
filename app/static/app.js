const map = L.map("map", { worldCopyJump: true }).setView([20, 20], 2);

L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  maxZoom: 18,
}).addTo(map);

let markersLayer = L.layerGroup().addTo(map);

const statusEl = document.getElementById("status");
const timespanEl = document.getElementById("timespan");
const refreshBtn = document.getElementById("refresh");

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

async function loadEvents() {
  statusEl.textContent = "Chargement…";
  markersLayer.clearLayers();

  const timespan = timespanEl.value;
  try {
    const demo = document.getElementById("demo-toggle")?.checked ? "&demo=true" : "";
    const res = await fetch(`/api/events?timespan=${encodeURIComponent(timespan)}${demo}`);
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

loadEvents();
