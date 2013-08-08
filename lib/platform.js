// Shared modules
var modules = {};
module.exports = platform;
function platform(obj) {
  for (var key in obj) {
    modules[key] = obj[key];
  }
  return platform;
}
platform.has = function (name) {
  return name in modules;
};
platform.require = function (name) {
  var mod = modules[name];
  if (!mod) throw new Error("Platform does not implement " + name + " interface");
  return mod;
};
