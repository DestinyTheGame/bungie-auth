import { BrowserWindow } from 'electron';
import diagnostics from 'diagnostics';
import failure from 'failure';
import once from 'one-time';
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
   * @param {String} redirectURL Redirect URL.
   * @param {Function} fn Completion callback.
   * @private
   */
  open(redirectURL, fn) {
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

    /**
     * Handle redirection and URL changes.
     *
     * @param {String} url New URL.
     * @private
     */
    const redirect = (url) => {
      debug('received redirect request to %s', url);

      //
      // This part of Bungie's o-auth flow is weird as fuck, normally you would
      // just login with your credentials and be done, but they need to get your
      // playstation details so they are not really an oAuth provider but more
      // like an oAuth proxy so they will redirect a couple of times during the
      // oAuth flow.
      //
      if (url.indexOf(redirectURL) !== 0) return;

      close(undefined, url);
    };

    browser.on('closed', () => {
      debug('user closed browser window');
      close(failure('User closed the oAuth window'));
    });

    browser.loadURL(this.url());
    browser.show();

    browser.webContents.on('did-get-redirect-request', (event, prev, next) => {
      debug('redirect request from %s to %s', prev, next);
      redirect(next);
    });

    browser.webContents.on('will-navigate', (event, url) => {
      debug('will navigate to %s', url);
      redirect(url);
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
