import TickTock from 'tick-tock';
import failure from 'failure';
import request from 'request';
import URL from 'url-parse';
import uuid from 'uuid/v4';

/**
 * Access oAuth from Bungie.net
 *
 * @param {Object} opts Configuration.
 * @constructor
 * @public
 */
export default class Bungo {
  constructor(opts) {
    opts = Object.assign({}, Bungo.defaults, opts || {});

    //
    // References to the API responses from Bungie.net
    //
    this.refreshToken = opts.refreshToken || null;
    this.accessToken = opts.accessToken || null;

    this.timers = new TickTock(this);
    this.config = opts;
    this.state = null;
  }

  /**
   * Open a new browser window for the oAuth authorization flow.
   *
   * @param {Function} fn Completion callback.
   * @private
   */
  open(fn) {
    return fn(failure('Left as implementation excercise for developers.'));
  }

  /**
   * Generate the URL that starts the oAuth flow.
   *
   * @returns {URL} Our URL instance, that can toString in to an URL.
   * @public
   */
  url() {
    const target = new URL(this.config.url, true);

    this.state = uuid();
    target.set('query', { state: this.state });

    return target.href;
  }

  /**
   * Check if the received URL is valid and secure enough to continue with our
   * authentication steps.
   *
   * @param {String} url URL we need to check for possible miss matches.
   * @returns {Boolean} Passed or failed our test.
   * @public
   */
  secure(url) {
    const target = new URL(url, true);

    return this.state === target.query.state;
  }

  /**
   * Request access.
   *
   * @param {Function} fn Completion callback
   * @public
   */
  request(fn) {
    this.open((err, url) => {
      if (err) return fn(err);

      const target = new URL(url, true);

      this.send('GetAccessTokensFromCode', {
        code: '4080809'
      }, this.capture(fn));
    });
  }

  /**
   * Get the access token from the API, if we don't have a refresh token we want
   * to request access to the user's details.
   *
   * @param {Function} fn Completion callback.
   * @public
   */
  token(fn) {
    if (this.refreshToken) return this.refresh(fn);

    this.request(fn);
  }

  /**
   * Send a token request to Bungie.net.
   *
   * @param {String} pathname Pathname we need to hit.
   * @param {Object} body Request body.
   * @param {Function} fn Completion callback.
   * @public
   */
  send(pathname, body, fn) {
    request({
      json: true,
      method: 'POST',
      body: JSON.stringify(body),
      url: 'https://www.bungie.net/Platform/App/'+ pathname +'/',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-API-Key': this.config.key,
        'Accept': 'application/json',
      }
    }, (err, res, body) => {
      if (err) return fn(err);

      fn(undefined, body);
    });
  }

  /**
   * Refresh the token.
   *
   * @param {String} token Optional refresh token. Will used last known.
   * @param {Function} fn Completion callback.
   * @public
   */
  refresh(token, fn) {
    if ('function' === typeof token) {
      fn = token;
      token = null;

      if (this.refreshToken) {
        token = this.refreshToken;
      }
    }

    //
    // @TODO when we don't have a token, do we want to trigger another
    // authentication request?
    //
    if (!token) {
      return fn(failure('Missing refresh token'));
    }

    return this.send('GetAccessTokensFromRefreshToken', {
      refreshToken: token
    }, this.capture(fn));
  }

  /**
   * Capture the response from the Bungie servers so we can apply some
   * additional processing.
   *
   * @param {Function} fn Completion callback.
   * @returns {Function} Interception callback.
   * @private
   */
  capture(fn) {
    return (err, body = {}) => {
      if (err) return fn(err);

      //
      // Handle various of failures.
      //
      if (!('Response' in body) || 'Success' !== body.ErrorStatus) {
        return fn(failure(body.Message || 'Invalid data received from Bungie.net', {
          status: body.ErrorStatus
        }));
      }

      const data = body.Response;

      this.refreshToken = data.refreshToken;
      this.accessToken = data.accessToken;

      fn(undefined, {
        refreshToken: this.refreshToken,
        accessToken: this.accessToken
      });
    };
  }
}

/**
 * Default options.
 *
 * @type {Object}
 * @private
 */
Bungo.defaults = {
  url: 'https://www.bungie.net/en/Application/Authorize/',
  browser: {
    'auto-hide-menu-bar': true,
    'use-content-size': true,
    'standard-window': true,
    'always-on-top': true,
    'center': true
  },
  autorefresh: true
};
