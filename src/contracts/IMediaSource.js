/**
 * Interface / Contract: IMediaRepository
 * Defines retrieval strategy for media catalog and video entities (ISP & DIP).
 */
export class IMediaRepository {
  /**
   * Fetches and returns list of normalized media models.
   * @returns {Promise<Array<MediaItem>>}
   */
  async getMediaItems() {
    throw new Error('Method not implemented: getMediaItems()');
  }
}

/**
 * Data Model: MediaItem
 */
export class MediaItem {
  /**
   * @param {Object} params
   * @param {string} params.id
   * @param {string} params.filename
   * @param {string} params.title
   * @param {string} params.series
   * @param {number} params.episodeNumber
   * @param {string} params.streamUrl
   * @param {number} [params.size]
   */
  constructor({ id, filename, title, series, episodeNumber, streamUrl, size }) {
    this.id = id;
    this.filename = filename;
    this.title = title;
    this.series = series;
    this.episodeNumber = episodeNumber;
    this.streamUrl = streamUrl;
    this.size = size || 0;
  }
}
