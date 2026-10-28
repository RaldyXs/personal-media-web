/**
 * Interface / Contract: IStorageProvider
 * Abstraction layer for client-side persistence (ISP & DIP).
 */
export class IStorageProvider {
  /**
   * @param {string} key
   * @returns {string | null}
   */
  get(key) {
    throw new Error('Method not implemented: get()');
  }

  /**
   * @param {string} key
   * @param {string} value
   */
  set(key, value) {
    throw new Error('Method not implemented: set()');
  }

  /**
   * @param {string} key
   */
  remove(key) {
    throw new Error('Method not implemented: remove()');
  }
}
