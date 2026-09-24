import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeFeatures } from "../src/conflicts.ts";
import type { Feature } from "../src/types.ts";

const f = (lon: number, lat: number, date: string, extra: Record<string, unknown> = {}): Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lon, lat] },
  properties: { name: "x", event_date: date, ...extra },
});

test("ACLED + GDELT proches -> un marqueur confirmé, date la plus récente", () => {
  const out = mergeFeatures({
    acled: [f(37.5, 47.1, "2026-09-20", { fatalities: 3, event_type: "airstrike" })],
    gdelt: [f(37.55, 47.12, "2026-09-22", { count: 40 }), f(10, 10, "2026-09-22", { count: 5 }), f(37.5, 47.1, "2026-09-01", { count: 9 })],
  });
  assert.equal(out.length, 3);
  assert.equal(out[0].properties.confidence, "confirmed");
  assert.equal(out[0].properties.event_date, "2026-09-22");
  assert.equal(out[0].properties.fatalities, 3);
  assert.equal(out[0].properties.event_type, "airstrike");
  assert.deepEqual(out[0].properties.sources.map((s: { key: string }) => s.key), ["acled", "gdelt"]);
  assert.equal(out[1].properties.confidence, "press");
  assert.equal(out[2].properties.event_date, "2026-09-01"); // trop ancien pour fusionner
});

test("UCDP seul -> qualifié ; ACLED + UCDP -> confirmé", () => {
  assert.equal(mergeFeatures({ ucdp: [f(1, 1, "2026-09-01")] })[0].properties.confidence, "verified");
  assert.equal(mergeFeatures({ acled: [f(1, 1, "2026-09-01")], ucdp: [f(1.01, 1, "2026-09-02")] })[0].properties.confidence, "confirmed");
});

test("aucune donnée -> aucun marqueur", () => {
  assert.deepEqual(mergeFeatures({}), []);
});
