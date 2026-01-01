import { describe, it, expect } from 'vitest';
import { getPercentileLevel, formatPercentileLabel, getPercentileClasses, getPercentileTextClass, getPercentileBorderClass } from './itinerary';

describe('itinerary utils', () => {
  describe('getPercentileLevel', () => {
    it('should return top for >= 0.75', () => {
      expect(getPercentileLevel(0.75)).toBe('top');
      expect(getPercentileLevel(0.9)).toBe('top');
      expect(getPercentileLevel(1.0)).toBe('top');
    });
    it('should return good for >= 0.5 and < 0.75', () => {
      expect(getPercentileLevel(0.5)).toBe('good');
      expect(getPercentileLevel(0.74)).toBe('good');
    });
    it('should return fair for >= 0.25 and < 0.5', () => {
      expect(getPercentileLevel(0.25)).toBe('fair');
      expect(getPercentileLevel(0.49)).toBe('fair');
    });
    it('should return bottom for < 0.25', () => {
      expect(getPercentileLevel(0)).toBe('bottom');
      expect(getPercentileLevel(0.24)).toBe('bottom');
    });
  });

  describe('formatPercentileLabel', () => {
    it('should format top percentiles correctly', () => {
      // 0.9 = 90th percentile = Top 10%
      expect(formatPercentileLabel(0.9)).toBe('Top 10%');
      // 0.99 = Top 1%
      expect(formatPercentileLabel(0.99)).toBe('Top 1%');
    });

    it('should format bottom percentiles correctly', () => {
      // 0.1 = 10th percentile = Bottom 90%? 
      // Logic: percent = 10. topPercent = 90. 90 > 50 -> "Bottom 90%"
      expect(formatPercentileLabel(0.1)).toBe('Bottom 90%');
      
      // 0.4 = 40th percentile. percent=40. topPercent=60. -> "Bottom 60%"
      expect(formatPercentileLabel(0.4)).toBe('Bottom 60%');
      
      // 0.6 = 60th percentile. percent=60. topPercent=40. -> "Top 40%"
      expect(formatPercentileLabel(0.6)).toBe('Top 40%');
    });
  });

  describe('getPercentileTextClass', () => {
    it('should return correct classes', () => {
      expect(getPercentileTextClass('top')).toBe('text-percentile-top');
      expect(getPercentileTextClass('good')).toBe('text-percentile-good');
      expect(getPercentileTextClass('fair')).toBe('text-percentile-fair');
      expect(getPercentileTextClass('bottom')).toBe('text-percentile-bottom');
    });
  });
  
  describe('getPercentileBorderClass', () => {
    it('should return correct classes', () => {
      expect(getPercentileBorderClass('top')).toBe('border-percentile-top');
      expect(getPercentileBorderClass('good')).toBe('border-percentile-good');
      expect(getPercentileBorderClass('fair')).toBe('border-percentile-fair');
      expect(getPercentileBorderClass('bottom')).toBe('border-percentile-bottom');
    });
  });

  describe('getPercentileClasses', () => {
    it('should bundle all properties correctly', () => {
        const result = getPercentileClasses(0.8); // Top 20%
        expect(result.level).toBe('top');
        expect(result.label).toBe('Top 20%');
        expect(result.textClass).toBe('text-percentile-top');
        expect(result.borderClass).toBe('border-percentile-top');
    });
  });
});
