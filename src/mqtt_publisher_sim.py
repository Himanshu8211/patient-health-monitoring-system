"""Simulated publisher/subscriber exchange on topic patient/monitor/data.

No network is involved: a small in-memory broker stands in for MQTT.
Swapping in paho-mqtt later only means replacing SimBroker.
"""
import json
import sys

import pandas as pd

TOPIC = "patient/monitor/data"


class SimBroker:
    def __init__(self):
        self.subs = {}

    def subscribe(self, topic, callback):
        self.subs.setdefault(topic, []).append(callback)

    def publish(self, topic, payload):
        for cb in self.subs.get(topic, []):
            cb(topic, payload)


def on_message(topic, payload):
    msg = json.loads(payload)
    if msg["alert_flag"] == 1:
        print(f"ALERT! {msg['patient_id']} HR={msg['heart_rate_bpm']} "
              f"T={msg['body_temp_C']} SpO2={msg['SpO2_pct']} ({msg['timestamp']})")


def main(path="data/simulated_sensor_data.csv"):
    df = pd.read_csv(path)
    broker = SimBroker()
    broker.subscribe(TOPIC, on_message)
    for _, row in df.iterrows():
        msg = {k: (v.item() if hasattr(v, "item") else v) for k, v in row.to_dict().items()}
        payload = json.dumps(msg)
        print("Topic:", TOPIC, "\nMessage:", payload, "\n")
        broker.publish(TOPIC, payload)


if __name__ == "__main__":
    main(*sys.argv[1:])
