# pack-ops mixin

This mixin adds the ability to consume or create packfile streams.

This depends on the repo already having:

 - `loadRaw(hash) => raw-binary`
 - `saveRaw(hash, raw-binary) =>`

And then adds:

 - `unpack(stream, opts) => hashes`
 - `pack(hashes, opts) => stream`

The streams are simple-stream format.  This means they have a `.read(callback)`
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
  stream.read(onRead);
  function onRead(err, item) {
    if (err) throw err;
    console.log(item);
    if (item) stream.read(onRead);
  }
});
```
