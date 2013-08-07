var each = require('../helpers/each.js');
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
var repo = require('../lib/repo.js')(fsDb(path, true));

connection.discover(function (err, result) {
  if (err) throw err;
  var refs = result.refs;
  var wants = [];
  each(refs, function (name, hash) {
    if (name === "HEAD" || name.indexOf('^') > 0) return;
    wants.push("want " + hash);
  });

  connection.negotiate(wants, {
    serverCaps: result.caps,
    includeTag: true,
    onProgress: function (data) {
      process.stdout.write(data);
    },
    onError: function (data) {
      process.stderr.write(data);
    }
  }, function (err, packStream) {
    if (err) return callback(err);
    repo.init(function (err) {
      if (err) throw err;
      repo.importRefs(refs, function (err) {
        if (err) throw err;
        repo.unpack(packStream, function (err) {
          if (err) throw err;
          console.log("DONE");
        });
      });
    });
  });
});
