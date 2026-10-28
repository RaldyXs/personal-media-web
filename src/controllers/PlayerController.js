import { AppConfig } from '../config/app.config.js';

/**
 * PlayerController
 * Encapsulates HTML5 Video DOM Element operations and event listening.
 * SRP: Playback lifecycle management and media element state.
 */
export class PlayerController {
  /**
   * @param {HTMLVideoElement} videoElement
   * @param {import('../contracts/IStorage.js').IStorageProvider} storage
   */
  constructor(videoElement, storage) {
    this.video = videoElement;
    this.storage = storage;
    this.activeItem = null;

    this._bindEvents();
  }

  /**
   * Loads a media item into the player.
   * @param {import('../contracts/IMediaSource.js').MediaItem} mediaItem
   * @param {boolean} [autoPlay=false]
   */
  loadMedia(mediaItem, autoPlay = false) {
    if (!mediaItem) return;
    this.activeItem = mediaItem;

    // Set media source
    this.video.src = mediaItem.streamUrl;

    // Restore saved playback position
    const savedTime = this.storage.getNumber(
      `${AppConfig.storageKeys.itemProgressPrefix}${mediaItem.id}`,
      0
    );

    if (savedTime > AppConfig.player.minPlaybackResumeSeconds) {
      this.video.currentTime = savedTime;
    }

    // Persist as last played
    this.storage.set(AppConfig.storageKeys.lastPlayedItem, mediaItem.id);

    if (autoPlay) {
      this.video.play().catch(() => {
        // Autoplay may be restricted by mobile browser policy
      });
    }
  }

  /**
   * @private
   */
  _bindEvents() {
    // Throttled time progress saving
    let lastSavedTime = 0;
    this.video.addEventListener('timeupdate', () => {
      const now = Date.now();
      if (this.activeItem && now - lastSavedTime > AppConfig.player.saveProgressIntervalMs) {
        lastSavedTime = now;
        if (this.video.currentTime > AppConfig.player.minPlaybackResumeSeconds) {
          this.storage.set(
            `${AppConfig.storageKeys.itemProgressPrefix}${this.activeItem.id}`,
            this.video.currentTime.toFixed(2)
          );
        }
      }
    });

    // Cleanup on completion
    this.video.addEventListener('ended', () => {
      if (this.activeItem) {
        this.storage.remove(`${AppConfig.storageKeys.itemProgressPrefix}${this.activeItem.id}`);
      }
    });
  }
}
