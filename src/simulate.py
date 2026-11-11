"""Generate 20 simulated sensor readings and label them with the alert rule.

Usage: python src/simulate.py [--seed 42] [--out data/simulated_run.csv]

data/simulated_sensor_data.csv holds the exact 20 readings used in the report.
A fresh run gives different numbers, so the normal/alert split will vary.
"""
import argparse
import random

import pandas as pd

from alert_logic import check_alert


def simulate(n=20, seed=None):
    rng = random.Random(seed)
    rows = []
    for _ in range(n):
        hr = rng.randint(60, 120)
        temp = round(rng.uniform(35, 39), 1)
        spo2 = rng.randint(90, 100)
        rows.append([hr, temp, spo2, check_alert(hr, temp, spo2)])
    df = pd.DataFrame(rows, columns=["heart_rate_bpm", "body_temp_C", "SpO2_pct", "alert_flag"])
    df["timestamp"] = pd.date_range(start="2026-10-30", periods=n, freq="min")
    df["patient_id"] = "P001"
    df["comm_channel"] = "WiFi"
    return df


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--out", default="data/simulated_run.csv")
    a = ap.parse_args()
    df = simulate(seed=a.seed)
    df.to_csv(a.out, index=False)
    print(df)
    print("normal:", (df.alert_flag == 0).sum(), "alert:", (df.alert_flag == 1).sum())
