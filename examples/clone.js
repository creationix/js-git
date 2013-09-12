var platform = require('git-node-platform');
var jsGit = require('../.')(platform);
var gitRemote = require('git-net')(platform);
var fsDb = require('git-fs-db')(platform);
var fs = platform.fs;
var basename = require('path').basename;

// Create a remote repo
var url = process.argv[2] || "git://github.com/creationix/conquest.git";
var remote = gitRemote(url);

// Create a local repo
var path = process.argv[3] || basename(remote.pathname);
var repo = jsGit(fsDb(fs(path)));

console.log("Cloning %s to %s", url, path);

var opts = {
  onProgress: function (progress) {
    process.stdout.write(progress);
  }
};
if (process.env.DEPTH) {
  opts.depth = parseInt(process.env.DEPTH, 10);
}

repo.fetch(remote, opts, function (err) {
  if (err) throw err;
  console.log("Done");
});
