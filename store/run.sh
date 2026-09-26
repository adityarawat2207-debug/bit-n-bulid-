#!/bin/sh
# Start the ShopX store on http://localhost:8100 (reports to CloudPulse at $CLOUDPULSE_URL, default :8000)
cd "$(dirname "$0")"
[ -d .venv ] || { python3 -m venv .venv && .venv/bin/pip install -q -r requirements.txt; }
exec .venv/bin/uvicorn app:app --port 8100
