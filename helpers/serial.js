module.exports = serial;

function serial(items) {
  if (!Array.isArray(items)) {
    items = Array.prototype.slice.call(arguments);
  }
  return function (callback) {
    check();
    function check(err) {
      if (err) return callback(err);
      var next = items.shift();
      if (!next) return callback();
      next(check);
    }
  };
}
