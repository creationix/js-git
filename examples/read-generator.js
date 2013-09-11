var platform = require('git-node-platform');
var jsGit = require('../.')(platform);
var fsDb = require('git-fs-db')(platform);
var fs = platform.fs;
var run = require('gen-run');

// Create a filesystem backed bare repo
var repo = jsGit(fsDb(fs("test.git")));

run(start("HEAD"));

function* start(hashish) {
  var hash = yield repo.resolveHashish(hashish);
  console.log(hashish, hash);
  yield* loadCommit(hash);
}

function* loadCommit(hash) {
  var commit = yield repo.loadAs("commit", hash);
  console.log("COMMIT", hash, commit);
  var tree = yield repo.loadAs("tree", commit.tree);
  console.log("TREE", commit.tree, tree);
  yield* each(tree, loadEntry);
  yield* each(commit.parents, loadCommit);
}

function* loadEntry(entry) {
  var blob = yield repo.loadAs("blob", entry.hash);
  console.log("BLOB", entry.hash, blob);
}

function* each(array, onItem) {
  for (var i = 0, l = array.length; i < l; ++i) {
    yield* onItem(array[i]);
  }
}