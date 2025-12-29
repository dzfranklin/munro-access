import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import path from 'path';

// Configuration
const OUT_DIR = './out';
const CACHE_DIR = `${OUT_DIR}/cache`;
const CACHE_FILE = `${CACHE_DIR}/startNames.json`;
const INPUT_FILE = './munro_routes.jsonl';
const OUTPUT_FILE = './targets.json';
const RATE_LIMIT_DELAY = 2000; // 2 seconds between API calls
const MAX_RETRIES = 3;

// Initialize Anthropic client
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Utility function: sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Utility function: slugify a string
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

// Utility function: calculate distance between two lat/lng points in meters
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const dphi = (lat2 - lat1) * Math.PI / 180;
  const dlambda = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(dphi/2) * Math.sin(dphi/2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(dlambda/2) * Math.sin(dlambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

// Parse distance from string like "12.5km / 7.75 miles" to kilometers
function parseDistance(distanceStr) {
  if (!distanceStr) return null;
  const match = distanceStr.match(/^([\d.]+)km/);
  return match ? parseFloat(match[1]) : null;
}

// Parse time from string like "4 - 5 hours" to object with min/max hours
function parseTime(timeStr) {
  if (!timeStr) return null;

  // Remove "summer conditions" or similar text
  const cleanStr = timeStr.replace(/\(.*?\)/g, '').trim();

  // Match patterns like "4 - 5 hours" or "6 hours"
  const rangeMatch = cleanStr.match(/^([\d.]+)\s*-\s*([\d.]+)\s*hours?/);
  if (rangeMatch) {
    return {
      min: parseFloat(rangeMatch[1]),
      max: parseFloat(rangeMatch[2])
    };
  }

  const singleMatch = cleanStr.match(/^([\d.]+)\s*hours?/);
  if (singleMatch) {
    const hours = parseFloat(singleMatch[1]);
    return { min: hours, max: hours };
  }

  return null;
}

// Parse ascent from string like "712m (Profile)" to meters
function parseAscent(ascentStr) {
  if (!ascentStr) return null;
  const match = ascentStr.match(/^([\d.]+)m/);
  return match ? parseInt(match[1]) : null;
}

// Parse stats object into structured data
function parseStats(stats) {
  if (!stats) return null;

  // Handle both "Time (summer conditions)" and "Time" keys
  const timeStr = stats['Time (summer conditions)'] || stats['Time'];

  return {
    distanceKm: parseDistance(stats.Distance),
    timeHours: parseTime(timeStr),
    ascentM: parseAscent(stats.Ascent)
  };
}

// Generate unique ID from name, appending numbers for duplicates
function generateUniqueId(name, usedIds) {
  const baseId = slugify(name);
  let id = baseId;
  let counter = 2;

  while (usedIds.has(id)) {
    id = `${baseId}-${counter}`;
    counter++;
  }

  usedIds.add(id);
  return id;
}

// Initialize directories
async function initializeDirs() {
  try {
    await fs.mkdir(OUT_DIR, { recursive: true });
    await fs.mkdir(CACHE_DIR, { recursive: true });
    console.log('✓ Directories initialized');
  } catch (error) {
    console.error('Error creating directories:', error.message);
    throw error;
  }
}

// Load cache from file
async function loadCache() {
  try {
    const cacheData = await fs.readFile(CACHE_FILE, 'utf-8');
    const cache = JSON.parse(cacheData);
    console.log(`✓ Loaded ${Object.keys(cache).length} cached entries`);
    return cache;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('✓ No existing cache found, starting fresh');
      return {};
    }
    console.error('Error loading cache:', error.message);
    return {};
  }
}

// Save cache to file
async function saveCache(cache) {
  try {
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
    console.log(`✓ Saved ${Object.keys(cache).length} entries to cache`);
  } catch (error) {
    console.error('Error saving cache:', error.message);
    throw error;
  }
}

// Read munro routes from JSONL file
async function readMunroRoutes() {
  const munros = [];
  const fileStream = createReadStream(INPUT_FILE);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.trim()) {
      try {
        const munro = JSON.parse(line);
        munros.push(munro);
      } catch (error) {
        console.error(`Error parsing line: ${line}`, error.message);
      }
    }
  }

  console.log(`✓ Read ${munros.length} munros from ${INPUT_FILE}`);
  return munros;
}

