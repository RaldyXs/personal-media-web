import { AppConfig } from '../config/app.config.js';

/**
 * CatalogController
 * Manages:
 * 1. Global Navigation Tabs (Anime vs Manga).
 * 2. Anime Series Showcase & Episode List.
 * 3. Manga Showcase, Manga Chapter Catalog with real-time numeric search filter.
 * SRP: Catalog view state, switching between sections, and media/chapter card rendering.
 */
export class CatalogController {
  /**
   * @param {Object} elements
   * @param {Function} onSelectCallback
   * @param {Function} [onViewChangeCallback]
   * @param {Function} [onSelectMangaChapterCallback]
   * @param {Function} [onFetchMangaChaptersCallback]
   */
  constructor(elements, onSelectCallback, onViewChangeCallback = null, onSelectMangaChapterCallback = null, onFetchMangaChaptersCallback = null) {
    this.el = elements;
    this.onSelect = onSelectCallback;
    this.onViewChange = onViewChangeCallback;
    this.onSelectMangaChapter = onSelectMangaChapterCallback;
    this.onFetchMangaChapters = onFetchMangaChaptersCallback;

    this.activeTab = 'anime'; // 'anime' | 'manga'
    this.currentView = 'showcase'; // 'showcase' | 'detail'

    // Anime state
    this.items = [];
    this.seriesList = [];
    this.selectedSeriesId = null;
    this.activeId = null;
    this.isPlaying = false;

    // Manga state
    this.mangaList = AppConfig.api.mangas || [];
    this.mangaChaptersMap = new Map();
    this.selectedMangaId = null;
    this.mangaFilterQuery = '';

    this._bindEvents();
  }

  setItems(items) {
    this.items = items;

    // Build series list enriched with AppConfig definitions
    const configSeries = AppConfig.api.series || [];
    const countsMap = new Map();
    items.forEach(item => {
      const sId = item.seriesId || item.series.toLowerCase().replace(/\s+/g, '-');
      countsMap.set(sId, (countsMap.get(sId) || 0) + 1);
    });

    this.seriesList = configSeries.map(s => {
      const realCount = countsMap.get(s.id) || 0;
      return {
        ...s,
        count: realCount,
        episodesCountText: `${realCount} ${realCount === 1 ? 'Capítulo' : 'Capítulos'}`
      };
    });

    if (this.activeTab === 'anime') {
      if (this.currentView === 'detail' && this.selectedSeriesId) {
        this.renderEpisodes();
      } else {
        this.renderShowcase();
      }
      this._updateTotalCountBadge();
    }
  }

  setMangaChapters(mangaId, chapters) {
    this.mangaChaptersMap.set(mangaId, chapters);
    if (this.activeTab === 'manga') {
      if (this.selectedMangaId === mangaId) {
        this.renderMangaChapters();
      }
      this.renderMangaShowcase();
      this._updateTotalCountBadge();
    }
  }

