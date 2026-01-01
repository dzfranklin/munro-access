import fs from "node:fs";
import {
  resultID,
  resultSchema,
  startsSchema,
  targetsWrapperSchema,
  type Itinerary,
  type Munro,
  type Result,
  type RouteMunro,
  type Start,
  type Target,
} from "./schema";
import { slugify } from "../app/utils/format";

function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours + minutes / 60;
}

function enhanceItinerary(itin: Omit<Itinerary, 'startTimeHours' | 'endTimeHours' | 'isOvernight' | 'dateMs'>): Itinerary {
  const startTimeHours = parseTime(itin.startTime);
  const endTimeHours = parseTime(itin.endTime);
  const dateMs = new Date(itin.date).getTime();
  const isOvernight = endTimeHours < startTimeHours;
  
  return {
    ...itin,
    startTimeHours,
    endTimeHours,
    isOvernight,
    dateMs,
  };
}

function parseStarts(): Map<string, Start> {
  const contents = fs.readFileSync("starts.json", "utf-8");
  const startList = startsSchema.parse(JSON.parse(contents));
  return new Map(startList.map((s) => [s.id, s]));
}
export const startMap = parseStarts();

function parseTargets(): Map<string, Target> {
  const contents = fs.readFileSync("targets.json", "utf-8");
  const targetsWrapper = targetsWrapperSchema.parse(JSON.parse(contents));
  return new Map(targetsWrapper.starts.map((t) => [t.id, t]));
}
export const targetMap = parseTargets();

function parseMunros(): Map<number, Munro> {
  const routeMunros = new Map<number, RouteMunro>();
  for (const target of targetMap.values()) {
    for (const route of target.routes) {
      for (const munro of route.munros) {
        routeMunros.set(munro.number, munro);
      }
    }
  }

  const out = new Map<number, Munro>();
  for (const rm of routeMunros.values()) {
    const slug = rm.number + "-" + slugify(rm.name);
    const munro = { ...rm, slug };
    out.set(munro.number, munro);
  }
  return out;
}
export const munroMap = parseMunros();

function parseResults(): Map<string, Result> {
  const lines = fs.readFileSync("results.jsonl", "utf-8").split("\n");
  const out = new Map<string, Result>();
  for (const line of lines) {
    if (line.trim() === "") continue;
    const parsed = resultSchema.safeParse(JSON.parse(line));
    if (parsed.error) {
      console.error(parsed.error.message);
      console.error(line);
      throw new Error("parse error");
    }
    
    // Enhance all itineraries with precomputed values
    const result = parsed.data;
    for (const [day, dayItins] of Object.entries(result.itineraries)) {
      result.itineraries[day as keyof typeof result.itineraries] = {
        outbounds: dayItins.outbounds.map(enhanceItinerary),
        returns: dayItins.returns.map(enhanceItinerary),
      };
    }
    
    out.set(resultID(result), result);
  }
  return out;
}
export const resultMap = parseResults();

export function getSampleDates(): string[] {
  const dates = new Set<string>();
  for (const result of resultMap.values()) {
    for (const dayItineraries of Object.values(result.itineraries)) {
      for (const itinerary of dayItineraries.outbounds) {
        dates.add(itinerary.date);
      }
    }
  }
  return Array.from(dates).sort();
}

if (import.meta.main) {
  console.log("Stats\n-------");
  console.log("starts: " + startMap.size);
  console.log("targets: " + targetMap.size);
  console.log("munros: " + munroMap.size);
  console.log("results: " + resultMap.size);

  console.log("\nExamples\n-------");
  console.log("\nstart");
  console.log(startMap.values().next().value);
  console.log("\ntarget");
  console.log(targetMap.values().next().value);
  console.log("\nmunro");
  console.log(munroMap.values().next().value);
  console.log("\nresult");
  console.log(
    Array.from(resultMap.values()).filter(
      (v) => v.itineraries.WEDNESDAY.outbounds.length > 0
    )[0]
  );
}
