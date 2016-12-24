import diagnostics from 'diagnostics';
import TickTock from 'tick-tock';
import failure from 'failure';
import request from 'request';
import URL from 'url-parse';
import uuid from 'uuid/v4';

//
// Setup our debug utility so we can figure out what is going on in with the
// module internals.
//
const debug = diagnostics('bungie-auth');

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

    if (this.accessToken && this.refreshToken) {
      this.setTimeout();
    }
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

    debug('created a oauth URL %s', target.href);
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
        debug('the given url is not secure, possible security leak detected: %s', url);
        return fn(new Error('Possible security attack detected'));
      }

      const target = new URL(url, true);

      if (!target.query.code) {
        debug('the user as declined the oauth access, no code was received from bungie');
        return fn(new Error('User as declined the oAuth request'));
      }

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
      debug('accessToken is not yet expired, using cached access token');
      return fn(undefined, this.payload());
    }

    //
    // 2:
    //
    // If we still have a refresh token, use it to generate a new access token.
    //
    if (!this.expired(this.refreshToken)) {
      debug('refreshToken is not yet expired, using cached refresh token');
      return this.refresh(fn);
    }

    //
    // 3:
    //
    // Abandon all hope, ask for another sign in as we have no token, no refresh
    // token, no nothing. The world is a sad place, and addition user actions
    // have to be taken.
    //
    debug('no working access and refresh tokens found, starting oauth flow');
    this.request(fn);
  }

  /**
   * Check if our given token is alive and kicking or if it's expired.
   *
   * @param {Object} token Token object received from Bungie.net
   * @returns {Boolean}
   * @public
   */
  expired(token) {
    if (!token || typeof token !== 'object' || !token.value || !token.epoch || !token.expires) {
      debug('no valid token received assume its expired');
      return true;
    }

    //
    // We transform the difference in epoch to seconds and remove a small amount
    // of buffering so people actually have some time to do an API request with
    // the returned token.
    //
    const diff = this.alive(token) + (this.config.buffer / 2);
    const canbeused = token.expires < diff;

    debug('token expires %j/%j seconds, expired:', diff, token.expires, canbeused);
    return canbeused;
  }

  /**
   * Calculate the time in seconds that the token has been alive.
   *
   * @returns {Number} time in seconds the token has been alive
   * @public
   */
  alive(token) {
    const now = Date.now();

    return Math.ceil((now - token.epoch) / 1000);
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
    const url = 'https://www.bungie.net/Platform/App/'+ pathname +'/';
    debug('sending API request to %s', url);

    request({
      url: url,
      json: true,
      method: 'POST',
      body: JSON.stringify(body),
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
      refreshToken: token.value
    }, this.capture(fn));
  }

  /**
   * Try to keep the internally cached accessToken as fresh as possible so
   * our `.token` method is as fast as it can be. We want to make sure that
   * we give our API some extra time to do the lookup so we'll subtract 60
   * seconds from the expiree.
   *
   * @private
   */
  setTimeout() {
    if (!this.config.fresh) return;
    this.timers.clear('refresh');

    let remaining = this.accessToken.expires - this.alive(this.accessToken);

    //
    // Remove the time from our buffer so we have spare time to refresh the
    // token without disrupting the application. But we need to make sure
    // that we still keep a positive integer when setting our timeout so
    // default to 0.
    //
    remaining = remaining - this.config.buffer;
    if (remaining < 0) remaining = 0;

    debug('updating setTimeout for refreshToken in %s seconds', remaining);

    this.timers.setTimeout('refresh', () => {
      debug('our refreshToken is about to expire, initating auto-refresh');
      this.refresh(this.config.fresh);
    }, remaining + ' seconds');
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
      if (err) {
        debug('Bungie API request failed hard: %s', err.message);
        return fn(err);
      }

      //
      // Handle various of failures.
      //
      if (!('Response' in body) || 'Success' !== body.ErrorStatus) {
        const message = body.Message || 'Invalid data received from Bungie.net';

        debug('Invalid response received from Bungie servers: %s', message);
        return fn(failure(message, { status: body.ErrorStatus }));
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

      const payload = this.payload();

      //
      // Check if we previously already had data or if this is actually the
      // first time we received data because in that case we also want to
      // trigger the fresh function so it can be used as storage callback for
      // applications
      //
      if (this.config.fresh && !refreshToken) {
        debug('first time calling refresh as we didnt have a token before');
        this.config.fresh(err, payload);
      }

      this.setTimeout();
      fn(err, payload);
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
