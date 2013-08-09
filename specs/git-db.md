# Git Database

This interface describes the git database used to store git objects (blobs, trees, commits, and tags) as well as refs (bookmarks to hashes).

The objects are stored by the sha1 of their binary representation as the key.  The refs are more like key/value entries where key is the name and value if the hash or symbolic name.

All examples use `yield` to consume [continuables][], assuming generators with [gen-run][] wrapping, but can be used with ES5 code as well.  Streams are in [simple-stream][] format.

```js
// ES6 syntax
var target = yield fs.readlink("/path/to/symlink");

// ES5 syntax
fs.readlink("/path/to/symlink")(function (err, target) {
  if (err) throw err;
  // do something with target
});
```

## fs (working directory)

If the db also has a working directory (a non-bare repo), then fs is the [fs interface][] instance to the working directory.

## load(hash) -> continuable&lt;object>

Given an object hash, return a raw object.

```js
var stream = db.load(hash);
```

Raw objects have the following structure:

```js
{
  type: ("tree" | "blob" | "commit" | or "tag")
  body: Buffer
}
```

## save(object) -> continuable&lt;hash>

Save a raw object to the database.  Note that the body needs to be already encoded, but not include the type and length headers.

The output is the SHA1 hash (hex encoded) of the data (header included) where the data can later be retrieved.

```js
var hash = yield db.save(stream);
```

## read(path) -> continuable&lt;string>

Read a ref by path.  This does not auto-resolve symbolic refs.

```js
var sym = yield db.read("HEAD");
```

## write(path, string) -> continuable

Write a ref to the database.

```js
yield db.write("/refs/heads/master", hash);
yield db.write("HEAD", "ref: /refs/heads/master");
```

## remove(hash) -> continuable

Given a hash, remove an object from the database.

```js
yield db.remove(hash);
```

# Concrete Implementations

JS-Git comes with an adapter that implements this interface on top of a [fs interface] instance at `require('js-git/lib/fs-db.js')`.

[gen-run]: https://github.com/creationix/gen-run
[continuables]: https://github.com/creationix/js-git/blob/master/specs/continuable.md
[simple-stream]: https://github.com/creationix/js-git/blob/master/specs/simple-stream.md
[fs interface]: https://github.com/creationix/js-git/blob/master/specs/fs.md
