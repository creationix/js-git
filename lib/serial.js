module.exports = serial;

function serial() {
  var items = Array.prototype.slice.call(arguments);
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
