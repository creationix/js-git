var platform = require('git-node-platform');
var jsGit = require('../.');
var fsDb = require('git-fs-db')(platform);
var fs = platform.fs;

if (!module.parent) {
  // Create a filesystem backed bare repo
  var repo = jsGit(fsDb(fs("test.git")));
  create(repo, function (err) {
    if (err) throw err;
  });
}
else {
  module.exports = create;
}


function create(repo, callback) {

  var mock = require('./mock.js');

  repo.setHead("master", function (err) {
    if (err) return callback(err);
    console.log("Git database Initialized");

    var parent;
    serialEach(mock.commits, function (message, files, next) {
      // Start building a tree object.
      var tree = {};
      parallelEach(files, function (name, contents, next) {
        repo.saveAs("blob", contents, function (err, hash) {
          if (err) return next(err);
          tree[name] = {
            mode: 0100644,
            hash: hash
          };
          next();
        });
      }, function (err) {
        if (err) return next(err);
        repo.saveAs("tree", tree, function (err, hash) {
          if (err) return next(err);
          var commit = {
            tree: hash,
            parent: parent,
            author: mock.author,
            committer: mock.committer,
            message: message
          };
          if (!parent) delete commit.parent;
          repo.saveAs("commit", commit, function (err, hash) {
            if (err) return next(err);
            parent = hash;
            repo.updateHead(hash, next);
          });
        });
      });
    }, callback);
  });

}

// Mini control-flow library
function serialEach(object, fn, callback) {
  var keys = Object.keys(object);
  next();
  function next(err) {
    if (err) return callback(err);
    var key = keys.shift();
    if (!key) return callback();
    fn(key, object[key], next);
  }
}
function parallelEach(object, fn, callback) {
  var keys = Object.keys(object);
  var left = keys.length + 1;
  var done = false;
  keys.forEach(function (key) {
    fn(key, object[key], check);
  });
  check();
  function check(err) {
    if (done) return;
    if (err) {
      done = true;
      return callback(err);
    }
    if (--left) return;
    done = true;
    callback();
  }
}
