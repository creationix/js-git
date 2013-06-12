# Streaming SHA1 Hash

This interface is a simple SHA1 hash that acts as a [min-stream][] sink that consumes a data stream and emits a single hash value.

All examples use `yield` to consume [continuables][], assuming generators with [gen-run][] wrapping, but can be used with ES5 code as well.

```js
// ES6 syntax
var target = yield fs.readlink("/path/to/symlink");

// ES5 syntax
fs.readlink("/path/to/symlink")(function (err, target) {
  if (err) throw err;
  // do something with target
});
```

## sha1(source) -> continuable

Consume the source, digesting the bytes and dropping them on the floor.  The result will be the hash.  If you intend to save the stream somewhere, use a stream splitter.

```js
var hash = yield sha1(source);
```

[gen-run]: https://github.com/creationix/gen-run
[continuables]: https://github.com/creationix/js-git/blob/master/specs/continuable.md
[min-stream]: https://github.com/creationix/min-stream#the-interface
