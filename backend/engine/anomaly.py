"""Anomaly detection (PRD §17) and the baseline/onset helpers every other
engine stage uses."""
import numpy as np

from simulator.model import TOPO


def total_cost(d):
    return sum(v for n in TOPO for v in d["cost"][n].values())


def node_cost(d, n):
    return sum(d["cost"][n].values())


def detect_anomaly(d, window=14, k=2.0):
    """Flag days whose cost > mean + k*std of the previous `window` days."""
    daily = total_cost(d).reshape(-1, 24).sum(1)
    flagged = [day for day in range(window, len(daily))
               if daily[day] > daily[day - window:day].mean() + k * daily[day - window:day].std()]
    # active incident = the anomalous run that reaches the latest day; older
    # flagged days (e.g. a resolved batch spike) are history, not incidents
    if not flagged or flagged[-1] != len(daily) - 1:
        return dict(daily=daily, flagged=flagged, day=None)
    start = flagged[-1]
    while start - 1 in flagged:
        start -= 1
    return dict(daily=daily, flagged=flagged, day=start)


class Baseline:
    """Same-hour-of-day expectation from the 14 days before `day`."""

    def __init__(self, day, window=14):
        self.lo, self.hi = (day - window) * 24, day * 24

    def expected(self, x):
        b = x[self.lo:self.hi].reshape(-1, 24)
        mu, sd = b.mean(0), b.std(0) + 1e-9
        reps = len(x) // 24
        return np.tile(mu, reps), np.tile(sd, reps)


def onset(x, base, start, z=4.0, sustain=2):
    """First hour >= start where x leaves its baseline band for `sustain` hours."""
    mu, sd = base.expected(x)
    zz = np.abs(x - mu) / sd
    for h in range(start, len(x) - sustain):
        if all(zz[h:h + sustain] > z):
            return h
    return None


def change(x, base, cur):
    """Ratio of x over the current window to its hour-of-day baseline."""
    mu, _ = base.expected(x)
    return x[cur].mean() / mu[cur].mean()


def levels(x, base, cur):
    """(baseline level, current level) of x over the current window."""
    mu, _ = base.expected(x)
    return float(mu[cur].mean()), float(x[cur].mean())


def run_rates(x, base, cur):
    """(baseline, current) monthly run-rate of an hourly $ series."""
    before = float(x[base.lo:base.hi].mean() * 24 * 30)
    return before, before * float(change(x, base, cur))
