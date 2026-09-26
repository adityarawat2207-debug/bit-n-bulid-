"""ShopX storefront: a small, real e-commerce site backed by SQLite.

Every request is metered (database queries actually executed, latency) and
reported to CloudPulse, the way an APM agent would.

search-service v2.0 has an N+1 query bug: it fetches the matching product ids,
then loads each product with its own query.
"""
import json
import os
import random
import sqlite3
import threading
import time
import urllib.request
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

HERE = Path(__file__).parent
# Vercel's filesystem is read-only apart from /tmp
DB_PATH = Path("/tmp/shopx.db") if os.environ.get("VERCEL") else HERE / "shopx.db"
CLOUDPULSE = os.environ.get("CLOUDPULSE_URL", "http://localhost:8000").rstrip("/") + "/api/v1/telemetry"
VERSIONS = {"search-service": "v2.0", "order-service": "v1.4"}
DB_ROUNDTRIP_S = 0.003  # network round trip to the database server per query


class Db:
    """A connection that counts every query it runs."""

    def __init__(self):
        self.conn = sqlite3.connect(DB_PATH)
        self.conn.row_factory = sqlite3.Row
        self.queries = 0

    def query(self, sql, *args):
        self.queries += 1
        time.sleep(DB_ROUNDTRIP_S)
        return self.conn.execute(sql, args).fetchall()

    def close(self):
        self.conn.close()


def report(service, route, db, started):
    payload = dict(service=service, version=VERSIONS[service], route=route,
                   db_queries=db.queries, latency_ms=round((time.time() - started) * 1000, 1))

    def send():
        try:
            req = urllib.request.Request(CLOUDPULSE, json.dumps(payload).encode(),
                                         {"Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=2).read()
        except Exception:
            pass  # monitoring must never break the shop

    if os.environ.get("VERCEL"):
        send()  # serverless freezes background threads once the response is sent
    else:
        threading.Thread(target=send, daemon=True).start()
    return payload


# ---------------------------------------------------------------- catalogue
CATALOGUE = {
    "shoes": ("👟", ["Runner", "Trail", "Court", "Canvas", "Leather", "Slip-On", "High-Top", "Loafer",
                     "Hiking", "Sprint", "Cloud", "Street"],
              ["Shoes", "Sneakers", "Boots"]),
    "shirts": ("👕", ["Linen", "Oxford", "Graphic", "Polo"], ["Shirt", "Tee"]),
    "watches": ("⌚", ["Chrono", "Diver", "Field"], ["Watch"]),
    "bags": ("🎒", ["Travel", "Laptop", "Gym"], ["Backpack", "Bag"]),
    "headphones": ("🎧", ["Studio", "Noise-Cancelling"], ["Headphones"]),
}
BRANDS = ["Stride", "Northpeak", "Velo", "Aurum", "Kite", "Monro"]


def seed():
    if DB_PATH.exists():
        return
    rng = random.Random(7)
    conn = sqlite3.connect(DB_PATH)
    conn.executescript("""
        CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, category TEXT, brand TEXT,
                               price REAL, rating REAL, stock INTEGER, emoji TEXT);
        CREATE TABLE orders (id INTEGER PRIMARY KEY, product_id INTEGER, qty INTEGER, created REAL);
        CREATE INDEX products_name ON products(name);
    """)
    for cat, (emoji, adjs, nouns) in CATALOGUE.items():
        for adj in adjs:
            for noun in nouns:
                conn.execute("INSERT INTO products (name, category, brand, price, rating, stock, emoji) "
                             "VALUES (?, ?, ?, ?, ?, ?, ?)",
                             (f"{adj} {noun}", cat, rng.choice(BRANDS), round(rng.uniform(19, 189), 2),
                              round(rng.uniform(3.6, 5.0), 1), rng.randint(0, 80), emoji))
    conn.commit()
    conn.close()


# ---------------------------------------------------------------- services
app = FastAPI(title="ShopX")
seed()


def search_terms(q):
    """Loose stems, so "running shoes" finds "Runner Shoes" and "watches" finds "Watch"."""
    return [w[:4] if len(w) > 4 else w.rstrip("s") or w for w in q.lower().split()][:6]


def search_products(db, q):
    # Rank by how many of the words match; a product matching none is left out
    terms = search_terms(q)
    score = " + ".join(["(name LIKE ? OR category LIKE ? OR brand LIKE ?)"] * len(terms))
    args = [f"%{t}%" for t in terms for _ in range(3)]
    ids = db.query(f"SELECT id FROM products WHERE {score} > 0 ORDER BY {score} DESC, rating DESC",
                   *args, *args)
    products = []
    for row in ids:
        p = db.query("SELECT * FROM products WHERE id = ?", row["id"])[0]
        products.append(dict(p))
    return products


@app.get("/api/search")
def search(q: str = Query("", max_length=60)):
    started, db = time.time(), Db()
    try:
        results = search_products(db, q.strip()) if q.strip() else []
    finally:
        db.close()
    meta = report("search-service", "/api/search", db, started)
    return dict(query=q, results=results, meta=meta)


@app.post("/api/order/{product_id}")
def order(product_id: int):
    started, db = time.time(), Db()
    try:
        p = db.query("SELECT id, stock FROM products WHERE id = ?", product_id)
        ok = bool(p) and p[0]["stock"] > 0
        if ok:
            db.conn.execute("UPDATE products SET stock = stock - 1 WHERE id = ?", (product_id,))
            db.conn.execute("INSERT INTO orders (product_id, qty, created) VALUES (?, 1, ?)",
                            (product_id, time.time()))
            db.queries += 2
            db.conn.commit()
    finally:
        db.close()
    meta = report("order-service", "/api/order", db, started)
    return dict(ok=ok, meta=meta)


@app.get("/")
def index():
    return FileResponse(HERE / "static" / "index.html")


app.mount("/static", StaticFiles(directory=HERE / "static"), name="static")
