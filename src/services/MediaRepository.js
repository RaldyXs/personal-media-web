import { IMediaRepository, MediaItem } from '../contracts/IMediaSource.js';
import { AppConfig } from '../config/app.config.js';

/**
 * MediaRepository
 * Implements IMediaRepository against Nginx JSON Autoindex / Static File Trees.
 * Supports multi-series endpoints (e.g., /videos/one-pace/, /videos/darling/)
 * as well as legacy single endpoint fallback.
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
    const configuredSeries = AppConfig.api.series || [];

    if (configuredSeries.length > 0) {
      try {
        const fetchPromises = configuredSeries.map(async (seriesConfig) => {
          const url = this.connector.buildStreamUrl(seriesConfig.endpoint);
          try {
            const response = await fetch(url, {
              headers: { 'Accept': 'application/json' },
              cache: 'no-cache'
            });
            if (!response.ok) return [];
            const rawItems = await response.json();
            return this._parseAutoindex(rawItems, seriesConfig);
          } catch (e) {
            console.warn(`[MediaRepository] Failed to fetch series ${seriesConfig.id}:`, e);
            return [];
          }
        });

        const results = await Promise.all(fetchPromises);
        const combined = results.flat();
        if (combined.length > 0) {
          return combined;
        }
      } catch (err) {
        console.warn('[MediaRepository] Multi-series fetch failed, trying fallback index', err);
      }
    }

    // Fallback to legacy single index /videos/
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
          id: 'darling_1.mp4',
          filename: '1.mp4',
          title: 'Capítulo 1',
          series: 'Darling in the Franxx',
          episodeNumber: 1,
          streamUrl: this.connector.buildStreamUrl('/videos/darling/1.mp4'),
          posterUrl: this.connector.buildStreamUrl('/videos/darling/1.jpg'),
          seriesId: 'darling',
          seriesBadge: 'Temporada 1'
        })
      ];
    }
  }

  /**
   * @private
   * @param {Array<Object>} items
   * @param {Object} [seriesConfig]
   * @returns {Array<MediaItem>}
   */
  _parseAutoindex(items, seriesConfig = null) {
    const validExtensions = new RegExp(`\\.(${AppConfig.player.supportedExtensions.join('|')})$`, 'i');
    const baseEndpoint = seriesConfig ? seriesConfig.endpoint : '/videos/';

    return items
      .filter(item => item.type === 'file' && validExtensions.test(item.name))
      .map(item => {
        const cleanBase = item.name.replace(/\.[^/.]+$/, '');
        const defaultSeries = seriesConfig ? seriesConfig.name : '';
        const parsed = this._extractMetadata(item.name, defaultSeries);

        const series = seriesConfig ? seriesConfig.name : parsed.series;
        const seriesId = seriesConfig ? seriesConfig.id : (parsed.series ? parsed.series.toLowerCase().replace(/\s+/g, '-') : 'default');
        const seriesBadge = seriesConfig ? seriesConfig.badge : '';
        const id = seriesConfig ? `${seriesConfig.id}_${item.name}` : item.name;

        const streamPath = `${baseEndpoint.replace(/\/+$/, '')}/${encodeURIComponent(item.name)}`;
        const posterPath = `${baseEndpoint.replace(/\/+$/, '')}/${encodeURIComponent(cleanBase)}.jpg`;

        return new MediaItem({
          id,
          filename: item.name,
          title: parsed.title,
          series,
          episodeNumber: parsed.episodeNumber,
          streamUrl: this.connector.buildStreamUrl(streamPath),
          posterUrl: this.connector.buildStreamUrl(posterPath),
          size: item.size || 0,
          seriesId,
          seriesBadge
        });
      })
      .sort((a, b) => {
        if (a.series !== b.series) return a.series.localeCompare(b.series);
        return a.episodeNumber - b.episodeNumber;
      });
  }

  /**
   * Universal parser that intelligently extracts Series name, Episode Number,
   * Season, and clean title from diverse media naming conventions.
   * @private
   */
  _extractMetadata(filename, defaultSeries = '') {
    const rawBase = filename.replace(/\.[^/.]+$/, '');

    let clean = rawBase
      .replace(/\[[^\]]*\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    let series = '';
    let title = '';
    let episodeNumber = 999;

    const sxxExxMatch = clean.match(/^(.*?)(?:[._ -]+)?(?:[sS](\d+)[eE](\d+)|(\d+)x(\d+))(?:[._ -]+)?(.*)$/i);
    const hyphenParts = clean.includes(' - ') ? clean.split(' - ') : null;
    const trailingEpMatch = clean.match(/^(.*?)(?:[._ -]+)(?:ep|episodio|cap|capitulo|episode|e)?\s*(\d{1,4})(?:[._ -]+)?(.*)$/i);

    if (sxxExxMatch) {
      series = sxxExxMatch[1].replace(/[._-]/g, ' ').trim();
      const season = parseInt(sxxExxMatch[2] || sxxExxMatch[4], 10);
      episodeNumber = parseInt(sxxExxMatch[3] || sxxExxMatch[5], 10);
      title = `T${season} · Capítulo ${episodeNumber}`;
      if (sxxExxMatch[6]) {
        const extra = sxxExxMatch[6].replace(/[._-]/g, ' ').trim();
        if (extra && !/^(1080p|720p|bluray|x264|hevc|web-dl)$/i.test(extra)) {
          title += ` - ${extra}`;
        }
      }
    } else if (hyphenParts && hyphenParts.length >= 2) {
      series = hyphenParts[0].replace(/[._-]/g, ' ').trim();
      const rest = hyphenParts.slice(1).join(' - ').trim();
      const numMatch = rest.match(/\b(\d{1,4})\b/);
      if (numMatch) {
        episodeNumber = parseInt(numMatch[1], 10);
        title = rest.startsWith('Capítulo') || rest.startsWith('Episodio')
          ? rest
          : `Capítulo ${episodeNumber}`;
      } else {
        title = rest;
      }
    } else if (trailingEpMatch && trailingEpMatch[1]) {
      series = trailingEpMatch[1].replace(/[._-]/g, ' ').trim();
      episodeNumber = parseInt(trailingEpMatch[2], 10);
      title = `Capítulo ${episodeNumber}`;
      if (trailingEpMatch[3]) {
        const extra = trailingEpMatch[3].replace(/[._-]/g, ' ').trim();
        if (extra && !/^(1080p|720p|bluray|x264|hevc|web-dl)$/i.test(extra)) {
          title += ` - ${extra}`;
        }
      }
    }

    if (!series) {
      if (/^\d+$/.test(clean)) {
        series = defaultSeries || 'Darling in the Franxx';
        episodeNumber = parseInt(clean, 10);
        title = `Capítulo ${episodeNumber}`;
      } else {
        series = defaultSeries || clean.replace(/[._-]/g, ' ').trim();
        title = clean.replace(/[._-]/g, ' ').trim();
        episodeNumber = 1;
      }
    }

    return { series, episodeNumber, title };
  }
}