// Extract unique startName values
function extractUniqueStartNames(munros) {
  const uniqueNames = new Set();
  let totalRoutes = 0;

  for (const munro of munros) {
    for (const route of munro.routes) {
      totalRoutes++;
      uniqueNames.add(route.startName);
    }
  }

  console.log(`✓ Found ${uniqueNames.size} unique locations out of ${totalRoutes} total routes`);
  return { uniqueNames: Array.from(uniqueNames), totalRoutes };
}

// Simplify location using Claude API
async function simplifyLocation(startName, retryCount = 0) {
  const prompt = `Simplify this hiking route starting location to a minimal label for a map (1-6 words, sentence case).

Rule: If there is a specific location term (e.g., track name, building name), do not include more general location terms (e.g., glen name, area name).

Examples:
"Small parking layby just north of summit of Lairig an Lochain": {"label": "Layby", "confidence": 5}
"Car park (charge - app only) off A85 in Glen Lochy": {"label": "Car park", "confidence": 5}
"Parking by track junction at NN252793 beyond Corriechoille": {"label": "Track junction", "confidence": 5}
"Inverey village": {"label": "Inverey", "confidence": 5}
"Corrour railway station (train only - no access by road)": {"label": "Corrour station", "confidence": 5}
"Start of Coishavachan track, Glen Lednock": {"label": "Coishavachan track", "confidence": 5}

Location: ${startName}

Return JSON: {"label": "...", "confidence": 1-5}`;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt
        },
        {
          role: 'assistant',
          content: '{'
        }
      ]
    });

    // Extract text from response and prepend the prefilled '{'
    const responseText = '{' + message.content[0].text;

    // Parse JSON response
    const result = JSON.parse(responseText);

    // Validate response structure
    if (!result.label || typeof result.confidence !== 'number') {
      throw new Error('Invalid response structure');
    }

    if (result.confidence < 1 || result.confidence > 5) {
      throw new Error('Confidence must be between 1 and 5');
    }

    return {
      label: result.label,
      confidence: result.confidence,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    // Handle rate limiting (429)
    if (error.status === 429 && retryCount < MAX_RETRIES) {
      const backoffDelay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      console.log(`  Rate limited, retrying in ${backoffDelay}ms...`);
      await sleep(backoffDelay);
      return simplifyLocation(startName, retryCount + 1);
    }

    // Handle other errors with retry
    if (retryCount < MAX_RETRIES) {
      const backoffDelay = Math.pow(2, retryCount) * 1000;
      console.log(`  Error (${error.message}), retrying in ${backoffDelay}ms...`);
      await sleep(backoffDelay);
      return simplifyLocation(startName, retryCount + 1);
    }

    // Max retries exceeded
    console.error(`  Failed to process "${startName}": ${error.message}`);
    return null;
  }
}

// Process all unique locations
async function processLocations(cache, uniqueNames) {
  const results = {};
  let cacheHits = 0;
  let apiCalls = 0;
  let failures = 0;

  for (let i = 0; i < uniqueNames.length; i++) {
    const startName = uniqueNames[i];

    // Check cache first
    if (cache[startName]) {
      results[startName] = cache[startName];
      cacheHits++;

      // Progress reporting every 10 locations
      if ((i + 1) % 10 === 0) {
        console.log(`[${i + 1}/${uniqueNames.length}] Processed (${cacheHits} cache hits, ${apiCalls} API calls, ${failures} failures)`);
      }
      continue;
    }

    // Call API
    console.log(`[${i + 1}/${uniqueNames.length}] Processing: "${startName}"`);
    const result = await simplifyLocation(startName);

    if (result) {
      results[startName] = result;
      cache[startName] = result; // Update cache
      apiCalls++;
      console.log(`  → "${result.label}" (confidence: ${result.confidence})`);
    } else {
      failures++;
    }

    // Rate limiting delay (only after API calls)
    if (i < uniqueNames.length - 1) {
      await sleep(RATE_LIMIT_DELAY);
    }

    // Progress reporting every 10 locations
    if ((i + 1) % 10 === 0) {
      console.log(`[${i + 1}/${uniqueNames.length}] Processed (${cacheHits} cache hits, ${apiCalls} API calls, ${failures} failures)`);
    }
  }

  console.log(`✓ Processing complete: ${cacheHits} cache hits, ${apiCalls} API calls, ${failures} failures`);
  return { results, cacheHits, apiCalls, failures };
}

