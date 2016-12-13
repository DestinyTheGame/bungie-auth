import failure from 'failure';
import once from 'one-time';
import URL from 'url-parse';
import Bungo from '../';

/**
 * Implementation of the oAuth handling using cordova.
 *
 * @constructor
 * @public
 */
export default class Cordova extends Bungo {
  constructor() {
    super(...arguments);

    this.config = Object.assign({}, Cordova.defaults, this.config);
    this.active = false;
  }

  /**
   * Open a new browser window for the oAuth authorization flow.
   *
   * @param {Function} fn Completion callback.
   * @private
   */
  open(fn) {
    if (this.active) return fn(failure('Already have an oAuth window open.'));

    const browser = cordova.InAppBrowser.open(
      this.url(),
      this.config.cordova.target,
      this.config.cordova.options
    );

    /**
     * Clean up our authorization windows and call our callback.
     *
     * @param {Error} err Optional error callback.
     * @param {String} url Received URL.
     * @private
     */
    const close = once((err, url) => {
      this.active = false;

      setImmediate(() => {
        browser.close();
      });

      fn(err, url);
    });

    browser.addEventListener('loadstart', (e) => {
      const next = e.originalEvent.url;
      const target = new URL(next);

      //
      // This part of Bungie's o-auth flow is weird as fuck, normally you would
      // just login with your credentials and be done, but they need to get your
      // playstation details so they are not really an oAuth provider but more
      // like an oAuth proxy so they will redirect a couple of times during the
      // oAuth flow.
      //
      if (target.hostname === 'www.bungie.net') return;

      close(undefined, next);
    });

    browser.addEventListener('loaderror', (e) => {
      close(failure('Failed to load oAuth page: '+ e.message));
    });

    browser.addEventListener('exit', (e) => {
      close(failure('User closed the oAuth window'));
    });
  }
}

/**
 * Default options.
 *
 * @type {Object}
 * @private
 */
Cordova.defaults = {
  cordova: {
    target: '_blank'
    options: ''
  }
};
