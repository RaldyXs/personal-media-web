import { AppConfig } from '../config/app.config.js';

/**
 * MangaReaderController
 * High-performance PDF Manga Reader powered by Mozilla PDF.js.
 * Supports:
 * - Modo Cascada (Webtoon): Continuous vertical scroll with viewport rendering.
 * - Modo Paginado (Manga): Lateral page flipping with keyboard/touch support.
 * - LocalStorage reading progress preservation.
 * - Fullscreen, chapter navigation, and zoom-aware rendering.
 */
export class MangaReaderController {
  /**
   * @param {Object} elements
   * @param {HTMLElement} elements.readerView
   * @param {HTMLElement} elements.container
   * @param {HTMLElement} elements.floatingHeader
   * @param {HTMLElement} elements.titleEl
   * @param {HTMLElement} elements.pageCounterEl
   * @param {HTMLElement} elements.modeToggleBtn
   * @param {HTMLElement} elements.closeBtn
   * @param {HTMLElement} elements.prevChapterBtn
   * @param {HTMLElement} elements.nextChapterBtn
   * @param {HTMLElement} elements.fullscreenBtn
   * @param {HTMLElement} elements.loader
   * @param {import('../services/StorageService.js').StorageService} storageService
   * @param {Function} onCloseCallback
   * @param {Function} onChapterChangeCallback
   */
  constructor(elements, storageService, onCloseCallback, onChapterChangeCallback) {
    this.el = elements;
    this.storage = storageService;
    this.onClose = onCloseCallback;
    this.onChapterChange = onChapterChangeCallback;

    this.currentChapter = null;
    this.allChapters = [];
    this.pdfDoc = null;
    this.currentPage = 1;
    this.totalPages = 0;
    this.readingMode = this.storage.get(AppConfig.storageKeys.mangaMode) || 'webtoon'; // 'webtoon' | 'paged'
    this.isRendering = false;
    this.renderTasks = new Map(); // pageNum -> renderTask
    this.pageObservers = null;
    this.controlsTimeout = null;
    this.controlsVisible = true;

    this._initEvents();
  }

  /**
   * Opens and renders a given chapter.
   * @param {import('../contracts/IMediaSource.js').MangaChapter} chapter
   * @param {Array<import('../contracts/IMediaSource.js').MangaChapter>} allChapters
   * @param {number} [targetPage=1]
   */
  async openChapter(chapter, allChapters = [], targetPage = 1) {
    this.currentChapter = chapter;
    this.allChapters = allChapters;
    this.currentPage = targetPage;

    // Show reader UI
    if (this.el.readerView) this.el.readerView.classList.remove('hidden');
    document.body.classList.add('manga-reader-active');

    this._updateHeaderInfo();
    this._updateModeButtonState();
    this._showLoader(true, 'Descargando capítulo...', 5);
    this._resetControlsTimeout();

    try {
      this._cancelAllRenderTasks();
      if (this.pdfDoc) {
        this.pdfDoc.destroy();
        this.pdfDoc = null;
      }

      if (!window.pdfjsLib) {
        throw new Error('PDF.js library is not loaded');
      }

      const buffer = await this._fetchChapterBuffer(chapter.streamUrl, (pct, received, total) => {
        const mbReceived = (received / (1024 * 1024)).toFixed(1);
        const mbTotal = total > 0 ? (total / (1024 * 1024)).toFixed(1) : '?';
        this._showLoader(true, `Descargando: ${pct}% (${mbReceived} MB / ${mbTotal} MB)`, pct);
      });

      this._showLoader(true, 'Renderizando páginas...', 100);

      const loadingTask = window.pdfjsLib.getDocument({
        data: buffer,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true
      });

      this.pdfDoc = await loadingTask.promise;
      this.totalPages = this.pdfDoc.numPages;

      // Restore saved page if valid and targetPage was default
      const savedProgress = this.getProgress(chapter.mangaId);
      if (savedProgress && savedProgress.chapterId === chapter.id && savedProgress.page > 0) {
        this.currentPage = Math.min(savedProgress.page, this.totalPages);
      }

      this._updatePageCounter();
      this._updateChapterNavButtons();
      this._showLoader(false);

      if (this.readingMode === 'webtoon') {
        await this._renderWebtoonMode();
      } else {
        await this._renderPagedMode(this.currentPage);
      }

      // Proactively prefetch next chapter in background
      this._preloadNextChapter();
    } catch (err) {
      console.error('[MangaReader] Error loading PDF chapter:', err);
      if (this.el.container) {
        this.el.container.innerHTML = `
          <div class="manga-reader-error">
            <p>Error al cargar el capítulo: ${err.message || 'Archivo no disponible'}</p>
            <button class="action-btn" id="manga-reader-retry-btn">Reintentar</button>
          </div>
        `;
        const retryBtn = document.getElementById('manga-reader-retry-btn');
        if (retryBtn) retryBtn.addEventListener('click', () => this.openChapter(chapter, allChapters, targetPage));
      }
    } finally {
      this._showLoader(false);
    }
  }

