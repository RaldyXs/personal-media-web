/**
 * Centralized Application Configuration
 * Single Source of Truth for runtime parameters and API endpoints.
 */
export const AppConfig = {
  app: {
    name: 'Anime Stream',
    version: '1.3.4',
    description: 'Minimalist, high-performance streaming client'
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
        episodesCountText: '4 Capítulos',
        endpoint: '/videos/one-pace/',
        coverUrl: './assets/covers/one-pace.jpg?v=1.3.4',
        description: 'La adaptación definitiva y fiel al manga de One Piece.'
      },
      {
        id: 'darling',
        name: 'Darling in the Franxx',
        badge: 'Temporada 1',
        episodesCountText: '10 Capítulos',
        endpoint: '/videos/darling/',
        coverUrl: './assets/covers/darling.jpg?v=1.3.4',
        description: 'En un futuro postapocalíptico, los niños pilotean los mechas Franxx.'
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
    lastSelectedSeries: 'pmh_last_selected_series',
    itemProgressPrefix: 'pmh_progress_',
    customBackendUrl: 'pmh_custom_backend_url'
  }
};
