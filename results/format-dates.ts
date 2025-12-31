/**
 * Format sample dates for display - keep it vague to emphasize patterns
 * rather than specific timetables
 */
export function formatSamplePeriod(dates: string[]): string {
  if (dates.length === 0) return "sample data";

  const start = new Date(dates[0]);
  const end = new Date(dates[dates.length - 1]);

  // If same month/year, just show that
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  // If different months but same year
  if (start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString('en-GB', { month: 'long' })}-${end.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
  }

  // Different years
  return `${start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} - ${end.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
}
