"""ShopX: the fictional e-commerce company of PRD §9-10."""
from .company import DB, GATEWAY, ONSET, Company

COMPANY = Company(
    id="shopx",
    name="ShopX",
    tagline="E-commerce",
    # (source, target) -> base calls per inbound request of source
    edges={
        (GATEWAY, "auth-service"): None,     # gateway edges carry user demand
        (GATEWAY, "search-service"): None,
        (GATEWAY, "order-service"): None,
        (GATEWAY, "image-service"): None,
        ("search-service", "redis"): 2.0,
        ("search-service", DB): 1.2,
        ("auth-service", DB): 0.5,
        ("order-service", DB): 3.0,
        ("order-service", "payment-service"): 0.3,
        ("image-service", "cdn"): 1.0,
        (DB, "analytics"): 0.02,
    },
    kind={
        GATEWAY: "ingress",
        "auth-service": "service", "search-service": "service",
        "order-service": "service", "image-service": "service",
        "payment-service": "service",
        "redis": "resource", DB: "resource", "cdn": "resource",
        "analytics": "resource",
    },
    topo=[GATEWAY, "auth-service", "search-service", "order-service",
          "image-service", "payment-service", "redis", "cdn", DB, "analytics"],
    base_demand={"auth-service": 15000, "search-service": 42000,
                 "order-service": 6000, "image-service": 20000},  # req/min
    # DB work units per query, by caller (search queries are light lookups)
    query_weight={"search-service": 0.2, "auth-service": 1.0, "order-service": 1.0},
    db_cpu_baseline=0.42,
    latency={"search-service": 60, "order-service": 90, "auth-service": 25,
             "image-service": 40, "payment-service": 150},  # base ms
    hop_ms={"redis": 0.5},  # added ms per call on these edges (DB is modelled separately)
    # Baseline monthly budget, calibrated to PRD §16 (sums to $10,240).
    compute={GATEWAY: (200, 300), "auth-service": (150, 200), "search-service": (300, 500),
             "order-service": (200, 250), "image-service": (150, 250),
             "payment-service": (70, 80), "analytics": (100, 150)},       # $2,900
    db_cost=(1100, 1700),                     # $2,800 (I/O-billed, so it tracks load)
    network_total=1500,                       # $1,500
    usage={"redis": ("cache", 400, 550),      # $950
           "cdn": ("cdn", 100, 200)},         # $300
    storage={DB: 1400, "analytics": 390},     # $1,790
    trend=("auth-service", 0.003),            # slow auth growth (decoy)
    batch_decoy=("analytics", "compute", 15, 2, 5, 3),  # day-15 batch spike (decoy)
    # Seeded incident history (PRD factor 5). Database has the MOST history on
    # purpose: history alone must not be enough to blame it.
    prior_incidents={"search-service": 1, DB: 2, "analytics": 1},
    # `expected` is the answer key for tests only; the engine never reads it.
    scenarios={
        "baseline": dict(
            name="Healthy baseline",
            description="Normal ShopX traffic with no incident",
            expected=None, deployments=[], effects=[],
        ),
        "search_query_explosion": dict(
            name="Search Query Explosion",
            description="Search v2.0 deploy multiplies database queries per request",
            expected="search-service",
            deployments=[("search-service", "v2.0", ONSET - 1)],
            # Search v2: queries/request 1.2 -> 4.8, plus organic traffic +20%
            effects=[("demand", "search-service", 1.20), ("ratio", ("search-service", DB), 4.0)],
        ),
        "traffic_spike": dict(
            name="Traffic Spike",
            description="Image traffic jumps +340%; an unrelated search deploy lands just before it",
            expected="image-service",
            # Decoy: search deployed 2h before, but nothing about search changes
            deployments=[("search-service", "v2.1", ONSET - 2)],
            effects=[("demand", "image-service", 4.4)],
        ),
        "database_overload": dict(
            name="Database Overload",
            description="Order v3.0 ships an N+1 query bug that saturates the database",
            expected="order-service",
            deployments=[("order-service", "v3.0", ONSET - 1)],
            # Order v3 N+1 bug: queries/request 3 -> 10.5. Decoy: search +10% traffic
            effects=[("ratio", ("order-service", DB), 3.5), ("demand", "search-service", 1.10)],
        ),
    },
)
