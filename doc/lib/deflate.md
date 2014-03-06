# Deflate

This module implements a simple interface that when normal given data, gives
you back the deflated version in a callback.  This will use node's native zlib
bindings when available, but otherwise, wraps the pako dependency.

## deflate(inflated) => deflated

```js
var deflate = require('js-git/lib/deflate');

deflate(original, function (err, deflated) {
  if (err) throw err;
  // yay
});
```
