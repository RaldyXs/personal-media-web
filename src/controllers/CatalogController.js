/**
 * CatalogController
 * Implements Netflix-style Series Selection & Episode Grid.
 * Allows users to choose a series (One Pace, Darling in the Franxx, etc.)
 * and browse all its available episodes with rich poster cards.
 * SRP: UI state and rendering of series selector tabs and episode cards.
 */
export class CatalogController {
  /**
   * @param {Object} elements
   * @param {HTMLElement} elements.listContainer
   * @param {HTMLElement} [elements.seriesNav]
   * @param {HTMLElement} [elements.sectionTitle]
   * @param {HTMLInputElement} [elements.searchInput]
   * @param {HTMLElement} [elements.countBadge]
   * @param {Function} onSelectCallback
   */
  constructor({ listContainer, seriesNav, sectionTitle, searchInput, countBadge }, onSelectCallback) {
    this.listContainer = listContainer;
    this.seriesNav = seriesNav;
    this.sectionTitle = sectionTitle;
    this.searchInput = searchInput;
    this.countBadge = countBadge;
    this.onSelect = onSelectCallback;

    this.items = [];
    this.seriesList = [];
    this.selectedSeriesId = null;
    this.activeId = null;
    this.isPlaying = false;

    this._bindSearch();
    this._bindSeriesNavDelegation();
    this._bindListDelegation();
  }

  setItems(items) {
    this.items = items;

    // Build unique series list preserving metadata
    const seriesMap = new Map();
    items.forEach(item => {
      const sId = item.seriesId || item.series.toLowerCase().replace(/\s+/g, '-');
      if (!seriesMap.has(sId)) {
        seriesMap.set(sId, {
          id: sId,
          name: item.series,
          badge: item.seriesBadge || '',
          count: 0
        });
      }
      seriesMap.get(sId).count++;
    });

    this.seriesList = Array.from(seriesMap.values());

    // Default to the first series if none selected
    if (!this.selectedSeriesId && this.seriesList.length > 0) {
      this.selectedSeriesId = this.seriesList[0].id;
    }

    this.renderSeriesNav();
    this.render();
  }

  selectSeries(seriesId) {
    if (this.selectedSeriesId !== seriesId) {
      this.selectedSeriesId = seriesId;
      this.renderSeriesNav();
      this.render();
    }
  }

  setActive(itemId, isPlaying = false) {
    this.activeId = itemId;
    this.isPlaying = isPlaying;

    // Automatically align selected series with the active playing item
    const activeItem = this.items.find(i => i.id === itemId);
    if (activeItem) {
      const activeSeriesId = activeItem.seriesId || activeItem.series.toLowerCase().replace(/\s+/g, '-');
      if (this.selectedSeriesId !== activeSeriesId && this.selectedSeriesId !== 'all') {
        this.selectedSeriesId = activeSeriesId;
      }
    }

    this.renderSeriesNav();
    this.render();
  }

  setPlaybackState(isPlaying) {
    if (this.isPlaying !== isPlaying) {
      this.isPlaying = isPlaying;
      this.renderSeriesNav();
      this.render();
    }
  }

  renderSeriesNav() {
    if (!this.seriesNav) return;

    if (!this.seriesList.length) {
      this.seriesNav.innerHTML = '';
      return;
    }

    const currentItem = this.items.find(i => i.id === this.activeId);
    const playingSeriesId = currentItem ? (currentItem.seriesId || currentItem.series.toLowerCase().replace(/\s+/g, '-')) : null;

    let html = '';

    // Individual Series Tabs
    this.seriesList.forEach(series => {
      const isSelected = this.selectedSeriesId === series.id;
      const isSeriesPlaying = series.id === playingSeriesId && this.isPlaying;

      html += `
        <button
          type="button"
          class="series-tab ${isSelected ? 'active' : ''} ${isSeriesPlaying ? 'has-playing' : ''}"
          data-series-id="${series.id}"
          role="tab"
          aria-selected="${isSelected}"
        >
          <span class="series-tab-dot"></span>
          <span class="series-tab-title">${series.name}</span>
          <span class="series-tab-badge">${series.badge || series.count + ' eps'}</span>
        </button>
      `;
    });

    // "Ver Todas" Tab for all combined
    const isAllSelected = this.selectedSeriesId === 'all';
    html += `
      <button
        type="button"
        class="series-tab ${isAllSelected ? 'active' : ''}"
        data-series-id="all"
        role="tab"
        aria-selected="${isAllSelected}"
      >
        <span class="series-tab-title">Todas las Series</span>
        <span class="series-tab-badge">${this.items.length} eps</span>
      </button>
    `;

    this.seriesNav.innerHTML = html;
  }

