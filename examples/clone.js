// Bootstrap the platform to run on node.js
require('../lib/platform.js')(require('./node'));

// Load the libraries
var fsDb = require('../lib/fs-db.js');
var wrap = require('../lib/repo.js');
var each = require('../helpers/each.js');
var autoProto = require('../protocols/auto.js');
var urlParse = require('url').parse;
var serial = require('../helpers/serial.js');
var parallel = require('../helpers/parallel.js');
var parallelData = require('../helpers/parallel-data.js');

var url = process.argv[2] || "git://github.com/creationix/conquest.git";
var opts = urlParse(url);
if (!opts.protocol) {
  opts = urlParse("ssh://" + url);
}
var path = opts.pathname.match(/[^\/]*$/)[0];

var connection = autoProto(opts);
var repo = wrap(fsDb(path, true));

parallelData({
  init: repo.init(),
  discover: connection.discover(),
}, function (err, result) {
  if (err) throw err;
  var refs = result.discover.refs;
  var wants = [];
  each(refs, function (name, hash) {
    if (name === "HEAD" || name.indexOf('^') > 0) return;
    wants.push("want " + hash);
  });

  var config = {
    serverCaps: result.discover.caps,
    includeTag: true,
    // onProgress: onProgress,
    onError: function (data) {
      process.stderr.write(data);
    }
  };

  connection.fetch(wants, config, function (err, pack) {
    if (err) throw err;
    serial(
      parallel(
        repo.importRefs(refs),
        repo.unpack(pack, {})
      ),
      connection.close()
    )(function (err) {
      if (err) throw err;
      console.log("DONE");
    });
  });

});

function onProgress(data) {
  process.stdout.write(data);
}
