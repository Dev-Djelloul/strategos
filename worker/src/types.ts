export interface Env {
  CACHE: KVNamespace;
  ASSETS?: Fetcher;
  ACLED_EMAIL?: string;
  ACLED_PASSWORD?: string;
  UCDP_ACCESS_TOKEN?: string;
  UCDP_GED_VERSION?: string;
  CESIUM_ION_TOKEN?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Props = Record<string, any>;

export interface Feature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Props;
}

export interface FeatureCollection {
  type: "FeatureCollection";
  features: Feature[];
  [key: string]: unknown;
}

/** Contexte d'exécution minimal (waitUntil) partagé par requêtes et cron. */
export interface Ctx {
  waitUntil(p: Promise<unknown>): void;
}

export const USER_AGENT = "Strategos/0.2 (projet pedagogique; contact: digitalblueskye@gmail.com)";
