# Patient Health Monitoring System

Software-based prototype for the HCLTech Career Shaper Programme (Embedded Systems & IoT).
It checks a 5,000-record vitals dataset, applies threshold alert rules, simulates sensor
readings, and builds JSON messages for the topic `patient/monitor/data`.

> Academic prototype. Not a medical device, not for diagnosis or treatment. The data is synthetic.

**Author:** Himanshu Dubey, ABES Engineering College

## Links

- GitHub: https://github.com/Himanshu8211/patient-health-monitoring-system
- Live dashboard: https://patient-health-monitoring-nine.vercel.app
- Notebook (Kaggle): ADD-YOUR-KAGGLE-LINK
- Report: [docs/project_report.pdf](docs/project_report.pdf)

## Alert rules

| Vital | Alert when |
|---|---|
| Heart rate | below 50 or above 110 BPM |
| Body temperature | below 35.5 or above 38.0 °C |
| SpO2 | below 94 % |

## What is done

- **Dataset analysis & validation:** Verified 5,000 vitals records across 40 patients with zero missing values.
- **Python simulation & CLI tools:** Scripts in `src/` for data simulation, threshold checking, and MQTT mock publishing.
- **React + Vite web app (`web/`):** Interactive dashboard replaying `data/patient_vitals_5000.csv` row by row.
  - Live metric cards for Heart rate, Temperature, and SpO2.
  - NORMAL / ALERT banner with specific alert reasons.
  - Three line charts of the last 40 readings with threshold lines (Recharts).
  - Recent alerts list and "Next alert" jump button.
  - Dataset summary with averages and alert rate by channel (WiFi, BLE, LoRa).
  - "Try the rule" panel with three sliders.
  - Optional "confirm alerts" toggle requiring two consecutive abnormal readings for the same patient.
- **Real MQTT integration:** Uses `mqtt.js` over WebSocket (`wss://broker.hivemq.com:8884/mqtt`). Publishes simulated telemetry to topic and displays messages live in subscriber panel.
- **ESP32 firmware sketch (`esp32/patient_monitor.ino`):** Reference Arduino sketch for MAX30100, DHT11, SSD1306 OLED, and PubSubClient.
- **Automated tests:** Vitest unit tests in `web/src/alertLogic.test.js` and Pytest suite in `tests/test_alert_logic.py` covering boundary values (50, 110, 35.5, 38.0, 94).

## What is not tested on hardware

- **ESP32 firmware (`esp32/patient_monitor.ino`):** The Arduino sketch is **untested on real hardware**.
- **Simulated readings:** All sensor readings and vitals data are synthetic, with no clinical validation.

## Run the web app

```bash
cd web
npm install
npm run dev
npm test
```

## Running Python Scripts

```bash
pip install -r requirements.txt
python src/analysis.py              # dataset checks, rule validation, writes data/test_results.csv
python src/simulate.py --seed 42    # 20 new random readings -> data/simulated_run.csv
python src/mqtt_publisher_sim.py    # JSON messages + simulated subscriber alerts
pytest tests                        # boundary tests for the alert rule
```

## Deploy on Vercel

1. Import this repository in the Vercel dashboard.
2. Set **Root Directory** to `web`.
3. Framework preset: **Vite**.
4. Build command: `npm run build`
5. Output directory: `dist`

## Project Structure

```
web/         Vite + React dashboard
esp32/       patient_monitor.ino ESP32 Arduino sketch
src/         alert_logic.py, simulate.py, mqtt_publisher_sim.py, analysis.py
tests/       test_alert_logic.py (Pytest suite)
data/        patient_vitals_5000.csv, dataset_clean.csv, simulated_sensor_data.csv, test_results.csv
figures/     visualizations and distribution plots
docs/        project_report.pdf
notebooks/   exported research notebooks
```
