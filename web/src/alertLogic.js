// Threshold limits for vital signs
export const HR_LOW = 50;
export const HR_HIGH = 110;
export const TEMP_LOW = 35.5;
export const TEMP_HIGH = 38.0;
export const SPO2_LOW = 94;

// Returns 1 if abnormal, 0 if normal
export function checkAlert(heartRate, temperature, spo2) {
  if (
    heartRate < HR_LOW ||
    heartRate > HR_HIGH ||
    temperature < TEMP_LOW ||
    temperature > TEMP_HIGH ||
    spo2 < SPO2_LOW
  ) {
    return 1;
  }
  return 0;
}

// Returns a list of reasons why an alert was triggered
export function alertReasons(heartRate, temperature, spo2) {
  const reasons = [];
  if (heartRate < HR_LOW) {
    reasons.push('heart rate low');
  }
  if (heartRate > HR_HIGH) {
    reasons.push('heart rate high');
  }
  if (temperature < TEMP_LOW) {
    reasons.push('temperature low');
  }
  if (temperature > TEMP_HIGH) {
    reasons.push('temperature high');
  }
  if (spo2 < SPO2_LOW) {
    reasons.push('SpO2 low');
  }
  return reasons;
}
