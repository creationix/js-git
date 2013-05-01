
function log(err) {
  if (err) throw err;
  console.log.apply(console, Array.prototype.slice.call(arguments, 1));
}

module.exports = getdb;
function getdb(fs, root, callback) {
  // Make sure it's an absolute path;
  if (root[0] !== "/") {
    return callback(new TypeError("root must be an absolute path"));
  }
  if (root[root.length - 1] !== "/") root += "/";

  function get(key, callback) {
    fs.readfile(root + key, callback || log);
  }
  function set(key, value, callback) {
    fs.writefile(root + key, value, callback || log);
  }
  fs.mkdir(root.substr(0, root.length - 1), function (err) {
    if (err) return callback(err);
    callback(null, {
      get: get,
      set: set
    });
  });
}
