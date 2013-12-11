module.exports = map;

// A functional map that works on both arrays and objects
// The returned object has the same shape as the original, but values mapped.
function map(obj, fn) {
  if (Array.isArray(obj)) return obj.map(fn);
  var result = {};
  var keys = Object.keys(obj);
  for (var i = 0, l = keys.length; i < l; i++) {
    var key = keys[i];
    result[key] = fn(obj[key], key, obj);
  }
  return result;
}
