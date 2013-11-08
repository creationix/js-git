module.exports = function isHash(hash) {
  return (/^[0-9a-f]{40}$/).test(hash);
};
