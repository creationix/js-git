var pako = require('pako');
import * as bodec from 'bodec';
if (bodec.Binary === Uint8Array) {
    exports = pako.deflate;
}
else {
    exports = function deflate(value) {
        return new Binary(pako.deflate(new Uint8Array(value)));
    };
}
