var bodec = require('bodec');
var sha1 = require('git-sha1');

exports.parseIndex = parseIndex;

function parseIndex(buffer) {
  if (readUint32(buffer, 0) !== 0xff744f63 ||
      readUint32(buffer, 4) !== 0x00000002) {
    throw new Error("Only v2 pack indexes supported");
  }

  // Get the number of hashes in index
  // This is the value of the last fan-out entry
  var hashOffset = 8 + 255 * 4;
  var length = readUint32(buffer, hashOffset);
  hashOffset += 4;
  var crcOffset = hashOffset + 20 * length;
  var lengthOffset = crcOffset + 4 * length;
  var largeOffset = lengthOffset + 4 * length;
  var checkOffset = largeOffset;
  var indexes = new Array(length);
  for (var i = 0; i < length; i++) {
    var start = hashOffset + i * 20;
    var hash = bodec.toHex(bodec.slice(buffer, start, start + 20));
    var crc = readUint32(buffer, crcOffset + i * 4);
    var offset = readUint32(buffer, lengthOffset + i * 4);
    if (offset & 0x80000000) {
      offset = largeOffset + (offset &0x7fffffff) * 8;
      checkOffset = Math.max(checkOffset, offset + 8);
      offset = readUint64(buffer, offset);
    }
    indexes[i] = {
      hash: hash,
      offset: offset,
      crc: crc
    };
  }
  var packChecksum = bodec.toHex(bodec.slice(buffer, checkOffset, checkOffset + 20));
  var checksum = bodec.toHex(bodec.slice(buffer, checkOffset + 20, checkOffset + 40));
  if (sha1(bodec.slice(buffer, 0, checkOffset + 20)) !== checksum) {
    throw new Error("Checksum mistmatch");
  }

  var byHash = {};
  indexes.sort(function (a, b) {
    return a.offset - b.offset;
  });
  indexes.forEach(function (data) {
    byHash[data.hash] = {
      offset: data.offset,
      crc: data.crc,
    };
  });
  var offsets = indexes.map(function (entry) {
    return entry.offset;
  }).sort(function (a, b) {
    return a - b;
  });

  return {
    offsets: offsets,
    byHash: byHash,
    checksum: packChecksum
  };
}

function readUint32(buffer, offset) {
  return (buffer[offset] << 24 |
          buffer[offset + 1] << 16 |
          buffer[offset + 2] << 8 |
          buffer[offset + 3] << 0) >>> 0;
}

// Yes this will lose precision over 2^53, but that can't be helped when
// returning a single integer.
// We simply won't support packfiles over 8 petabytes. I'm ok with that.
function readUint64(buffer, offset) {
  var hi = (buffer[offset] << 24 |
            buffer[offset + 1] << 16 |
            buffer[offset + 2] << 8 |
            buffer[offset + 3] << 0) >>> 0;
  var lo = (buffer[offset + 4] << 24 |
            buffer[offset + 5] << 16 |
            buffer[offset + 6] << 8 |
            buffer[offset + 7] << 0) >>> 0;
  return hi * 0x100000000 + lo;
}
