import type { Itinerary } from "results/schema";

// Text formatting

export function pluralize(count: number, singular: string): string {
  if (count === 1) {
    return `${count} ${singular}`;
  }
  return `${count} ${singular}s`;
}

export function formatDayLabel(dayCode: string): string {
  return dayCode.charAt(0) + dayCode.slice(1).toLowerCase();
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

// Time formatting

export function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5);
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours + minutes / 60;
}

// Fast version using precomputed values
export function parseTimeFast(itinerary: Itinerary, field: 'start' | 'end'): number {
  return field === 'start' ? itinerary._startTimeHours : itinerary._endTimeHours;
}

// Date formatting and calculations

export function formatSamplePeriod(dates: string[]): string {
  if (dates.length === 0) return "sample data";

  const start = new Date(dates[0]);
  const end = new Date(dates[dates.length - 1]);

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  if (start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString('en-GB', { month: 'long' })}-${end.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
  }

  return `${start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} - ${end.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
}

export function isSameDay(itin1: Itinerary, itin2: Itinerary): boolean {
  return itin1.date === itin2.date;
}

export function isNextDay(outbound: Itinerary, returnItin: Itinerary): boolean {
  const outboundDate = new Date(outbound.date);
  const returnDate = new Date(returnItin.date);
  const nextDay = new Date(outboundDate);
  nextDay.setDate(nextDay.getDate() + 1);

  return nextDay.toISOString().slice(0, 10) === returnDate.toISOString().slice(0, 10);
}

export function getDaysBetween(outbound: Itinerary, returnItin: Itinerary): number {
  const diffMs = returnItin.dateMs - outbound.dateMs;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function calculateDuration(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string
): number {
  const start = new Date(`${startDate}T${startTime}`);
  const end = new Date(`${endDate}T${endTime}`);
  const durationMs = end.getTime() - start.getTime();
  return durationMs / (1000 * 60 * 60);
}

export function isOvernightJourney(itinerary: Itinerary): boolean {
  return itinerary.isOvernight;
}
