module.exports = each;
function each(obj, fn) {
  var keys = Object.keys(obj);
  for (var i = 0, l = keys.length; i < l; i++) {
    var key = keys[i];
    fn(key, obj[key]);
  }
}
