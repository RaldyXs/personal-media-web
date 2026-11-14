/**
 * CatalogController
 * Manages the Netflix-style multi-series horizontal carousel catalog,
 * search filtering, and item selection events.
 * SRP: UI state and rendering of series shelves and episode cards.
 */
export class CatalogController {
  /**
   * @param {Object} elements
   * @param {HTMLElement} elements.listContainer
   * @param {HTMLInputElement} [elements.searchInput]
   * @param {HTMLElement} [elements.countBadge]
   * @param {Function} onSelectCallback
   */
  constructor({ listContainer, searchInput, countBadge }, onSelectCallback) {
    this.listContainer = listContainer;
    this.searchInput = searchInput;
    this.countBadge = countBadge;
    this.onSelect = onSelectCallback;

    this.items = [];
    this.activeId = null;
    this.isPlaying = false;

    this._bindSearch();
    this._bindListDelegation();
  }

  setItems(items) {
    this.items = items;
    this.render();
  }

  setActive(itemId, isPlaying = false) {
    this.activeId = itemId;
    this.isPlaying = isPlaying;
    this.render();
  }

  setPlaybackState(isPlaying) {
    if (this.isPlaying !== isPlaying) {
      this.isPlaying = isPlaying;
      this.render();
    }
  }

  render() {
    const query = (this.searchInput?.value || '').trim().toLowerCase();
    const filtered = query
      ? this.items.filter(item =>
          item.title.toLowerCase().includes(query) ||
          item.series.toLowerCase().includes(query) ||
          (item.seriesBadge && item.seriesBadge.toLowerCase().includes(query))
        )
      : this.items;

    if (this.countBadge) {
      const seriesCount = new Set(filtered.map(i => i.series)).size;
      this.countBadge.textContent = `${filtered.length} eps · ${seriesCount} ${seriesCount === 1 ? 'serie' : 'series'}`;
    }

    if (!filtered.length) {
      this.listContainer.innerHTML = '<div class="empty-state">No se encontraron episodios disponibles.</div>';
      return;
    }

    // Group items by series in insertion order
    const seriesMap = new Map();
    filtered.forEach(item => {
      const seriesName = item.series || 'Series';
      if (!seriesMap.has(seriesName)) {
        seriesMap.set(seriesName, {
          id: item.seriesId || seriesName.toLowerCase().replace(/\s+/g, '-'),
          badge: item.seriesBadge || '',
          items: []
        });
      }
      seriesMap.get(seriesName).items.push(item);
    });

    let html = '';
    seriesMap.forEach((group, seriesName) => {
      html += `
        <section class="series-shelf" data-series-id="${group.id}">
          <div class="series-shelf-header">
            <div class="series-shelf-title-wrap">
              <span class="series-shelf-bullet"></span>
              <h3 class="series-shelf-title">${seriesName}</h3>
              ${group.badge ? `<span class="series-badge">${group.badge}</span>` : ''}
            </div>
            <span class="series-shelf-count">${group.items.length} ${group.items.length === 1 ? 'capítulo' : 'capítulos'}</span>
          </div>

          <div class="series-carousel" tabindex="0" role="region" aria-label="Episodios de ${seriesName}">
            ${group.items.map(item => {
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
                        ${isCurrentlyPlaying ? 'EN VIVO' : 'ACTIVO'}
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
            }).join('')}
          </div>
        </section>
      `;
    });

    this.listContainer.innerHTML = html;
  }

  _bindSearch() {
    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => this.render());
    }
  }

  /**
   * Event delegation on listContainer: Single listener bound once for lifetime.
   * High performance, zero DOM listener churn.
   * @private
   */
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

    // Keyboard support (Enter / Space to select card)
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
