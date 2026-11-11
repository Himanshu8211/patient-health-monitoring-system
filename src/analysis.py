"""Dataset checks, rule validation and the simulation test report.

Usage: python src/analysis.py
Writes data/test_results.csv.
"""
import pandas as pd

from alert_logic import check_alert

COLS = ["heart_rate_bpm", "body_temp_C", "SpO2_pct"]


def rule(df):
    return df.apply(lambda r: check_alert(r.heart_rate_bpm, r.body_temp_C, r.SpO2_pct), axis=1)


def main():
    df = pd.read_csv("data/patient_vitals_5000.csv", parse_dates=["timestamp"])
    print("Shape:", df.shape)
    print("Missing:", int(df.isna().sum().sum()), "| duplicates:", int(df.duplicated().sum()))
    print("Timestamps increasing:", df.timestamp.is_monotonic_increasing)
    print("Means:", df[COLS].mean().round(2).to_dict())
    print("Alert rate: %.2f%%" % (df.alert_flag.mean() * 100))

    print("Rule agreement with alert_flag: %.1f%%" % ((rule(df) == df.alert_flag).mean() * 100))
    hr_only = ((df.heart_rate_bpm < 50) | (df.heart_rate_bpm > 110)).astype(int)
    caught = int(((hr_only == 1) & (df.alert_flag == 1)).sum())
    print("Heart-rate-only recall: %.3f (%d of %d alerts)" % (caught / df.alert_flag.sum(), caught, df.alert_flag.sum()))

    sim = pd.read_csv("data/simulated_sensor_data.csv")
    ok = (sim.alert_flag == rule(sim)).all()
    res = pd.DataFrame({
        "Test Case": ["Total Readings", "Normal Readings", "Alert Readings", "Missing Values", "Alert Logic"],
        "Result": [len(sim), int((sim.alert_flag == 0).sum()), int((sim.alert_flag == 1).sum()),
                   int(sim.isna().sum().sum()), "Passed" if ok else "Failed"],
    })
    res.to_csv("data/test_results.csv", index=False)
    print(res)


if __name__ == "__main__":
    main()