// Deduplicate nearby starts
function deduplicateStarts(starts) {
  const SAME_NAME_DISTANCE = 200; // meters - merge same name locations within this distance
  const DIFF_NAME_DISTANCE = 50;  // meters - merge different name locations within this distance
  const mergedIndices = new Set(); // Track which indices have been merged
  const deduplicatedStarts = [];
  let mergeCount = 0;

  for (let i = 0; i < starts.length; i++) {
    if (mergedIndices.has(i)) continue;

    let currentStart = starts[i];
    const mergedRoutes = new Map();

    // Add this start's routes
    for (const route of currentStart.routes) {
      const key = `${route.name}::${route.page}`;
      mergedRoutes.set(key, route);
    }

    // Check for nearby duplicates
    for (let j = i + 1; j < starts.length; j++) {
      if (mergedIndices.has(j)) continue;

      const start2 = starts[j];
      const distance = haversineDistance(
        currentStart.lngLat[1], currentStart.lngLat[0],
        start2.lngLat[1], start2.lngLat[0]
      );

      // Check if we should merge these two starts
      const baseName1 = currentStart.id.replace(/-\d+$/, '');
      const baseName2 = start2.id.replace(/-\d+$/, '');
      const sameName = baseName1 === baseName2;

      const shouldMerge =
        (sameName && distance <= SAME_NAME_DISTANCE) ||
        (!sameName && distance <= DIFF_NAME_DISTANCE);

      if (shouldMerge) {
        console.log(`  Merging "${currentStart.id}" and "${start2.id}" (${distance.toFixed(1)}m apart, ${sameName ? 'same' : 'different'} name)`);
        mergeCount++;
        mergedIndices.add(j);

        // For different names, keep the longer one
        if (!sameName && start2.name.length > currentStart.name.length) {
          console.log(`    → Keeping longer name: "${start2.name}" instead of "${currentStart.name}"`);
          currentStart = {
            ...currentStart,
            id: start2.id,
            name: start2.name,
            description: start2.description
          };
        }

        // Merge routes from start2
        for (const route of start2.routes) {
          const key = `${route.name}::${route.page}`;
          if (!mergedRoutes.has(key)) {
            mergedRoutes.set(key, route);
          }
        }
      }
    }

    // Create the deduplicated start
    deduplicatedStarts.push({
      id: currentStart.id,
      name: currentStart.name,
      description: currentStart.description,
      lngLat: currentStart.lngLat,
      routes: Array.from(mergedRoutes.values())
    });
  }

  console.log(`✓ Deduplicated starts: ${starts.length} → ${deduplicatedStarts.length} (merged ${mergeCount} duplicates)`);
  return deduplicatedStarts;
}

// Build targets JSON structure - organized by start location
function buildTargetsJson(munros, locationMap, stats) {
  const CONFIDENCE_THRESHOLD = 3; // Warn if confidence is below this

  // Group routes by start location coordinates
  const startLocationMap = new Map();
  let lowConfidenceCount = 0;

  // Process each munro and its routes
  for (const munro of munros) {
    for (const route of munro.routes) {
      // Use coordinates as the key since they uniquely identify a physical location
      const locationKey = `${route.startLngLat[0]},${route.startLngLat[1]}`;

      // Initialize start location if not exists
      if (!startLocationMap.has(locationKey)) {
        const location = locationMap[route.startName];

        // Determine name based on confidence
        let name;
        if (location && location.confidence >= CONFIDENCE_THRESHOLD) {
          name = location.label;
        } else {
          // Use original name if confidence is too low or location failed
          name = route.startName;
          if (location && location.confidence < CONFIDENCE_THRESHOLD) {
            console.log(`  ⚠ Low confidence (${location.confidence}) for "${route.startName}", using original`);
            lowConfidenceCount++;
          }
        }

        startLocationMap.set(locationKey, {
          name: name,
          description: route.startName,
          lngLat: route.startLngLat,
          routes: new Map() // Map of route name -> route info
        });
      }

      const startLoc = startLocationMap.get(locationKey);

      // Add or update route
      if (!startLoc.routes.has(route.name)) {
        startLoc.routes.set(route.name, {
          name: route.name,
          page: route.page,
          stats: parseStats(route.stats),
          munros: []
        });
      }

      // Add munro to this route
      startLoc.routes.get(route.name).munros.push({
        number: munro.number,
        name: munro.name,
        page: munro.page
      });
    }
  }

  // Convert to array format with unique IDs
  const usedIds = new Set();
  let starts = Array.from(startLocationMap.values()).map(loc => ({
    id: generateUniqueId(loc.name, usedIds),
    name: loc.name,
    description: loc.description,
    lngLat: loc.lngLat,
    routes: Array.from(loc.routes.values())
  }));

  // Deduplicate nearby starts with the same base name
  console.log('\nDeduplicating starts...');
  starts = deduplicateStarts(starts);

  // Count total unique routes
  const totalUniqueRoutes = starts.reduce((sum, start) => sum + start.routes.length, 0);

  return {
    metadata: {
      processedAt: new Date().toISOString(),
      totalStarts: starts.length,
      totalUniqueRoutes: totalUniqueRoutes,
      totalMunros: munros.length,
      lowConfidenceCount: lowConfidenceCount,
      cacheHits: stats.cacheHits,
      apiCalls: stats.apiCalls,
      failures: stats.failures
    },
    starts: starts
  };
}

