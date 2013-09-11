var platform = require('git-node-platform');
var jsGit = require('../.')(platform);

var repo = jsGit();

var url = process.argv[2] || "git://github.com/creationic/conquest.git";
repo.lsRemote(url, function (err, refs) {
  if (err) throw err;
  Object.keys(refs).forEach(function (ref) {
    console.log(refs[ref] + "\t" + ref);
  });
});
