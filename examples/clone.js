
var url = process.argv[2] || "git://github.com/creationix/conquest.git";
var path = url.split("/");
path = path[path.length - 1];

var platform = require('./node');
// And create a db instance as a local bare repo
var db = require('../lib/fs-db.js')(platform)(path, true);
// And wrap in a repo API
var repo = require('../lib/repo.js')(db);
// Get the pull logic
var pull = require('../lib/pull.js');


repo.init(function (err) {
  if (err) throw err;
  repo.lsRemote(url, function (err, refs) {
    if (err) throw err;
    console.log("refs", refs);
  });
});

