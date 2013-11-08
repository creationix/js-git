"use strict";
let platform = require('git-node-platform');
let jsGit = require('../.');
let fsDb = require('git-fs-db')(platform);
let fs = platform.fs;
let run = require('gen-run');

// Create a filesystem backed bare repo
let repo = jsGit(fsDb(fs("test.git")));

run(start("HEAD"));

function* start(hashish) {
  let hash = yield repo.resolveHashish(hashish);
  console.log(hashish, hash);
  yield* loadCommit(hash);
}

function* loadCommit(hash) {
  let commit = yield repo.loadAs("commit", hash);
  console.log("COMMIT", hash, commit);
  let tree = yield repo.loadAs("tree", commit.tree);
  console.log("TREE", commit.tree, tree);
  for (let entry of tree.values()) {
    let blob = yield repo.loadAs("blob", entry.hash);
    console.log("BLOB", entry.hash, blob);
  }
  for (let parent of commit.parents.values()) {
    yield* loadCommit(parent);
  }
}
