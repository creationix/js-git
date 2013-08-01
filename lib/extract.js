module.exports = function (hash, name) {
  var implementation = hash[name];
  if (!implementation) throw new TypeError(name + " interface implementation instance required");
  return implementation;
};
