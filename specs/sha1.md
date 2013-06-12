# Streaming SHA1 Hash

This interface is a simple SHA1 hash that acts as a [min-stream][] sink that consumes a data stream and emits a single hash value.

All examples use `yield` to consume [continuables][], assuming generators with [gen-run][] wrapping, but can be used with ES5 code as well.

## sha1(source) -> continuable

Consume the source, digesting the bytes and dropping them on the floor.  The result will be the hash.  If you intend to save the stream somewhere, use a stream splitter.

```js
// ES6 syntax
var hash = yield sha1(source);

// ES5 syntax

sha1(source)(function (err, hash) {
  if (err) return handle(err);
  // handle hash
})
```

[gen-run]: https://github.com/creationix/gen-run
[continuables]: https://github.com/creationix/js-git/blob/master/specs/continuable.md
[min-stream]: https://github.com/creationix/min-stream#the-interface
