// The simulated companies. Mirrors /scenarios and each company's graph in
// backend/simulator/{shopx,ridenow}.py, so the header, graph and what-if
// controls work without a request (and offline, from the mocks).
import type { NodeKind, ScenarioId } from "./types";

export interface Company {
  id: string;
  name: string;
  tagline: string;
  baseline: ScenarioId;
  /** scenario id -> name + what the simulator injects (decoys included) */
  scenarios: Record<ScenarioId, { name: string; detail: string }>;
  /** fixed graph layout (the backend never sends positions) */
  layout: Record<string, { x: number; y: number; kind: NodeKind }>;
  edges: [string, string][];
  /** services user traffic enters through (rate-limit targets) */
  entry: string[];
  /** service-to-service edges a what-if can restore to baseline */
  fixEdges: [string, string][];
}

export const COMPANIES: Company[] = [
  {
    id: "shopx",
    name: "ShopX",
    tagline: "E-commerce",
    baseline: "baseline",
    scenarios: {
      baseline: {
        name: "Healthy baseline",
        detail: "Normal diurnal traffic. Decoys: slow auth growth and a resolved analytics batch spike on day 15.",
      },
      search_query_explosion: {
        name: "Search Query Explosion",
        detail: "search-service v2.0 raises database queries per request 1.2 → 4.8, with +20% organic traffic.",
      },
      traffic_spike: {
        name: "Traffic Spike",
        detail: "image-service traffic +340%. Decoy: an unrelated search-service deploy 2h earlier.",
      },
      database_overload: {
        name: "Database Overload",
        detail: "order-service v3.0 N+1 bug: queries per request 3 → 10.5. Decoy: search traffic +10%.",
      },
      shopx_live: {
        name: "Live storefront",
        detail: "Real requests from the running ShopX store, replayed at production traffic.",
      },
    },
    // ingress on top, services, then the resources they call
    layout: {
      "api-gateway": { x: 285, y: 0, kind: "ingress" },
      "auth-service": { x: 0, y: 125, kind: "service" },
      "search-service": { x: 190, y: 125, kind: "service" },
      "order-service": { x: 380, y: 125, kind: "service" },
      "image-service": { x: 570, y: 125, kind: "service" },
      redis: { x: 95, y: 255, kind: "resource" },
      database: { x: 285, y: 255, kind: "resource" },
      "payment-service": { x: 475, y: 255, kind: "service" },
      cdn: { x: 640, y: 255, kind: "resource" },
      analytics: { x: 285, y: 380, kind: "resource" },
    },
    edges: [
      ["api-gateway", "auth-service"], ["api-gateway", "search-service"], ["api-gateway", "order-service"],
      ["api-gateway", "image-service"], ["search-service", "redis"], ["search-service", "database"],
      ["auth-service", "database"], ["order-service", "database"], ["order-service", "payment-service"],
      ["image-service", "cdn"], ["database", "analytics"],
    ],
    entry: ["search-service", "order-service", "image-service", "auth-service"],
    fixEdges: [
      ["search-service", "database"], ["search-service", "redis"], ["order-service", "database"],
      ["order-service", "payment-service"], ["auth-service", "database"], ["image-service", "cdn"],
    ],
  },
  {
    id: "ridenow",
    name: "RideNow",
    tagline: "Ride-hailing",
    baseline: "ridenow_baseline",
    scenarios: {
      ridenow_baseline: {
        name: "Healthy baseline",
        detail: "Normal diurnal traffic. Decoys: slow rider growth and a resolved analytics batch spike on day 17.",
      },
      ridenow_surge_pricing_storm: {
        name: "Surge Pricing Storm",
        detail: "pricing-service v4.0 calls the maps API per nearby driver: maps calls per quote 1 → 6, DB reads 0.8 → 2.0. Decoy: rider promo, +15% traffic.",
      },
      ridenow_gps_ping_flood: {
        name: "GPS Ping Flood",
        detail: "location-service v5.2 drops ping batching: driver GPS requests x3. Decoy: an unrelated matching-service deploy 2h earlier.",
      },
      ridenow_matching_retry_storm: {
        name: "Matching Retry Storm",
        detail: "matching-service v3.0 retries ETA lookups: maps calls x4, Redis x2. Decoys: its caller trip-service also deploys just before the spike, and Friday rush adds +12% trips.",
      },
    },
    layout: {
      "api-gateway": { x: 380, y: 0, kind: "ingress" },
      "rider-service": { x: 95, y: 125, kind: "service" },
      "trip-service": { x: 380, y: 125, kind: "service" },
      "location-service": { x: 665, y: 125, kind: "service" },
      "pricing-service": { x: 0, y: 255, kind: "service" },
      "matching-service": { x: 285, y: 255, kind: "service" },
      "payment-service": { x: 475, y: 255, kind: "service" },
      database: { x: 95, y: 385, kind: "resource" },
      "maps-api": { x: 285, y: 385, kind: "resource" },
      redis: { x: 570, y: 385, kind: "resource" },
      "event-queue": { x: 760, y: 385, kind: "resource" },
      analytics: { x: 760, y: 510, kind: "resource" },
    },
    edges: [
      ["api-gateway", "rider-service"], ["api-gateway", "location-service"], ["api-gateway", "trip-service"],
      ["rider-service", "pricing-service"], ["rider-service", "database"],
      ["location-service", "redis"], ["location-service", "event-queue"],
      ["trip-service", "matching-service"], ["trip-service", "database"], ["trip-service", "payment-service"],
      ["matching-service", "redis"], ["matching-service", "maps-api"],
      ["pricing-service", "maps-api"], ["pricing-service", "database"], ["event-queue", "analytics"],
    ],
    entry: ["rider-service", "location-service", "trip-service"],
    fixEdges: [
      ["pricing-service", "maps-api"], ["pricing-service", "database"], ["matching-service", "maps-api"],
      ["matching-service", "redis"], ["trip-service", "database"], ["trip-service", "matching-service"],
      ["rider-service", "database"], ["rider-service", "pricing-service"], ["location-service", "redis"],
      ["location-service", "event-queue"],
    ],
  },
];

export const isScenario = (s: string | null): s is ScenarioId =>
  !!s && COMPANIES.some((c) => Object.hasOwn(c.scenarios, s));

export const companyOf = (s: ScenarioId): Company =>
  COMPANIES.find((c) => Object.hasOwn(c.scenarios, s)) ?? COMPANIES[0];

export const scenarioName = (s: ScenarioId) => companyOf(s).scenarios[s]?.name ?? s;

export const isBaseline = (s: ScenarioId) => companyOf(s).baseline === s;

/** Scenarios driven by live telemetry from the ShopX store; the UI polls them. */
export const isLive = (s: ScenarioId) => s === "shopx_live";
