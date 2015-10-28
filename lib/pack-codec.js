import * as bodec from 'bodec';
let inflateStream = require('./inflate-stream.js');
let inflate = require('./inflate.js');
let deflate = require('./deflate.js');
let sha1 = require('git-sha1');
let typeToNum = {
    commit: 1,
    tree: 2,
    blob: 3,
    tag: 4,
    "ofs-delta": 6,
    "ref-delta": 7
};
let numToType = {};
for (let type in typeToNum) {
    let num = typeToNum[type];
    numToType[num] = type;
}
exports.parseEntry = parseEntry;
function parseEntry(chunk) {
    let offset = 0;
    let byte = chunk[offset++];
    let type = numToType[(byte >> 4) & 0x7];
    let size = byte & 0xf;
    let left = 4;
    while (byte & 0x80) {
        byte = chunk[offset++];
        size |= (byte & 0x7f) << left;
        left += 7;
    }
    size = size >>> 0;
    let ref;
    if (type === "ref-delta") {
        ref = bodec.toHex(bodec.slice(chunk, offset, offset += 20));
    }
    else if (type === "ofs-delta") {
        byte = chunk[offset++];
        ref = byte & 0x7f;
        while (byte & 0x80) {
            byte = chunk[offset++];
            ref = ((ref + 1) << 7) | (byte & 0x7f);
        }
    }
    let body = inflate(bodec.slice(chunk, offset));
    if (body.length !== size) {
        throw new Error("Size mismatch");
    }
    let result = {
        type: type,
        body: body
    };
    if (typeof ref !== "undefined") {
        result.ref = ref;
    }
    return result;
}
exports.decodePack = decodePack;
function decodePack(emit) {
    let state = $pack;
    let sha1sum = sha1();
    let inf = inflateStream();
    let offset = 0;
    let position = 0;
    let version = 0x4b434150;
    let num = 0;
    let type = 0;
    let length = 0;
    let ref = null;
    let checksum = "";
    let start = 0;
    let parts = [];
    return function (chunk) {
        if (chunk === undefined) {
            if (num || checksum.length < 40)
                throw new Error("Unexpected end of input stream");
            return emit();
        }
        for (let i = 0, l = chunk.length; i < l; i++) {
            if (!state)
                throw new Error("Unexpected extra bytes: " + bodec.slice(chunk, i));
            state = state(chunk[i], i, chunk);
            position++;
        }
        if (!state)
            return;
        if (state !== $checksum)
            sha1sum.update(chunk);
        let buff = inf.flush();
        if (buff.length) {
            parts.push(buff);
        }
    };
    function $pack(byte) {
        if ((version & 0xff) === byte) {
            version >>>= 8;
            return version ? $pack : $version;
        }
        throw new Error("Invalid packfile header");
    }
    function $version(byte) {
        version = (version << 8) | byte;
        if (++offset < 4)
            return $version;
        if (version >= 2 && version <= 3) {
            offset = 0;
            return $num;
        }
        throw new Error("Invalid version number " + num);
    }
    function $num(byte) {
        num = (num << 8) | byte;
        if (++offset < 4)
            return $num;
        offset = 0;
        emit({ version: version, num: num });
        return $header;
    }
    function $header(byte) {
        if (start === 0)
            start = position;
        type = byte >> 4 & 0x07;
        length = byte & 0x0f;
        if (byte & 0x80) {
            offset = 4;
            return $header2;
        }
        return afterHeader();
    }
    function $header2(byte) {
        length |= (byte & 0x7f) << offset;
        if (byte & 0x80) {
            offset += 7;
            return $header2;
        }
        return afterHeader();
    }
    function afterHeader() {
        offset = 0;
        if (type === 6) {
            ref = 0;
            return $ofsDelta;
        }
        if (type === 7) {
            ref = "";
            return $refDelta;
        }
        return $body;
    }
    function $ofsDelta(byte) {
        ref = byte & 0x7f;
        if (byte & 0x80)
            return $ofsDelta2;
        return $body;
    }
    function $ofsDelta2(byte) {
        ref = ((ref + 1) << 7) | (byte & 0x7f);
        if (byte & 0x80)
            return $ofsDelta2;
        return $body;
    }
    function $refDelta(byte) {
        ref += toHex(byte);
        if (++offset < 20)
            return $refDelta;
        return $body;
    }
    function toHex(num) {
        return num < 0x10 ? "0" + num.toString(16) : num.toString(16);
    }
    function emitObject() {
        let body = bodec.join(parts);
        if (body.length !== length) {
            throw new Error("Body length mismatch");
        }
        let item = {
            type: numToType[type],
            size: length,
            body: body,
            offset: start
        };
        if (ref)
            item.ref = ref;
        parts.length = 0;
        start = 0;
        offset = 0;
        type = 0;
        length = 0;
        ref = null;
        emit(item);
    }
    function $body(byte, i, chunk) {
        if (inf.write(byte))
            return $body;
        let buf = inf.flush();
        if (buf.length !== length)
            throw new Error("Length mismatch, expected " + length + " got " + buf.length);
        inf.recycle();
        if (buf.length) {
            parts.push(buf);
        }
        emitObject();
        if (--num)
            return $header;
        sha1sum.update(bodec.slice(chunk, 0, i + 1));
        return $checksum;
    }
    function $checksum(byte) {
        checksum += toHex(byte);
        if (++offset < 20)
            return $checksum;
        let actual = sha1sum.digest();
        if (checksum !== actual)
            throw new Error("Checksum mismatch: " + actual + " != " + checksum);
    }
}
exports.encodePack = encodePack;
function encodePack(emit) {
    let sha1sum = sha1();
    let left;
    return function (item) {
        if (item === undefined) {
            if (left !== 0)
                throw new Error("Some items were missing");
            return emit();
        }
        if (typeof item.num === "number") {
            if (left !== undefined)
                throw new Error("Header already sent");
            left = item.num;
            write(packHeader(item.num));
        }
        else if (typeof item.type === "string" && bodec.isBinary(item.body)) {
            if (typeof left !== "number")
                throw new Error("Headers not sent yet");
            if (!left)
                throw new Error("All items already sent");
            write(packFrame(item));
            if (!--left) {
                emit(bodec.fromHex(sha1sum.digest()));
            }
        }
        else {
            throw new Error("Invalid item");
        }
    };
    function write(chunk) {
        sha1sum.update(chunk);
        emit(chunk);
    }
}
function packHeader(length) {
    return bodec.fromArray([
        0x50, 0x41, 0x43, 0x4b,
        0, 0, 0, 2,
        length >> 24,
        (length >> 16) & 0xff,
        (length >> 8) & 0xff,
        length & 0xff
    ]);
}
function packFrame(item) {
    let length = item.body.length;
    let head = [(typeToNum[item.type] << 4) | (length & 0xf)];
    let i = 0;
    length >>= 4;
    while (length) {
        head[i++] |= 0x80;
        head[i] = length & 0x7f;
        length >>= 7;
    }
    if (typeof item.ref === "number") {
        let offset = item.ref;
        i += Math.floor(Math.log(offset) / Math.log(0x80)) + 1;
        head[i] = offset & 0x7f;
        while (offset >>= 7) {
            head[--i] = 0x80 | (--offset & 0x7f);
        }
    }
    let parts = [bodec.fromArray(head)];
    if (typeof item.ref === "string") {
        parts.push(bodec.fromHex(item.ref));
    }
    parts.push(deflate(item.body));
    return bodec.join(parts);
}
