# mem-db mixin

This mixin implements object store (normal and raw) and stores the data in memory.

```js
var memDb = require('js-git/mixins/mem-db');
var repo = {};
memDb(repo);
repo.saveAs("blob", "Hello World", function (err, hash) {
  if (err) throw err;
  console.log("Blob saved with hash " + hash);
});
```

This attaches the following interfaces onto the repo object passed in:

 - `saveAs(type, body) => hash`
 - `loadAs(type, hash) => body`
 - `loadRaw(hash) => raw-binary`
 - `saveRaw(hash, raw-binary) =>`

All these functions are async and accept either a callback last or return a continuable.

```js
// Example using continuable interface from gen-run generator body.
var commit = yield repo.loadAs("commit", commitHash);
```