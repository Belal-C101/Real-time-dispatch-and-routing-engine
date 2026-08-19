import { describe, it, expect } from 'vitest';
import { calculateDistance, formatDuration, isWithinTimeWindow } from './index';

describe('Utility Functions', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      // New York City to Los Angeles
      const distance = calculateDistance(40.7128, -74.006, 34.0522, -118.2437);
      expect(distance).toBeCloseTo(2446, -1); // Approximately 2446 miles
    });

    it('should return 0 for the same point', () => {
      const distance = calculateDistance(40.7128, -74.006, 40.7128, -74.006);
      expect(distance).toBe(0);
    });

    it('should handle negative coordinates', () => {
      // Sydney to Tokyo
      const distance = calculateDistance(-33.8688, 151.2093, 35.6762, 139.6503);
      expect(distance).toBeGreaterThan(0);
    });
  });

  describe('formatDuration', () => {
    it('should format hours and minutes correctly', () => {
      expect(formatDuration(150)).toBe('2h 30m');
    });

    it('should handle zero minutes', () => {
      expect(formatDuration(0)).toBe('0h 0m');
    });

    it('should handle only hours', () => {
      expect(formatDuration(120)).toBe('2h 0m');
    });

    it('should handle only minutes', () => {
      expect(formatDuration(45)).toBe('0h 45m');
    });
  });

  describe('isWithinTimeWindow', () => {
    it('should return true when date is within window', () => {
      const date = new Date('2023-01-01T09:00:00Z');
      const window = {
        start: new Date('2023-01-01T08:00:00Z'),
        end: new Date('2023-01-01T10:00:00Z'),
      };
      expect(isWithinTimeWindow(date, window)).toBe(true);
    });

    it('should return false when date is before window', () => {
      const date = new Date('2023-01-01T07:00:00Z');
      const window = {
        start: new Date('2023-01-01T08:00:00Z'),
        end: new Date('2023-01-01T10:00:00Z'),
      };
      expect(isWithinTimeWindow(date, window)).toBe(false);
    });

    it('should return false when date is after window', () => {
      const date = new Date('2023-01-01T11:00:00Z');
      const window = {
        start: new Date('2023-01-01T08:00:00Z'),
        end: new Date('2023-01-01T10:00:00Z'),
      };
      expect(isWithinTimeWindow(date, window)).toBe(false);
    });

    it('should return true when date equals start of window', () => {
      const date = new Date('2023-01-01T08:00:00Z');
      const window = {
        start: new Date('2023-01-01T08:00:00Z'),
        end: new Date('2023-01-01T10:00:00Z'),
      };
      expect(isWithinTimeWindow(date, window)).toBe(true);
    });

    it('should return true when date equals end of window', () => {
      const date = new Date('2023-01-01T10:00:00Z');
      const window = {
        start: new Date('2023-01-01T08:00:00Z'),
        end: new Date('2023-01-01T10:00:00Z'),
      };
      expect(isWithinTimeWindow(date, window)).toBe(true);
    });
  });
});