  switchTab(tab) {
    this.activeTab = tab;

    if (this.el.tabAnimeBtn) this.el.tabAnimeBtn.classList.toggle('active', tab === 'anime');
    if (this.el.tabMangaBtn) this.el.tabMangaBtn.classList.toggle('active', tab === 'manga');

    if (tab === 'anime') {
      // Hide manga views
      if (this.el.mangaShowcaseView) this.el.mangaShowcaseView.classList.add('hidden');
      if (this.el.mangaDetailView) this.el.mangaDetailView.classList.add('hidden');
      if (this.el.backToMangaBtn) this.el.backToMangaBtn.classList.add('hidden');

      // Show anime views
      if (this.currentView === 'detail' && this.selectedSeriesId) {
        if (this.el.showcaseView) this.el.showcaseView.classList.add('hidden');
        if (this.el.detailView) this.el.detailView.classList.remove('hidden');
        if (this.el.backToCatalogBtn) this.el.backToCatalogBtn.classList.remove('hidden');
        this.renderEpisodes();
      } else {
        if (this.el.showcaseView) this.el.showcaseView.classList.remove('hidden');
        if (this.el.detailView) this.el.detailView.classList.add('hidden');
        if (this.el.backToCatalogBtn) this.el.backToCatalogBtn.classList.add('hidden');
        this.renderShowcase();
      }
    } else {
      // Pause video when navigating to manga
      if (typeof this.onViewChange === 'function') {
        this.onViewChange('manga');
      }

      // Hide anime views
      if (this.el.showcaseView) this.el.showcaseView.classList.add('hidden');
      if (this.el.detailView) this.el.detailView.classList.add('hidden');
      if (this.el.backToCatalogBtn) this.el.backToCatalogBtn.classList.add('hidden');

      // Show manga views
      if (this.selectedMangaId && this.el.mangaDetailView) {
        if (this.el.mangaShowcaseView) this.el.mangaShowcaseView.classList.add('hidden');
        if (this.el.mangaDetailView) this.el.mangaDetailView.classList.remove('hidden');
        if (this.el.backToMangaBtn) this.el.backToMangaBtn.classList.remove('hidden');
        this.renderMangaChapters();
      } else {
        if (this.el.mangaShowcaseView) this.el.mangaShowcaseView.classList.remove('hidden');
        if (this.el.mangaDetailView) this.el.mangaDetailView.classList.add('hidden');
        if (this.el.backToMangaBtn) this.el.backToMangaBtn.classList.add('hidden');
        this.renderMangaShowcase();
      }
    }

    this._updateTotalCountBadge();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  showShowcase() {
    this.currentView = 'showcase';
    if (this.el.showcaseView) this.el.showcaseView.classList.remove('hidden');
    if (this.el.detailView) this.el.detailView.classList.add('hidden');
    if (this.el.backToCatalogBtn) this.el.backToCatalogBtn.classList.add('hidden');
    if (this.el.countBadge) this.el.countBadge.classList.remove('hidden');

    this.renderShowcase();
    this._updateTotalCountBadge();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (typeof this.onViewChange === 'function') {
      this.onViewChange('showcase');
    }
  }

  openSeries(seriesId, autoPlayFirst = false) {
    this.selectedSeriesId = seriesId;
    this.currentView = 'detail';

    if (this.el.showcaseView) this.el.showcaseView.classList.add('hidden');
    if (this.el.detailView) this.el.detailView.classList.remove('hidden');
    if (this.el.backToCatalogBtn) this.el.backToCatalogBtn.classList.remove('hidden');
    if (this.el.countBadge) this.el.countBadge.classList.add('hidden');

    const series = this.seriesList.find(s => s.id === seriesId);
    if (series) {
      if (this.el.currentSeriesName) this.el.currentSeriesName.textContent = series.name;
      if (this.el.currentSeriesBadge) this.el.currentSeriesBadge.textContent = `· ${series.badge} (${series.count} eps)`;
    }

    this.renderEpisodes();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (autoPlayFirst) {
      const seriesEpisodes = this.items.filter(i => (i.seriesId || i.series.toLowerCase().replace(/\s+/g, '-')) === seriesId);
      if (seriesEpisodes.length > 0 && (!this.activeId || !seriesEpisodes.some(e => e.id === this.activeId))) {
        this.onSelect(seriesEpisodes[0]);
      }
    }
  }

  setActive(itemId, isPlaying = false) {
    this.activeId = itemId;
    this.isPlaying = isPlaying;

    const activeItem = this.items.find(i => i.id === itemId);
    if (activeItem) {
      this.selectedSeriesId = activeItem.seriesId || activeItem.series.toLowerCase().replace(/\s+/g, '-');
      const series = this.seriesList.find(s => s.id === this.selectedSeriesId);
      if (series) {
        if (this.el.currentSeriesName) this.el.currentSeriesName.textContent = series.name;
        if (this.el.currentSeriesBadge) this.el.currentSeriesBadge.textContent = `· ${series.badge} (${series.count} eps)`;
      }
    }

    if (this.activeTab === 'anime') {
      if (this.currentView === 'detail') {
        this.renderEpisodes();
      } else {
        this.renderShowcase();
      }
    }
  }

  setPlaybackState(isPlaying) {
    if (this.isPlaying !== isPlaying) {
      this.isPlaying = isPlaying;
      if (this.activeTab === 'anime') {
        if (this.currentView === 'detail') {
          this.renderEpisodes();
        } else {
          this.renderShowcase();
        }
      }
    }
  }

  renderShowcase() {
    if (!this.el.seriesGrid) return;

    if (!this.seriesList.length) {
      this.el.seriesGrid.innerHTML = '<div class="empty-state">No hay series registradas en el catálogo.</div>';
      return;
    }

    const currentItem = this.items.find(i => i.id === this.activeId);
    const playingSeriesId = currentItem ? (currentItem.seriesId || currentItem.series.toLowerCase().replace(/\s+/g, '-')) : null;

    this.el.seriesGrid.innerHTML = this.seriesList.map(series => {
      const isSeriesPlaying = series.id === playingSeriesId && this.isPlaying;

      return `
        <article
          class="series-poster-card ${isSeriesPlaying ? 'is-playing' : ''}"
          data-series-id="${series.id}"
          role="button"
          tabindex="0"
          aria-label="Abrir serie ${series.name}"
        >
          <div class="series-poster-img-wrap">
            <img
              class="series-poster-img"
              src="${series.coverUrl}"
              alt="${series.name}"
              loading="lazy"
              onerror="this.src='./assets/covers/one-pace.jpg'"
            />
            <div class="series-poster-gradient"></div>

            <span class="series-card-badge">${series.episodesCountText}</span>

            ${isSeriesPlaying ? `
              <div class="series-playing-badge">
                <span class="now-badge-dot"></span>
                <span>REPRODUCIENDO</span>
              </div>
            ` : ''}

            <div class="series-poster-hover-overlay">
              <div class="series-play-btn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
              <span class="series-explore-text">Explorar capítulos</span>
            </div>
          </div>

          <div class="series-poster-meta">
            <h3 class="series-poster-title">${series.name}</h3>
            <span class="series-poster-subtitle">${series.badge}</span>
          </div>
        </article>
      `;
    }).join('');
  }

  renderEpisodes() {
    if (!this.el.episodesGrid) return;

    const scopedItems = this.items.filter(item => {
      const sId = item.seriesId || item.series.toLowerCase().replace(/\s+/g, '-');
      return sId === this.selectedSeriesId;
    });

    if (!scopedItems.length) {
      this.el.episodesGrid.innerHTML = '<div class="empty-state">No se encontraron capítulos en esta serie.</div>';
      return;
    }

    this.el.episodesGrid.innerHTML = scopedItems.map(item => {
      const isActive = item.id === this.activeId;
      const isCurrentlyPlaying = isActive && this.isPlaying;
      const indexStr = item.episodeNumber < 100
        ? String(item.episodeNumber).padStart(2, '0')
        : String(item.episodeNumber);

      return `
        <article
          class="episode-row ${isActive ? 'active' : ''} ${isCurrentlyPlaying ? 'playing' : ''}"
          data-id="${item.id}"
          role="button"
          tabindex="0"
          aria-label="${item.series} ${item.title}"
        >
          <div class="ep-thumb-wrap">
            <img
              class="ep-thumb-img"
              src="${item.posterUrl}"
              alt="${item.title}"
              loading="lazy"
              onerror="this.style.opacity='0'"
            />
            <div class="ep-play-overlay">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                ${isCurrentlyPlaying
                  ? '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>'
                  : '<path d="M8 5v14l11-7z"/>'}
              </svg>
            </div>
          </div>

          <div class="ep-info">
            <div class="ep-title-line">
              <span class="ep-index-num">${indexStr}</span>
              <span class="ep-title" title="${item.title}">${item.title}</span>
            </div>
            <span class="ep-subtext">${item.seriesBadge || item.series}</span>
          </div>

          ${isActive ? `
            <span class="ep-status-pill">
              <span class="ep-dot"></span>
              <span>${isCurrentlyPlaying ? 'EN VIVO' : 'ACTIVO'}</span>
            </span>
          ` : ''}
        </article>
      `;
    }).join('');
  }

  /* ==========================================================================
     MANGA METHODS
     ========================================================================== */

  renderMangaShowcase() {
    if (!this.el.mangaGrid) return;

    if (!this.mangaList.length) {
      this.el.mangaGrid.innerHTML = '<div class="empty-state">No hay mangas registrados en el catálogo.</div>';
      return;
    }

    this.el.mangaGrid.innerHTML = this.mangaList.map(manga => {
      const chapters = this.mangaChaptersMap.get(manga.id) || [];
      const countText = chapters.length > 0 ? `${chapters.length} Caps` : 'Cargando...';

      return `
        <article
          class="series-poster-card manga-card"
          data-manga-id="${manga.id}"
          role="button"
          tabindex="0"
          aria-label="Leer manga ${manga.name}"
        >
          <div class="series-poster-img-wrap">
            <img
              class="series-poster-img"
              src="${manga.coverUrl}"
              alt="${manga.name}"
              loading="lazy"
            />
            <div class="series-poster-gradient"></div>

            <span class="series-card-badge">${countText}</span>

            <div class="series-poster-hover-overlay">
              <div class="series-play-btn manga-icon-btn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                </svg>
              </div>
              <span class="series-explore-text">Leer manga</span>
            </div>
          </div>

          <div class="series-poster-meta">
            <h3 class="series-poster-title">${manga.name}</h3>
            <span class="series-poster-subtitle">${manga.author || manga.badge}</span>
          </div>
        </article>
      `;
    }).join('');
  }

  async openManga(mangaId) {
    this.selectedMangaId = mangaId;
    this.mangaFilterQuery = '';

    if (this.el.mangaSearchInput) {
      this.el.mangaSearchInput.value = '';
    }

    if (this.el.mangaShowcaseView) this.el.mangaShowcaseView.classList.add('hidden');
    if (this.el.mangaDetailView) this.el.mangaDetailView.classList.remove('hidden');
    if (this.el.backToMangaBtn) this.el.backToMangaBtn.classList.remove('hidden');

    const manga = this.mangaList.find(m => m.id === mangaId);
    if (manga) {
      if (this.el.mangaDetailTitle) this.el.mangaDetailTitle.textContent = manga.name;
      if (this.el.mangaDetailAuthor) this.el.mangaDetailAuthor.textContent = manga.author || '';
      if (this.el.mangaDetailDesc) this.el.mangaDetailDesc.textContent = manga.description || '';
      if (this.el.mangaDetailCover) this.el.mangaDetailCover.src = manga.coverUrl;
    }

    // Check if chapters need to be fetched
    if (!this.mangaChaptersMap.has(mangaId) && typeof this.onFetchMangaChapters === 'function') {
      if (this.el.mangaChaptersList) {
        this.el.mangaChaptersList.innerHTML = '<div class="empty-state">Cargando capítulos del manga...</div>';
      }
      const chapters = await this.onFetchMangaChapters(manga);
      this.setMangaChapters(mangaId, chapters);
    } else {
      this.renderMangaChapters();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  showMangaShowcase() {
    this.selectedMangaId = null;
    if (this.el.mangaShowcaseView) this.el.mangaShowcaseView.classList.remove('hidden');
    if (this.el.mangaDetailView) this.el.mangaDetailView.classList.add('hidden');
    if (this.el.backToMangaBtn) this.el.backToMangaBtn.classList.add('hidden');

    this.renderMangaShowcase();
    this._updateTotalCountBadge();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  renderMangaChapters() {
    if (!this.el.mangaChaptersList) return;

    const chapters = this.mangaChaptersMap.get(this.selectedMangaId) || [];
    const query = this.mangaFilterQuery.trim().toLowerCase();

    const filtered = query
      ? chapters.filter(c => {
          const numStr = String(c.chapterNumber);
          return numStr.includes(query) || c.title.toLowerCase().includes(query) || c.filename.toLowerCase().includes(query);
        })
      : chapters;

    if (this.el.mangaDetailBadge) {
      this.el.mangaDetailBadge.textContent = `${chapters.length} Capítulos`;
    }

    if (!filtered.length) {
      this.el.mangaChaptersList.innerHTML = query
        ? `<div class="empty-state">No se encontraron capítulos con "${query}".</div>`
        : '<div class="empty-state">No hay capítulos disponibles todavía.</div>';
      return;
    }

    this.el.mangaChaptersList.innerHTML = filtered.map(ch => {
      const numStr = String(ch.chapterNumber).padStart(3, '0');
      return `
        <button
          class="manga-chapter-item"
          data-chapter-id="${ch.id}"
          title="Leer ${ch.title}"
        >
          <div class="manga-chapter-left">
            <span class="manga-chapter-num">${numStr}</span>
            <span class="manga-chapter-title">${ch.title}</span>
          </div>
          <span class="manga-read-badge">Leer</span>
        </button>
      `;
    }).join('');
  }

  _updateTotalCountBadge() {
    if (!this.el.countBadge) return;

    if (this.activeTab === 'anime') {
      if (this.currentView === 'showcase') {
        this.el.countBadge.classList.remove('hidden');
        this.el.countBadge.textContent = `${this.seriesList.length} Series · ${this.items.length} Caps`;
      } else {
        this.el.countBadge.classList.add('hidden');
      }
    } else {
      const totalMangaChapters = Array.from(this.mangaChaptersMap.values()).reduce((sum, arr) => sum + arr.length, 0);
      if (!this.selectedMangaId) {
        this.el.countBadge.classList.remove('hidden');
        this.el.countBadge.textContent = `${this.mangaList.length} Mangas ${totalMangaChapters ? `· ${totalMangaChapters} Caps` : ''}`;
      } else {
        this.el.countBadge.classList.add('hidden');
      }
    }
  }

  _bindEvents() {
    // 1. Header Navigation Tabs (Anime vs Manga)
    if (this.el.tabAnimeBtn) {
      this.el.tabAnimeBtn.addEventListener('click', () => this.switchTab('anime'));
    }

    if (this.el.tabMangaBtn) {
      this.el.tabMangaBtn.addEventListener('click', () => this.switchTab('manga'));
    }

    // 2. Click on Series Poster in Showcase
    if (this.el.seriesGrid) {
      this.el.seriesGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.series-poster-card');
        if (!card) return;
        const seriesId = card.getAttribute('data-series-id');
        if (seriesId) this.openSeries(seriesId, true);
      });

      this.el.seriesGrid.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          const card = e.target.closest('.series-poster-card');
          if (!card) return;
          e.preventDefault();
          const seriesId = card.getAttribute('data-series-id');
          if (seriesId) this.openSeries(seriesId, true);
        }
      });
    }

