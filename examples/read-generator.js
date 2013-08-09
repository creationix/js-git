// Bootstrap the platform to run on node.js
require('../lib/platform.js')(require('js-git-node-platform'));

// Load the libraries
var fsDb = require('../lib/fs-db.js');
var wrap = require('../lib/repo.js');
var run = require('gen-run');

run(function*() {

  var repo = wrap(fsDb("test.git", true));

  console.log("Looking up hash that HEAD points to...");
  var hash = yield repo.get("HEAD");
  console.log("HEAD", hash);

  do {
    var commit = yield repo.loadCommit(hash);
    console.log("COMMIT", hash, commit);

    var tree = yield repo.loadTree(commit.tree);
    console.log("TREE", commit.tree, tree);

    yield* each(tree, function* (entry) {
      var blob = yield repo.loadBlob(entry.hash);
      console.log("BLOB", entry.hash, blob);
    });

    hash = commit.parents ? commit.parents[0] : null;

  } while (hash);

});

// Mini control-flow library
function* each(array, fn) {
  for (var i = 0, l = array.length; i < l; i++) {
    yield* fn(array[i]);
  }
}
