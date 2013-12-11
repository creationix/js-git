module.exports = each;

// A functional forEach that works on both arrays and objects
function each(obj, fn) {
  if (Array.isArray(obj)) return obj.forEach(fn);
  var keys = Object.keys(obj);
  for (var i = 0, l = keys.length; i < l; i++) {
    var key = keys[i];
    fn(obj[key], key, obj);
  }
}
