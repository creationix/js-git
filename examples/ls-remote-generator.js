// Bootstrap the platform to run on node.js
require('../lib/platform.js')(require('./node'));

// Load the libraries
var autoProto = require('../protocols/auto.js');
var urlParse = require('url').parse;
var run = require('gen-run');

// Process the command-line args and environment variables
var url = process.argv[2] || "git://github.com/creationix/conquest.git";
var opts = urlParse(url);
if (!opts.protocol) {
  opts = urlParse("ssh://" + url);
}
if (process.env.TRACE) opts.trace = require('./trace.js');

// Do the action
run(function* () {
  var connection = autoProto(opts);
  var results = yield connection.discover();
  var refs = results.refs;
  Object.keys(refs).forEach(function (ref) {
    console.log(refs[ref] + "\t" + ref);
  });
  yield connection.close();
});
