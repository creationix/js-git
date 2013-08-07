var platform = require('./node');
var fsDb = require('../lib/fs-db.js')(platform);
var fetch = require('../lib/network.js')(platform).fetch;

var url = process.argv[2] || "git://github.com/creationix/conquest.git";
var path = url.split("/");
path = path[path.length - 1];
var repo = require('../lib/repo.js')(fsDb(path, true));

repo.init(function (err) {
  if (err) throw err;
  fetch(url, repo, {
    includeTag: true,
    onProgress: function (data) {
      process.stdout.write(data);
    },
    onError: function (data) {
      process.stderr.write(data);
    }
  }, function (err, report) {
    if (err) throw err;
    console.log("report", report);
  });
});
