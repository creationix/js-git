"use strict";
exports = {
    encode: encode,
    decode: decode
};
function encode(config) {
    let lines = [];
    Object.keys(config).forEach(function (name) {
        const obj = config[name];
        let deep = {};
        let values = {};
        let hasValues = false;
        Object.keys(obj).forEach(function (key) {
            let value = obj[key];
            if (typeof value === 'object') {
                deep[key] = value;
            }
            else {
                hasValues = true;
                values[key] = value;
            }
        });
        if (hasValues) {
            encodeBody('[' + name + ']', values);
        }
        Object.keys(deep).forEach(function (sub) {
            let child = deep[sub];
            encodeBody('[' + name + ' "' + sub + '"]', child);
        });
    });
    return lines.join("\n") + "\n";
    function encodeBody(header, obj) {
        lines.push(header);
        Object.keys(obj).forEach(function (name) {
            lines.push("\t" + name + " = " + obj[name]);
        });
    }
}
function decode(text) {
    let config = {};
    let section;
    text.split(/[\r\n]+/).forEach(function (line) {
        let match = line.match(/\[([^ \t"\]]+) *(?:"([^"]+)")?\]/);
        if (match) {
            section = config[match[1]] || (config[match[1]] = {});
            if (match[2]) {
                section = section[match[2]] = {};
            }
            return;
        }
        match = line.match(/([^ \t=]+)[ \t]*=[ \t]*(.+)/);
        if (match) {
            section[match[1]] = match[2];
        }
    });
    return config;
}
