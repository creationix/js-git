module.exports = function walk(seed, scan, loadKey, compare) {
  var queue = [seed];
  var working = 0, error, cb;
  return {read: read, abort: abort};

  function read(callback) {
    if (cb) return callback(new Error("Only one read at a time"));
    if (working) { cb = callback; return; }
    var item = queue.shift();
    if (!item) return callback();
    try { scan(item).forEach(onKey); }
    catch (err) { return callback(err); }
    return callback(null, item);
  }

  function abort(callback) { return callback(); }

  function onError(err) {
    if (cb) {
      var callback = cb; cb = null;
      return callback(err);
    }
    error = err;
  }

  function onKey(key) {
    working++;
    loadKey(key, onItem);
  }

  function onItem(err, item) {
    working--;
    if (err) return onError(err);
    var index = queue.length;
    while (index && compare(item, queue[index - 1])) index--;
    queue.splice(index, 0, item);
    if (!working && cb) {
      var callback = cb; cb = null;
      return read(callback);
    }
  }
};
