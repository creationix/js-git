var each = require('./each.js');

module.exports = map;
function map(obj, fn) {
  var results = [];
  each(obj, function (key, value) {
    results.push(fn(key, value));
  });
  return results;
}
