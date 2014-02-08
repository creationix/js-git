define("js-git/mixins/formats", function () {

  var binary = require('js-git/lib/binary');

  return function (repo) {
    var loadAs = repo.loadAs;
    repo.loadAs = newLoadAs;
    function newLoadAs(type, hash, callback) {
      if (!callback) return newLoadAs.bind(this, type, hash, callback);
      var realType = type === "text" ? "blob": 
                     type === "array" ? "tree" : type;
      return loadAs.call(this, realType, hash, onLoad);
      
      function onLoad(err, body, hash) {
        if (body === undefined) return callback.call(this, err);
        if (type === "text") body = binary.toUnicode(body);
        if (type === "array") body = toArray(body);
        return callback.call(this, err, body, hash);
      }
    }
  };

  function toArray(tree) {
    return Object.keys(tree).map(function (name) {
      var entry = tree[name];
      entry.name = name;
      return entry;
    });
  }

});
