var refsMachine = require('./refs.js');
var each = require('../each.js');
var parallel = require('../parallel.js');

module.exports = fetchMachine;
function fetchMachine(repo, path, host, write, emit) {
  if (!write && !emit) return fetchMachine.bind(this, repo, path, host);
  var refs;
  write("git-upload-pack " + path + "\0host=" + host + "\0");
  return refsMachine(write, function (result) {
    refs = result;
    var tasks = [];
    each(refs, function (name, hash) {
      if (name === "HEAD" || name.indexOf('^') > 0) return;
      tasks.push(repo.writeRaw(name, hash));
    });
    parallel(tasks)(function (err) {
      if (err) return callback(err);
      write(null);
      console.log("more?")
    });

  });


}
