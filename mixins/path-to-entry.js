var cache = require('./mem-cache').cache;
var modes = require('../lib/modes');

module.exports = function (repo) {
  repo.pathToEntry = pathToEntry;
};

function pathToEntry(rootTree, path, callback) {
  if (!callback) return pathToEntry.bind(this, rootTree, path);
  var repo = this;
  var mode = modes.tree;
  var hash = rootTree;
  var parts = path.split("/").filter(Boolean);
  var index = 0;
  var cached;
  loop();
  function loop() {
    while (index < parts.length) {
      if (mode === modes.tree) {
        cached = cache[hash];
        if (!cached) return repo.loadAs("tree", hash, onLoad);
        var entry = cached[parts[index]];
        if (!entry) return callback();
        mode = entry.mode;
        hash = entry.hash;
        index++;
        continue;
      }
      if (modes.isFile(mode)) return callback();
      return callback(null, {
        last: {
          mode: mode,
          hash: hash,
          path: parts.slice(0, index).join("/"),
          rest: parts.slice(index).join("/"),
        }
      });
    }
    callback(null, {
      mode: mode,
      hash: hash
    });
  }

  function onLoad(err, value) {
    if (!value) return callback(err || new Error("Missing object: " + hash));
    cache[hash] = value;
    loop();
  }

}
