// Inject the dependencies to fsDb to work using node.js
var fsDb = require('../lib/fs-db.js')(require('./node'));
var bops = require('bops');

// Mock data for creating generating some history
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

fsDb("test.git", { bare: true, init: true}, function (err, db) {
  if (err) throw err;

  console.log("Git database Initialized");
  var parent;
  asyncEach(commits, function (message, files, next) {
    // Start building a tree object.
    var tree = {};
    asyncEach(files, function (name, contents, next) {
      db.save(encodeBlob(contents), function (err, hash) {
        if (err) return next(err);
        tree[name] = {
          mode: 0100644,
          hash: hash
        };
        next();
      });
    }, function (err) {
      if (err) return next(err);
      db.save(encodeTree(tree), function (err, hash) {
        if (err) return next(err);
        var now = gitDate(new Date);
        var commit = {
          tree: hash,
          parent: parent,
          author: author + " " + now,
          committer: committer + " " + now,
          message: message
        };
        if (!parent) delete commit.parent;
        db.save(encodeCommit(commit), function (err, hash) {
          if (err) return next(err);
          parent = hash;
          updateHead(hash, next);
        });
      });
    });
  }, function (err) {
    if (err) throw err;
    console.log("Done");
  });

  function updateHead(hash, callback) {
    db.read("HEAD")(function (err, value) {
      if (err) return callback(err);
      if (value.substr(0, 4) !== "ref:") {
        return callback(new Error("HEAD must be symbolic ref"));
      }
      db.write(value.substr(4).trim(), hash + "\n", callback);
    });
  }

});

function asyncEach(object, fn, callback) {
  var keys = Object.keys(object);
  next();
  function next(err) {
    if (err) return callback(err);
    var key = keys.shift();
    if (!key) return callback();
    fn(key, object[key], next);
  }
}

function encodeBlob(buffer) {
  if (typeof buffer === "string") buffer = bops.from(buffer);
  return {
    type: "blob",
    size: buffer.length,
    body: buffer
  };
}

function pathCmp(a, b) {
  a += "/"; b += "/";
  return a < b ? -1 : a > b ? 1 : 0;
}

function encodeTree(tree) {
  var chunks = [];
  Object.keys(tree).sort(pathCmp).forEach(function (name) {
    var entry = tree[name];
    chunks.push(
      bops.from(entry.mode.toString(8) + " " + name + "\0"),
      bops.from(entry.hash, "hex")
    );
  });
  var body = bops.join(chunks);
  return {
    type: "tree",
    size: body.length,
    body: body
  };
}

function encodeCommit(commit) {
  var str = "";
  Object.keys(commit).forEach(function (key) {
    if (key === "message") return;
    var value = commit[key];
    if (key === "parents") {
      value.forEach(function (value) {
        str += "parent " + value + "\n";
      });
    }
    else {
      str += key + " " + value + "\n";
    }
  });
  var body = bops.from(str + "\n" + commit.message);
  return {
    type: "commit",
    size: body.length,
    body: body
  };

}

// Format a js data object into the data format expected in git commits.
function gitDate(date) {
  var timezone = date.getTimezoneOffset() / 60;
  var seconds = Math.floor(date.getTime() / 1000);
  return seconds + " " + (timezone > 0 ? "-0" : "0") + timezone + "00";
}
