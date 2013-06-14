# Git Database

This interface describes the git database used to store git objects (blobs, trees, commits, and tags) as well as refs (bookmarks to hashes).

The objects are stored by the sha1 of their binary representation as the key.  The refs are more like key/value entries where key is the name and value if the hash or symbolic name.

All examples use `yield` to consume [continuables][], assuming generators with [gen-run][] wrapping, but can be used with ES5 code as well.  Streams are in [min-stream][] format.

```js
// ES6 syntax
var target = yield fs.readlink("/path/to/symlink");

// ES5 syntax
fs.readlink("/path/to/symlink")(function (err, target) {
  if (err) throw err;
  // do something with target
});
```

## load(hash) -> source&lt;binary>

Given an object hash, return a data stream.  

```js
var stream = db.load(hash);
```

## save(source) -> continuable&lt;hash>

Save an object to the database.  Source is a binary data stream already git encoded.

The output is the SHA1 hash (hex encoded) of the stream's contents where the data can later be retrieved.

```js
var hash = yield db.save(stream);
```

## read(path) -> continuable&lt;hash>

Read a ref by path.  This will auto-resolve symbolic refs.

```js
var hash = yield db.read("HEAD");
```

## write(path, hash) -> continuable

Write a ref to the database.

```js
yield db.write("/refs/heads/master", hash);
```

## readSym(path) -> continuable&lt;path>

Read a ref by path, but don't auto-resolve symbolic refs.

```js
var HEAD = yield db.readSym("HEAD");
```

## writeSym(path, target) -> continuable

Write a symbolic ref to the database.

```js
yield sb.writeSym("HEAD", "/refs/heads/master");
```

## listObjects() -> source&lt;hash>

Create a stream of all the hash keys in the database.

```js
var hashStream = db.listObjects();
```

## listRefs() -> source&lt;path>

Create a stream that emits all ref paths.

```js
var pathStream = db.listRefs();
```

## removeObject(hash) -> continuable

Given a hash, remove an object from the database.

```js
yield db.removeObject(hash);
```

## removeRef(path) -> continuable

Delete a ref by path.

```js
yield db.removeRef("/refs/heads/temp");
```

# Concrete Implementations

There isn't one yet, but a generic one that builds on top of a generic K/V store and the [sha1][] interface could easly be build as long as the K/V store allowed for renames or naming after writing.

- [git-repo/fs-db.js](https://github.com/creationix/git-repo/blob/master/fs-db.js) An in-progress implementation that sits on top of a fs interface isntance.

[gen-run]: https://github.com/creationix/gen-run
[continuables]: https://github.com/creationix/js-git/blob/master/specs/continuable.md
[sha1]: https://github.com/creationix/js-git/blob/master/specs/sha1.md
[min-stream]: https://github.com/creationix/js-git/blob/master/specs/min-stream.md
