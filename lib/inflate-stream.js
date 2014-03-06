var binary = require('bodec');

// This code is slightly modified from chrisdickson/inflate min.js
// The original code is under the MIT license copyright Chris Dickinson

module.exports = inflate;

var MAXBITS = 15
  , MAXLCODES = 286
  , MAXDCODES = 30
  , MAXCODES = (MAXLCODES+MAXDCODES)
  , FIXLCODES = 288

var lens = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
  35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258
]

var lext = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
  3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0
]

var dists = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
  257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
  8193, 12289, 16385, 24577
]

var dext = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
  7, 7, 8, 8, 9, 9, 10, 10, 11, 11,
  12, 12, 13, 13
]

var order = [
  16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15
]

var WINDOW = 32768
  , WINDOW_MINUS_ONE = WINDOW - 1

function inflate(emit, on_unused) {
  var output = new Uint8Array(WINDOW)
    , need_input = false
    , buffer_offset = 0
    , bytes_read = 0
    , output_idx = 0
    , ended = false
    , state = null
    , states = []
    , buffer = []
    , got = 0

  // buffer up to 128k "output one" bytes
  var OUTPUT_ONE_LENGTH = 131070
    , output_one_offs = OUTPUT_ONE_LENGTH
    , output_one_buf

  var bitbuf = 0
    , bitcnt = 0
    , is_final = false
    , fixed_codes

  var adler_s1 = 1
    , adler_s2 = 0

  onread.recycle = function recycle() {
    var out
    buffer.length = 0
    buffer_offset = 0
    output_idx = 0
    bitbuf = 0
    bitcnt = 0
    states.length = 0
    is_final = false
    need_input = false
    bytes_read = 0
    output_idx = 0
    ended = false
    got = 0
    adler_s1 = 1
    adler_s2 = 0
    output_one_offs = 0
    become(noop, {}, noop)
    start_stream_header()
    // return stream
  }

  var bytes_need = 0
    , bytes_value = []

  var bits_need = 0
    , bits_value = []

  var codes_distcode = null
    , codes_lencode = null
    , codes_len = 0
    , codes_dist = 0
    , codes_symbol = 0

  var dynamic_distcode = {symbol: [], count: []}
    , dynamic_lencode = {symbol: [], count: []}
    , dynamic_lengths = []
    , dynamic_nlen = 0
    , dynamic_ndist = 0
    , dynamic_ncode = 0
    , dynamic_index = 0
    , dynamic_symbol = 0
    , dynamic_len = 0

  var decode_huffman = null
    , decode_len = 0
    , decode_code = 0
    , decode_first = 0
    , decode_count = 0
    , decode_index = 0

  var last = null

  become(noop, {}, noop)
  start_stream_header()

  return onread

  function onread(err, buf) {
    if(buf === undefined) {
      return emit(err)
    }

    return write(buf)
  }

  function noop() {

  }

  function call_header() {
  }

  function call_bytes(need) {
    bytes_value.length = 0
    bytes_need = need
  }

  function call_bits(need) {
    bits_value = 0
    bits_need = need
  }

  function call_codes(distcode, lencode) {
    codes_len =
    codes_dist =
    codes_symbol = 0
    codes_distcode = distcode
    codes_lencode = lencode
  }

  function call_dynamic() {
    dynamic_distcode.symbol.length =
    dynamic_distcode.count.length =
    dynamic_lencode.symbol.length =
    dynamic_lencode.count.length =
    dynamic_lengths.length = 0
    dynamic_nlen = 0
    dynamic_ndist = 0
    dynamic_ncode = 0
    dynamic_index = 0
    dynamic_symbol = 0
    dynamic_len = 0
  }

  function call_decode(h) {
    decode_huffman = h
    decode_len = 1
    decode_first =
    decode_index =
    decode_code = 0
  }

  function write(buf) {
    buffer.push(buf)
    got += buf.length
    if(!ended) {
      execute()
    }
  }

  function execute() {
    do {
      states[0].current()
    } while(!need_input && !ended)

    var needed = need_input
    need_input = false
  }

  function start_stream_header() {
    become(bytes, call_bytes(2), got_stream_header)
  }

  function got_stream_header() {
    var cmf = last[0]
      , flg = last[1]


    if((cmf << 8 | flg) % 31 !== 0) {
      emit(new Error(
        'failed header check'
      ))
      return
    }




    if(flg & 32) {
      return become(bytes, call_bytes(4), on_got_fdict)
    }
    return become(bits, call_bits(1), on_got_is_final)
  }




  function on_got_fdict() {
    return become(bits, call_bits(1), on_got_is_final)
  }








  function on_got_is_final() {
    is_final = last
    become(bits, call_bits(2), on_got_type)
  }












  function on_got_type() {
    if(last === 0) {
      become(bytes, call_bytes(4), on_got_len_nlen)
      return
    }

    if(last === 1) {
      // `fixed` and `dynamic` blocks both eventually delegate
      // to the "codes" state -- which reads bits of input, throws
      // them into a huffman tree, and produces "symbols" of output.
      fixed_codes = fixed_codes || build_fixed()
      become(start_codes, call_codes(
        fixed_codes.distcode
      , fixed_codes.lencode
      ), done_with_codes)
      return
    }

    become(start_dynamic, call_dynamic(), done_with_codes)
    return
  }




  function on_got_len_nlen() {
    var want = last[0] | (last[1] << 8)
      , nlen = last[2] | (last[3] << 8)

    if((~nlen & 0xFFFF) !== want) {
      emit(new Error(
        'failed len / nlen check'
      ))
    }

    if(!want) {
      become(bits, call_bits(1), on_got_is_final)
      return
    }
    become(bytes, call_bytes(want), on_got_stored)
  }




  function on_got_stored() {
    output_many(last)
    if(is_final) {
      become(bytes, call_bytes(4), on_got_adler)
      return
    }
    become(bits, call_bits(1), on_got_is_final)
  }






  function start_dynamic() {
    become(bits, call_bits(5), on_got_nlen)
  }

  function on_got_nlen() {
    dynamic_nlen = last + 257
    become(bits, call_bits(5), on_got_ndist)
  }

  function on_got_ndist() {
    dynamic_ndist = last + 1
    become(bits, call_bits(4), on_got_ncode)
  }

  function on_got_ncode() {
    dynamic_ncode = last + 4
    if(dynamic_nlen > MAXLCODES || dynamic_ndist > MAXDCODES) {
      emit(new Error('bad counts'))
      return
    }

    become(bits, call_bits(3), on_got_lengths_part)
  }

  function on_got_lengths_part() {
    dynamic_lengths[order[dynamic_index]] = last

    ++dynamic_index
    if(dynamic_index === dynamic_ncode) {
      for(; dynamic_index < 19; ++dynamic_index) {
        dynamic_lengths[order[dynamic_index]] = 0
      }

      // temporarily construct the `lencode` using the
      // lengths we've read. we'll actually be using the
      // symbols produced by throwing bits into the huffman
      // tree to constuct the `lencode` and `distcode` huffman
      // trees.
      construct(dynamic_lencode, dynamic_lengths, 19)
      dynamic_index = 0

      become(decode, call_decode(dynamic_lencode), on_got_dynamic_symbol_iter)
      return
    }
    become(bits, call_bits(3), on_got_lengths_part)
  }

  function on_got_dynamic_symbol_iter() {
    dynamic_symbol = last

    if(dynamic_symbol < 16) {
      dynamic_lengths[dynamic_index++] = dynamic_symbol
      do_check()
      return
    }

    dynamic_len = 0
    if(dynamic_symbol === 16) {
      become(bits, call_bits(2), on_got_dynamic_symbol_16)
      return
    }

    if(dynamic_symbol === 17) {
      become(bits, call_bits(3), on_got_dynamic_symbol_17)
      return
    }

    become(bits, call_bits(7), on_got_dynamic_symbol)
  }

  function on_got_dynamic_symbol_16() {
    dynamic_len = dynamic_lengths[dynamic_index - 1]
    on_got_dynamic_symbol_17()
  }

  function on_got_dynamic_symbol_17() {
    dynamic_symbol = 3 + last
    do_dynamic_end_loop()
  }

  function on_got_dynamic_symbol() {
    dynamic_symbol = 11 + last
    do_dynamic_end_loop()
  }

  function do_dynamic_end_loop() {
    if(dynamic_index + dynamic_symbol > dynamic_nlen + dynamic_ndist) {
      emit(new Error('too many lengths'))
      return
    }

    while(dynamic_symbol--) {
      dynamic_lengths[dynamic_index++] = dynamic_len
    }

    do_check()
  }

  function do_check() {
    if(dynamic_index >= dynamic_nlen + dynamic_ndist) {
      end_read_dynamic()
      return
    }
    become(decode, call_decode(dynamic_lencode), on_got_dynamic_symbol_iter)
  }

  function end_read_dynamic() {
    // okay, we can finally start reading data out of the stream.
    construct(dynamic_lencode, dynamic_lengths, dynamic_nlen)
    construct(dynamic_distcode, dynamic_lengths.slice(dynamic_nlen), dynamic_ndist)
    become(start_codes, call_codes(
        dynamic_distcode
      , dynamic_lencode
    ), done_with_codes)
  }

  function start_codes() {
    become(decode, call_decode(codes_lencode), on_got_codes_symbol)
  }

  function on_got_codes_symbol() {
    var symbol = codes_symbol = last
    if(symbol < 0) {
      emit(new Error('invalid symbol'))
      return
    }

    if(symbol < 256) {
      output_one(symbol)
      become(decode, call_decode(codes_lencode), on_got_codes_symbol)
      return
    }

    if(symbol > 256) {
      symbol = codes_symbol -= 257
      if(symbol >= 29) {
        emit(new Error('invalid fixed code'))
        return
      }

      become(bits, call_bits(lext[symbol]), on_got_codes_len)
      return
    }

    if(symbol === 256) {
      unbecome()
      return
    }
  }






  function on_got_codes_len() {
    codes_len = lens[codes_symbol] + last
    become(decode, call_decode(codes_distcode), on_got_codes_dist_symbol)
  }


  function on_got_codes_dist_symbol() {
    codes_symbol = last
    if(codes_symbol < 0) {
      emit(new Error('invalid distance symbol'))
      return
    }

    become(bits, call_bits(dext[codes_symbol]), on_got_codes_dist_dist)
  }

  function on_got_codes_dist_dist() {
    var dist = dists[codes_symbol] + last

    // Once we have a "distance" and a "length", we start to output bytes.
    // We reach "dist" back from our current output position to get the byte
    // we should repeat and output it (thus moving the output window cursor forward).
    // Two notes:
    //
    // 1. Theoretically we could overlap our output and input.
    // 2. `X % (2^N) == X & (2^N - 1)` with the distinction that
    //    the result of the bitwise AND won't be negative for the
    //    range of values we're feeding it. Spare a modulo, spoil the child.
    while(codes_len--) {
      output_one(output[(output_idx - dist) & WINDOW_MINUS_ONE])
    }

    become(decode, call_decode(codes_lencode), on_got_codes_symbol)
  }

  function done_with_codes() {
    if(is_final) {
      become(bytes, call_bytes(4), on_got_adler)
      return
    }
    become(bits, call_bits(1), on_got_is_final)
  }




  function on_got_adler() {
    var check_s1 = last[3] | (last[2] << 8)
      , check_s2 = last[1] | (last[0] << 8)

    if(check_s2 !== adler_s2 || check_s1 !== adler_s1) {
      emit(new Error(
        'bad adler checksum: '+[check_s2, adler_s2, check_s1, adler_s1]
      ))
      return
    }

    ended = true

    output_one_recycle()

    if(on_unused) {
      on_unused(
          [binary.slice(buffer[0], buffer_offset)].concat(buffer.slice(1))
        , bytes_read
      )
    }

    output_idx = 0
    ended = true
    emit()
  }

  function decode() {
    _decode()
  }

  function _decode() {
    if(decode_len > MAXBITS) {
      emit(new Error('ran out of codes'))
      return
    }

    become(bits, call_bits(1), got_decode_bit)
  }

  function got_decode_bit() {
    decode_code = (decode_code | last) >>> 0
    decode_count = decode_huffman.count[decode_len]
    if(decode_code < decode_first + decode_count) {
      unbecome(decode_huffman.symbol[decode_index + (decode_code - decode_first)])
      return
    }
    decode_index += decode_count
    decode_first += decode_count
    decode_first <<= 1
    decode_code = (decode_code << 1) >>> 0
    ++decode_len
    _decode()
  }


  function become(fn, s, then) {
    if(typeof then !== 'function') {
      throw new Error
    }
    states.unshift({
      current: fn
    , next: then
    })
  }

  function unbecome(result) {
    if(states.length > 1) {
      states[1].current = states[0].next
    }
    states.shift()
    if(!states.length) {
      ended = true

      output_one_recycle()
      if(on_unused) {
        on_unused(
            [binary.slice(buffer[0], buffer_offset)].concat(buffer.slice(1))
          , bytes_read
        )
      }
      output_idx = 0
      ended = true
      emit()
      // return
    }
    else {
      last = result
    }
  }

  function bits() {
    var byt
      , idx

    idx = 0
    bits_value = bitbuf
    while(bitcnt < bits_need) {
      // we do this to preserve `bits_value` when
      // "need_input" is tripped.
      //
      // fun fact: if we moved that into the `if` statement
      // below, it would trigger a deoptimization of this (very
      // hot) function. JITs!
      bitbuf = bits_value
      byt = take()
      if(need_input) {
        break
      }
      ++idx
      bits_value = (bits_value | (byt << bitcnt)) >>> 0
      bitcnt += 8
    }

    if(!need_input) {
      bitbuf = bits_value >>> bits_need
      bitcnt -= bits_need
      unbecome((bits_value & ((1 << bits_need) - 1)) >>> 0)
    }
  }



  function bytes() {
    var byte_accum = bytes_value
      , value

    while(bytes_need--) {
      value = take()


      if(need_input) {
        bitbuf = bitcnt = 0
        bytes_need += 1
        break
      }
      byte_accum[byte_accum.length] = value
    }
    if(!need_input) {
      bitcnt = bitbuf = 0
      unbecome(byte_accum)
    }
  }



  function take() {
    if(!buffer.length) {
      need_input = true
      return
    }

    if(buffer_offset === buffer[0].length) {
      buffer.shift()
      buffer_offset = 0
      return take()
    }

    ++bytes_read

    return bitbuf = takebyte()
  }

  function takebyte() {
    return buffer[0][buffer_offset++]
  }



  function output_one(val) {
    adler_s1 = (adler_s1 + val) % 65521
    adler_s2 = (adler_s2 + adler_s1) % 65521
    output[output_idx++] = val
    output_idx &= WINDOW_MINUS_ONE
    output_one_pool(val)
  }

  function output_one_pool(val) {
    if(output_one_offs === OUTPUT_ONE_LENGTH) {
      output_one_recycle()
    }

    output_one_buf[output_one_offs++] = val
  }

  function output_one_recycle() {
    if(output_one_offs > 0) {
      if(output_one_buf) {
        emit(null, binary.slice(output_one_buf, 0, output_one_offs))
      } else {
      }
      output_one_buf = binary.create(OUTPUT_ONE_LENGTH)
      output_one_offs = 0
    }
  }

  function output_many(vals) {
    var len
      , byt
      , olen

    output_one_recycle()
    for(var i = 0, len = vals.length; i < len; ++i) {
      byt = vals[i]
      adler_s1 = (adler_s1 + byt) % 65521
      adler_s2 = (adler_s2 + adler_s1) % 65521
      output[output_idx++] = byt
      output_idx &= WINDOW_MINUS_ONE
    }

    emit(null, binary.fromArray(vals))
  }
}

