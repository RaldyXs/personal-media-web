import { IStorageProvider } from '../contracts/IStorage.js';

/**
 * StorageService
 * Concrete implementation of IStorageProvider using Web Storage API (LocalStorage).
 * Adheres to SRP: Handles solely key-value persistence.
 */
export class StorageService extends IStorageProvider {
  constructor(storage = window.localStorage) {
    super();
    this.storage = storage;
  }

  get(key) {
    try {
      return this.storage.getItem(key);
    } catch (e) {
      console.warn(`[StorageService] Failed to read key: ${key}`, e);
      return null;
    }
  }

  set(key, value) {
    try {
      this.storage.setItem(key, String(value));
    } catch (e) {
      console.warn(`[StorageService] Failed to write key: ${key}`, e);
    }
  }

  remove(key) {
    try {
      this.storage.removeItem(key);
    } catch (e) {
      console.warn(`[StorageService] Failed to remove key: ${key}`, e);
    }
  }

  getNumber(key, defaultValue = 0) {
    const val = this.get(key);
    if (val === null) return defaultValue;
    const num = parseFloat(val);
    return isNaN(num) ? defaultValue : num;
  }
}