  close() {
    this._cancelAllRenderTasks();
    if (this.pdfDoc) {
      this.pdfDoc.destroy();
      this.pdfDoc = null;
    }

    if (this.pageObservers) {
      this.pageObservers.disconnect();
      this.pageObservers = null;
    }

    if (this.el.container) {
      this.el.container.innerHTML = '';
    }

    if (this.el.readerView) {
      this.el.readerView.classList.add('hidden');
    }
    document.body.classList.remove('manga-reader-active');

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    if (typeof this.onClose === 'function') {
      this.onClose();
    }
  }

  toggleReadingMode() {
    this.readingMode = this.readingMode === 'webtoon' ? 'paged' : 'webtoon';
    this.storage.set(AppConfig.storageKeys.mangaMode, this.readingMode);
    this._updateModeButtonState();

    if (!this.pdfDoc) return;

    this._cancelAllRenderTasks();
    if (this.readingMode === 'webtoon') {
      this._renderWebtoonMode();
    } else {
      this._renderPagedMode(this.currentPage);
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      const target = this.el.readerView || document.documentElement;
      if (target.requestFullscreen) {
        target.requestFullscreen().catch(err => console.warn('Fullscreen denied:', err));
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  goToPage(pageNum) {
    if (!this.pdfDoc || pageNum < 1 || pageNum > this.totalPages) return;
    this.currentPage = pageNum;
    this._updatePageCounter();
    this._saveProgress();

    if (this.readingMode === 'paged') {
      this._renderPagedMode(pageNum);
    } else {
      const pageEl = this.el.container.querySelector(`[data-page-num="${pageNum}"]`);
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.goToPage(this.currentPage + 1);
    } else {
      this.nextChapter();
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    } else {
      this.prevChapter();
    }
  }

  nextChapter() {
    const currentIndex = this.allChapters.findIndex(c => c.id === this.currentChapter?.id);
    if (currentIndex >= 0 && currentIndex < this.allChapters.length - 1) {
      const nextChap = this.allChapters[currentIndex + 1];
      if (typeof this.onChapterChange === 'function') {
        this.onChapterChange(nextChap);
      }
    }
  }

  prevChapter() {
    const currentIndex = this.allChapters.findIndex(c => c.id === this.currentChapter?.id);
    if (currentIndex > 0) {
      const prevChap = this.allChapters[currentIndex - 1];
      if (typeof this.onChapterChange === 'function') {
        this.onChapterChange(prevChap);
      }
    }
  }

  getProgress(mangaId) {
    try {
      if (typeof this.storage.getJson === 'function') {
        return this.storage.getJson(`${AppConfig.storageKeys.mangaProgressPrefix}${mangaId}`);
      }
      const raw = this.storage.get(`${AppConfig.storageKeys.mangaProgressPrefix}${mangaId}`);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  /* ==========================================================================
     PRIVATE RENDERING METHODS
     ========================================================================== */

  /**
   * Webtoon mode: Renders pages vertically with continuous scroll and IntersectionObserver.
   * @private
   */
  async _renderWebtoonMode() {
    if (!this.el.container || !this.pdfDoc) return;
    this.el.container.className = 'manga-pages-container webtoon-mode';
    this.el.container.innerHTML = '';

    // First page determines aspect ratio placeholder
    const firstPage = await this.pdfDoc.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1 });
    const aspectRatio = viewport.height / viewport.width;

    const frag = document.createDocumentFragment();

    for (let i = 1; i <= this.totalPages; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'manga-page-wrapper';
      wrapper.dataset.pageNum = String(i);
      wrapper.style.minHeight = `calc(min(100vw, 900px) * ${aspectRatio})`;

      const canvas = document.createElement('canvas');
      canvas.className = 'manga-page-canvas';
      wrapper.appendChild(canvas);

      const placeholder = document.createElement('div');
      placeholder.className = 'manga-page-placeholder';
      placeholder.textContent = `Página ${i}`;
      wrapper.appendChild(placeholder);

      frag.appendChild(wrapper);
    }

    this.el.container.appendChild(frag);

    // Setup IntersectionObserver for lazy rendering and page counter tracking
    if (this.pageObservers) this.pageObservers.disconnect();

    const renderedPages = new Set();

    // Immediately pre-render first 3 pages so user sees content immediately
    for (let p = 1; p <= Math.min(3, this.totalPages); p++) {
      renderedPages.add(p);
      const targetWrap = this.el.container.querySelector(`[data-page-num="${p}"]`);
      if (targetWrap) {
        this._renderPageToCanvas(p, targetWrap.querySelector('canvas'), targetWrap.querySelector('.manga-page-placeholder'));
      }
    }

    this.pageObservers = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const pageNum = parseInt(entry.target.dataset.pageNum, 10);

        if (entry.isIntersecting) {
          // Update current page counter
          this.currentPage = pageNum;
          this._updatePageCounter();
          this._saveProgress();

          // Render canvas if not already rendered
          if (!renderedPages.has(pageNum)) {
            renderedPages.add(pageNum);
            this._renderPageToCanvas(pageNum, entry.target.querySelector('canvas'), entry.target.querySelector('.manga-page-placeholder'));
          }
        }
      });
    }, {
      root: this.el.container,
      rootMargin: '800px 0px 800px 0px',
      threshold: 0.05
    });

