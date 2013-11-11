js-git
======

Git Implemented in JavaScript.

This project is very modular and configurable by gluing different components together.

This repo, `js-git`, is the core implementation of git and consumes various instances of interfaces.  This means that your network and persistance stack is completely pluggable.

If you're looking for a more pre-packaged system, consider packages like `creationix/git-node` that implement all the abstract interfaces using node.js native APIs.  The `creationix/jsgit` package is an example of a CLI tool that consumes this.

The main end-user API as exported by this module for working with local repositories is:

## Initialize the library

First you create an instance of the library by injecting the platform dependencies.

```js
var platform = require('git-node-platform');
var jsGit = require('js-git')(platform);
```

## Wrap a Database

Then you implement the database interface (or more likely use a library to create it for you).

```js
var fsDb = require('git-fs-db')(platform);
var db = fsDb("/path/to/repo.git");
```

The database interface is documented later on.

## Continuables

In all public async functions you can either pass in a node-style callback last or omit the callback and it will return you a continuable.

This means you can consume the js-git library using normal ES3 code or if you prefer use [gen-run][] and consume the continuables.

If the callback is omitted, a continuable is returned.  You must pass a callback into this continuable to actually start the action.

```js
// Callback mode
jsgit.someAction(arg1, arg2, function (err, result) {
  ...
});

// Continuable mode
var cont = jsgit.someAction(arg1, arg2);
cont(function (err, result) {
  ...
});

// Continuable mode with gen-run
var result = yield jsgit.someAction(arg1, arg2);
```

### db.get(key, [callback]) -> value

Load a ref or object from the database.

The database should assume that keys that are 40-character long hex strings are sha1 hashes.  The value for these will always be binary (`Buffer` in node, `Uint8Array` in browser)
All other keys are paths like `refs/heads/master` or `HEAD` and the value is a string.


### db.set(key, value, [callback])

Save a value to the database.  Same rules apply about hash keys being binary values and other keys being string values.

### db.has(key, [callback]) -> hasKey?

Check if a key is in the database

### db.del(key, [callback])

Remove an object or ref from the database.

### db.keys(prefix, [callback]) -> keys

Given a path prefix, give all the keys.  This is like a readdir if you treat the keys as paths.

For example, given the keys `refs/heads/master`, `refs/headers/experimental`, `refs/tags/0.1.3` and the prefix `refs/heads/`, the output would be `master` and `experimental`.

A null prefix returns all non hash keys.

### db.init([callback])

Initialize a database.  This is where you db implementation can setup stuff.

### db.clear([callback])

This is for when the user wants to delete or otherwise reclaim your database's resources.


### Wrapping the DataBase

Now that you have a database instance, you can use the jsGit library created above.

```js
var repo = jsGit(db);
```

### repo.load(hash(ish), [callback]) -> git object

Load a git object from the database.  You can pass in either a hash or a symbolic name like `HEAD` or `refs/tags/v3.1.4`.

The object will be of the form:

```js
{
  type: "commit", // Or "tag", "tree", or "blob"
  body: { ... } // Or an array for tree and a binary value for blob.
}
```

### repo.save(object, [callback]) -> hash

Save an object to the database.  This will give you back the hash of the cotent by which you can retrieve the value back.

### repo.loadAs(type, hash, [callback]) -> body

This convenience wrapper will call `repo.save` for you and then check if the type is what you expected.  If it is, it will return the body directly.  If it's not, it will error.

```js
var commit = yield repo.loadAs("commit", "HEAD");
var tree = yield repo.loadAs("tree", commit.tree);
```

I'm using yield syntax because it's simpler, you can use callbacks instead if you prefer.

### repo.saveAs(type, body, [callback]) -> hash

Another convenience wrapper, this time to save objects as a specefic type.  The body must be in the right format.

```js
var blobHash = yield repo.saveAs("blob", binaryData);
var treeHash = yield repo.saveAs("tree", [
  { mode: 0100644, name: "file.dat", hash: blobHash }
]);
var commitHash = yield repo.saveAs("commit", {
  tree: treeHash,
  author: { name: "Tim Caswell", email: "tim@creationix.com", date: new Date },
  message: "Save the blob"
});
```

### repo.remove(hash, [callback])

Remove an object.

### repo.unpack(packFileStream, opts, [callback])

Import a packfile stream (simple-stream format) into the current database.  This is used mostly for clone and fetch operations where the stream comes from a remote repo.

`opts` is a hash of optional configs.

 - `opts.onProgress(progress)` - listen to the git progress channel by passing in a event listener.
 - `opts.onError(error)` - same thing, but for the error channel.
 - `opts.deline` - If this is truthy, the progress and error messages will be rechunked to be whole lines.  They usually come jumbled in the internal sidechannel.

### repo.logWalk(hash(ish), [callback]) -> log stream

This convenience wrapper creates a readable stream of the history sorted by author date.

If you want full history, pass in `HEAD` for the hash.

### repo.treeWalk(hash(ish), [callback]) -> file stream

This helper will return a stream of files suitable for traversing a file tree as a linear stream.  The hash can be a ref to a commit, a commit hash or a tree hash directly.

### repo.walk(seed, scan, loadKey, compare) -> stream

This is the generic helper that `logWalk` and `treeWalk` use.  See `js-git.js` source for usage.

### repo.resolveHashish(hashish, [callback]) -> hash

Resolve a ref, branch, or tag to a real hash.

### repo.updateHead(hash, [callback])

Update whatever branch `HEAD` is pointing to so that it points to `hash`.

You'll usually want to do this after creating a new commint in the HEAD branch.

### repo.getHead([callback]) -> ref name

Read the current active branch.

### repo.setHead(ref, [callback])

Set the current active branch.

### repo.fetch(remote, opts, [callback])

Convenience wrapper that fetches from a remote instance and calls `repo.unpack` with the resulting packfile stream for you.

## Related Packages

Being that js-git is so modular, here is a list of the most relevent modules that work with js-git:

 - <https://github.com/creationix/git-net> - A generic remote protocol implementation that wraps the platform interfaces and consumes urls.
 - Example Applications
   - <https://github.com/creationix/git-browser> - A multi-platform GUI program that clones and browses git repos.
   - <https://github.com/creationix/jsgit> - An example of using js-git in node.  This is a CLI tool.
     - <https://github.com/creationix/git-node> - A packaged version of js-git made for node.js
 - Platform Helpers
   - <https://github.com/creationix/git-http> - A git-http platform interface adapter that wraps git-tcp platform instances.
   - <https://github.com/creationix/git-node-platform> - Just the platform interface for using js-git on node.js.
   - <https://github.com/creationix/git-sha1> - A pure-js implementation of the sha1 part of the platform interface.
   - <https://github.com/creationix/git-web-platform> - An implementation of js-git platform for browsers.
   - <https://github.com/creationix/websocket-tcp-client> - An implementation of the git-tcp interface that consumes a websocket to tcp proxy server.
   - <https://github.com/creationix/git-zlib> - A pure-js implementation of the zlib parts of the platform interface.
 - Storage Backends
   - <https://github.com/creationix/git-fs-db> - A database interface adapter that wraps a fs interface.
   - <https://github.com/creationix/git-localdb> - A git-db implementation based on `localStorage`.
   - <https://github.com/creationix/git-memdb> - A git-db implementation that stores data in ram for quick testing.
   - <https://github.com/aaronpowell/git-indexeddb> - A git-db implementation cased on `indexedDB`.

[gen-run]: https://github.com/creationix/gen-run
