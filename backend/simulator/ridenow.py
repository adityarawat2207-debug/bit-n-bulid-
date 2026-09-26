"""RideNow: a fictional ride-hailing company. A different graph and cost shape
from ShopX (high-volume driver GPS ingest, a per-call billed maps API, an event
queue), analysed by the same engine with no changes."""
from .company import DB, GATEWAY, ONSET, Company

COMPANY = Company(
    id="ridenow",
    name="RideNow",
    tagline="Ride-hailing",
    # (source, target) -> base calls per inbound request of source
    edges={
        (GATEWAY, "rider-service"): None,     # rider app: browse, fare quotes
        (GATEWAY, "location-service"): None,  # driver app GPS pings
        (GATEWAY, "trip-service"): None,      # ride requests and trip updates
        ("rider-service", "pricing-service"): 0.4,
        ("rider-service", DB): 0.6,
        ("location-service", "redis"): 1.0,         # geo index writes
        ("location-service", "event-queue"): 1.0,   # location stream
        ("trip-service", "matching-service"): 1.0,
        ("trip-service", DB): 2.5,
        ("trip-service", "payment-service"): 0.3,
        ("matching-service", "redis"): 4.0,         # nearby-driver lookups
        ("matching-service", "maps-api"): 1.5,      # pickup ETAs
        ("pricing-service", "maps-api"): 1.0,       # route distance
        ("pricing-service", DB): 0.8,               # surge zone reads
        ("event-queue", "analytics"): 0.05,
    },
    kind={
        GATEWAY: "ingress",
        "rider-service": "service", "location-service": "service", "trip-service": "service",
        "matching-service": "service", "pricing-service": "service", "payment-service": "service",
        "redis": "resource", "event-queue": "resource", "maps-api": "resource",
        DB: "resource", "analytics": "resource",
    },
    topo=[GATEWAY, "rider-service", "location-service", "trip-service", "matching-service",
          "pricing-service", "payment-service", "redis", "event-queue", "maps-api", DB, "analytics"],
    base_demand={"rider-service": 18000, "location-service": 90000, "trip-service": 4000},  # req/min
    query_weight={"rider-service": 0.5, "trip-service": 1.0, "pricing-service": 0.3},
    db_cpu_baseline=0.55,
    latency={"rider-service": 45, "location-service": 12, "trip-service": 110,
             "matching-service": 80, "pricing-service": 70, "payment-service": 180},
    hop_ms={"redis": 0.5, "maps-api": 6.0, "event-queue": 0.3},
    # Baseline monthly budget: $13,980.
    compute={GATEWAY: (250, 350), "rider-service": (200, 250), "location-service": (300, 600),
             "trip-service": (250, 300), "matching-service": (300, 450),
             "pricing-service": (150, 200), "payment-service": (80, 100),
             "analytics": (120, 180)},                     # $4,080
    db_cost=(1300, 1500),                                  # $2,800
    network_total=1600,                                    # $1,600
    usage={"redis": ("cache", 450, 650),                   # $1,100
           "event-queue": ("queue", 300, 500),             # $800
           "maps-api": ("maps", 200, 1600)},               # $1,800 (billed per call)
    storage={DB: 1200, "analytics": 450, "event-queue": 150},  # $1,800
    trend=("rider-service", 0.0005),                       # slow rider growth (decoy)
    batch_decoy=("analytics", "compute", 17, 1, 4, 3),     # day-17 batch spike (decoy)
    # maps-api has the most history on purpose: it is where cost lands, but
    # history alone must not be enough to blame it.
    prior_incidents={"maps-api": 2, DB: 1, "location-service": 1},
    noise_stream=1,
    scenarios={
        "ridenow_baseline": dict(
            name="Healthy baseline",
            description="Normal RideNow traffic with no incident",
            expected=None, deployments=[], effects=[],
        ),
        "ridenow_surge_pricing_storm": dict(
            name="Surge Pricing Storm",
            description="Pricing v4.0 calls the maps API for every nearby driver on each fare quote",
            expected="pricing-service",
            deployments=[("pricing-service", "v4.0", ONSET - 1)],
            # maps calls/quote 1 -> 6, surge-zone DB reads 0.8 -> 2.0.
            # Decoy: a rider promo campaign, +15% rider traffic.
            effects=[("ratio", ("pricing-service", "maps-api"), 6.0),
                     ("ratio", ("pricing-service", DB), 2.5),
                     ("demand", "rider-service", 1.15)],
        ),
        "ridenow_gps_ping_flood": dict(
            name="GPS Ping Flood",
            description="Location v5.2 drops ping batching, so every driver GPS fix is its own request",
            expected="location-service",
            # Decoy: matching deployed 2h before, but nothing about matching changes
            deployments=[("matching-service", "v3.1", ONSET - 2), ("location-service", "v5.2", ONSET - 1)],
            effects=[("demand", "location-service", 3.0)],
        ),
        "ridenow_matching_retry_storm": dict(
            name="Matching Retry Storm",
            description="Matching v3.0 retries pickup-ETA lookups on timeout, multiplying maps API calls",
            expected="matching-service",
            # Decoy: its caller trip-service deployed just before, and Friday
            # rush adds +12% trip requests.
            deployments=[("matching-service", "v3.0", ONSET - 2), ("trip-service", "v7.2", ONSET - 1)],
            effects=[("ratio", ("matching-service", "maps-api"), 4.0),
                     ("ratio", ("matching-service", "redis"), 2.0),
                     ("demand", "trip-service", 1.12)],
        ),
    },
)
