"use strict";
let platform = require('git-node-platform');
let jsGit = require('../.')(platform);
let fsDb = require('git-fs-db')(platform);
let fs = platform.fs;
let run = require('gen-run');

// Create a filesystem backed bare repo
let repo = jsGit(fsDb(fs("test.git")));

let mock = require('./mock.js');

run(function *() {
  yield repo.setBranch("master");
  console.log("Git database Initialized");

  let head;
  console.log(yield* map(mock.commits, function* (files, message) {
    return head = yield repo.saveAs("commit", {
      tree: yield repo.saveAs("tree", yield* map(files, function* (contents) {
        return {
          mode: 33188, // 0100644,
          hash: yield repo.saveAs("blob", contents)
        };
      })),
      parent: head,
      author: mock.author,
      committer: mock.committer,
      message: message
    });
  }));

  yield repo.updateHead(head);
  console.log("Done");

});

function* map(object, onItem) {
  let obj = {};
  for (let key in object) {
    let value = object[key];
    obj[key] = yield* onItem(value, key);
  }
  return obj;
}