    // 3. Click on Episode Row
    if (this.el.episodesGrid) {
      this.el.episodesGrid.addEventListener('click', (e) => {
        const row = e.target.closest('.episode-row');
        if (!row) return;
        const id = row.getAttribute('data-id');
        const selected = this.items.find(i => i.id === id);
        if (selected && this.onSelect) this.onSelect(selected);
      });
    }

    // 4. Click on Manga Poster in Showcase
    if (this.el.mangaGrid) {
      this.el.mangaGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.manga-card');
        if (!card) return;
        const mangaId = card.getAttribute('data-manga-id');
        if (mangaId) this.openManga(mangaId);
      });
    }

    // 5. Click on Manga Chapter Item
    if (this.el.mangaChaptersList) {
      this.el.mangaChaptersList.addEventListener('click', (e) => {
        const item = e.target.closest('.manga-chapter-item');
        if (!item) return;
        const chapterId = item.getAttribute('data-chapter-id');
        const chapters = this.mangaChaptersMap.get(this.selectedMangaId) || [];
        const selected = chapters.find(c => c.id === chapterId);
        if (selected && typeof this.onSelectMangaChapter === 'function') {
          this.onSelectMangaChapter(selected, chapters);
        }
      });
    }

    // 6. Fast Search Filter Input
    if (this.el.mangaSearchInput) {
      this.el.mangaSearchInput.addEventListener('input', (e) => {
        this.mangaFilterQuery = e.target.value;
        this.renderMangaChapters();
      });
    }

    if (this.el.mangaSearchClearBtn) {
      this.el.mangaSearchClearBtn.addEventListener('click', () => {
        if (this.el.mangaSearchInput) {
          this.el.mangaSearchInput.value = '';
          this.mangaFilterQuery = '';
          this.renderMangaChapters();
          this.el.mangaSearchInput.focus();
        }
      });
    }

    // 7. Navigation Buttons back to Showcase
    if (this.el.backToCatalogBtn) {
      this.el.backToCatalogBtn.addEventListener('click', () => this.showShowcase());
    }

    if (this.el.navCatalogBtn) {
      this.el.navCatalogBtn.addEventListener('click', () => {
        if (this.activeTab === 'anime') {
          this.showShowcase();
        } else {
          this.showMangaShowcase();
        }
      });
    }

    if (this.el.backToMangaBtn) {
      this.el.backToMangaBtn.addEventListener('click', () => this.showMangaShowcase());
    }
  }
}
