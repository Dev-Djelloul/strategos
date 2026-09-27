/** Métadonnées descriptives des sources (page Méthodologie). Une seule
 * source de vérité : la page est générée depuis ces listes, et l'état de
 * configuration est lu à l'exécution (jamais supposé). */
import type { Env } from "./types.ts";

export interface ConflictSourceInfo {
  key: string;
  name: string;
  full: string;
  url: string;
  reliability: "verified" | "press";
  kind: string;
  freshness: string;
  coverage: string;
  license: string;
  access: string;
  secrets: (keyof Env)[];
}

export const CONFLICT_SOURCES: ConflictSourceInfo[] = [
  {
    key: "acled",
    name: "ACLED",
    full: "Armed Conflict Location & Event Data",
    url: "https://acleddata.com/",
    reliability: "verified",
    kind: "Événements codés à la main par des analystes, à partir de sources multiples",
    freshness: "Hebdomadaire (niveau Research : événements décalés d'environ une semaine)",
    coverage: "Mondiale",
    license: "Conditions d'utilisation ACLED — attribution obligatoire, pas de redistribution",
    access: "Compte myACLED avec une adresse académique ou institutionnelle ; les adresses personnelles n'ont plus accès à l'API (niveau Open : données agrégées seulement)",
    secrets: ["ACLED_EMAIL", "ACLED_PASSWORD"],
  },
  {
    key: "ucdp",
    name: "UCDP GED",
    full: "Uppsala Conflict Data Program — Georeferenced Event Dataset",
    url: "https://ucdp.uu.se/",
    reliability: "verified",
    kind: "Jeu de données académique évalué par des pairs, événements de violence organisée",
    freshness: "Versions « candidate » mensuelles, environ 2 semaines de décalage (la version annuelle a ~9 mois de retard)",
    coverage: "Mondiale",
    license: "CC BY 4.0 — citer Sundberg & Melander (2013), Journal of Peace Research 50(4)",
    access: "Jeton d'accès gratuit, sur demande auprès de l'équipe UCDP",
    secrets: ["UCDP_ACCESS_TOKEN"],
  },
  {
    key: "gdelt",
    name: "GDELT",
    full: "Global Database of Events, Language, and Tone",
    url: "https://www.gdeltproject.org/",
    reliability: "press",
    kind: "Extraction automatique d'événements dans la presse mondiale — non vérifiée",
    freshness: "Toutes les 15 minutes (historique depuis le début de la collecte)",
    coverage: "Mondiale, très inégale selon la couverture médiatique",
    license: "Libre d'usage, citation du projet GDELT demandée",
    access: "Aucun compte requis",
    secrets: [],
  },
];

export const LAYER_SOURCES = [
  {
    name: "Sites nucléaires civils",
    provider: "Wikidata",
    url: "https://www.wikidata.org/",
    freshness: "Cache 24 h",
    license: "CC0",
    note: "Centrales et sites civils déclarés uniquement. Base collaborative, non exhaustive.",
  },
  {
    name: "Bases militaires",
    provider: "OpenStreetMap (Overpass)",
    url: "https://www.openstreetmap.org/",
    freshness: "Cache 6 h",
    license: "ODbL — © contributeurs OpenStreetMap",
    note: "Sites nommés et publics uniquement. Base collaborative, non exhaustive.",
  },
  {
    name: "Infrastructures",
    provider: "OpenStreetMap (Overpass)",
    url: "https://www.openstreetmap.org/",
    freshness: "Cache 6 h",
    license: "ODbL — © contributeurs OpenStreetMap",
    note: "Aéroports internationaux, ports, centrales électriques non nucléaires.",
  },
];

export const CONTROL_SOURCE = {
  name: "Contrôle territorial (Ukraine)",
  provider: "VIINA 2.0 — Université Notre-Dame",
  url: "https://github.com/zhukovyuri/VIINA",
  freshness: "Instantané quotidien (fichier statique)",
  license: "ODbL 1.0 — attribution obligatoire",
  note:
    "Statut par localité (russe / contesté), avec les changements de main des 90 derniers jours, issu d'un vote entre DeepStateMap, ISW, Wikipédia et des rapports de presse. C'est une estimation, pas une ligne de front officielle. Ukraine uniquement : aucune source ouverte équivalente n'a été trouvée pour les autres conflits.",
};

export const BASEMAP_CREDITS: [string, string][] = [
  ["Imagerie satellite et calques de référence", "Esri, Maxar, Earthstar Geographics"],
  ["Relief mondial", "Cesium World Terrain (Cesium ion)"],
  ["Villes 3D photoréalistes", "Google Photorealistic 3D Tiles, via Cesium ion — soumis aux conditions de Google"],
  ["Moteur 3D", "CesiumJS"],
];

export const isConfigured = (env: Env, s: ConflictSourceInfo): boolean => s.secrets.every((k) => Boolean(env[k]));
