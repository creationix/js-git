var proto = require('../protocols/auto.js')(require('./node'));
var urlParse = require('url').parse;

var url = process.argv[2] || "git://github.com/creationix/conquest.git";
var opts = urlParse(url);
if (!opts.protocol) {
  opts = urlParse("ssh://" + url);
}
if (process.env.TRACE) opts.trace = require('./trace.js');
var connection = proto(opts);

connection.discover(function (err, result) {
  if (err) throw err;
  var refs = result.refs;
  Object.keys(refs).forEach(function (ref) {
    console.log(refs[ref] + "\t" + ref);
  });
  connection.close(function (err) {
    if (err) throw err;
  });
});

