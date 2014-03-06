# Inflate Stream

This module implements zlib inflate by hand with a special streaming interface.
This is used in js-git to inflate git object fragments in a pack-stream.

## inflateStream(onEmit, onUnused) -> onInput

```js
var onInput = inflateStream(onEmit, onUnused);

someStream.on("data", function (chunk) {
  onInput(null, chunk);
});

function onEmit(err, out) {
  if (err) throw err;
  // out is a chunk of inflated data
}

function onUnused(chunks) {
  // chunks is an array of extra buffers or buffer slices.
}
```