// Main function
async function main() {
  try {
    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('Error: ANTHROPIC_API_KEY environment variable is not set');
      console.error('Please set it with: export ANTHROPIC_API_KEY=sk-...');
      process.exit(1);
    }

    // Check for preview mode
    const isPreview = process.argv.includes('--preview');
    if (isPreview) {
      console.log('Running in PREVIEW mode (processing only 2 routes)\n');
    } else {
      console.log('Starting postprocessing...\n');
    }

    // 1. Initialize
    await initializeDirs();
    const cache = await loadCache();

    // 2. Read input
    let munros = await readMunroRoutes();

    // In preview mode, limit to routes that will give us 2 total routes
    if (isPreview) {
      let routeCount = 0;
      const limitedMunros = [];

      for (const munro of munros) {
        if (routeCount >= 2) break;

        const remainingRoutes = 2 - routeCount;
        const munroRoutes = munro.routes.slice(0, remainingRoutes);

        if (munroRoutes.length > 0) {
          limitedMunros.push({
            ...munro,
            routes: munroRoutes
          });
          routeCount += munroRoutes.length;
        }
      }

      munros = limitedMunros;
      console.log(`Preview mode: Limited to ${routeCount} routes from ${limitedMunros.length} munros\n`);
    }

    // 3. Extract unique locations
    const { uniqueNames, totalRoutes } = extractUniqueStartNames(munros);

    // 4. Process locations
    console.log('\nProcessing locations...');
    const { results, cacheHits, apiCalls, failures } = await processLocations(cache, uniqueNames);

    // 5. Save cache
    console.log('\nSaving cache...');
    await saveCache(cache);

    // 6. Build and save output
    console.log('Building output...');
    const targets = buildTargetsJson(munros, results, {
      totalRoutes,
      uniqueLocations: uniqueNames.length,
      cacheHits,
      apiCalls,
      failures
    });

    if (isPreview) {
      console.log('\n--- Preview Output ---');
      console.log(JSON.stringify(targets, null, 2));
      console.log('--- End Preview ---\n');
    } else {
      await fs.writeFile(OUTPUT_FILE, JSON.stringify(targets, null, 2));
      console.log(`✓ Saved output to ${OUTPUT_FILE}`);
    }

    console.log('\n✓ Postprocessing complete!');
    console.log(`\nSummary:`);
    console.log(`  - Starts: ${targets.metadata.totalStarts}`);
    console.log(`  - Unique routes: ${targets.metadata.totalUniqueRoutes}`);
    console.log(`  - Munros: ${munros.length}`);
    console.log(`  - Low confidence labels: ${targets.metadata.lowConfidenceCount}`);
    console.log(`  - Cache hits: ${cacheHits}`);
    console.log(`  - API calls: ${apiCalls}`);
    console.log(`  - Failures: ${failures}`);

  } catch (error) {
    console.error('\nFatal error:', error.message);
    process.exit(1);
  }
}

// Run main function
main();
