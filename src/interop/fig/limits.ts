/** Conservative limits for the experimental native reader, independent of the editor model. */
export const FIG_LIMITS = {
  file: 100 * 1024 * 1024,
  canvas: 64 * 1024 * 1024,
  schema: 2 * 1024 * 1024,
  message: 64 * 1024 * 1024,
  archive: 128 * 1024 * 1024,
  entries: 1024,
  nodes: 10000,
  depth: 128,
  values: 2_000_000,
  array: 100000,
  string: 1024 * 1024,
  timeout: 15000,
} as const;
export function figError(message: string): never {
  throw new Error('Cannot import .fig: ' + message);
}
