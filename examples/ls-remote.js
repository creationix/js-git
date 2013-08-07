
var url = process.argv[2] || "git://github.com/creationix/conquest.git";
// Load a node powered lsRemote function
var lsRemote = require('../lib/network.js')(require('./node')).lsRemote;

lsRemote(url, function (err, refs, caps) {
  if (err) throw err;
  Object.keys(refs).forEach(function (ref) {
    console.log(refs[ref] + "\t" + ref);
  });
});
