module.exports = function assertType(object, type) {
  if (object.type !== type) {
    throw new Error(type + " expected, but found " + object.type);
  }
};
