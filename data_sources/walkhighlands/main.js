import {chromium} from "patchright";
import {parse} from "csv-parse/sync";
import AdmZip from "adm-zip";

const DOBIH_CSV_ZIP = "https://www.hill-bagging.co.uk/dobih-downloads/hillcsv.zip"
const WH_MATCH_CSV = "https://raw.githubusercontent.com/dzfranklin/match-dobih-walkhighlands/refs/heads/main/dobih_walkhighlands_matches.csv";

const ctx = await chromium.launchPersistentContext("", {
    channel: "chrome",
    headless: false,
    viewport: null,
});
const page = await ctx.newPage();

const dobihZipResponse = await fetch(DOBIH_CSV_ZIP);
const dobihZipBuffer = Buffer.from(await dobihZipResponse.arrayBuffer());
const dobihZip = new AdmZip(dobihZipBuffer);
const dobihCsvEntry = dobihZip.getEntries().find(entry => entry.entryName.endsWith('.csv'));
const dobihCsvContent = dobihCsvEntry.getData().toString('utf8');
const dobihRecords = parse(dobihCsvContent, {columns: true, skip_empty_lines: true});

const munros = dobihRecords.filter(record => {
    if (!record.Classification) return false;
    const classifications = record.Classification.split(',').map(c => c.trim());
    return classifications.includes('M');
});

const whMatchResponse = await fetch(WH_MATCH_CSV);
const whMatchContent = await whMatchResponse.text();
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

async function scrapeMunro(munro) {
    await navigateDelay();
    await page.goto(munro.page, {waitUntil: "domcontentloaded"});

    const routes = await page.locator("h2:text('Detailed route description')").evaluate(el => {
        const out = [];
        while ((el = el.nextElementSibling).tagName !== "H3") {
            for (const linkEl of el.querySelectorAll("a")) {
                const page = linkEl.href;
                const name = linkEl.textContent;
                out.push({page, name});
            }
        }
        return out;
    });

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

    await navigateDelay();
    await page.goto(route.page, {waitUntil: "domcontentloaded"});

    const startInfo = await page.locator("h2:text('Start') + p").evaluate(el => {
        const mapsLink = el.querySelector('a[href*="google.com/maps/search/"]').getAttribute("href");
        const match = mapsLink.match(/maps\/search\/([-\d.]+),([-\d.]+)/);
        const startLngLat = [parseFloat(match[2]),  parseFloat(match[1])];

        el.querySelector(".noprint").remove();

        const startName = el.textContent.trim().replace(/\.$/, '');

        return {startLngLat, startName};
    });
    Object.assign(route, startInfo);

    routeCache.set(cacheKey, route);
    return route;
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

await ctx.close();
