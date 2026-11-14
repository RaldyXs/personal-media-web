import { AppConfig } from './config/app.config.js?v=1.3.1';
import { StorageService } from './services/StorageService.js?v=1.3.1';
import { StreamConnector } from './services/StreamConnector.js?v=1.3.1';
import { MediaRepository } from './services/MediaRepository.js?v=1.3.1';
import { PlayerController } from './controllers/PlayerController.js?v=1.3.1';
import { CatalogController } from './controllers/CatalogController.js?v=1.3.1';

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

    // 2. DOM Elements
    const videoElement = document.getElementById('media-player');
    const playerError = document.getElementById('player-error');
    const playerLoader = document.getElementById('player-loader');
    const retryBtn = document.getElementById('player-retry-btn');
    const nowTitle = document.getElementById('now-title');
    const nowSubtitle = document.getElementById('now-subtitle');
    const downloadBtn = document.getElementById('download-btn');

    const showcaseView = document.getElementById('series-showcase-view');
    const detailView = document.getElementById('series-detail-view');
    const seriesGrid = document.getElementById('series-posters-grid');
    const episodesGrid = document.getElementById('catalog-list');
    const currentSeriesName = document.getElementById('current-series-name');
    const backToCatalogBtn = document.getElementById('back-to-catalog-btn');
    const navCatalogBtn = document.getElementById('nav-catalog-btn');
    const countBadge = document.getElementById('catalog-count');

    // 3. Controllers
    const playerController = new PlayerController(videoElement, storageService, playerError, playerLoader);

    const catalogController = new CatalogController(
      {
        showcaseView,
        detailView,
        seriesGrid,
        episodesGrid,
        currentSeriesName,
        backToCatalogBtn,
        navCatalogBtn,
        countBadge
      },
      (selectedMedia) => {
        // Selection Handler
        playerController.loadMedia(selectedMedia, true);
        catalogController.setActive(selectedMedia.id, true);
        AppBootstrap._updateNowPlaying(selectedMedia, { nowTitle, nowSubtitle, downloadBtn });
      }
    );

    // Synchronize play/pause state from player to catalog items
    playerController.onStateChange(({ isPlaying }) => {
      catalogController.setPlaybackState(isPlaying);
    });

    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        playerController.retry();
      });
    }

    // 4. Initial Data Load
    try {
      const items = await mediaRepository.getMediaItems();
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
