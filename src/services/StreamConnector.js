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

  /**
   * Resolves the active backend base URL.
   * Priority:
   * 1. URL Query Parameter (?backend=https://...)
   * 2. Stored custom backend in localStorage
   * 3. Default configured origin
   * @returns {string}
   */
  getBaseUrl() {
    const params = new URLSearchParams(window.location.search);
    const queryBackend = params.get('backend');

    if (queryBackend) {
      const sanitized = queryBackend.replace(/\/+$/, '');
      this.storage.set(AppConfig.storageKeys.customBackendUrl, sanitized);
      return sanitized;
    }

    const storedBackend = this.storage.get(AppConfig.storageKeys.customBackendUrl);
    if (storedBackend) {
      return storedBackend.replace(/\/+$/, '');
    }

    return AppConfig.api.defaultBaseUrl;
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
