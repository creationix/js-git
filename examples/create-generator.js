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

  var parent;
  yield* each(mock.commits, function* (message, files) {
    var tree = {};
    yield* each(files, function * (name, contents) {
      tree[name] = {
        mode: 0100644,
        hash: yield repo.saveAs("blob", contents)
      };
    });
    var commit = {
      tree: yield repo.saveAs("tree", tree),
      parent: parent,
      author: mock.author,
      committer: mock.committer,
      message: message
    };
    var hash = yield repo.saveAs("commit", commit);
    parent = hash;
    yield repo.updateHead(hash);
  });
  console.log("Done");

});

function* each(object, onItem) {
  for (var key in object) {
    var value = object[key];
    yield* onItem(key, value);
  }
}
