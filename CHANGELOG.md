# CHANGELOG

### 0.0.8

- The auto refresh was not set correctly because the different was calculated
  incorrectly. We now re-use the logic from our token expiree.
- Reduce the buffer that is used in the `expires` method to give our refresh
  functionality more time.

### 0.0.7

- Clean up the debug information output with more information about the expiree.

### 0.0.6

- Added error callback for when user denies/declines the oauth.

### 0.0.5

- Send only the token's value to the Bungie servers instead of the full refresh
  object.
- Added `diagnostics` integration so we can see what is going on with the auth
  flow using `DEBUG=bungie-auth*` env variables.

### 0.0.4

- Call the `fresh` option also when we first receive our tokens so we can
  actually store that shit.

### 0.0.3

- Opt-in to `babel-register` compilation by setting `babel-ignore` to `false` in
  the `package.json`

### 0.0.2

- Use the correct window options for electron so that auth window actually
  displays on top of other windows as it's most likely the most important window
  in your application at that moment.

### 0.0.1

- Added missing babel preset & config.
- Added example for cordova (not documented or tested).
- Renamed `browser` to `electron` for electron configuration.

### 0.0.0

- Initial release.
