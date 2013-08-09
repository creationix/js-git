// Bootstrap the platform to run on node.js
require('../lib/platform.js')(require('js-git-node-platform'));

// Load the libraries
var fsDb = require('../lib/fs-db.js');
var wrap = require('../lib/repo.js');
var run = require('gen-run');

// Mock data for generating some history
var author = "Tim Caswell <tim@creationix.com>";
var committer = "JS-Git <js-git@creationix.com>";
var commits = {
  "Initial Commit\n": {
    "README.md": "# This is a test Repo\n\nIt's generated entirely by JavaScript\n"
  },
  "Add package.json and blank module\n": {
    "README.md": "# This is a test Repo\n\nIt's generated entirely by JavaScript\n",
    "package.json": '{\n  "name": "awesome-lib",\n  "version": "3.1.3",\n  "main": "awesome.js"\n}\n',
    "awesome.js": 'module.exports = function () {\n  throw new Error("TODO: Implement Awesome");\n};\n'
  },
  "Implement awesome and bump version to 3.1.4\n": {
    "README.md": "# This is a test Repo\n\nIt's generated entirely by JavaScript\n",
    "package.json": '{\n  "name": "awesome-lib",\n  "version": "3.1.4",\n  "main": "awesome.js"\n}\n',
    "awesome.js": 'module.exports = function () {\n  return 42;\n};\n'
  }
};

run(function *() {
  var repo = wrap(fsDb("test.git", true));

  yield repo.init();
  console.log("Git database Initialized");

  var parent;
  yield* each(commits, function* (message, files) {
    // Start building a tree object.
    var tree = {};

    yield* each(files, function* (name, contents) {
      tree[name] = {
        mode: 0100644,
        hash: yield repo.saveBlob(contents)
      };
    });

    var now = gitDate(new Date);
    var commit = {
      tree: yield repo.saveTree(tree),
      parent: parent,
      author: author + " " + now,
      committer: committer + " " + now,
      message: message
    };

    if (!parent) delete commit.parent;

    parent = yield repo.saveCommit(commit);

    yield repo.updateHead(parent);
  });

  console.log("Done");

});

// Format a js data object into the data format expected in git commits.
function gitDate(date) {
  var timezone = date.getTimezoneOffset() / 60;
  var seconds = Math.floor(date.getTime() / 1000);
  return seconds + " " + (timezone > 0 ? "-0" : "0") + timezone + "00";
}

// Mini control-flow library
function* each(object, fn) {
  var keys = Object.keys(object);
  for (var i = 0, l = keys.length; i < l; i++) {
    var key = keys[i];
    yield* fn(key, object[key]);
  }
}