  render() {
    const query = (this.searchInput?.value || '').trim().toLowerCase();

    // 1. Filter by Selected Series
    let scopedItems = this.items;
    if (this.selectedSeriesId && this.selectedSeriesId !== 'all') {
      scopedItems = this.items.filter(item => {
        const sId = item.seriesId || item.series.toLowerCase().replace(/\s+/g, '-');
        return sId === this.selectedSeriesId;
      });
    }

    // 2. Filter by Search Query
    const filtered = query
      ? scopedItems.filter(item =>
          item.title.toLowerCase().includes(query) ||
          item.series.toLowerCase().includes(query) ||
          (item.seriesBadge && item.seriesBadge.toLowerCase().includes(query))
        )
      : scopedItems;

    // 3. Update Title & Badges
    const currentSeries = this.seriesList.find(s => s.id === this.selectedSeriesId);
    if (this.sectionTitle) {
      if (currentSeries && this.selectedSeriesId !== 'all') {
        this.sectionTitle.textContent = `${currentSeries.name} · ${currentSeries.badge || 'Episodios'}`;
      } else {
        this.sectionTitle.textContent = 'Todas las Series Disponibles';
      }
    }

    if (this.countBadge) {
      this.countBadge.textContent = `${filtered.length} ${filtered.length === 1 ? 'capítulo' : 'capítulos'}`;
    }

    if (!filtered.length) {
      this.listContainer.innerHTML = '<div class="empty-state">No se encontraron episodios en esta serie.</div>';
      return;
    }

    // Render Netflix Responsive Episode Grid
    this.listContainer.innerHTML = `
      <div class="episodes-grid" role="list">
        ${filtered.map(item => {
          const isActive = item.id === this.activeId;
          const isCurrentlyPlaying = isActive && this.isPlaying;
          const indexStr = item.episodeNumber < 100
            ? String(item.episodeNumber).padStart(2, '0')
            : String(item.episodeNumber);

          return `
            <article
              class="episode-card ${isActive ? 'active' : ''} ${isCurrentlyPlaying ? 'playing' : ''}"
              data-id="${item.id}"
              role="listitem"
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
                <span class="episode-series-name">${item.seriesBadge ? `${item.series} · ${item.seriesBadge}` : item.series}</span>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;
  }

  _bindSearch() {
    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => this.render());
    }
  }

  _bindSeriesNavDelegation() {
    if (!this.seriesNav) return;
    this.seriesNav.addEventListener('click', (event) => {
      const tabEl = event.target.closest('.series-tab');
      if (!tabEl) return;
      const seriesId = tabEl.getAttribute('data-series-id');
      if (seriesId) {
        this.selectSeries(seriesId);
      }
    });
  }

  _bindListDelegation() {
    if (!this.listContainer) return;
    this.listContainer.addEventListener('click', (event) => {
      const itemEl = event.target.closest('.episode-card');
      if (!itemEl) return;
      const id = itemEl.getAttribute('data-id');
      const selected = this.items.find(i => i.id === id);
      if (selected && this.onSelect) {
        this.onSelect(selected);
      }
    });

    this.listContainer.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        const itemEl = event.target.closest('.episode-card');
        if (!itemEl) return;
        event.preventDefault();
        const id = itemEl.getAttribute('data-id');
        const selected = this.items.find(i => i.id === id);
        if (selected && this.onSelect) {
          this.onSelect(selected);
        }
      }
    });
  }
}
