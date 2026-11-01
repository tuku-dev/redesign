import type { FigImportResult } from './fig/import.ts';
import type { FigWorkerResponse } from './fig/worker.ts';
import { FIG_LIMITS, figError } from './fig/limits.ts';

/** Isolate parsing from editor input, and terminate on success, failure or timeout. */
export async function readFigFile(file: File, name: string): Promise<FigImportResult> {
  if (file.size > FIG_LIMITS.file) figError('file exceeds the 100 MB limit.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./fig/worker.ts', import.meta.url), { type: 'module' });
    const finish = (result?: FigImportResult, error?: Error) => {
      clearTimeout(timer);
      worker.terminate();
      if (result) resolve(result);
      else reject(error);
    };
    const timer = setTimeout(
      () =>
        finish(
          undefined,
          new Error('Cannot import .fig: parsing exceeded 15 seconds. Try a smaller document.'),
        ),
      FIG_LIMITS.timeout,
    );
    worker.onmessage = (event: MessageEvent<FigWorkerResponse>) => {
      if ('error' in event.data) finish(undefined, new Error(event.data.error));
      else finish(event.data.result);
    };
    worker.onerror = () =>
      finish(undefined, new Error('Cannot import .fig: the import worker failed.'));
    worker.onmessageerror = () =>
      finish(undefined, new Error('Cannot import .fig: invalid worker response.'));
    try {
      worker.postMessage({ bytes, name }, [bytes.buffer]);
    } catch (error) {
      finish(undefined, error instanceof Error ? error : new Error('Cannot start .fig import.'));
    }
  });
}
