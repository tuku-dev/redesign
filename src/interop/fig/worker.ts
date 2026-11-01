import { importFig } from './import.ts';
import type { FigImportResult } from './import.ts';
interface Request {
  bytes: Uint8Array;
  name: string;
}
export type FigWorkerResponse = { result: FigImportResult } | { error: string };
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage(message: FigWorkerResponse): void;
};
scope.onmessage = (event) => {
  try {
    const result = importFig(event.data.bytes, event.data.name);
    scope.postMessage({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown format error.';
    scope.postMessage({
      error: message.startsWith('Cannot import .fig:')
        ? message
        : 'Cannot import .fig: malformed or unsupported data (' + message + ').',
    });
  }
};
