import { IMediaRepository, MediaItem } from '../contracts/IMediaSource.js';
import { AppConfig } from '../config/app.config.js';

/**
 * MediaRepository
 * Implements IMediaRepository against Nginx JSON Autoindex / Static File Trees.
 * SRP: Fetching, parsing, and normalizing media objects.
 */
export class MediaRepository extends IMediaRepository {
  /**
   * @param {import('./StreamConnector.js').StreamConnector} connector
   */
  constructor(connector) {
    super();
    this.connector = connector;
  }

  async getMediaItems() {
    const url = this.connector.buildStreamUrl(AppConfig.api.endpoints.videosIndex);

    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-cache'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch media index from ${url}`);
      }

      const rawItems = await response.json();
      return this._parseAutoindex(rawItems);
    } catch (err) {
      console.warn('[MediaRepository] Remote index fetch failed, falling back to local default', err);
      return [
        new MediaItem({
          id: '1.mp4',
          filename: '1.mp4',
          title: 'Capítulo 1',
          series: 'Darling in the Franxx',
          episodeNumber: 1,
          streamUrl: this.connector.buildStreamUrl('/videos/1.mp4'),
          posterUrl: this.connector.buildStreamUrl('/videos/1.jpg')
        })
      ];
    }
  }

  /**
   * @private
   * @param {Array<Object>} items
   * @returns {Array<MediaItem>}
   */
  _parseAutoindex(items) {
    const validExtensions = new RegExp(`\\.(${AppConfig.player.supportedExtensions.join('|')})$`, 'i');

    return items
      .filter(item => item.type === 'file' && validExtensions.test(item.name))
      .map(item => {
        const parsed = this._extractMetadata(item.name);
        const cleanBase = item.name.replace(/\.[^/.]+$/, '');
        return new MediaItem({
          id: item.name,
          filename: item.name,
          title: parsed.title,
          series: parsed.series,
          episodeNumber: parsed.episodeNumber,
          streamUrl: this.connector.buildStreamUrl(`/videos/${encodeURIComponent(item.name)}`),
          posterUrl: this.connector.buildStreamUrl(`/videos/${encodeURIComponent(cleanBase)}.jpg`),
          size: item.size || 0
        });
      })
      .sort((a, b) => {
        if (a.series !== b.series) return a.series.localeCompare(b.series);
        return a.episodeNumber - b.episodeNumber;
      });
  }

  /**
   * Intelligent parser that extracts Series and Episode Number from filename.
   * Examples:
   * "1.mp4" -> Series: "Darling in the Franxx", Ep: 1, Title: "Capítulo 1"
   * "Shingeki_no_Kyojin_03.mp4" -> Series: "Shingeki no Kyojin", Ep: 3, Title: "Capítulo 3"
   * @private
   */
  _extractMetadata(filename) {
    const cleanBase = filename.replace(/\.[^/.]+$/, '');
    const numMatch = cleanBase.match(/(?:ep|episodio|cap|capitulo)?[\s_.-]*(\d+)/i);
    const episodeNumber = numMatch ? parseInt(numMatch[1], 10) : 999;

    let series = 'Darling in the Franxx';
    let title = `Capítulo ${episodeNumber}`;

    // If filename has a separator like "Series - 01"
    if (cleanBase.includes(' - ')) {
      const parts = cleanBase.split(' - ');
      series = parts[0].replace(/[_-]/g, ' ').trim();
      title = parts[1].trim();
    }

    return { series, episodeNumber, title };
  }
}
