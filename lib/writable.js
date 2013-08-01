module.exports = writable;

function writable(abort) {
  var queue = [];
  var emit = null;
  
  write.read = read;
  write.abort = abort;
  write.error = error;
  return write;
  
  function write() {
    for (var i = 0, l = arguments.length; i < l; i++) {
      queue.push([null, arguments[i]]);
    }
    check();
  }
  
  function error(err) {
    queue.push([err]);
    check();
  }
  
  function read(callback) {
    if (queue.length) {
      return callback.apply(null, queue.shift());
    }
    if (emit) return callback(new Error("Only one read at a time"));
    emit = callback;
    check();
  }
  
  function check() {
    if (emit && queue.length) {
      var callback = emit;
      emit = null;
      callback.apply(null, queue.shift());
    }
  }
}