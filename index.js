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
   * Request accessToken.
   *
   * @param {Function} fn Completion callback
   * @public
   */
  request(fn) {
    this.open((err, url) => {
      if (err) return fn(err);

      //
      // Validate that our `state` value is exactly the same as the one supplied
      // in the URL. This is to validate that the response was not altered by a
      // man in the middle.
      //
      if (!this.secure(url)) {
        return fn(new Error('Possible security attack detected'));
      }

      const target = new URL(url, true);

      this.send('GetAccessTokensFromCode', {
        code: target.query.code
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
    //
    // 1:
    //
    // Look if we have a stored accessToken and check if it's still somewhat
    // valid.
    //
    if (!this.expired(this.accessToken)) {
      return fn(undefined, this.payload());
    }

    //
    // 2:
    //
    // If we still have a refresh token, use it to generate a new access token.
    //
    if (!this.expired(this.refreshToken)) {
      return this.refresh(fn);
    }

    //
    // 3:
    //
    // Abandon all hope, ask for another sign in as we have no token, no refresh
    // token, no nothing. The world is a sad place, and addition user actions
    // have to be taken.
    //
    this.request(fn);
  }

  /**
   * Check if our given token is alive and kicking or if it's expired.
   *
   * @param {Object} token Token object received from Bungie.net
   * @returns {Boolean}
   * @private
   */
  expired(token) {
    if (!token || typeof token !== 'object' || !token.value || !token.epoch || !token.expires) {
      return true;
    }

    //
    // We transform the difference in epoch to seconds and remove a small amount
    // of buffering so people actually have some time to do an API request with
    // the returned token.
    //
    const now = Date.now();
    const diff = Math.ceil((now - token.epoch) / 1000) + this.config.buffer;

    return token.expires < diff;
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

      const refreshToken = this.refreshToken;
      const data = body.Response;
      const now = Date.now();

      //
      // The API responses only have a `expires` and  `readyin` values which
      // started when the API request was made. So if you store these values you
      // really have no clue if you can still use the accessToken or
      // refreshToken.
      //
      data.refreshToken.epoch = now
      data.accessToken.epoch = now;

      this.refreshToken = data.refreshToken;
      this.accessToken = data.accessToken;

      //
      // Try to keep the internally cached accessToken as fresh as possible so
      // our `.token` method is as fast as it can be. We want to make sure that
      // we give our API some extra time to do the lookup so we'll subtract 60
      // seconds from the expiree.
      //
      if (this.config.fresh) {
        this.timers.clear('refresh');

        this.timers.setTimeout('refresh', () => {
          this.refresh(this.config.fresh);
        }, (this.accessToken.expires - this.config.buffer) + ' seconds');
      }

      fn(undefined, this.payload());
    };
  }

  /**
   * The payload that is returned to the user.
   *
   * @returns {Object} The API payload.
   * @public
   */
  payload() {
    return {
      refreshToken: this.refreshToken,
      accessToken: this.accessToken
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
  buffer: 60,
  fresh: false
};
