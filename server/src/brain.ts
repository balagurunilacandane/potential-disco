// Server-side brain: the shared BrainCore plus JSON-file persistence.
import fs from 'node:fs';
import path from 'node:path';
import { BrainCore, type BrainData } from '../../shared/brain.ts';

export { HttpError } from '../../shared/brain.ts';

function load(file: string): BrainData | null {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as BrainData;
    if (raw.version === 1) return raw;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`[brain] could not read ${file}, starting fresh:`, (err as Error).message);
    }
  }
  return null;
}

export class Brain extends BrainCore {
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(private file: string) {
    super(load(file));
  }

  protected override changed() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flush();
    }, 500);
  }

  flush() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
}
