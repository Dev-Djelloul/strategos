import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { aggregateExport, recentStamps } from "../src/sources/gdelt.ts";
import type { Group } from "../src/sources/gdelt.ts";
import { unzipFirstFile } from "../src/zip.ts";

// Ligne GDELT 2.0 minimale (61 colonnes) : on ne remplit que celles utilisées.
function row(o: { root: string; code?: string; mentions: number; sources: number; geoType: string; name: string; fips: string; lat: number; lon: number; date?: string; url?: string }): string {
  const c = new Array(61).fill("");
  c[1] = o.date ?? "20260924";
  c[26] = o.code ?? o.root + "0";
  c[28] = o.root;
  c[31] = String(o.mentions);
  c[32] = String(o.sources);
  c[51] = o.geoType;
  c[52] = o.name;
  c[53] = o.fips;
  c[56] = String(o.lat);
  c[57] = String(o.lon);
  c[60] = o.url ?? "https://example.org/a";
  return c.join("\t");
}

test("aggregateExport filtre et agrège", () => {
  const text = [
    row({ root: "19", mentions: 5, sources: 3, geoType: "4", name: "Kharkiv", fips: "UP", lat: 49.99, lon: 36.23 }),
    row({ root: "19", mentions: 7, sources: 2, geoType: "4", name: "Kharkiv", fips: "UP", lat: 49.99, lon: 36.23, date: "20260925", url: "https://example.org/b" }),
    row({ root: "19", code: "195", mentions: 4, sources: 2, geoType: "4", name: "Kharkiv", fips: "UP", lat: 49.99, lon: 36.23 }),
    row({ root: "19", mentions: 9, sources: 1, geoType: "4", name: "Peu fiable", fips: "UP", lat: 1, lon: 1 }), // < 2 sources
    row({ root: "19", mentions: 9, sources: 5, geoType: "1", name: "Pays entier", fips: "UP", lat: 2, lon: 2 }), // centroïde
    row({ root: "03", mentions: 9, sources: 5, geoType: "4", name: "Pas violent", fips: "UP", lat: 3, lon: 3 }),
  ].join("\n");
  const groups: Record<string, Group> = {};
  aggregateExport(text, groups);
  assert.equal(Object.keys(groups).length, 2);
  const g = groups["49.99,36.23,offensive"];
  assert.equal(g.count, 12);
  assert.equal(g.date, "20260925");
  assert.equal(g.url, "https://example.org/b");
  assert.equal(g.country, "UA");
  assert.equal(groups["49.99,36.23,airstrike"].count, 4);
});

test("unzipFirstFile lit une archive ZIP (deflate)", async () => {
  const content = "bonjour\tGDELT\n".repeat(50);
  const data = deflateRawSync(Buffer.from(content));
  const name = Buffer.from("a.csv");
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(name.length, 26);
  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(8, 10);
  cd.writeUInt32LE(data.length, 20);
  cd.writeUInt32LE(content.length, 24);
  cd.writeUInt16LE(name.length, 28);
  cd.writeUInt32LE(0, 42);
  const cdOffset = local.length + name.length + data.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cd.length + name.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  const zip = Buffer.concat([local, name, data, cd, name, eocd]);
  assert.equal(await unzipFirstFile(new Uint8Array(zip)), content);
});

test("recentStamps : pas de 15 min, du plus récent au plus ancien, dernier fichier ignoré", () => {
  const s = recentStamps(new Date("2026-09-24T05:40:30Z"), 1);
  assert.deepEqual(s, ["20260924051500", "20260924050000", "20260924044500", "20260924043000"]);
});
