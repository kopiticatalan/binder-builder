import { del, get, set } from "idb-keyval";
import type { AccentId, Matter } from "./types";

export interface PersistedState {
  matters: Matter[];
  activeId: string | null;
  accent: AccentId;
}

const STATE_KEY = "bb-state-v1";
const bytesKey = (id: string) => `bb-bytes:${id}`;

const mem = new Map<string, ArrayBuffer>();

export async function loadState(): Promise<PersistedState | null> {
  try {
    const v = await get<PersistedState>(STATE_KEY);
    return v ?? null;
  } catch {
    return null;
  }
}

export async function saveState(state: PersistedState): Promise<void> {
  try {
    await set(STATE_KEY, state);
  } catch (err) {
    console.warn("[binder] persist failed", err);
  }
}

export async function saveBytes(id: string, buf: ArrayBuffer): Promise<void> {
  mem.set(id, buf);
  try {
    await set(bytesKey(id), buf);
  } catch (err) {
    console.warn("[binder] bytes persist failed", err);
  }
}

export async function loadBytes(id: string): Promise<ArrayBuffer | undefined> {
  const hit = mem.get(id);
  if (hit) return hit;
  try {
    const buf = await get<ArrayBuffer>(bytesKey(id));
    if (buf) mem.set(id, buf);
    return buf;
  } catch {
    return undefined;
  }
}

export async function deleteBytes(id: string): Promise<void> {
  mem.delete(id);
  try {
    await del(bytesKey(id));
  } catch {
    /* ignore */
  }
}

export function cacheBytes(id: string, buf: ArrayBuffer) {
  mem.set(id, buf);
}
