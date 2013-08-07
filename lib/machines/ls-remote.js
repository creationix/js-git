var refsMachine = require('./refs.js');

module.exports = lsRemoteMachine;
function lsRemoteMachine(path, host, write, emit) {
  if (!write && !emit) return lsRemoteMachine.bind(this, path, host);
  write("git-upload-pack " + path + "\0host=" + host + "\0");
  return refsMachine(write, function (refs) {
    write(null);
    emit(refs);
  });
}
