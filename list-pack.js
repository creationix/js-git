// NOTE: This is just copied out of chrisdickinson/git-list-pack's min.js
// TODO: either make part of js-git properly by reformatting or find the best
// way to link to external libraries.

module.exports = unpack

var inflate = require('./inflate.js')
  , binary = require('bops')

var OFS_DELTA = 6
  , REF_DELTA = 7

function unpack(read, oncksum) {
  var need_input = false
    , states = []
    , state = null
    , ended = false
    , buffer = []
    , got = 0

  var buffer_offset = 0

  var inflate_stream = null
    , inflated_fragments = []
    , uninflated_fragments = []
    , inflate_finished = false
    , _inflate_wants

  var offset = 12
    , header_size = 0

  var current_object_header = []
    , current_ofs_header = []

  var expanded_size
    , object_count
    , prev_object
    , reference
    , version
    , cksum
    , type
    , last

  var byte_need = 0
    , byte_accum = []

  var queued = []
    , emit

  oncksum = oncksum || function() {}

  want_bytes(4); become(bytes, got_header)

  stream.is = 'min-stream-pull-filter'

  return stream

  function stream(close, callback) {
    if(queued.length) {
      var out = queued.shift()
      if(out === null) {
        return callback()
      }
      return callback(null, out)
    }

    emit = callback
    read(null, onread)
  }

  function onread(err, buf) {
    if(buf === undefined) {
      return read(err)
    }
    return write(buf)
  }

  function queue(obj) {
    queued.push(obj)
    if(emit) while(queued.length) {
      emit(null, queued.shift())
    }
  }

  function want_bytes(num) {
    byte_need = num
    byte_accum.length = 0
  }

  function write(buf) {
    buffer.push(buf)
    got += buf.length

    if(!ended) {
      execute()
    }

    read(null, onread)
  }

  function got_header() {
    for(var i = 0, len = 4; i < len; ++i) {
      if(last[i] !== 'PACK'.charCodeAt(i)) {
        emit(new Error(
          'invalid header'
        ))
        return
      }
    }
    want_bytes(4); become(bytes, got_header_version)
  }

  function got_header_version() {
    // no-op for now
    want_bytes(4); become(bytes, got_object_count)
  }

  function got_object_count() {
    object_count = last[3] | (last[2] << 8) | (last[1] << 16) | (last[0] << 24)
    object_count >>>= 0
    want_bytes(1); become(bytes, start_object_header)
  }

  function start_object_header() {
    current_object_header.length = 0
    header_size = 0
    iter_object_header()
  }


  function iter_object_header() {
    var byt = last[0]
    current_object_header.push(byt)
    if(!(byt & 0x80)) {
      finish_object_header()
    } else {
      want_bytes(1); become(bytes, iter_object_header)
    }
  }

  function finish_object_header() {
    var size = current_object_header[0] & 0x0F
      , shift = 4
      , idx = 1
      , byt

    header_size = current_object_header.length
    type = current_object_header[0] >> 4 & 7
    while(idx < current_object_header.length) {
      size += (current_object_header[idx++] & 0x7F) << shift
      shift += 7
    }

    expanded_size = size

    if(type < 5) {
      start_inflate()
    } else if(type === OFS_DELTA) {
      start_ofs_delta()
    } else if(type === REF_DELTA) {
      start_ref_delta()
    }
  }

  function start_inflate() {
    states[0] = write_inflate
    inflate_stream = inflate_stream ? inflate_stream.recycle() : inflate(inflate_read, finish_inflate)
    inflated_fragments.length = 0
    inflate_finished = false

    iter()

    function iter() {
      inflate_stream(null, function(err, data) {
        if(err) {
          return emit(err)
        }
        inflated_fragments.push(data)
        iter()
      })
    }
  }

  function inflate_read(close, ready) {
    if(close === true) {
      return
    }

    if(close) {
      return emit(close)
    }
    _inflate_wants = ready
  }

  function write_inflate() {
    var next
    while(buffer.length && !inflate_finished) {
      next = buffer.shift()
      if(buffer_offset) {
        if(buffer_offset === next.length) {
          buffer_offset = 0
          continue
        }
        next = binary.subarray(next, buffer_offset)
        buffer_offset = 0
      }
      got -= next.length
      _inflate_wants(null, next)
    }
    if(!buffer.length && !inflate_finished) {
      need_input = true
    }
  }

  function finish_inflate(unused, read) {
    inflate_finished = true
    queue(prev_object = {
        reference: reference
      , data: binary.join(inflated_fragments)
      , type: type
      , offset: offset
      , num: object_count - 1
    })

    offset += read + header_size + (reference ? reference.length : 0)
    header_size = 0
    --object_count
    reference = null

    if(unused.length) {
      buffer = unused.concat(buffer)
      for(var i = 0, len = unused.length; i < len; ++i) {
        got += unused[i].length
      }
      buffer_offset = 0
    }

    if(!object_count) {
      want_bytes(20); become(bytes, got_checksum)
    } else {
      want_bytes(1); become(bytes, start_object_header)
    }
  }

  function start_ofs_delta() {
    current_ofs_header.length = 0
    want_bytes(1); become(bytes, iter_ofs_delta)
  }

  function iter_ofs_delta() {
    var byt = last[0]
    current_ofs_header.push(byt)
    if(!(byt & 0x80)) {
      reference = binary.from(current_ofs_header)
      start_inflate()
    } else {
      want_bytes(1); become(bytes, iter_ofs_delta)
    }
  }

  function start_ref_delta() {
    want_bytes(20); become(bytes, got_ref_delta_reference)
  }

  function got_ref_delta_reference() {
    reference = binary.from(last)
    start_inflate()
  }

  function got_checksum() {
    oncksum(binary.from(last))
    queue(null)
    ended = true
  }

  function execute() {
    while(1) {
      states[0]()
      if(need_input || ended) {
        break
      }
    }
    need_input = false
  }

  function bytes() {
    var value
    while(byte_need--) {
      value = take()
      if(need_input) {
        byte_need += 1
        break
      }
      byte_accum[byte_accum.length] = value
    }
    if(!need_input) {
      unbecome(byte_accum)
    }
  }

  function take() {
    var val
    if(!buffer.length) {
      need_input = true
    } else if(buffer_offset === buffer[0].length) {
      buffer.shift()
      buffer_offset = 0
      val = take()
    } else {
      val = buffer[0][buffer_offset++]
    }
    return val
  }

  function become(fn, then) {
    if(typeof then !== 'function') {
      throw new Error
    }
    last = null
    if(states.length < 1) {
      states.unshift(then)
    } else {
      states[0] = then
    }
    states.unshift(fn)
  }

  function unbecome(result) {
    states.shift()
    last = result
  }
}
