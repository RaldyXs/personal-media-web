import { AppConfig } from './config/app.config.js';
import { StorageService } from './services/StorageService.js';
import { StreamConnector } from './services/StreamConnector.js';
import { MediaRepository } from './services/MediaRepository.js';
import { PlayerController } from './controllers/PlayerController.js';
import { CatalogController } from './controllers/CatalogController.js';

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
    const nowTitle = document.getElementById('now-title');
    const nowSubtitle = document.getElementById('now-subtitle');
    const downloadBtn = document.getElementById('download-btn');
    const listContainer = document.getElementById('catalog-list');
    const searchInput = document.getElementById('catalog-search');
    const countBadge = document.getElementById('catalog-count');

    // 3. Controllers
    const playerController = new PlayerController(videoElement, storageService);

    const catalogController = new CatalogController(
      { listContainer, searchInput, countBadge },
      (selectedMedia) => {
        // Selection Handler
        playerController.loadMedia(selectedMedia, true);
        catalogController.setActive(selectedMedia.id);
        AppBootstrap._updateNowPlaying(selectedMedia, { nowTitle, nowSubtitle, downloadBtn });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    );

    // 4. Initial Data Load
    try {
      const items = await mediaRepository.getMediaItems();
      catalogController.setItems(items);

      if (items.length > 0) {
        const lastPlayedId = storageService.get(AppConfig.storageKeys.lastPlayedItem);
        const initialItem = items.find(i => i.id === lastPlayedId) || items[0];

        playerController.loadMedia(initialItem, false);
        catalogController.setActive(initialItem.id);
        AppBootstrap._updateNowPlaying(initialItem, { nowTitle, nowSubtitle, downloadBtn });
      } else {
        if (nowTitle) nowTitle.textContent = 'Sin contenido disponible';
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
    if (nowSubtitle) nowSubtitle.textContent = mediaItem.series;
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
