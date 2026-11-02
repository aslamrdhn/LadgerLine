import { StateStorage } from "zustand/middleware";
import { get, set, del } from "idb-keyval";

const LEGACY_KEYS = ["aslam-pos-data-storage", "aslam-ledger-storage"];

/**
 * Enterprise IndexedDB Storage Adapter for Zustand
 * - Eliminates the 5MB localStorage QuotaExceededError bottleneck.
 * - Automatically migrates any existing state from legacy localStorage keys on first load.
 */
export const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const value = await get<string>(name);
      if (value) {
        return value;
      }

      // Seamless one-time migration from legacy localStorage if IndexedDB is empty
      if (typeof window !== "undefined" && window.localStorage) {
        for (const key of [name, ...LEGACY_KEYS]) {
          const legacyVal = window.localStorage.getItem(key);
          if (legacyVal) {
            await set(name, legacyVal);
            return legacyVal;
          }
        }
      }
      return null;
    } catch (err) {
      console.warn("[IDBStorage] Fallback to localStorage read:", err);
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(name);
      }
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await set(name, value);
    } catch (err) {
      console.warn("[IDBStorage] Write error:", err);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await del(name);
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(name);
      }
    } catch (err) {
      console.warn("[IDBStorage] Remove error:", err);
    }
  },
};
