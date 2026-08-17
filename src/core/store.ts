/**
 * Abstract storage layer — Store<T> (v0.57).
 *
 * Single interface for Orion file stores (economy, lessons).
 * Implementations: fileStore (JSON array), jsonlStore (JSONL + O_APPEND),
 * memoryStore (for tests).
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  renameSync,
} from "node:fs";

/** Generic persistent store. cap keeps the last `max` entries (after optional sort ascending). */
export interface Store<T> {
  load(): T[];
  append(entry: T): void;
  replace(entries: T[]): void;
  /** Trim to max entries, keeping the LAST ones (highest score after ascending sort). */
  cap(max: number, sortBy?: (a: T, b: T) => number): void;
}

/** File-system store backed by a JSON array file. */
export function fileStore<T>(path: string): Store<T> {
  function read(): T[] {
    try {
      if (!existsSync(path)) return [];
      const raw = JSON.parse(readFileSync(path, "utf8"));
      return Array.isArray(raw) ? (raw as T[]) : [];
    } catch {
      return [];
    }
  }
  function write(rows: T[]): void {
    writeFileSync(path, JSON.stringify(rows), "utf8");
  }
  return {
    load: read,
    append(entry) {
      const rows = read();
      rows.push(entry);
      write(rows);
    },
    replace: write,
    cap(max, sortBy) {
      let rows = read();
      if (sortBy) rows.sort(sortBy);
      if (rows.length > max) rows = rows.slice(-max);
      write(rows);
    },
  };
}

/** JSONL store — append-only via O_APPEND, no read-modify-write. */
export function jsonlStore<T>(path: string): Store<T> {
  return {
    load(): T[] {
      try {
        if (!existsSync(path)) return [];
        const rows: T[] = [];
        for (const raw of readFileSync(path, "utf8").split("\n")) {
          const trimmed = raw.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed === "object") rows.push(parsed as T);
          } catch {
            /* skip corrupt */
          }
        }
        return rows;
      } catch {
        return [];
      }
    },
    append(entry: T): void {
      try {
        appendFileSync(path, JSON.stringify(entry) + "\n", "utf8");
      } catch {
        /* best effort */
      }
    },
    replace(entries: T[]): void {
      try {
        const text = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
        const tmp = path + "." + process.pid + ".tmp";
        writeFileSync(tmp, text, "utf8");
        renameSync(tmp, path);
      } catch {
        /* best effort */
      }
    },
    cap(max: number, sortBy?: (a: T, b: T) => number): void {
      try {
        let rows = this.load();
        if (sortBy) rows.sort(sortBy);
        if (rows.length > max) rows = rows.slice(-max);
        this.replace(rows);
      } catch {
        /* best effort */
      }
    },
  };
}

/** In-memory store for tests (never touches disk). */
export function memoryStore<T>(): Store<T> {
  const buf: T[] = [];
  return {
    load: () => [...buf],
    append: (e) => buf.push(e),
    replace: (es) => {
      buf.length = 0;
      buf.push(...es);
    },
    cap: (max, sortBy) => {
      if (sortBy) buf.sort(sortBy);
      if (buf.length > max) buf.splice(0, buf.length - max);
    },
  };
}
