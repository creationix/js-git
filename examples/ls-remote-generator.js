var tcp = require('../protocols/tcp.js')(require('./node'));
var urlParse = require('url').parse;

var url = process.argv[2] || "git://github.com/creationix/conquest.git";
var opts = urlParse(url);
if (process.env.TRACE) opts.trace = require('./trace.js');
var connection = tcp(opts);

require('gen-run')(function *() {
  var results = yield connection.discover();
  var refs = results.refs;
  Object.keys(refs).forEach(function (ref) {
    console.log(refs[ref] + "\t" + ref);
  });
  yield connection.close();
});