function build_fixed() {
  var lencnt = []
    , lensym = []
    , distcnt = []
    , distsym = []

  var lencode = {
      count: lencnt
    , symbol: lensym
  }

  var distcode = {
      count: distcnt
    , symbol: distsym
  }

  var lengths = []
    , symbol

  for(symbol = 0; symbol < 144; ++symbol) {
    lengths[symbol] = 8
  }
  for(; symbol < 256; ++symbol) {
    lengths[symbol] = 9
  }
  for(; symbol < 280; ++symbol) {
    lengths[symbol] = 7
  }
  for(; symbol < FIXLCODES; ++symbol) {
    lengths[symbol] = 8
  }
  construct(lencode, lengths, FIXLCODES)

  for(symbol = 0; symbol < MAXDCODES; ++symbol) {
    lengths[symbol] = 5
  }
  construct(distcode, lengths, MAXDCODES)
  return {lencode: lencode, distcode: distcode}
}

function construct(huffman, lengths, num) {
  var symbol
    , left
    , offs
    , len

  offs = []

  for(len = 0; len <= MAXBITS; ++len) {
    huffman.count[len] = 0
  }

  for(symbol = 0; symbol < num; ++symbol) {
    huffman.count[lengths[symbol]] += 1
  }

  if(huffman.count[0] === num) {
    return
  }

  left = 1
  for(len = 1; len <= MAXBITS; ++len) {
    left <<= 1
    left -= huffman.count[len]
    if(left < 0) {
      return left
    }
  }

  offs[1] = 0
  for(len = 1; len < MAXBITS; ++len) {
    offs[len + 1] = offs[len] + huffman.count[len]
  }

  for(symbol = 0; symbol < num; ++symbol) {
    if(lengths[symbol] !== 0) {
      huffman.symbol[offs[lengths[symbol]]++] = symbol
    }
  }

  return left
}