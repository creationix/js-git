var create, subarray, isBinary;
if (typeof Buffer === "undefined") {
  create = function (length) {
    return new Uint8Array(length|0);
  };
  isBinary = function (binary) {
    return binary instanceof Uint8Array;
  };
  subarray = function (binary, start, end) {
    return binary.subarray(start, end);
  };
}
else {
  create = function (length) {
    return new Buffer(length|0);
  };
  isBinary = Buffer.isBuffer;
  subarray = function (buffer, start, end) {
    return buffer.slice(start, end);
  };
}

module.exports = {
  create: create,
  build: build,
  is: isBinary,
  subarray: subarray,
  copy: copy,
  read: read,
  write: write,
};

// Build a binary value from parts
// parts can be:
// integer - empty space
// string - binary string
// array-like value of bytes (including binary buffers)
var slice = Function.prototype.call.bind(Array.prototype.slice);
function build() {
  var parts = slice(arguments);
  var i, part, binary;
  var length = parts.length|0;
  var total = 0;
  var offset = 0;

  // Measure the total length needed and encode strings.
  for (i = 0; i < length; i++) {
    part = parts[i];
    if (part === (part|0)) total += part;
    else if (part && (part.length === (part.length|0))) total += part.length;
    else throw new Error("Invalid part: " + part + " at offset " + i);
  }

  // Copy the items into the new binary buffer.
  binary = create(total);
  for (i = 0; i < length; i++) {
    part = parts[i];
    if (part === (part|0)) offset += part;
    else {
      if (typeof part === "string") write(binary, part, offset);
      else copy(part, binary, offset);
      offset += part.length;
    }
  }

  return binary;
}

// Write source binary into target binary at optional offset
function copy(source, target, offset) {
  if (typeof offset !== "number") offset = 0;
  var length = source.length;
  var i;
  if (source.buffer === target.buffer) {
    // Copy source in case source and target overlap
    // TODO: look deeper to see if they actually overlap and how.
    var temp = new Array(length);
    for (i = 0; i < length; i++) {
      temp[i] = source[i];
    }
    source = temp;
  }
  for (i = 0; i < length; i++) {
    target[offset + i] = source[i];
  }
  return target;
}

// Read a string from the binary value
function read(binary, offset, length) {
  if (offset !== (offset|0)) offset = 0;
  if (length !== (length|0)) length = binary.length;
  var end = offset + length;
  var string= "";
  for (var i = offset; i < end; i++) {
    string += String.fromCharCode(binary[i]);
  }
  return string;
}

// Write a string to the binary value
function write(binary, string, offset) {
  if (offset !== (offset|0)) offset = 0;
  var length = string.length;
  for (var i = 0; i < length; i ++) {
    binary[offset + i] = string.charCodeAt(i) & 0xff;
  }
  return binary;
}
