# Bungie Auth

The `bungie-auth` module exposes a nice API to authenticate withe Bungie.net's
oAuth 2.0 based authentication process.

## Installation

```
npm install --save bungie-auth
```

## Usage

The following configuration values are **required**:

- `url` The unique `Authorization URL` that Bungie created for your application.
- `key` The API for your `Authorization URL`.

While not strictly **required** you want to supply this by default as well if
you have it:

- `refreshToken` The `responseToken` object you got back from the API.
- `accessToken` The `accessToken` object you got back from the API.

These values should be stored locally and securely so you don't have to
authenticate every single time people open your application.

#### API

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

## Electron

This is a pre-build authorization flow for Electron so you can easily build
desktop applications that interact with the Bungie.net API. The API should run
in the electron instance and not the browser instance as it needs to be able to
spawn windows and do POST calls to the Bungie API for access tokens.

The following properties are specific to `electron`

- `browser` Allows you to control options for the created `BrowserWindow` by
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

