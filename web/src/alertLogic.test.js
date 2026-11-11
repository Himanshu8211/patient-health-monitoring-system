import { describe, it, expect } from 'vitest';
import { checkAlert, alertReasons, HR_LOW, HR_HIGH, TEMP_LOW, TEMP_HIGH, SPO2_LOW } from './alertLogic';

describe('Alert rule verification', () => {
  it('returns 0 for normal baseline readings', () => {
    expect(checkAlert(75, 36.7, 97)).toBe(0);
    expect(alertReasons(75, 36.7, 97)).toEqual([]);
  });

  describe('Heart rate boundaries (50 - 110 BPM)', () => {
    it('is normal at exact lower boundary 50', () => {
      expect(checkAlert(50, 36.7, 97)).toBe(0);
    });

    it('triggers alert below lower boundary (49)', () => {
      expect(checkAlert(49, 36.7, 97)).toBe(1);
      expect(alertReasons(49, 36.7, 97)).toContain('heart rate low');
    });

    it('is normal at exact upper boundary 110', () => {
      expect(checkAlert(110, 36.7, 97)).toBe(0);
    });

    it('triggers alert above upper boundary (111)', () => {
      expect(checkAlert(111, 36.7, 97)).toBe(1);
      expect(alertReasons(111, 36.7, 97)).toContain('heart rate high');
    });
  });

  describe('Temperature boundaries (35.5 - 38.0 C)', () => {
    it('is normal at exact lower boundary 35.5', () => {
      expect(checkAlert(75, 35.5, 97)).toBe(0);
    });

    it('triggers alert below lower boundary (35.4)', () => {
      expect(checkAlert(75, 35.4, 97)).toBe(1);
      expect(alertReasons(75, 35.4, 97)).toContain('temperature low');
    });

    it('is normal at exact upper boundary 38.0', () => {
      expect(checkAlert(75, 38.0, 97)).toBe(0);
    });

    it('triggers alert above upper boundary (38.1)', () => {
      expect(checkAlert(75, 38.1, 97)).toBe(1);
      expect(alertReasons(75, 38.1, 97)).toContain('temperature high');
    });
  });

  describe('SpO2 boundary (>= 94 %)', () => {
    it('is normal at exact lower boundary 94', () => {
      expect(checkAlert(75, 36.7, 94)).toBe(0);
    });

    it('triggers alert below lower boundary (93)', () => {
      expect(checkAlert(75, 36.7, 93)).toBe(1);
      expect(alertReasons(75, 36.7, 93)).toContain('SpO2 low');
    });
  });

  describe('Multiple alert reasons', () => {
    it('identifies combined tachycardia and hypoxemia', () => {
      const reasons = alertReasons(125, 36.8, 91);
      expect(reasons).toEqual(['heart rate high', 'SpO2 low']);
    });

    it('identifies fever and bradycardia', () => {
      const reasons = alertReasons(45, 39.2, 98);
      expect(reasons).toEqual(['heart rate low', 'temperature high']);
    });
  });
});
