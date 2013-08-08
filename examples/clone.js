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

var config = {
  includeTag: true,
  onProgress: function (data) {
    process.stdout.write(data);
  },
  onError: function (data) {
    process.stderr.write(data);
  }
};

parallelData({
  init: repo.init(),
  pack: connection.fetch(config),
}, function (err, result) {
  if (err) throw err;
  serial(
    parallel(
      repo.importRefs(result.pack.refs),
      repo.unpack(result.pack, config)
    ),
    connection.close()
  )(function (err) {
    if (err) throw err;
    console.log("DONE");
  });
});
