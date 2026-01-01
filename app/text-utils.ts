export function pluralize(count: number, singular: string): string {
  if (count === 1) {
    return `${count} ${singular}`;
  }
  return `${count} ${singular}s`;
}
