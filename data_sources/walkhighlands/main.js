import {chromium} from "patchright";
import {parse} from "csv-parse/sync";
import AdmZip from "adm-zip";
import {mkdir, readFile, writeFile} from "fs/promises";
import {createHash} from "crypto";
import {existsSync} from "fs";
import {load} from "cheerio";

const DOBIH_CSV_ZIP = "https://www.hill-bagging.co.uk/dobih-downloads/hillcsv.zip"
const WH_MATCH_CSV = "https://raw.githubusercontent.com/dzfranklin/match-dobih-walkhighlands/refs/heads/main/dobih_walkhighlands_matches.csv";
const CACHE_DIR = "./out/cache";
const PAGE_CACHE_DIR = CACHE_DIR+"/page";

// Ensure cache directory exists
if (!existsSync(PAGE_CACHE_DIR)) {
    await mkdir(PAGE_CACHE_DIR, {recursive: true});
}

let ctx = null;
let page = null;

async function ensureBrowser() {
    if (!ctx) {
        ctx = await chromium.launchPersistentContext("", {
            channel: "chrome",
            headless: false,
            viewport: null,
        });
        page = await ctx.newPage();
    }
    return page;
}

// Cache DOBIH CSV
const dobihCacheFile = `${CACHE_DIR}/dobih.zip`;
let dobihZipBuffer;
if (existsSync(dobihCacheFile)) {
    dobihZipBuffer = await readFile(dobihCacheFile);
} else {
    const dobihZipResponse = await fetch(DOBIH_CSV_ZIP);
    dobihZipBuffer = Buffer.from(await dobihZipResponse.arrayBuffer());
    await writeFile(dobihCacheFile, dobihZipBuffer);
}
const dobihZip = new AdmZip(dobihZipBuffer);
const dobihCsvEntry = dobihZip.getEntries().find(entry => entry.entryName.endsWith('.csv'));
const dobihCsvContent = dobihCsvEntry.getData().toString('utf8');
const dobihRecords = parse(dobihCsvContent, {columns: true, skip_empty_lines: true});

const munros = dobihRecords.filter(record => {
    if (!record.Classification) return false;
    const classifications = record.Classification.split(',').map(c => c.trim());
    return classifications.includes('M');
});

// Cache WH Match CSV
const whMatchCacheFile = `${CACHE_DIR}/wh_match.csv`;
let whMatchContent;
if (existsSync(whMatchCacheFile)) {
    whMatchContent = await readFile(whMatchCacheFile, 'utf-8');
} else {
    const whMatchResponse = await fetch(WH_MATCH_CSV);
    whMatchContent = await whMatchResponse.text();
    await writeFile(whMatchCacheFile, whMatchContent, 'utf-8');
}
const whMatchRecords = parse(whMatchContent, {columns: true, skip_empty_lines: true});

const whMatchMap = new Map();
for (const record of whMatchRecords) {
    whMatchMap.set(record.Number, record.Walkhighlands);
}

let munroList = [];
for (const munro of munros) {
    const whUrl = whMatchMap.get(munro.Number);
    if (whUrl) {
        munroList.push({
            number: parseInt(munro.Number),
            page: whUrl,
            name: munro.Name
        });
    }
}
if (munroList.length === 0) {
    console.error("ERROR: munroList is empty");
    process.exit(1);
}

function pageCacheFile(url) {
    const hash = createHash('md5').update(url).digest('hex');
    return `${PAGE_CACHE_DIR}/${hash}.html`;
}

async function fetchHtml(url) {
    const cacheFile = pageCacheFile(url);

    if (existsSync(cacheFile)) {
        return await readFile(cacheFile, 'utf-8');
    } else {
        const page = await ensureBrowser();
        await navigateDelay();
        await page.goto(url, {waitUntil: "domcontentloaded"});
        const html = await page.content();
        await writeFile(cacheFile, html, 'utf-8');
        return html;
    }
}

async function scrapeMunro(munro) {
    const html = await fetchHtml(munro.page);
    const $ = load(html);

    const routes = [];
    const routeHeader = $('h2:contains("Detailed route description")');
    let el = routeHeader.next();
    while (el.length && el.prop('tagName') !== 'H3') {
        el.find('a').each((_, linkEl) => {
            const href = $(linkEl).attr('href');
            const page = new URL(href, munro.page).href;
            const name = $(linkEl).text();
            routes.push({page, name});
        });
        el = el.next();
    }

    for (let i = 0; i < routes.length; i++) {
        routes[i] = await scrapeRoute(routes[i]);
    }

    return {...munro, routes};
}

const routeCache = new Map();

async function scrapeRoute(route) {
    const cacheKey = route.page;
    if (routeCache.has(cacheKey)) {
        return routeCache.get(cacheKey);
    }

    const html = await fetchHtml(route.page);
    const $ = load(html);

    const startP = $('h2:contains("Start")').next('p');
    const mapsLink = startP.find('a[href*="google.com/maps/search/"]').attr('href');
    const match = mapsLink.match(/maps\/search\/([-\d.]+),([-\d.]+)/);
    const startLngLat = [parseFloat(match[2]), parseFloat(match[1])];

    startP.find('.noprint').remove();
    const startName = startP.text().trim().replace(/\.$/, '');

    // Parse walk statistics
    const stats = {};
    const statsDl = $('h2:contains("Walk Statistics")').next('dl');
    statsDl.find('dt').each((_, dt) => {
        const key = $(dt).text().trim();
        const value = $(dt).next('dd').text().trim();
        stats[key] = value;
    });

    const result = {...route, startLngLat, startName, stats};
    routeCache.set(cacheKey, result);
    return result;
}

function navigateDelay() {
    const delaySecs = 5 + Math.random() * 10;
    return new Promise(resolve => setTimeout(() => resolve(), delaySecs * 1_000));
}

if (process.argv[2] === "--preview") {
    munroList = munroList.filter(m => [519, 521].includes(m.number));
}

const out = [];
for (const munro of munroList) {
    const scrapedMunro = await scrapeMunro(munro);
    console.log(JSON.stringify(scrapedMunro));
    out.push(scrapedMunro);
}

if (ctx) {
    await ctx.close();
}
