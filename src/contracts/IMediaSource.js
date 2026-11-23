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
   * @param {string} [params.posterUrl]
   * @param {string} [params.seriesId]
   * @param {string} [params.seriesBadge]
   * @param {string} [params.coverUrl]
   */
  constructor({ id, filename, title, series, episodeNumber, streamUrl, posterUrl, size, seriesId, seriesBadge, coverUrl }) {
    this.id = id;
    this.filename = filename;
    this.title = title;
    this.series = series;
    this.episodeNumber = episodeNumber;
    this.streamUrl = streamUrl;
    this.posterUrl = posterUrl || '';
    this.size = size || 0;
    this.seriesId = seriesId || '';
    this.seriesBadge = seriesBadge || '';
    this.coverUrl = coverUrl || '';
  }
}

/**
 * Data Model: MangaChapter
 */
export class MangaChapter {
  /**
   * @param {Object} params
   * @param {string} params.id
   * @param {string} params.filename
   * @param {string} params.title
   * @param {number} params.chapterNumber
   * @param {string} params.streamUrl
   * @param {number} [params.size]
   * @param {string} params.mangaId
   * @param {string} params.mangaName
   * @param {string} [params.coverUrl]
   */
  constructor({ id, filename, title, chapterNumber, streamUrl, size, mangaId, mangaName, coverUrl }) {
    this.id = id;
    this.filename = filename;
    this.title = title;
    this.chapterNumber = chapterNumber;
    this.streamUrl = streamUrl;
    this.size = size || 0;
    this.mangaId = mangaId;
    this.mangaName = mangaName;
    this.coverUrl = coverUrl || '';
  }
}

