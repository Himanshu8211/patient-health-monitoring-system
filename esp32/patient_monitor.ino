/*
 * Patient Health Monitoring System - ESP32 Prototype
 *
 * NOTE: Untested on real hardware. This is an academic reference implementation.
 *
 * Hardware components:
 * - ESP32 Development Board
 * - MAX30100 Pulse Oximeter & Heart Rate Sensor (I2C)
 * - DHT11 Temperature & Humidity Sensor (GPIO 4)
 * - SSD1306 128x64 OLED Display (I2C: SDA 21, SCL 22)
 *
 * Alert thresholds (do not change):
 * - Heart rate < 50 or > 110 BPM
 * - Body temperature < 35.5 or > 38.0 C
 * - SpO2 < 94 %
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>
#include "MAX30100_PulseOximeter.h"

// WiFi and MQTT settings
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;
const char* mqtt_topic = "himanshu-patient/monitor/data";

// Pin definitions
#define DHTPIN 4
#define DHTTYPE DHT11
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1

// Threshold constants
const float HR_LOW = 50.0;
const float HR_HIGH = 110.0;
const float TEMP_LOW = 35.5;
const float TEMP_HIGH = 38.0;
const float SPO2_LOW = 94.0;

// Device and patient ID
const char* patient_id = "PT-ESP32-01";

WiFiClient espClient;
PubSubClient client(espClient);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
DHT dht(DHTPIN, DHTTYPE);
PulseOximeter pox;

uint32_t tsLastReport = 0;
#define REPORTING_PERIOD_MS 2000

void setup_wifi() {
  delay(10);
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected, IP: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Connecting to MQTT...");
    String clientId = "ESP32-PatientMonitor-" + String(random(0xffff), HEX);
    if (client.connect(clientId.c_str())) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" retrying in 5 seconds");
      delay(5000);
    }
  }
}

int check_alert(float hr, float temp, float spo2) {
  if (hr < HR_LOW || hr > HR_HIGH || temp < TEMP_LOW || temp > TEMP_HIGH || spo2 < SPO2_LOW) {
    return 1;
  }
  return 0;
}

void update_display(float hr, float temp, float spo2, int alert_flag) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("Patient Health Monitor");
  display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

  display.setCursor(0, 15);
  display.print("HR  : ");
  display.print(hr, 0);
  display.println(" bpm");

  display.setCursor(0, 27);
  display.print("Temp: ");
  display.print(temp, 1);
  display.println(" C");

  display.setCursor(0, 39);
  display.print("SpO2: ");
  display.print(spo2, 0);
  display.println(" %");

  display.drawLine(0, 50, 127, 50, SSD1306_WHITE);
  display.setCursor(0, 54);
  if (alert_flag == 1) {
    display.print("STATUS: ALERT!");
  } else {
    display.print("STATUS: NORMAL");
  }
  display.display();
}

void publish_telemetry(float hr, float temp, float spo2, int alert_flag) {
  char payload[200];
  snprintf(payload, sizeof(payload),
    "{\"patient_id\":\"%s\",\"heart_rate_bpm\":%.1f,\"body_temp_C\":%.1f,\"SpO2_pct\":%.1f,\"comm_channel\":\"WiFi\",\"alert_flag\":%d}",
    patient_id, hr, temp, spo2, alert_flag
  );
  client.publish(mqtt_topic, payload);
  Serial.print("Published: ");
  Serial.println(payload);
}

void onBeatDetected() {
  Serial.println("Heartbeat detected!");
}

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("SSD1306 allocation failed");
  } else {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 20);
    display.println("Initializing sensors...");
    display.display();
  }

  dht.begin();

  if (!pox.begin()) {
    Serial.println("MAX30100 init failed!");
  } else {
    pox.setOnBeatDetectedCallback(onBeatDetected);
  }

  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  pox.update();

  if (millis() - tsLastReport > REPORTING_PERIOD_MS) {
    float hr = pox.getHeartRate();
    float spo2 = pox.getSpO2();
    float temp = dht.readTemperature();

    // Fallback if sensor read fails
    if (isnan(temp)) temp = 36.5;

    int alert = check_alert(hr, temp, spo2);

    update_display(hr, temp, spo2, alert);
    publish_telemetry(hr, temp, spo2, alert);

    tsLastReport = millis();
  }
}
