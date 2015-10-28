/// <reference path="../cust_typings/bodec/bodec.d.ts"/>

import * as bodec from 'bodec';

exports = applyDelta;

function applyDelta(delta, base) {
  let deltaOffset = 0;

  if (base.length !== readLength()) {
    throw new Error("Base length mismatch");
  }

  // Create a new output buffer with length from header.
  let outOffset = 0;
  let out = bodec.create(readLength());

  while (deltaOffset < delta.length) {
    let byte = delta[deltaOffset++];
    // Copy command.  Tells us offset in base and length to copy.
    if (byte & 0x80) {
      let offset = 0;
      let length = 0;
      if (byte & 0x01) offset |= delta[deltaOffset++] << 0;
      if (byte & 0x02) offset |= delta[deltaOffset++] << 8;
      if (byte & 0x04) offset |= delta[deltaOffset++] << 16;
      if (byte & 0x08) offset |= delta[deltaOffset++] << 24;
      if (byte & 0x10) length |= delta[deltaOffset++] << 0;
      if (byte & 0x20) length |= delta[deltaOffset++] << 8;
      if (byte & 0x40) length |= delta[deltaOffset++] << 16;
      if (length === 0) length = 0x10000;
      // copy the data
      bodec.copy(bodec.slice(base, offset, offset + length), out, outOffset);
      outOffset += length;
    }
    // Insert command, opcode byte is length itself
    else if (byte) {
      bodec.copy(bodec.slice(delta, deltaOffset, deltaOffset + byte), out, outOffset);
      deltaOffset += byte;
      outOffset += byte;
    }
    else throw new Error('Invalid delta opcode');
  }

  if (outOffset !== out.length) {
    throw new Error("Size mismatch in check");
  }

  return out;

  // Read a letiable length number our of delta and move the offset.
  function readLength() {
    let byte = delta[deltaOffset++];
    let length = byte & 0x7f;
    let shift = 7;
    while (byte & 0x80) {
      byte = delta[deltaOffset++];
      length |= (byte & 0x7f) << shift;
      shift += 7;
    }
    return length;
  }
}
