import { BrowserWindow } from 'electron';
import diagnostics from 'diagnostics';
import failure from 'failure';
import once from 'one-time';
import URL from 'url-parse';
import Bungo from '../';

//
// Setup our debug utility.
//
const debug = diagnostics('bungie-auth:electron');

/**
 * Implementation of the oAuth handling using electron.
 *
 * @constructor
 * @public
 */
export default class Electron extends Bungo {
  constructor() {
    super(...arguments);

    this.config = Object.assign({}, Electron.defaults, this.config);
    this.active = false;
  }

  /**
   * Open a new browser window for the oAuth authorization flow.
   *
   * @param {Function} fn Completion callback.
   * @private
   */
  open(fn) {
    if (this.active) {
      debug('we already have an oauth window open, raising error');
      return fn(failure('Already have an oAuth window open.'));
    }

    const browser = this.active = new BrowserWindow(
      Object.assign({}, this.config.electron, {
        //
        // This should never be overridden. If we spawn the window without this
        // option we will end up with a page full of JavaScript errors and we
        // really want to create a normal functioning browser window. No special
        // sauce needed
        //
        webPreferences: {
          nodeIntegration: false
        }
      })
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
      browser.removeAllListeners('closed');

      setImmediate(() => {
        browser.destroy();
      });

      fn(err, url);
    });

    browser.on('closed', () => {
      debug('user closed browser window');
      close(failure('User closed the oAuth window'));
    });

    browser.loadURL(this.url());
    browser.show();

    browser.webContents.on('did-get-redirect-request', (event, prev, next) => {
      const target = new URL(next);
      debug('received redirect request to %s', next);

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
  }
}

/**
 * Default options.
 *
 * @type {Object}
 * @private
 */
Electron.defaults = {
  electron: {
    autoHideMenuBar: true,
    useContentSize: true,
    alwaysOnTop: true,
    center: true
  }
};
