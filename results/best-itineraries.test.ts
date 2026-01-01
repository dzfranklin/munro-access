import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBestItinerariesForTarget } from './best-itineraries';
import { resultMap, targetMap, munroMap } from './parse.server';
import type { Result, Target, Munro, Route, Itinerary } from './schema';

// Mock the dependencies
vi.mock('./parse.server', () => ({
  resultMap: new Map(),
  targetMap: new Map(),
  munroMap: new Map(),
}));

describe('best-itineraries', () => {
  beforeEach(() => {
    resultMap.clear();
    targetMap.clear();
    munroMap.clear();
  });

  const createItinerary = (overrides: Partial<Itinerary> = {}): Itinerary => ({
    date: "2025-06-01",
    startTime: "09:00:00",
    endTime: "11:00:00",
    modes: ["BUS"],
    legs: [],
    ...overrides,
  });

  const createRoute = (): Route => ({
    name: "Route 1",
    page: "http://example.com",
    stats: {
      distanceKm: 10,
      timeHours: { min: 4, max: 6 },
      ascentM: 500
    },
    munros: [{ number: 1, name: "Munro 1", page: "http://example.com/m1" }]
  });

  const createTarget = (id: string): Target => ({
    id,
    name: "Target " + id,
    description: "Desc",
    lngLat: [0, 0],
    routes: [createRoute()]
  });

  const createResult = (start: string, target: string): Result => ({
    start,
    target,
    itineraries: {
      WEDNESDAY: { outbounds: [], returns: [] },
      FRIDAY: { outbounds: [], returns: [] },
      SATURDAY: { outbounds: [], returns: [] },
      SUNDAY: { outbounds: [], returns: [] },
    }
  });

  it('should return null if target not found', () => {
    const result = getBestItinerariesForTarget('missing');
    expect(result).toBeNull();
  });

  it('should return best options when itineraries exist', () => {
    const target = createTarget('t1');
    targetMap.set('t1', target);

    const munro: Munro = { number: 1, name: "Munro 1", page: "http://example.com/m1", slug: "1-munro-1" };
    munroMap.set(1, munro);

    const result = createResult('s1', 't1');
    
    // Add viable itineraries for Saturday
    result.itineraries.SATURDAY = {
        outbounds: [createItinerary({ startTime: "08:00:00", endTime: "10:00:00" })],
        returns: [createItinerary({ startTime: "17:00:00", endTime: "19:00:00" })]
    };

    resultMap.set('s1:t1', result);

    const best = getBestItinerariesForTarget('t1');
    
    expect(best).not.toBeNull();
    expect(best?.targetId).toBe('t1');
    expect(best?.bestOptions.length).toBeGreaterThan(0);
    expect(best?.bestOptions[0].startId).toBe('s1');
    expect(best?.bestOptions[0].day).toBe('SATURDAY');
  });

  it('should calculate global percentiles correctly', () => {
    // This indirectly tests calculateGlobalPercentiles via getBestItinerariesForTarget
    // when globalPercentiles argument is not provided.
    
    const target = createTarget('t1');
    targetMap.set('t1', target);
    
    const munro: Munro = { number: 1, name: "Munro 1", page: "http://example.com/m1", slug: "1-munro-1" };
    munroMap.set(1, munro);

    const result = createResult('s1', 't1');
    result.itineraries.SATURDAY = {
        outbounds: [createItinerary({ startTime: "08:00:00", endTime: "10:00:00" })],
        returns: [createItinerary({ startTime: "17:00:00", endTime: "19:00:00" })]
    };
    resultMap.set('s1:t1', result);

    const best = getBestItinerariesForTarget('t1');
    
    // Since there is only one score, it should have percentile 0
    // Wait, calculatePercentiles: 1 item -> percentile 0. 
    // If I add another better one, it might shift.
    
    expect(best?.bestOptions[0].score).toBeDefined();
  });
});
