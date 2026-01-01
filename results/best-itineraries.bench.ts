import { bench, describe } from 'vitest';
import {
  resultMap,
  targetMap,
  munroMap,
} from './parse.server';
import {
  getTopTargetsPerStart,
  computeAllTargetItineraries,
} from './best-itineraries';
import { DEFAULT_RANKING_PREFERENCES } from './scoring';

describe('Homepage Computation Benchmarks', () => {
  bench('Full homepage computation (getTopTargetsPerStart)', () => {
    getTopTargetsPerStart(
      resultMap,
      targetMap,
      munroMap,
      Infinity,
      DEFAULT_RANKING_PREFERENCES
    );
  });

  bench('Core computation only (computeAllTargetItineraries)', () => {
    computeAllTargetItineraries(resultMap, targetMap, DEFAULT_RANKING_PREFERENCES);
  });

  bench('Parse data (baseline)', () => {
    // This measures the cost of just accessing the preloaded data
    let count = 0;
    for (const result of resultMap.values()) {
      for (const dayItineraries of Object.values(result.itineraries)) {
        count += dayItineraries.outbounds.length + dayItineraries.returns.length;
      }
    }
    // Prevent optimization from eliminating the loop
    if (count < 0) throw new Error();
  });
});

describe('Individual Target Benchmarks', () => {
  // Pick a representative target with many options
  const sampleTargetId = Array.from(targetMap.keys()).find(targetId => {
    for (const result of resultMap.values()) {
      if (result.target !== targetId) continue;
      for (const dayItins of Object.values(result.itineraries)) {
        if (dayItins.outbounds.length > 10 && dayItins.returns.length > 10) {
          return true;
        }
      }
    }
    return false;
  });

  if (sampleTargetId) {
    bench(`Single target computation (${targetMap.get(sampleTargetId)?.name})`, () => {
      const { targetCache, percentileMap } = computeAllTargetItineraries(
        resultMap,
        targetMap,
        DEFAULT_RANKING_PREFERENCES
      );
      
      // Just access the single target
      const cached = targetCache.get(sampleTargetId);
      if (cached) {
        // Apply percentiles
        cached.options.map(opt => ({
          ...opt,
          score: percentileMap.get(opt.rawScore) ?? 0,
        }));
      }
    });
  }
});
