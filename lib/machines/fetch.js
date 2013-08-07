var refsMachine = require('./refs.js');

module.exports = fetchMachine;
function fetchMachine(path, host, repo, write, emit) {
  if (!write && !emit) return fetchMachine.bind(this, path, host, repo);
  write("git-upload-pack " + path + "\0host=" + host + "\0");
  return refsMachine(write, function (refs) {
    write(null);
    console.log({refs:refs})
  });
}
