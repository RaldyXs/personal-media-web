import { AppConfig } from '../config/app.config.js';

/**
 * CatalogController
 * Manages the Netflix Series Showcase (Vertical Posters 2:3 Grid)
 * and the Series Episodes Detail & Video Player view.
 * SRP: Catalog view state, series switching, and episode grid rendering.
 */
export class CatalogController {
  /**
   * @param {Object} elements
   * @param {HTMLElement} elements.showcaseView
   * @param {HTMLElement} elements.detailView
   * @param {HTMLElement} elements.seriesGrid
   * @param {HTMLElement} elements.episodesGrid
   * @param {HTMLElement} elements.currentSeriesName
   * @param {HTMLElement} elements.backToCatalogBtn
   * @param {HTMLElement} elements.detailBackBtn
   * @param {HTMLElement} elements.navCatalogBtn
   * @param {HTMLInputElement} elements.searchInput
   * @param {HTMLElement} elements.countBadge
   * @param {Function} onSelectCallback
   */
  constructor(elements, onSelectCallback) {
    this.el = elements;
    this.onSelect = onSelectCallback;

    this.items = [];
    this.seriesList = [];
    this.currentView = 'showcase'; // 'showcase' | 'detail'
    this.selectedSeriesId = null;
    this.activeId = null;
    this.isPlaying = false;

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

    // If an item was already playing or saved, we can initialize state
    if (this.currentView === 'detail' && this.selectedSeriesId) {
      this.renderEpisodes();
    } else {
      this.renderShowcase();
    }

    this._updateTotalCountBadge();
  }

  showShowcase() {
    this.currentView = 'showcase';
    if (this.el.showcaseView) this.el.showcaseView.classList.remove('hidden');
    if (this.el.detailView) this.el.detailView.classList.add('hidden');
    if (this.el.backToCatalogBtn) this.el.backToCatalogBtn.classList.add('hidden');

    this.renderShowcase();
    this._updateTotalCountBadge();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  openSeries(seriesId, autoPlayFirst = false) {
    this.selectedSeriesId = seriesId;
    this.currentView = 'detail';

    if (this.el.showcaseView) this.el.showcaseView.classList.add('hidden');
    if (this.el.detailView) this.el.detailView.classList.remove('hidden');
    if (this.el.backToCatalogBtn) this.el.backToCatalogBtn.classList.remove('hidden');

    const series = this.seriesList.find(s => s.id === seriesId);
    if (this.el.currentSeriesName && series) {
      this.el.currentSeriesName.textContent = `${series.name} (${series.badge})`;
    }

    this.renderEpisodes();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Optional auto-select first episode of series if none active in this series
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
    }

    if (this.currentView === 'detail') {
      this.renderEpisodes();
    } else {
      this.renderShowcase();
    }
  }

  setPlaybackState(isPlaying) {
    if (this.isPlaying !== isPlaying) {
      this.isPlaying = isPlaying;
      if (this.currentView === 'detail') {
        this.renderEpisodes();
      } else {
        this.renderShowcase();
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

    const query = (this.el.searchInput?.value || '').trim().toLowerCase();

    // Filter by selected series
    let scopedItems = this.items.filter(item => {
      const sId = item.seriesId || item.series.toLowerCase().replace(/\s+/g, '-');
      return sId === this.selectedSeriesId;
    });

    // Filter by search query
    const filtered = query
      ? scopedItems.filter(item => item.title.toLowerCase().includes(query))
      : scopedItems;

    if (this.el.countBadge) {
      this.el.countBadge.textContent = `${filtered.length} ${filtered.length === 1 ? 'capítulo' : 'capítulos'}`;
    }

    if (!filtered.length) {
      this.el.episodesGrid.innerHTML = '<div class="empty-state">No se encontraron capítulos en esta serie.</div>';
      return;
    }

    this.el.episodesGrid.innerHTML = filtered.map(item => {
      const isActive = item.id === this.activeId;
      const isCurrentlyPlaying = isActive && this.isPlaying;
      const indexStr = item.episodeNumber < 100
        ? String(item.episodeNumber).padStart(2, '0')
        : String(item.episodeNumber);

      return `
        <article
          class="episode-card ${isActive ? 'active' : ''} ${isCurrentlyPlaying ? 'playing' : ''}"
          data-id="${item.id}"
          role="button"
          tabindex="0"
          aria-label="${item.series} ${item.title}"
        >
          <div class="episode-poster-wrap">
            <img
              class="episode-poster"
              src="${item.posterUrl}"
              alt="${item.title}"
              loading="lazy"
              onerror="this.style.opacity='0'"
            />
            <div class="episode-fallback-gradient"></div>

            <div class="episode-overlay">
              <div class="play-action-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  ${isCurrentlyPlaying
                    ? '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>'
                    : '<path d="M8 5v14l11-7z"/>'}
                </svg>
              </div>
            </div>

            ${isActive ? `
              <span class="now-badge">
                <span class="now-badge-dot"></span>
                ${isCurrentlyPlaying ? 'REPRODUCIENDO' : 'ACTIVO'}
              </span>
            ` : ''}

            <span class="episode-tag">EP ${indexStr}</span>
          </div>

          <div class="episode-card-body">
            <span class="episode-title" title="${item.title}">${item.title}</span>
            <span class="episode-series-name">${item.seriesBadge || item.series}</span>
          </div>
        </article>
      `;
    }).join('');
  }

  _updateTotalCountBadge() {
    if (this.el.countBadge) {
      this.el.countBadge.textContent = `${this.seriesList.length} Series · ${this.items.length} Caps`;
    }
  }

  _bindEvents() {
    // 1. Click on Series Poster in Showcase
    if (this.el.seriesGrid) {
      this.el.seriesGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.series-poster-card');
        if (!card) return;
        const seriesId = card.getAttribute('data-series-id');
        if (seriesId) {
          this.openSeries(seriesId, true);
        }
      });

      this.el.seriesGrid.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          const card = e.target.closest('.series-poster-card');
          if (!card) return;
          e.preventDefault();
          const seriesId = card.getAttribute('data-series-id');
          if (seriesId) {
            this.openSeries(seriesId, true);
          }
        }
      });
    }

    // 2. Click on Episode Card in Details
    if (this.el.episodesGrid) {
      this.el.episodesGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.episode-card');
        if (!card) return;
        const id = card.getAttribute('data-id');
        const selected = this.items.find(i => i.id === id);
        if (selected && this.onSelect) {
          this.onSelect(selected);
        }
      });

      this.el.episodesGrid.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          const card = e.target.closest('.episode-card');
          if (!card) return;
          e.preventDefault();
          const id = card.getAttribute('data-id');
          const selected = this.items.find(i => i.id === id);
          if (selected && this.onSelect) {
            this.onSelect(selected);
          }
        }
      });
    }

    // 3. Navigation Buttons back to Showcase
    if (this.el.backToCatalogBtn) {
      this.el.backToCatalogBtn.addEventListener('click', () => this.showShowcase());
    }

    if (this.el.detailBackBtn) {
      this.el.detailBackBtn.addEventListener('click', () => this.showShowcase());
    }

    if (this.el.navCatalogBtn) {
      this.el.navCatalogBtn.addEventListener('click', () => this.showShowcase());
    }

    // 4. Search Filter
    if (this.el.searchInput) {
      this.el.searchInput.addEventListener('input', () => this.renderEpisodes());
    }
  }
}
