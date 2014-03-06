# Deflate

This module implements a simple interface that when normal given data, returns the deflated version in a callback.  This wraps the pako dependency.

## deflate(inflated) => deflated

```js
var deflate = require('js-git/lib/deflate');

var deflated = deflate(original);
```
