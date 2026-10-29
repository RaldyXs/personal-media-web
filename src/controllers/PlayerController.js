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
   * @param {HTMLElement} [errorElement]
   */
  constructor(videoElement, storage, errorElement = null) {
    this.video = videoElement;
    this.storage = storage;
    this.errorElement = errorElement;
    this.activeItem = null;
    this.stateListeners = [];

    this._bindEvents();
  }

  /**
   * Subscribes to playback state updates.
   * @param {Function} callback
   */
  onStateChange(callback) {
    this.stateListeners.push(callback);
  }

  /**
   * @private
   */
  _emitState(state) {
    this.stateListeners.forEach(cb => {
      try { cb(state); } catch (e) { console.error(e); }
    });
  }

  /**
   * Loads a media item into the player.
   * @param {import('../contracts/IMediaSource.js').MediaItem} mediaItem
   * @param {boolean} [autoPlay=false]
   */
  loadMedia(mediaItem, autoPlay = false) {
    if (!mediaItem) return;
    this.activeItem = mediaItem;
    this._hideError();

    // Set poster preview if available
    if (mediaItem.posterUrl) {
      this.video.poster = mediaItem.posterUrl;
    } else {
      this.video.removeAttribute('poster');
    }

    // Set media source
    this.video.src = mediaItem.streamUrl;

    // Restore saved playback position safely once metadata is available
    const applySavedPosition = () => {
      const savedTime = this.storage.getNumber(
        `${AppConfig.storageKeys.itemProgressPrefix}${mediaItem.id}`,
        0
      );
      if (savedTime > AppConfig.player.minPlaybackResumeSeconds) {
        try {
          if (this.video.duration && savedTime < this.video.duration) {
            this.video.currentTime = savedTime;
          }
        } catch (e) {
          console.warn('[PlayerController] Error al restaurar posición de reproducción:', e);
        }
      }
    };

    if (this.video.readyState >= 1) {
      applySavedPosition();
    } else {
      this.video.addEventListener('loadedmetadata', applySavedPosition, { once: true });
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
   * Retries loading the active media item.
   */
  retry() {
    if (this.activeItem) {
      this._hideError();
      const current = this.activeItem;
      this.video.src = '';
      this.video.load();
      this.loadMedia(current, true);
    }
  }

  /**
   * @private
   */
  _bindEvents() {
    this.video.addEventListener('play', () => {
      this._hideError();
      this._emitState({ isPlaying: true, item: this.activeItem });
    });

    this.video.addEventListener('pause', () => {
      this._emitState({ isPlaying: false, item: this.activeItem });
    });

    this.video.addEventListener('error', () => {
      const err = this.video.error;
      // Error code 1 is MEDIA_ERR_ABORTED (operation intentionally stopped)
      if (err && err.code === 1) return;

      console.error('[PlayerController] Media playback error:', err);
      this._showError('No se pudo reproducir el video. Verifica la conexión con el servidor.');
      this._emitState({ isPlaying: false, error: true, item: this.activeItem });
    });

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
      this._emitState({ isPlaying: false, ended: true, item: this.activeItem });
    });

    // Keyboard controls for desktop (Space = Play/Pause, Arrows = Seek 10s, F = Fullscreen, M = Mute)
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (this.video.paused) {
            this.video.play().catch(() => {});
          } else {
            this.video.pause();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.video.currentTime = Math.max(0, this.video.currentTime - 10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.video.currentTime = Math.min(this.video.duration || Infinity, this.video.currentTime + 10);
          break;
        case 'KeyF':
          e.preventDefault();
          if (!document.fullscreenElement) {
            this.video.requestFullscreen?.().catch(() => {});
          } else {
            document.exitFullscreen?.().catch(() => {});
          }
          break;
        case 'KeyM':
          e.preventDefault();
          this.video.muted = !this.video.muted;
          break;
      }
    });
  }

  /**
   * @private
   */
  _showError(message) {
    if (this.errorElement) {
      const msgEl = this.errorElement.querySelector('.player-error-text');
      if (msgEl) msgEl.textContent = message;
      this.errorElement.classList.remove('hidden');
    }
  }

  /**
   * @private
   */
  _hideError() {
    if (this.errorElement) {
      this.errorElement.classList.add('hidden');
    }
  }
}
