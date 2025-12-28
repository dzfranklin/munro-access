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
  const starts = Array.from(startLocationMap.values()).map(loc => ({
    id: generateUniqueId(loc.name, usedIds),
    name: loc.name,
    description: loc.description,
    lngLat: loc.lngLat,
    routes: Array.from(loc.routes.values())
  }));

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

    await fs.writeFile(OUTPUT_FILE, JSON.stringify(targets, null, 2));
    console.log(`✓ Saved output to ${OUTPUT_FILE}`);

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
