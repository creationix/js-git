// This is Chris Dickinson's code

var binary = require('bodec')
  // , Decoder = require('varint/decode.js')
  // , vi = new Decoder

// we use writeUint[8|32][LE|BE] instead of indexing
// into buffers so that we get buffer-browserify compat.
var OFFSET_BUFFER = binary.create(4)
  , LENGTH_BUFFER = binary.create(4)

module.exports = apply_delta;
function apply_delta(delta, target) {
  throw "TODO: fix me"
  var base_size_info = {size: null, buffer: null}
    , resized_size_info = {size: null, buffer: null}
    , output_buffer
    , out_idx
    , command
    , len
    , idx

  delta_header(delta, base_size_info)
  delta_header(base_size_info.buffer, resized_size_info)

  delta = resized_size_info.buffer

  idx =
  out_idx = 0
  output_buffer = binary.create(resized_size_info.size)

  len = delta.length

  while(idx < len) {
    command = delta[idx++]
    command & 0x80 ? copy() : insert()
  }

  return output_buffer

  function copy() {
    OFFSET_BUFFER[0] = 0;
    OFFSET_BUFFER[1] = 0;
    OFFSET_BUFFER[2] = 0;
    OFFSET_BUFFER[3] = 0;
    LENGTH_BUFFER[0] = 0;
    LENGTH_BUFFER[1] = 0;
    LENGTH_BUFFER[2] = 0;
    LENGTH_BUFFER[3] = 0;

    var check = 1
      , length
      , offset

    for(var x = 0; x < 4; ++x) {
      if(command & check) {
        OFFSET_BUFFER[3 - x] = delta[idx++]
      }
      check <<= 1
    }

    for(var x = 0; x < 3; ++x) {
      if(command & check) {
        LENGTH_BUFFER[3 - x] = delta[idx++]
      }
      check <<= 1
    }
    LENGTH_BUFFER[0] = 0

    length = (
      (LENGTH_BUFFER[0] << 24) |
      (LENGTH_BUFFER[1] << 16) |
      (LENGTH_BUFFER[2] << 8) |
      (LENGTH_BUFFER[3])) || 0x10000;
    offset =
      (OFFSET_BUFFER[0] << 24) |
      (OFFSET_BUFFER[1] << 16) |
      (OFFSET_BUFFER[2] << 8) |
      (OFFSET_BUFFER[3]);

    binary.copy(target, output_buffer, out_idx, offset, offset + length)
    out_idx += length
  }

  function insert() {
    binary.copy(delta, output_buffer, out_idx, idx, command + idx)
    idx += command
    out_idx += command
  }
}

function delta_header(buf, output) {
  var done = false
    , idx = 0
    , size = 0

  vi.ondata = function(s) {
    size = s
    done = true
  }

  do {
    vi.write(buf[idx++])
  } while(!done)

  output.size = size
  output.buffer = binary.slice(buf, idx)

}
