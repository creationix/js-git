var platform = require('git-node-platform');
var jsGit = require('../.')(platform);
var gitRemote = require('git-net')(platform);

var repo = jsGit();

var url = process.argv[2] || "git://github.com/creationix/conquest.git";
repo.lsRemote(gitRemote(url), function (err, refs) {
  if (err) throw err;
  Object.keys(refs).forEach(function (ref) {
    console.log(refs[ref] + "\t" + ref);
  });
});
