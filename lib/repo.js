var encode = require('./encode.js');

module.exports = repo;
function repo(db) {
  return {
    root: db.root,
    init: db.init,
    saveBlob: saveBlob,
    saveTree: saveTree,
    saveCommit: saveCommit,
    saveTag: saveTag,
    saveRaw: db.save,
    loadRaw: db.load,
    remove: db.remove,
    updateHead: updateHead,
  }

  function saveBlob(blob, callback) {
    return db.save(encode.blob(blob), callback);
  }

  function saveTree(tree, callback) {
    return db.save(encode.tree(tree), callback);
  }

  function saveCommit(commit, callback) {
    return db.save(encode.commit(commit), callback);
  }

  function saveTag(tag, callback) {
    return db.save(encode.tag(tag), callback);
  }

  function updateHead(hash, callback) {
    if (!callback) return updateHead.bind(this, hash);
    db.read("HEAD")(function (err, value) {
      if (err) return callback(err);
      if (value.substr(0, 4) !== "ref:") {
        return callback(new Error("HEAD must be symbolic ref"));
      }
      db.write(value.substr(4).trim(), hash + "\n", callback);
    });
  }

}
