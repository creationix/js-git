// Inject the dependencies to fsDb to work using node.js
var platform = require('./node');
// And create a db instance
var db = require('../lib/fs-db.js')(platform)("test.git", true);
// And wrap in a repo API
var repo = require('../lib/repo.js')(db);


require('gen-run')(function *() {

  console.log("Looking up hash that HEAD points to...");
  var hash = yield repo.getHead();
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
