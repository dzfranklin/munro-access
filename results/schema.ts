import * as z from "zod";

export const lngLatSchema = z.tuple([z.number(), z.number()]);

export const startSchema = z.object({
  id: z.string(),
  name: z.string(),
  lngLat: lngLatSchema,
  radius: z.number(),
});
export type Start = z.infer<typeof startSchema>;

export const startsSchema = z.array(startSchema);

export const routeMunroSchema = z.object({
  number: z.number(),
  name: z.string(),
  page: z.url(),
});

export type RouteMunro = z.infer<typeof routeMunroSchema>;

export interface Munro extends RouteMunro {
  slug: string;
}

export const routeSchema = z.object({
  name: z.string(),
  page: z.url(),
  stats: z.object({
    distanceKm: z.number(),
    timeHours: z.object({
      min: z.number(),
      max: z.number(),
    }),
    ascentM: z.number(),
  }),
  munros: z.array(routeMunroSchema),
});

export type Route = z.infer<typeof routeSchema>;

export const targetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  lngLat: lngLatSchema,
  routes: z.array(routeSchema),
});

export type Target = z.infer<typeof targetSchema>;

export const targetsWrapperSchema = z.object({
  starts: z.array(targetSchema),
});

const placeSchema = z.object({
  name: z.string(),
  lngLat: lngLatSchema,
});

const modeSchema = z.enum([
  "BICYCLE",
  "BUS",
  "COACH",
  "FERRY",
  "RAIL",
  "TRAM",
  "WALK",
]);

export type Mode = z.infer<typeof modeSchema>;

export const legSchema = z.object({
  from: placeSchema,
  to: placeSchema,
  interlineWithPreviousLeg: z.boolean(),
  startTime: z.iso.time(),
  endTime: z.iso.time(),
  mode: modeSchema,
  agencyName: z.string().optional(),
  routeName: z.string().optional(),
});

export const itinerarySchema = z.object({
  date: z.string(), // Format: "YYYY-MM-DD"
  startTime: z.string(),
  endTime: z.string(),
  modes: z.array(modeSchema),
  legs: z.array(legSchema),
});

// Enhanced runtime type with parsed numeric values
export interface Itinerary extends z.infer<typeof itinerarySchema> {
  // Numeric representations for fast computation
  startTimeHours: number;  // e.g., 9.5 for "09:30:00"
  endTimeHours: number;    // e.g., 11.75 for "11:45:00"
  isOvernight: boolean;    // true if journey crosses midnight
  dateMs: number;          // milliseconds since epoch for date comparison
}

export const dayItinerariesSchema = z.object({
  outbounds: z.array(itinerarySchema),
  returns: z.array(itinerarySchema),
});

export const resultSchema = z.object({
  start: z.string(),
  target: z.string(),
  itineraries: z.object({
    WEDNESDAY: dayItinerariesSchema,
    FRIDAY: dayItinerariesSchema,
    SATURDAY: dayItinerariesSchema,
    SUNDAY: dayItinerariesSchema,
  }),
});

// Base schema type (before enhancement)
export type ResultFromSchema = z.infer<typeof resultSchema>;

// Enhanced Result type with enhanced itineraries
export interface Result {
  start: string;
  target: string;
  itineraries: {
    WEDNESDAY: { outbounds: Itinerary[]; returns: Itinerary[] };
    FRIDAY: { outbounds: Itinerary[]; returns: Itinerary[] };
    SATURDAY: { outbounds: Itinerary[]; returns: Itinerary[] };
    SUNDAY: { outbounds: Itinerary[]; returns: Itinerary[] };
  };
}

export function resultID(start: string, target: string): string;
export function resultID(result: Result): string;
export function resultID(
  startOrResult: string | Result,
  target?: string
): string {
  if (typeof startOrResult === "string" && typeof target === "string") {
    return startOrResult + ":" + target;
  } else if (typeof startOrResult === "object") {
    return resultID(startOrResult.start, startOrResult.target);
  } else {
    throw new Error("bad argument");
  }
}
