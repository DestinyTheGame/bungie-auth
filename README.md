# Bungie Auth

The `bungie-auth` module exposes a nice API to authenticate withe Bungie.net's
oAuth 2.0 based authentication process.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [API](#api)
  - [token](#token)
  - [request](#request)
  - [refresh](#refresh)
  - [payload](#payload)
  - [alive](#alive)
  - [expired](#expired)
  - [capture](#capture)
  - [open](#open)
  - [url](#url)
  - [secure](#secure)
  - [send](#send)
  - [setTimeout](#settimeout)
- [pre-build](#pre-build)
  - [electron](#electron)
- [license](#license)

## Installation

The module is released to the public npm registry and can be installed by
running:

```
npm install --save bungie-auth
```

Please note that this module is written in ES6, if you wish to use it in a
Node.js environment you might need to use `babel` to transform the module to an
ES5 compatible version.

## Usage

The following configuration values are **required**:

- `url` The unique `Authorization URL` that Bungie created for your application.
- `key` The API for your `Authorization URL`.

While not strictly **required** you want to supply this by default as well if
you have it:

- `refreshToken` The `responseToken` object you got back from the API.
- `accessToken` The `accessToken` object you got back from the API.

These values should be stored locally and securely so you don't have to
authenticate every single time people open your application. The following
configuration values are optional:

- `buffer` Number in seconds. Amount of seconds that will be extracted from the
  `expires` value of the `accessToken` and `refreshToken`. Defaults to `60`.
- `fresh` Function. Callback to indicate that we automatically want to refresh
  the cached internal `accessToken` when it's about to expire. The `fresh`
  method will be called with the new [payload](#payload).

## API

```js
import Bungo from 'bungie-auth/electron';

const bungie = new Bungo({
  key: '..',
  url: '..'
});
```

The created `bungie` instance will have the following methods available. 

- [token](#token)
- [request](#request)
- [refresh](#refresh)
- [payload](#payload)
- [alive](#alive)
- [expired](#expired)
- [capture](#capture)
- [open](#open)
- [url](#url)
- [secure](#secure)
- [send](#send)
- [setTimeout](#settimeout)

Once you've received the `accessToken` from one of our API methods you can use
it's `value` to create the `Authorization` header that might be needed for the
the API calls:

```js
bungie.token(function (err, paylaod) {
  if (err) throw err;

  const token = payload.accessToken.value;
  const authorization = `Bearer ${token}`;
});
```

### token

Retrieve the access token from the API. If we have a cached `accessToken` which
is still good, we will use that. If it's expired we will generate a new one with
a `refreshToken` that we might have. If that case fails, we will ask the user
login again so we get a fresh `refreshToken` and `accessToken`.

The method accepts a single argument:

- `fn` An error first callback that receives potential errors as first argument
  and the [payload](#payload) as second argument.

```js
bungie.token(function (err, payload) {

});
```

### request

Request a new access token. This will ask the user to login with their
credentials and does the initial call the Bungie servers to retrieve the
`accessToken` and `refreshToken`.

The method accepts a single argument:

- `fn` An error first callback that receives potential errors as first argument
  and the [payload](#payload) as second argument.

```js
bungie.request(function (err, payload) {

});
```

### refresh

Refresh the `accessToken` as it expires after like 30 minutes once you first
requested it (see expires value in seconds on the `accessToken object`).

The method accepts two arguments:

- `token` An optional token object that you received from payload. When omitted
  and used as single argument function it will default to the internally stored
  `refreshToken`.
- `fn` An error first callback that receives potential errors as first argument
  and the [payload](#payload) as second argument.

```js
bungie.refresh(token, function (err, payload) {

});

bungie.refresh(function (err, payload) {

});
```

### payload

Formats and returns the payload that we received from the Bungie servers. API
methods like [refresh](#refresh), [token](#token), [request](#request) use the
returned object as response.

```js
const data = bungie.payload();
```

The method returns the following object structure:

```js
{
  accessToken: {
    value: 'your access token',
    readyin: 0,
    expires: 3600,
    epoch: 90874174017
  },
  refreshToken: {
    value: 'your refresh token',
    readyin: 1800,
    expires: 3600
    epoch: 90874174017
  }
}
```

The `value` is the actual token from the server. The `readyin` and `expires` are
seconds. We add our own `epoch` property to each object. This is the result of
`Date.now()` when we first received the information from the Bungie servers.
This allows you to determine if the token is still valid or if it's expired.

### alive

Check how long a given token has been alive. Returns time in seconds so it can
be matched against the `token.expires` property.

The method accepts a single argument:

- `token` The `accessToken` or `refreshToken` object that was returned from the
  [payload](#payload) method.

```js
bungie.alive(bungie.accessToken) // 189
```

### expired

Check if a token is expired. It does this by checking the amount of seconds that
have been passed since the token was received based on the `epoch` value that we
added to the object. It automatically adds `config.buffer` in seconds to the
time passed so we will have some spare time to request a new access token and
prevent that API calls will use the token RIGHT when it expired. This gives you
some peace of mind that the token you receive is **alway** valid for the amount
of time was configured with the `buffer` option.

The method accepts a single argument:

- `token` The `accessToken` or `refreshToken` object that was returned from the
  [payload](#payload) method.

The method will return a boolean indicating if the token is still valid or needs
to be re-requested.

```js
bungie.expired(bungie.accessToken) // false
```

### capture

*private api*

Intercept and capture all API responses from Bungie so we can store the values
internally.

The method accepts a single argument:

- `fn` An error first callback that receives potential errors as first argument
  and the [payload](#payload) as second argument.

And it will return a wrapped function that should be for callbacks.

```js
const fn = bungie.capture(callback);
bungie.send('GetAccessTokenFromRefreshToken', { refreshToken: token } fn);
```

### open

*private api*

This is a method that should be implemented by our [pre-build](#pre-build)
integrations. This method should start the oAuth 2.0 Authorization flow using
the `bungie.url()` method. It should call the supplied callback once it receives
the `code` and `state` back as query string values from the oAuth 2.0 redirect
URL.

The method accepts a single argument:

- `fn` An error first callback that receives potential errors as first argument
  and the full redirect URL as second value.

Example implementation, take this with a grain of salt and look at our
[electron](#electron) flow for a working example.

```js
bungie.open = function open(fn) {
  var url = bungie.url();

  // implement opening of url, and capturing redirect url
  fn(undefined, redirect.url);
};
```

### url

*private api*

Generate the URL that needs to be used for the oAuth 2.0 authorization flow.
This automatically generates and stores a unique value as `this.state` which
will be used in the [secure](#secure) method to validate the response.

The method will return a string which is the URL that should be opened to start
the authentication process.

```js
const url = bungie.url();
```

### secure

*private api*

Checks the received URL to see if the received `state` query string matches our
internal stored `state` so we can check if the request/response was tampered
with.

The method accepts a single argument:

- `url` Full, unparsed URL string that Bungie used to redirect to. Should
  include the `code` and `state` query string values.

The method will return a boolean indicating if the URL is secure.

```js
bungie.state = 'foo';
bungie.secure('http//example.com/oauth/redirect?state=foo&code=bar'); // true
```

### send

*private api*

Our internal HTTP request method that does the API calls to the Bungie servers
to validate/request the tokens and codes we receive from the Authorization flow.
It automatically uses the supplied `config.key` for the `X-API-Key` header and
handles all responses as JSON responses.

It requires the following arguments:

- `pathname` The pathname of `/Platform/App/{pathanme here}/` we need to access.
- `body` An object that will be used as POST body.
- `fn` Completion callback that uses the error first callback pattern.

```js
bungie.send('GetAccessTokenFromRefreshToken', { 
  refreshToken: token 
}, function (err, data) {

});
```

### setTimeout

*private api*

Start the internal setTimeout so we can automatically refresh the cached
`accessToken` using the `refreshToken` so our internally cached token is alway
fresh and elimination possibility to provide an token that might expire in a
second or to accidentally send multiple refresh requests to the bungie API.

```js
bungie.setTimeout();
```

## Pre-build

- [Electron](#electron)

In addition to the pre-build authorization flows for the various of frameworks
that we support it is quite easy to roll your own. The only thing you need todo
is extend our class and implement the `open` method as shown below:

```js
import Bungo from 'bungie-auth';

export default class MyImplementation extends Bungo {
  open(fn) {
    const url = this.url();

    /* 
    do the stuffs that opens the authorization url and receives the redirect
    information and call the `fn` callback function with an optional error as
    first argument and the redirected URL as second argument and you're done.
    */
  }
}
```

After that you just construct an instance of your custom `MyImplementation`
class and it should work with our described API's! If you want to contribute
back to the community, we would love to support more pre-build authorization
flows to make it easier for other people to create applications. So create
a pull request with your new implementation and we'll make that happen!

### Electron

This is a pre-build authorization flow for Electron so you can easily build
desktop applications that interact with the Bungie.net API. The API should run
in the electron instance and not the browser instance as it needs to be able to
spawn windows and do POST calls to the Bungie API for access tokens.

The following properties are specific to `electron`

- `electron` Allows you to control options for the created `BrowserWindow` by
  default we will spawn a window that the same size as oAuth window.

While we allow you to configure the `browser` option, we forcefully apply
`nodeIntergration: false` so the authentication actually works.

```js
import Bungo from 'bungie-auth/electron';

const bungo = new Bungo({ /*.. config ..*/ });

bungo.token(function token(err, data) {
  console.log(data.accessToken.value); // CJ098da098df...
});
```
## License

This module is released under the MIT license.
