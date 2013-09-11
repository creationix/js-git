var platform = require('git-node-platform');
var jsGit = require('../.')(platform);
var fsDb = require('git-fs-db')(platform);
var fs = platform.fs;

// Create a filesystem backed bare repo
var fs = fs("test.git");
var db = fsDb(fs);
var repo = jsGit({ db: db });

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
