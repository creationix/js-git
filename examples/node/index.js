module.exports = {
  fs: require('./fs.js'),
  tcp: require('./tcp.js'),
  http: require('./http.js'),
  ssh: require('./ssh.js'),
  sha1: require('./sha1.js'),
  inflate: require('./inflate.js'),
  deflate: require('./deflate.js'),
  agent: "jsgit/" + require('../../package.json').version
};
