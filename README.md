# JS-Git

This project is a collection of modules that helps in implementing git powered
applications in JavaScript.  The original purpose for this is to enable better
developer tools for authoring code in restricted environments like ChromeBooks
and tablets.  It also enables using git at a database to replace SQL and no-SQL
data stores in many applications.

This project was initially funded by two crowd-sourced fundraisers.  See details
in [BACKERS.md](BACKERS.md) and [BACKERS-2.md](BACKERS.md).  Thanks to all of
you who made this possible!

## Usage

Detailed API docs are contained in the [doc](doc) subfolder of this repository.

In general the way you use js-git is you create a JS object and then mixin the
functionality you need.  Here is an example of creating an in-memory database,
creating some objects, and then walking that tree using the high-level walker
APIs.

```js
// This provides symbolic names for the octal modes used by git trees.
var modes = require('js-git/lib/modes');

// Create a repo by creating a plain object.
var repo = {};

// This provides an in-memory storage backend that provides the following APIs:
// - saveAs(type, value) => hash
// - loadAs(type, hash) => hash
// - saveRaw(hash, binary) =>
// - loadRaw(hash) => binary
require('../mixins/mem-db')(repo);

// This adds a high-level API for creating multiple git objects by path.
// - createTree(entries) => hash
require('../mixins/create-tree')(repo);

// This provides extra methods for dealing with packfile streams.
// It depends on
// - unpack(packStream, opts) => hashes
// - pack(hashes, opts) => packStream
require('../mixins/pack-ops')(repo);

// This teaches the repo the client half of git network protocols:
// - fetchPack(remote, opts) =>
// - sendPack(remote, opts) =>
require('../mixins/client')(repo);

// This adds in walker algorithms for quickly walking history or a tree.
// - logWalk(ref|hash) => stream<commit>
// - treeWalk(hash) => stream<object>
require('../mixins/walkers')(repo);

// This combines parallel requests for the same resource for effeciency under load.
require('../mixins/read-combiner')(repo);

// This makes the object interface less strict.  See it's docs for details
require('../mixins/formats')(repo);
```

Now we have an in-memory git repo useful for testing the network operations or
just getting to know the available APIs.

In this example, we'll create a blob, create a tree containing that blob, create
a commit containing that tree.  This shows how to create git objects manually.

```js
// I'm using gen-run and ES6 generators to clean up the syntax, but normal
// node callback style also works.  All js-git APIs support both.
var run = require('gen-run');

run(function*() {

  // First we create a blob from a string.  The `formats` mixin allows us to
  // use a string directly instead of having to pass in a binary buffer.
  var blobHash = yield repo.saveAs("blob", "Hello World\n");

  // Now we create a tree that is a folder containing the blob as `greeting.txt`
  var treeHash = yield repo.saveAs("tree", {
    "greeting.txt": { mode: modes.file, hash: blobHash }
  });

  // With that tree, we can create a commit.
  // Again the `formats` mixin allows us to omit details like committer, date,
  // and parents.  It assumes sane defaults for these.
  var commitHash = yield repo.saveAs("commit", {
    author: {
      name: "Tim Caswell",
      email: "tim@creationix.com"
    },
    tree: treeHash,
    message: "Test commit\n"
  });

```

We can read objects back one at a time using `loadAs`.

```js
  // Reading the file "greeting.txt" from a commit.

  // We first read the commit.
  var commit = yield repo.loadAs("commit", commitHash);
  // We then read the tree using `commit.tree`.
  var tree = yield repo.loadAs("tree", commit.tree);
  // We then read the file using the entry hash in the tree.
  var file = yield repo.loadAs("blob", tree["greeting.txt"];
  // file is now a binary buffer.
```

When using the `formats` mixin there are two new types for loadAs, they are
`text` and `array`.

```js
  // When you're sure the file contains unicode text, you can load it as text directly.
  var fileAsText = yield repo.loadAs("text", blobHash);

  // Also if you prefer array format, you can load a directory as an array.
  var entries = yield repo.loadAs("array", treeHash);
  entries.forEach(function (entry) {
    // entry contains {name, mode, hash}
  });
```

Now that we have a repo with some minimal data in it, we can query it.  Since we
included the `walkers` mixin, we can walk the history as a linear stream or walk
the file tree as a depth-first linear stream.

```js
  // Create a log stream starting at the commit we just made.
  // You could also use symbolic refs like `refs/heads/master` for repos that
  // support them.
  var logStream = yield repo.logWalk(commitHash);

  // Looping through the stream is easy by repeatedly calling waiting on `read`.
  var commit, object;
  while (commit = yield logStream.read(), commit !== undefined) {

    console.log(commit);

    // We can also loop through all the files of each commit version.
    var treeStream = yield repo.treeWalk(commit.tree);
    while (object = yield treeStream.read(), object !== undefined) {
      console.log(object);
    }

  }
});
```

If you feel that creating a blob, then creating a tree, then creating the parent
tree, etc is a lot of work to save just one file, I agree.  While writing the
tedit app, I discovered a nice high-level abstraction that you can mixin to make
this much easier.  This is the `create-tree` mixin referenced in the above
config.

```js
// We wish to create a tree that contains `www/index.html` and `README.me` files.
// This will create these two blobs, create a tree for `www` and then create a
// tree for the root containing `README.md` and the newly created `www` tree.
var treeHash = yield repo.createTree({
  "www/index.html": {
    mode: modes.file,
    content: "<h1>Hello</h1>\n<p>This is an HTML page?</p>\n"
  },
  "README.md": {
    mode: modes.file,
    content: "# Sample repo\n\nThis is a sample\n"
  }
});
```

This is great for creating several files at once, but it can also be used to
edit existing trees by adding new files, changing existing files, or deleting
existing entries.

```js
