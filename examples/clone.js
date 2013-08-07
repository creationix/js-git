var platform = require('./node');
var fsDb = require('../lib/fs-db.js')(platform);
var fetch = require('../lib/fetch.js')(platform);

var url = process.argv[2] || "git://github.com/creationix/conquest.git";
var path = url.split("/");
path = path[path.length - 1];

var repo = require('../lib/repo.js')(fsDb(path, true));

repo.init(function (err) {
  if (err) throw err;
  fetch(repo, url, function (err, report) {
    if (err) throw err;
    console.log("report", report);
  });
});
