import { decodeFig } from './decode.ts';
import { convertFig } from './convert.ts';
export type { FigImportResult, FigImportReport } from './convert.ts';
export function importFig(bytes: Uint8Array, name: string) {
  return convertFig(decodeFig(bytes), name);
}
