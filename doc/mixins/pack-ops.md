# pack-ops mixin

This mixin adds the ability to consume or create packfile streams.

This depends on the repo already having:

 - `loadRaw(hash) => raw-binary`
 - `saveRaw(hash, raw-binary) =>`

And then adds:

 - `unpack(stream, opts) => hashes`
 - `pack(hashes, opts) => stream`

The streams are simple-stream format.  This means they have a `.take(callback)`
method for pulling items out of the stream.

Example:

```js
var packOps = require('js-git/mixins/pack-ops');
packOps(repo);

repo.unpack(stream, opts, function (err, hashes) {
  // hashes is imported objects
});

repo.pack(hashes, opts, function (err, stream) {
  if (err) throw err;
  stream.take(onRead);
  function onRead(err, chunk) {
    if (err) throw err;
    console.log(chunk);
    if (item) stream.take(onRead);
  }
});
```
