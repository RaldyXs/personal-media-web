/**
 * CatalogController
 * Manages the UI list rendering, search filtering, and item selection events.
 * SRP: UI state and rendering of catalog components.
 */
export class CatalogController {
  /**
   * @param {Object} elements
   * @param {HTMLElement} elements.listContainer
   * @param {HTMLInputElement} elements.searchInput
   * @param {HTMLElement} elements.countBadge
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
          item.series.toLowerCase().includes(query)
        )
      : this.items;

    if (this.countBadge) {
      this.countBadge.textContent = `${filtered.length} ${filtered.length === 1 ? 'título' : 'títulos'}`;
    }

    if (!filtered.length) {
      this.listContainer.innerHTML = '<div class="empty-state">No se encontraron elementos disponibles.</div>';
      return;
    }

    this.listContainer.innerHTML = filtered.map((item, index) => {
      const isActive = item.id === this.activeId;
      const isCurrentlyPlaying = isActive && this.isPlaying;
      let statusText = 'Tocar para ver';
      if (isActive) {
        statusText = isCurrentlyPlaying ? 'En reproducción' : 'Listo para reproducir';
      }

      const indexStr = item.episodeNumber < 100
        ? String(item.episodeNumber).padStart(2, '0')
        : String(item.episodeNumber);

      return `
        <div class="catalog-item ${isActive ? 'active' : ''} ${isCurrentlyPlaying ? 'playing' : ''}" data-id="${item.id}" data-index="${index}">
          <span class="item-index">${indexStr}</span>
          <div class="item-main">
            <span class="item-name">${item.series} · ${item.title}</span>
            <span class="item-status-text">${statusText}</span>
          </div>
          <div class="item-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              ${isCurrentlyPlaying
                ? '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>'
                : '<path d="M8 5v14l11-7z"/>'}
            </svg>
          </div>
        </div>
      `;
    }).join('');
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
      const itemEl = event.target.closest('.catalog-item');
      if (!itemEl) return;
      const id = itemEl.getAttribute('data-id');
      const selected = this.items.find(i => i.id === id);
      if (selected && this.onSelect) {
        this.onSelect(selected);
      }
    });
  }
}
