var platform = require('git-node-platform');
var jsGit = require('../.')(platform);

var repo = jsGit({});

repo.addRemote("origin", "git://github.com/creationic/conquest.git");
repo.lsRemote("origin", function (err, refs) {
  if (err) throw err;
  Object.keys(refs).forEach(function (ref) {
    console.log(refs[ref] + "\t" + ref);
  });
});
