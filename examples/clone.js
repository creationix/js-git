
var platform = require('./node');
var proto = require('../protocols/auto.js')(platform);
var fsDb = require('../lib/fs-db.js')(platform);
var urlParse = require('url').parse;

var url = process.argv[2] || "git://github.com/creationix/conquest.git";
var opts = urlParse(url);
if (!opts.protocol) {
  opts = urlParse("ssh://" + url);
}
if (process.env.TRACE) opts.trace = require('./trace.js');
var path = opts.pathname.match(/[^\/]*$/)[0];
var connection = proto(opts);

connection.discover(function (err, result) {
  if (err) throw err;
  var refs = result.refs;
});



// var url = process.argv[2] || "git://github.com/creationix/conquest.git";
// var path = url.split("/");
// path = path[path.length - 1];
// var repo = require('../lib/repo.js')(fsDb(path, true));

// repo.init(function (err) {
//   if (err) throw err;
//   fetch(url, repo, {
//     includeTag: true,
//     onProgress: function (data) {
//       process.stdout.write(data);
//     },
//     onError: function (data) {
//       process.stderr.write(data);
//     }
//   }, function (err, report) {
//     if (err) throw err;
//     console.log("report", report);
//   });
// });
