/**
 * Centralized Application Configuration
 * Single Source of Truth for runtime parameters and API endpoints.
 */
export const AppConfig = {
  app: {
    name: 'Anime Stream',
    version: '1.4.1',
    description: 'Minimalist, high-performance streaming & manga client'
  },
  api: {
    /**
     * Default backend base URL.
     * When hosted on the same origin (e.g., Nginx), empty string uses relative paths.
     * Can be dynamically overridden via query string `?backend=https://...` or Storage.
     */
    defaultBaseUrl: 'https://planets-gym-postcards-lighter.trycloudflare.com',
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
        coverUrl: './assets/covers/one-pace.jpg?v=1.4.0',
        description: 'La adaptación definitiva y fiel al manga de One Piece.'
      },
      {
        id: 'darling',
        name: 'Darling in the Franxx',
        badge: 'Temporada 1',
        episodesCountText: '10 Capítulos',
        endpoint: '/videos/darling/',
        coverUrl: './assets/covers/darling.jpg?v=1.4.0',
        description: 'En un futuro postapocalíptico, los niños pilotean los mechas Franxx.'
      },
      {
        id: '009-re-cyborg',
        name: '009 Re:Cyborg',
        badge: 'Película',
        episodesCountText: '1 Película',
        endpoint: '/videos/009-re-cyborg/',
        coverUrl: './assets/covers/009-re-cyborg.jpg?v=1.4.0',
        description: 'En un mundo amenazado por atentados globales, los nueve guerreros cyborg son reactivados para salvar a la humanidad.'
      }
    ],
    mangas: [
      {
        id: 'hunter-x-hunter',
        name: 'Hunter x Hunter',
        badge: 'Manga Oficial',
        author: 'Yoshihiro Togashi',
        endpoint: '/videos/mangas/hunter-x-hunter/',
        coverUrl: './assets/covers/hunter-x-hunter.jpg?v=1.4.0',
        description: 'Gon Freecss descubre que su padre está vivo y es un legendario Cazador. Para encontrarlo, emprende un peligroso viaje.'
      }
    ],
    timeoutMs: 8000
  },
  player: {
    minPlaybackResumeSeconds: 3,
    saveProgressIntervalMs: 3000,
    supportedExtensions: ['mp4', 'webm', 'mkv', 'm4v']
  },
  manga: {
    supportedExtensions: ['pdf']
  },
  storageKeys: {
    lastPlayedItem: 'pmh_last_played_item',
    lastSelectedSeries: 'pmh_last_selected_series',
    activeTab: 'pmh_active_tab',
    lastSelectedManga: 'pmh_last_selected_manga',
    mangaMode: 'pmh_manga_mode',
    mangaProgressPrefix: 'pmh_manga_progress_',
    itemProgressPrefix: 'pmh_progress_',
    customBackendUrl: 'pmh_custom_backend_url'
  }
};
