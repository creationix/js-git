var platform = require('git-node-platform');
var jsGit = require('../.')(platform);
var gitRemote = require('git-net')(platform);
var fsDb = require('git-fs-db')(platform);
var fs = platform.fs;
var basename = require('path').basename;

// Create a remote repo
var url = process.argv[2] || "git@github.com:creationix/conquest.git";
var remote = gitRemote(url);

// Create a local repo
var path = process.argv[3] || basename(remote.pathname);
var repo = jsGit(fsDb(fs(path)));

console.log("Pushing %s to %s", path, url);

var opts = {
  onProgress: function (progress) {
    process.stderr.write(progress);
  }
};
repo.send(remote, opts, function (err) {
  if (err) throw err;
  console.log("Done");
});
