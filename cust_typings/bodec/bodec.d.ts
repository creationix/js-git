/// <reference path="../../typings/node/node.d.ts"/>

declare var bodec: bodec.bodec;

declare module bodec {
    export interface Buffer extends NodeBuffer {
        concat: any;
    }

    export interface bodec {
        Binary: any;
        // Utility functions
        isBinary: (t: any) => boolean;
        create: (length?: number) => Buffer;
        join: any; //Buffer.concat;

        // Binary input and output
        copy: (source, binary, offset?: number) => typeof source;
        slice: (binary, start: number, end?: number) => typeof binary;

        // String input and output
        toRaw: (binary, start: number, end?: number) => string;
        fromRaw: (raw, binary?, offset?: number) => typeof binary | Buffer;
        toUnicode: (binary, start?: number, end?: number) => string;
        fromUnicode: (unicode, binary?, offset?: number) => typeof binary | Buffer;
        toHex: (binary, start?: number, end?: number) => string;
        fromHex: (hex, binary?, offset?: number) => typeof binary | Buffer;
        toBase64: (binary, start: number, end?: number) => string;
        fromBase64: (base64, binary, offset?: number) => typeof binary | Buffer;
        toString: (binary, encoding) => string;
        fromString: (string, encoding) => any;

        // Array input and output
        toArray: (binary, start: number, end?: number) => any[];
        fromArray: (array: any[], binary?, offset?: number) => Buffer;

        // Raw <-> Hex-encoded codec
        decodeHex: (hex: string) => string;
        encodeHex: (raw: string) => string;

        decodeBase64: (base64: string) => string;
        encodeBase64: (raw: string) => string;

        // Unicode <-> Utf8-encoded-raw codec
        encodeUtf8: (unicode: string) => string;
        decodeUtf8: (utf8) => string;

        // Hex <-> Nibble codec
        nibbleToCode: (nibble: number) => number;
        codeToNibble: (code: number) => number;

        // More
        subarray: (item, i: number) => any[];
    }
}

declare module "bodec" {
    export = bodec;
}
