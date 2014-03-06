# Inflate

This module implements a simple interface that when given deflated data, gives
you back the inflated version in a callback.  This will use node's native zlib
bindings when available, but otherwise, wrap the included streaming inflate.

## inflate(deflated) => inflated

```js
var inflate = require('js-git/lib/inflate');

inflate(deflated, function (err, inflated) {
  if (err) throw err;
  // yay
});
```
