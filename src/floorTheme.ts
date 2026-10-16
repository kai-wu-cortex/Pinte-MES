export type FloorTheme = 'apple' | 'classic';

export function resolveFloorTheme(value: unknown): FloorTheme {
  // Retire the image-generated dark variant without losing existing preferences.
  return value === 'classic' || value === 'industrial' ? 'classic' : 'apple';
}
