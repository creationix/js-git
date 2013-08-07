module.exports = parallel;

function parallel(items) {
  if (!Array.isArray(items)) {
    items = Array.prototype.slice.call(arguments);
  }
  return function (callback) {
    var left = items.length + 1;
    var isDone = false;
    items.forEach(function (continuable) {
      continuable(check);
    });
    check();
    function done(err) {
      if (isDone) return;
      isDone = true;
      callback(err);
    }
    function check(err) {
      if (err) return done(err);
      if (--left) return;
      done();
    }
  };
}
