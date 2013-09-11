var platform = require('git-node-platform');
var jsGit = require('../.')(platform);
var fsDb = require('git-fs-db')(platform);
var fs = platform.fs;
var run = require('gen-run');

// Create a filesystem backed bare repo
var fs = fs("test.git");
var db = fsDb(fs);
var repo = jsGit({ db: db });

var mock = require('./mock.js');

run(function *() {
  yield repo.setBranch("master");
  console.log("Git database Initialized");

  var head;
  console.log(yield* map(mock.commits, function* (files, message) {
    return head = yield repo.saveAs("commit", {
      tree: yield repo.saveAs("tree", yield* map(files, function* (contents) {
        return {
          mode: 0100644,
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
  var obj = {};
  for (var key in object) {
    var value = object[key];
    obj[key] = yield* onItem(value, key);
  }
  return obj;
}


