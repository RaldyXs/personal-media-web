import { AppConfig } from '../config/app.config.js';

/**
 * StreamConnector
 * Handles backend endpoint discovery, base URL resolution, and network health checks.
 * SRP: Resolving network topology for media streams.
 */
export class StreamConnector {
  /**
   * @param {import('../contracts/IStorage.js').IStorageProvider} storage
   */
  constructor(storage) {
    this.storage = storage;
  }

  clearCustomBackend() {
    this.storage.remove(AppConfig.storageKeys.customBackendUrl);
  }

  /**
   * Resolves the active backend base URL.
   * Priority:
   * 1. Default configured origin (AppConfig.api.defaultBaseUrl - Single Source of Truth)
   * 2. URL Query Parameter (?forceBackend=... or ?backend=...)
   * 3. Stored custom backend in localStorage
   * @returns {string}
   */
  getBaseUrl() {
    if (AppConfig.api.defaultBaseUrl) {
      return AppConfig.api.defaultBaseUrl.replace(/\/+$/, '');
    }

    const params = new URLSearchParams(window.location.search);
    const queryBackend = params.get('forceBackend') || params.get('backend');

    if (queryBackend) {
      const sanitized = queryBackend.replace(/\/+$/, '');
      this.storage.set(AppConfig.storageKeys.customBackendUrl, sanitized);
      return sanitized;
    }

    const storedBackend = this.storage.get(AppConfig.storageKeys.customBackendUrl);
    if (storedBackend) {
      return storedBackend.replace(/\/+$/, '');
    }

    return '';
  }

  /**
   * Builds an absolute URL for a media asset.
   * @param {string} relativePath
   * @returns {string}
   */
  buildStreamUrl(relativePath) {
    const base = this.getBaseUrl();
    const cleanPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    return base ? `${base}${cleanPath}` : cleanPath;
  }
}
