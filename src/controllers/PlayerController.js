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
   * @param {HTMLElement} [loaderElement]
   */
  constructor(videoElement, storage, errorElement = null, loaderElement = null) {
    this.video = videoElement;
    this.storage = storage;
    this.errorElement = errorElement;
    this.loaderElement = loaderElement;
    this.activeItem = null;
    this.stateListeners = [];
    this._loadSessionId = 0;

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
   * Loads a media item into the player with robust WebKit session isolation.
   * @param {import('../contracts/IMediaSource.js').MediaItem} mediaItem
   * @param {boolean} [autoPlay=false]
   */
  loadMedia(mediaItem, autoPlay = false) {
    if (!mediaItem) return;
    this.activeItem = mediaItem;
    this._hideError();
    this._showLoader();

    const currentSession = ++this._loadSessionId;

    // 1. Reset current player pipeline safely
    this.video.pause();

    // 2. Set poster preview if available
    if (mediaItem.posterUrl) {
      this.video.poster = mediaItem.posterUrl;
    } else {
      this.video.removeAttribute('poster');
    }

    // 3. Set source and force fresh load to clear previous buffer and stale readyState
    this.video.src = mediaItem.streamUrl;
    this.video.load();

    // 4. One-time listener for metadata of this specific media item
    const onLoadedMetadata = () => {
      if (this._loadSessionId !== currentSession) return;

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
          console.warn('[PlayerController] Error al restaurar posición:', e);
        }
      }

      if (autoPlay) {
        this.video.play().catch(err => {
          console.log('[PlayerController] Autoplay diferido a interacción de usuario:', err?.name);
        });
      }
    };

    this.video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });

    // Persist as last played
    this.storage.set(AppConfig.storageKeys.lastPlayedItem, mediaItem.id);
  }

  /**
   * Retries loading the active media item.
   */
  retry() {
    if (this.activeItem) {
      this._hideError();
      const current = this.activeItem;
      this.loadMedia(current, true);
    }
  }

  /**
   * Pauses media playback safely.
   */
  pause() {
    if (this.video && !this.video.paused) {
      this.video.pause();
    }
  }

  _showLoader() {
    if (this.loaderElement) {
      this.loaderElement.classList.remove('hidden');
    }
  }

  _hideLoader() {
    if (this.loaderElement) {
      this.loaderElement.classList.add('hidden');
    }
  }

  _showError(message) {
    this._hideLoader();
    if (this.errorElement) {
      const textEl = this.errorElement.querySelector('.player-error-text');
      if (textEl && message) textEl.textContent = message;
      this.errorElement.classList.remove('hidden');
    }
  }

  _hideError() {
    if (this.errorElement) {
      this.errorElement.classList.add('hidden');
    }
  }

  /**
   * @private
   */
  _bindEvents() {
    this.video.addEventListener('play', () => {
      this._hideError();
      this._hideLoader();
      this._emitState({ isPlaying: true, item: this.activeItem });
    });

    this.video.addEventListener('playing', () => {
      this._hideLoader();
      this._emitState({ isPlaying: true, item: this.activeItem });
    });

    this.video.addEventListener('pause', () => {
      this._emitState({ isPlaying: false, item: this.activeItem });
    });

    this.video.addEventListener('waiting', () => {
      this._showLoader();
    });

    this.video.addEventListener('canplay', () => {
      this._hideLoader();
    });

    this.video.addEventListener('error', () => {
      this._hideLoader();
      const err = this.video.error;
      if (err && err.code === 1) return; // MEDIA_ERR_ABORTED

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

    // Keyboard controls
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
          this.video.currentTime = Math.min(this.video.duration || 0, this.video.currentTime + 10);
          break;
        case 'KeyF':
          e.preventDefault();
          if (!document.fullscreenElement) {
            this.video.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
          break;
        case 'KeyM':
          e.preventDefault();
          this.video.muted = !this.video.muted;
          break;
      }
    });
  }
}
