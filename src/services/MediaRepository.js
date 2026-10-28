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
   * Universal parser that intelligently extracts Series name, Episode Number,
   * Season, and clean title from diverse media naming conventions.
   *
   * Supported formats:
   * - "1.mp4" -> Series: "Darling in the Franxx", Ep: 1, Title: "Capítulo 1"
   * - "[SubsPlease] Bocchi the Rock! - 01 [1080p].mp4" -> Series: "Bocchi the Rock!", Ep: 1
   * - "Jujutsu.Kaisen.S02E05.1080p.mp4" -> Series: "Jujutsu Kaisen", Ep: 5, Title: "T2 · Capítulo 5"
   * - "One_Piece_1050.mp4" -> Series: "One Piece", Ep: 1050
   * - "Spirited_Away_2001.mp4" -> Series: "Películas", Ep: 1, Title: "Spirited Away (2001)"
   * @private
   */
  _extractMetadata(filename) {
    const rawBase = filename.replace(/\.[^/.]+$/, '');

    // 1. Strip release groups [Fansub], quality tags [1080p], audio tags (Dual Audio)
    let clean = rawBase
      .replace(/\[[^\]]*\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    let series = '';
    let title = '';
    let episodeNumber = 999;

    // Pattern A: Standard S01E02 / 1x02
    const sxxExxMatch = clean.match(/^(.*?)(?:[._ -]+)?(?:[sS](\d+)[eE](\d+)|(\d+)x(\d+))(?:[._ -]+)?(.*)$/i);
    // Pattern B: Hyphen separator "Series - EpisodeNumber - Title"
    const hyphenParts = clean.includes(' - ') ? clean.split(' - ') : null;
    // Pattern C: Trailing or embedded episode number: "Naruto_Shippuden_05" or "Chainsaw Man 03"
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

    // Fallbacks for purely numeric or uncategorized names
    if (!series) {
      if (/^\d+$/.test(clean)) {
        series = 'Darling in the Franxx';
        episodeNumber = parseInt(clean, 10);
        title = `Capítulo ${episodeNumber}`;
      } else {
        series = clean.replace(/[._-]/g, ' ').trim();
        title = series;
        episodeNumber = 1;
      }
    }

    return { series, episodeNumber, title };
  }
}
