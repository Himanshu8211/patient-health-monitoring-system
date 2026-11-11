"""Threshold-based alert rule used across the project."""

HR_LOW, HR_HIGH = 50, 110         # beats per minute
TEMP_LOW, TEMP_HIGH = 35.5, 38.0  # degrees Celsius
SPO2_LOW = 94                     # percent


def check_alert(heart_rate, temperature, spo2):
    """Return 1 if any vital is outside its limit, else 0."""
    if (heart_rate < HR_LOW or heart_rate > HR_HIGH
            or temperature < TEMP_LOW or temperature > TEMP_HIGH
            or spo2 < SPO2_LOW):
        return 1
    return 0


def alert_reasons(heart_rate, temperature, spo2):
    """List which limits were crossed (useful for display and logging)."""
    out = []
    if heart_rate < HR_LOW:
        out.append("heart rate low")
    if heart_rate > HR_HIGH:
        out.append("heart rate high")
    if temperature < TEMP_LOW:
        out.append("temperature low")
    if temperature > TEMP_HIGH:
        out.append("temperature high")
    if spo2 < SPO2_LOW:
        out.append("SpO2 low")
    return out
