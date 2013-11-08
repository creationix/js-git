module.exports = function pathCmp(oa, ob) {
  var a = oa.name;
  var b = ob.name;
  a += "/"; b += "/";
  return a < b ? -1 : a > b ? 1 : 0;
};
