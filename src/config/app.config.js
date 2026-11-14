/**
 * Centralized Application Configuration
 * Single Source of Truth for runtime parameters and API endpoints.
 */
export const AppConfig = {
  app: {
    name: 'Personal Media Hub',
    version: '1.2.0',
    description: 'Minimalist, high-performance Netflix-style streaming client'
  },
  api: {
    /**
     * Default backend base URL.
     * When hosted on the same origin (e.g., Nginx), empty string uses relative paths.
     * Can be dynamically overridden via query string `?backend=https://...` or Storage.
     */
    defaultBaseUrl: 'https://featured-exceed-taste-take.trycloudflare.com',
    endpoints: {
      videosIndex: '/videos/'
    },
    series: [
      {
        id: 'one-pace',
        name: 'One Pace',
        badge: 'Romance Dawn',
        endpoint: '/videos/one-pace/'
      },
      {
        id: 'darling',
        name: 'Darling in the Franxx',
        badge: 'Temporada 1',
        endpoint: '/videos/darling/'
      }
    ],
    timeoutMs: 8000
  },
  player: {
    minPlaybackResumeSeconds: 3,
    saveProgressIntervalMs: 3000,
    supportedExtensions: ['mp4', 'webm', 'mkv', 'm4v']
  },
  storageKeys: {
    lastPlayedItem: 'pmh_last_played_item',
    itemProgressPrefix: 'pmh_progress_',
    customBackendUrl: 'pmh_custom_backend_url'
  }
};