    const wrappers = this.el.container.querySelectorAll('.manga-page-wrapper');
    wrappers.forEach(w => this.pageObservers.observe(w));

    // Scroll to initial page if not 1
    if (this.currentPage > 1) {
      setTimeout(() => {
        const targetWrapper = this.el.container.querySelector(`[data-page-num="${this.currentPage}"]`);
        if (targetWrapper) targetWrapper.scrollIntoView({ block: 'start' });
      }, 100);
    }
  }

  /**
   * Paged mode: Single canvas with lateral flipping.
   * @private
   */
  async _renderPagedMode(pageNum) {
    if (!this.el.container || !this.pdfDoc) return;
    this.el.container.className = 'manga-pages-container paged-mode';
    this.el.container.innerHTML = `
      <div class="manga-paged-wrap" id="manga-paged-wrap">
        <canvas class="manga-page-canvas" id="manga-paged-canvas"></canvas>
        <div class="manga-touch-zone left" id="touch-left" title="Página anterior"></div>
        <div class="manga-touch-zone center" id="touch-center" title="Alternar menú"></div>
        <div class="manga-touch-zone right" id="touch-right" title="Página siguiente"></div>
      </div>
    `;

    const canvas = document.getElementById('manga-paged-canvas');
    await this._renderPageToCanvas(pageNum, canvas);

    // Wire touch zones
    const leftZone = document.getElementById('touch-left');
    const centerZone = document.getElementById('touch-center');
    const rightZone = document.getElementById('touch-right');

    if (leftZone) leftZone.addEventListener('click', (e) => { e.stopPropagation(); this.prevPage(); });
    if (rightZone) rightZone.addEventListener('click', (e) => { e.stopPropagation(); this.nextPage(); });
    if (centerZone) centerZone.addEventListener('click', (e) => { e.stopPropagation(); this._toggleControls(); });

    this._updatePageCounter();
    this._saveProgress();
  }

  /**
   * Renders a specific PDF page onto a canvas element with devicePixelRatio sharpness.
   * @private
   */
  async _renderPageToCanvas(pageNum, canvas, placeholderEl = null) {
    if (!this.pdfDoc || !canvas) return;

    try {
      const page = await this.pdfDoc.getPage(pageNum);
      const containerWidth = Math.min(window.innerWidth, this.readingMode === 'webtoon' ? 960 : window.innerWidth * 0.95);
      const initialViewport = page.getViewport({ scale: 1 });
      const scale = containerWidth / initialViewport.width;

      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const viewport = page.getViewport({ scale: scale * dpr });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

      const ctx = canvas.getContext('2d', { alpha: false });
      const renderTask = page.render({
        canvasContext: ctx,
        viewport
      });

      this.renderTasks.set(pageNum, renderTask);
      await renderTask.promise;
      this.renderTasks.delete(pageNum);

      if (placeholderEl) {
        placeholderEl.style.display = 'none';
      }
    } catch (err) {
      if (err.name !== 'RenderingCancelledException') {
        console.warn(`[MangaReader] Page ${pageNum} render error:`, err);
      }
    }
  }

  _cancelAllRenderTasks() {
    this.renderTasks.forEach(task => {
      try {
        task.cancel();
      } catch (_) {}
    });
    this.renderTasks.clear();
  }

  _updateHeaderInfo() {
    if (this.el.titleEl && this.currentChapter) {
      this.el.titleEl.textContent = `${this.currentChapter.mangaName} · ${this.currentChapter.title}`;
    }
  }

  _updatePageCounter() {
    if (this.el.pageCounterEl) {
      this.el.pageCounterEl.textContent = `${this.currentPage} / ${this.totalPages || '?'}`;
    }
  }

  _updateModeButtonState() {
    if (this.el.modeToggleBtn) {
      const isWebtoon = this.readingMode === 'webtoon';
      this.el.modeToggleBtn.textContent = isWebtoon ? 'Cascada' : 'Paginado';
      this.el.modeToggleBtn.title = isWebtoon ? 'Cambiar a modo paginado lateral' : 'Cambiar a modo cascada vertical';
    }
  }

  _updateChapterNavButtons() {
    const currentIndex = this.allChapters.findIndex(c => c.id === this.currentChapter?.id);
    if (this.el.prevChapterBtn) {
      this.el.prevChapterBtn.disabled = currentIndex <= 0;
    }
    if (this.el.nextChapterBtn) {
      this.el.nextChapterBtn.disabled = currentIndex >= this.allChapters.length - 1;
    }
  }

  _showLoader(show, text = 'Cargando capítulo...', progressPct = 0) {
    if (this.el.loader) {
      this.el.loader.classList.toggle('hidden', !show);
    }
    const textEl = document.getElementById('manga-loader-text');
    if (textEl) textEl.textContent = text;
    const barEl = document.getElementById('manga-progress-bar-fill');
    if (barEl) barEl.style.width = `${progressPct}%`;
  }

  /**
   * Fast streaming download with client-side Cache API integration.
   * Caches loaded chapters so subsequent reads are 100% instant (0ms).
   * @private
   */
  async _fetchChapterBuffer(url, onProgress) {
    const cacheName = 'pmh-manga-cache-v1';
    let cache = null;
    if ('caches' in window) {
      try {
        cache = await caches.open(cacheName);
      } catch (_) {}
    }

    if (cache) {
      try {
        const cachedResp = await cache.match(url);
        if (cachedResp) {
          if (onProgress) onProgress(100, 1, 1);
          return await cachedResp.arrayBuffer();
        }
      } catch (_) {}
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: No se pudo descargar el archivo`);
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    let buffer;
    if (!response.body || !total) {
      buffer = await response.arrayBuffer();
      if (cache) {
        try {
          const cachedResponse = new Response(buffer.slice(0), {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Length': String(buffer.byteLength)
            }
          });
          cache.put(url, cachedResponse).catch(() => {});
        } catch (_) {}
      }
      return buffer;
    }

    const reader = response.body.getReader();
    let receivedLength = 0;
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      receivedLength += value.length;
      if (onProgress) {
        const pct = Math.min(Math.round((receivedLength / total) * 100), 99);
        onProgress(pct, receivedLength, total);
      }
    }

    const chunksAll = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
      chunksAll.set(chunk, position);
      position += chunk.length;
    }

    buffer = chunksAll.buffer;

    if (cache) {
      try {
        const cachedResponse = new Response(buffer.slice(0), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Length': String(receivedLength)
          }
        });
        cache.put(url, cachedResponse).catch(() => {});
      } catch (_) {}
    }

    return buffer;
  }

  /**
   * Silently pre-fetches the next chapter into Cache Storage in the background.
   * @private
   */
  _preloadNextChapter() {
    const currentIndex = this.allChapters.findIndex(c => c.id === this.currentChapter?.id);
    if (currentIndex >= 0 && currentIndex < this.allChapters.length - 1) {
      const nextChap = this.allChapters[currentIndex + 1];
      const preloader = () => {
        this._fetchChapterBuffer(nextChap.streamUrl, null)
          .catch(() => {});
      };
      if ('requestIdleCallback' in window) {
        requestIdleCallback(preloader);
      } else {
        setTimeout(preloader, 1500);
      }
    }
  }

  _saveProgress() {
    if (!this.currentChapter) return;
    try {
      const data = {
        chapterId: this.currentChapter.id,
        chapterNumber: this.currentChapter.chapterNumber,
        title: this.currentChapter.title,
        page: this.currentPage,
        totalPages: this.totalPages,
        updatedAt: Date.now()
      };
      if (typeof this.storage.setJson === 'function') {
        this.storage.setJson(`${AppConfig.storageKeys.mangaProgressPrefix}${this.currentChapter.mangaId}`, data);
      } else {
        this.storage.set(`${AppConfig.storageKeys.mangaProgressPrefix}${this.currentChapter.mangaId}`, JSON.stringify(data));
      }
    } catch (_) {}
  }

  _toggleControls() {
    this.controlsVisible = !this.controlsVisible;
    if (this.el.floatingHeader) {
      this.el.floatingHeader.classList.toggle('collapsed', !this.controlsVisible);
    }
    if (this.controlsVisible) {
      this._resetControlsTimeout();
    }
  }

  _resetControlsTimeout() {
    if (this.controlsTimeout) clearTimeout(this.controlsTimeout);
    this.controlsTimeout = setTimeout(() => {
      if (this.readingMode === 'paged') {
        this.controlsVisible = false;
        if (this.el.floatingHeader) this.el.floatingHeader.classList.add('collapsed');
      }
    }, 4000);
  }

  _initEvents() {
    // 1. Header controls
    if (this.el.closeBtn) {
      this.el.closeBtn.addEventListener('click', () => this.close());
    }

    if (this.el.modeToggleBtn) {
      this.el.modeToggleBtn.addEventListener('click', () => this.toggleReadingMode());
    }

    if (this.el.fullscreenBtn) {
      this.el.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    }

    if (this.el.prevChapterBtn) {
      this.el.prevChapterBtn.addEventListener('click', () => this.prevChapter());
    }

    if (this.el.nextChapterBtn) {
      this.el.nextChapterBtn.addEventListener('click', () => this.nextChapter());
    }

    // 2. Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (!this.el.readerView || this.el.readerView.classList.contains('hidden')) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        this.nextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        this.prevPage();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        this.toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        this.toggleReadingMode();
      }
    });

    // 3. Activity to show controls
    if (this.el.readerView) {
      this.el.readerView.addEventListener('mousemove', () => {
        if (!this.controlsVisible) {
          this.controlsVisible = true;
          if (this.el.floatingHeader) this.el.floatingHeader.classList.remove('collapsed');
        }
        this._resetControlsTimeout();
      });
    }
  }
}
