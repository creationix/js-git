var jsGit = require('../.');
var platform = require('git-node-platform');
var fsDb = require('git-fs-db');

// Create a filesystem backed bare repo
var repo = jsGit({
  db: fsDb(platform.fs("test.git"), platform),
}, platform);

loadCommit("HEAD");

function loadCommit(hashish) {
  repo.loadAs("commit", hashish, onCommit);
}

function onCommit(err, commit, hash) {
  if (err) throw err;
  console.log("COMMIT", hash, commit);
  loadTree(commit.tree);
  if (commit.parents) {
    commit.parents.forEach(loadCommit);
  }
}

function loadTree(hash) {
  repo.loadAs("tree", hash, onTree);
}

function onTree(err, tree, hash) {
  if (err) throw err;
  console.log("TREE", hash, tree);
  tree.forEach(onEntry);
}

function onEntry(entry) {
  repo.loadAs("blob", entry.hash, function (err, blob) {
    if (err) throw err;
    console.log("BLOB", entry.hash, blob);
  });
}
