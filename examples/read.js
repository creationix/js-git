// Bootstrap the platform to run on node.js
require('../lib/platform.js')(require('js-git-node-platform'));

// Load the libraries
var fsDb = require('../lib/fs-db.js');
var wrap = require('../lib/repo.js');

var repo = wrap(fsDb("test.git", true));

console.log("Looking up hash that HEAD points to...");
repo.getHead(function (err, head) {
  if (err) throw err;

  console.log("HEAD", head);
  return loadCommit(head);

});

function loadCommit(hash) {
  repo.loadCommit(hash, function (err, commit) {
    if (err) throw err;
    console.log("COMMIT", hash, commit);
    loadTree(commit.tree);
    if (commit.parents) {
      commit.parents.forEach(loadCommit);
    }
  });
}

function loadTree(hash) {
  repo.loadTree(hash, function (err, tree) {
    if (err) throw err;
    console.log("TREE", hash, tree);
    tree.forEach(function (entry) {
      repo.loadBlob(entry.hash, function (err, blob) {
        if (err) throw err;
        console.log("BLOB", entry.hash, blob);
      });
    });
  });
}