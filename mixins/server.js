module.exports = function (repo) {
  repo.uploadPack = uploadPack;
  repo.receivePack = receivePack;
};

function uploadPack(remote, opts, callback) {
  if (!callback) return uploadPack.bind(this, remote, opts);
  throw "TODO: Implement repo.uploadPack";
}

function receivePack(remote, opts, callback) {
  if (!callback) return receivePack.bind(this, remote, opts);
  throw "TODO: Implement repo.uploadPack";
}