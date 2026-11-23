import { AppConfig } from './config/app.config.js?v=1.4.1';
import { StorageService } from './services/StorageService.js?v=1.4.1';
import { StreamConnector } from './services/StreamConnector.js?v=1.4.1';
import { MediaRepository } from './services/MediaRepository.js?v=1.4.1';
import { PlayerController } from './controllers/PlayerController.js?v=1.4.1';
import { CatalogController } from './controllers/CatalogController.js?v=1.4.1';
import { MangaReaderController } from './controllers/MangaReaderController.js?v=1.4.1';

/**
 * AppBootstrap
 * Composition root applying Dependency Injection (DIP).
 */
export class AppBootstrap {
  static async init() {
    // 1. Core Services
    const storageService = new StorageService();
    const streamConnector = new StreamConnector(storageService);
    const mediaRepository = new MediaRepository(streamConnector);

    // 2. Video Player DOM Elements
    const videoElement = document.getElementById('media-player');
    const playerError = document.getElementById('player-error');
    const playerLoader = document.getElementById('player-loader');
    const retryBtn = document.getElementById('player-retry-btn');
    const nowTitle = document.getElementById('now-title');
    const nowSubtitle = document.getElementById('now-subtitle');
    const downloadBtn = document.getElementById('download-btn');

    // 3. Navigation & Anime Catalog DOM Elements
    const tabAnimeBtn = document.getElementById('tab-anime-btn');
    const tabMangaBtn = document.getElementById('tab-manga-btn');
    const showcaseView = document.getElementById('series-showcase-view');
    const detailView = document.getElementById('series-detail-view');
    const seriesGrid = document.getElementById('series-posters-grid');
    const episodesGrid = document.getElementById('catalog-list');
    const currentSeriesName = document.getElementById('current-series-name');
    const currentSeriesBadge = document.getElementById('current-series-badge');
    const backToCatalogBtn = document.getElementById('back-to-catalog-btn');
    const navCatalogBtn = document.getElementById('nav-catalog-btn');
    const countBadge = document.getElementById('catalog-count');

    // 4. Manga Catalog DOM Elements
    const mangaShowcaseView = document.getElementById('manga-showcase-view');
    const mangaDetailView = document.getElementById('manga-detail-view');
    const mangaGrid = document.getElementById('manga-posters-grid');
    const mangaChaptersList = document.getElementById('manga-chapters-list');
    const mangaSearchInput = document.getElementById('manga-chapter-search');
    const mangaSearchClearBtn = document.getElementById('manga-search-clear-btn');
    const mangaDetailTitle = document.getElementById('manga-detail-title');
    const mangaDetailBadge = document.getElementById('manga-detail-badge');
    const mangaDetailCover = document.getElementById('manga-detail-cover');
    const mangaDetailDesc = document.getElementById('manga-detail-desc');
    const mangaDetailAuthor = document.getElementById('manga-detail-author');
    const backToMangaBtn = document.getElementById('back-to-manga-btn');

    // 5. Manga Reader DOM Elements
    const readerView = document.getElementById('manga-reader-view');
    const container = document.getElementById('manga-pages-container');
    const floatingHeader = document.getElementById('manga-reader-header');
    const titleEl = document.getElementById('manga-reader-title');
    const pageCounterEl = document.getElementById('manga-page-counter');
    const modeToggleBtn = document.getElementById('manga-mode-toggle');
    const closeBtn = document.getElementById('manga-close-reader-btn');
    const prevChapterBtn = document.getElementById('manga-prev-chapter-btn');
    const nextChapterBtn = document.getElementById('manga-next-chapter-btn');
    const fullscreenBtn = document.getElementById('manga-fullscreen-btn');
    const loader = document.getElementById('manga-reader-loader');

    // 6. Controllers Initialization
    const playerController = new PlayerController(videoElement, storageService, playerError, playerLoader);

    let mangaReaderController = null;

    const catalogController = new CatalogController(
      {
        tabAnimeBtn,
        tabMangaBtn,
        showcaseView,
        detailView,
        seriesGrid,
        episodesGrid,
        currentSeriesName,
        currentSeriesBadge,
        backToCatalogBtn,
        navCatalogBtn,
        countBadge,
        mangaShowcaseView,
        mangaDetailView,
        mangaGrid,
        mangaChaptersList,
        mangaSearchInput,
        mangaSearchClearBtn,
        mangaDetailTitle,
        mangaDetailBadge,
        mangaDetailCover,
        mangaDetailDesc,
        mangaDetailAuthor,
        backToMangaBtn
      },
      (selectedMedia) => {
        // Video Selection Handler
        playerController.loadMedia(selectedMedia, true);
        catalogController.setActive(selectedMedia.id, true);
        AppBootstrap._updateNowPlaying(selectedMedia, { nowTitle, nowSubtitle, downloadBtn });
      },
      (view) => {
        // View change Handler: pause video if switching to showcase or manga
        if (view === 'showcase' || view === 'manga') {
          playerController.pause();
        }
      },
      (selectedChapter, allChapters) => {
        // Manga Chapter Selection Handler: open reader
        if (mangaReaderController) {
          mangaReaderController.openChapter(selectedChapter, allChapters);
        }
      },
      async (mangaConfig) => {
        // Fetch Manga Chapters on demand
        return await mediaRepository.getMangaChapters(mangaConfig);
      }
    );

    // Initialize Manga Reader Controller
    mangaReaderController = new MangaReaderController(
      {
        readerView,
        container,
        floatingHeader,
        titleEl,
        pageCounterEl,
        modeToggleBtn,
        closeBtn,
        prevChapterBtn,
        nextChapterBtn,
        fullscreenBtn,
        loader
      },
      storageService,
      () => {
        // On Close callback: nothing extra needed
      },
      (newChapter) => {
        // On Chapter Change callback (from reader next/prev)
        const chapters = catalogController.mangaChaptersMap.get(newChapter.mangaId) || [];
        mangaReaderController.openChapter(newChapter, chapters);
      }
    );

    // Synchronize play/pause state from video player to catalog items
    playerController.onStateChange(({ isPlaying }) => {
      catalogController.setPlaybackState(isPlaying);
    });

    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        playerController.retry();
      });
    }

    // 7. Initial Data Load (Parallel)
    try {
      // Load Anime Catalog
      const animePromise = mediaRepository.getMediaItems().then(items => {
        catalogController.setItems(items);
        if (items.length > 0) {
          const lastPlayedId = storageService.get(AppConfig.storageKeys.lastPlayedItem);
          const initialItem = items.find(i => i.id === lastPlayedId) || items[0];
          playerController.loadMedia(initialItem, false);
          catalogController.setActive(initialItem.id, false);
          AppBootstrap._updateNowPlaying(initialItem, { nowTitle, nowSubtitle, downloadBtn });
        } else {
          if (nowTitle) nowTitle.textContent = 'Sin contenido disponible';
          if (nowSubtitle) nowSubtitle.textContent = 'Servidor sin videos';
        }
      });

      // Preload Manga Catalog in background
      const mangas = AppConfig.api.mangas || [];
      const mangaPromises = mangas.map(async (m) => {
        try {
          const chapters = await mediaRepository.getMangaChapters(m);
          catalogController.setMangaChapters(m.id, chapters);
        } catch (e) {
          console.warn(`[AppBootstrap] Failed to preload manga ${m.id}:`, e);
        }
      });

      await Promise.all([animePromise, ...mangaPromises]);
    } catch (err) {
      console.error('[AppBootstrap] Initialization failure:', err);
    }
  }

  /**
   * @private
   */
  static _updateNowPlaying(mediaItem, { nowTitle, nowSubtitle, downloadBtn }) {
    if (nowTitle) nowTitle.textContent = mediaItem.title;
    if (nowSubtitle) {
      const extra = mediaItem.seriesBadge ? ` · ${mediaItem.seriesBadge}` : '';
      nowSubtitle.textContent = `${mediaItem.series}${extra}`;
    }
    if (downloadBtn) {
      downloadBtn.href = mediaItem.streamUrl;
      downloadBtn.download = mediaItem.filename;
    }
  }
}

// Auto-start on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  AppBootstrap.init();
});
