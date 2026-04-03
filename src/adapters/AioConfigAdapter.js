/**
 * Adapter class for interacting with an external SDK (e.g., acc-js-sdk).
 * Encapsulates SDK-specific logic and provides a clean interface for business services.
 * @class AioConfigAdapter
 */
class AioConfigAdapter {
  constructor(config) {
    this.config = config;
  }

  get(key) {
    return this.config.get(key);
  }

  set(key, value) {
    return this.config.set(key, value);
  }

  reload() {
    return this.config.reload();
  }

  global() {
    return this.config.global;
  }
}

export default AioConfigAdapter;
