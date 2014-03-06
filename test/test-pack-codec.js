var modes = require('../lib/modes.js');
var bodec = require('bodec');
var sha1 = require('git-sha1');
var run = require('./run.js');
var decoders = require('../lib/object-codec.js').decoders;

// The thing we mean to test.
var codec = require('../lib/pack-codec.js');


// pack-763df34c046438fd52466d888b46f2e6adb4039d.pack
// var pack = bodec.fromBase64('UEFDSwAAAAIAAAAHlA54nJ3LWw7CIBBG4XdWMRvQDAVKSYwx6RbcwAA/lqQXUzG6fLsGX0++03aAfK+9yRiG4IIDl8ylCDgxXFdyYEmCwaWonrJjbRQPIykytM0uhjJ4a0KM1vTJJxuDNxEZOSh5t2nb6V4XGuX1wTzTpdXllnZIq9tav+e0LVfSJljd9bpzdOKeWR11qa3hn1eNk6wPUJtApc5QP7ZrRo2TC3icncxNCsIwEEDhfU4xF1Dy0yRTkCJ05d4LTGKCA0kLcUSPr3gEtw++J6MUCBPWjKGg9zHdKKVsM1okM3vnKzoXbawUrKKn3PcBV+6w0uNVWoOTcD/nUUh43/h9zHtfwLh5MtY7dHDQQWv1rZ1Fyj9WXTYWpgbrb6I+XRw3AMcJeJw1jEEOwiAQAO+8Yj+gAaGlJMaY+IV+gIVtXVOKqZtofy8evEzmMlPxQUkASU8xoSbjcodhGryzAdHZPvnkMHiLlCkHJfuTINVSWJTEGcre+LOZNhi5wC2+3rQscBYu17RRFK4rf46tuYCxwZlT5/wAB91rrdTYHnIn4JWF4/JffwGK/zCMqAJ4nDM0MDAzMVFIL0pNLcnMS9crqShh2OnOb+K3/Hfb3s+7jrn/7csVXdVzGAAm5xFpqAJ4nDM0MDAzMVFIL0pNLcnMS9crqShhCK3dYPty+oksL6Y+ub1WMq+Voh9ZAAAZvA8xtAF4nPNIzcnJVwjPL8pJUXDOSMxLT03hAgBLKQbxPHic80jNyclXCM8vyknhAgAcMgQn30Dgfr8qXI6710Y++2pQNk1UifU=');

// pack-2746619e21b1b8527bfae6520441ef5ead239e3f.pack
// var pack = bodec.fromBase64('UEFDSwAAAAIAAAAKmA94nJ3PTWrDMBBA4b1OMRdosDT6hRIKvkIuIMkjd6htGXVCkts3Z+j2wbd4MohA+5Cai874uiQXQmuIjagsAWMp3rWS0WCM6syDDgGbDCXEmhz5Zl00iayv2mpyHk2xVLVZlhJUvst3H3DjHeb8+6Btg0/h/asOysL94Oel9v0KGpPVxjtE+Jj8NKl33VmE/mPV3M8XrO8x4WOFkusPSIc+eOUjb9B4I/UHHmNMM5QOeJydy1sKwjAQRuH3rGI2oGQmlzYgIrgDcQNp8hcDTSsxostXt+B5/OD0BpAzMJmzJJs4J5Fh5OiCsB3nMFvoOAakkaHusWHtpJm1y9YYb4KXSawgR/GY9MQ+8OB/TZhVfPbb1uhaKp3j44VloUMv9ZQaYi/bWt77tNUjsQmWxTttaae91uqrtfSOf151wRorqN9Ac1mgPgYNRBeSDnicncvdCcIwEADg90xxCyiXn6YGRBRXcIG75IKBppX2xI6vM/j6waerCGAozFyCiA2Jx+QJh5Rd8l5cHUiSdcVTzeZFq8wKY5TkamYsIWO1Xkau8VRdHNhF5BLJsUWqht76XFZ4tA532j4yTXDW1q95FdK2zG0/5qVfwPoUrIshWThgRDQ/7U1V/rnmVgpsSxdQ2dV8AbwRRT6TC3icnczNCQIxEEDhe6qYBpT8JwuyCHvybgOTmOBAsoE4ouUrluD1wfd4lgLexpqjL9G5kG6YUtY56ohqccbVaEzQoaLXAp98HxOu1GHDx6u0Biemfs6zINPY6X3Mo6+gzGKV9jYEOEgvpfjWTszlHysuOzFhg+03ER9fQDcKogV4nDM0MDAzMVFIL0pNLcnMS9crqShhEHwQ5TRdT6bE+tY/8blzjRyr9lYcMoSoy60kqBIAxkEfn7UBeJzzSM3JyVcIzy/KSeFyTElRKM7PTeUCAFCMBw6qAnicMzQwMDMxUcitTC9KTS3JzEvXK6koYRB8EOU0XU+mxPrWP/G5c40cq/ZWHAIAMVIQQ6gCeJwzNDAwMzFRSC9KTS3JzEvXK6koYRB8EOU0XU+mxPrWP/G5c40cq/ZWHAIAD7kPXagCeJwzNDAwMzFRSC9KTS3JzEvXK6koYQit3WD7cvqJLC+mPrm9VjKvlaIfWQAAGbwPMTx4nPNIzcnJVwjPL8pJ4QIAHDIEJ9ZeN41OSEIONrXcvdaEN0YnUsHv');

// This is a small sample packfile with couple offset deltas
// pack-5851ce932ec42973b51d631afe25da247c3dc49a.pack
var pack = bodec.fromBase64('UEFDSwAAAAIAAAAQnQ54nJ3MWwoCMQxA0f+uIhtQ0nYeKYgobsENZNoEC/OQMTK6e2cN/l4411YRYCo5kseITVLpSmAfOVLSnFJB6kJqSukDuSevMhu0moed9CmrKjKFwpIxtT7TINh2vSqReHX8tseywr1OcOPXJuMIJ6vTJa/CVpe5fo55mc7gY2p86LFBOGCH6PY6VTP5x7prKfAVA54Xe+yLWTbQOor7AZUCSPmRDnicnctRCgIhEADQf08xFyjGUVeFiKIrdAEdZ0lYd8OM7fh1hn4fvNFFQEi8JCcuCoWSmakwY8xoHGMxkdgimZjVM3VZB8wUPMUJLWrRPml0IdspuJl1JHJBSijGRlLpPR5bh3ttcEuvXZYFTqO2C3dJo25r/Rx5a2fQJlpNHgnhgBOi+mmrY8g/V11LgVV2mOsi6guDiEL9mA94nJ3PTWrDMBBA4b1OMRdosDT6hRIKvkIuIMkjd6htGXVCkts3Z+j2wbd4MohA+5Cai874uiQXQmuIjagsAWMp3rWS0WCM6syDDgGbDCXEmhz5Zl00iayv2mpyHk2xVLVZlhJUvst3H3DjHeb8+6Btg0/h/asOysL94Oel9v0KGpPVxjtE+Jj8NKl33VmE/mPV3M8XrO8x4WOFkusPSIc+eOUjb9B4I/UHHmNMM5QOeJydy1sKwjAQRuH3rGI2oGQmlzYgIrgDcQNp8hcDTSsxostXt+B5/OD0BpAzMJmzJJs4J5Fh5OiCsB3nMFvoOAakkaHusWHtpJm1y9YYb4KXSawgR/GY9MQ+8OB/TZhVfPbb1uhaKp3j44VloUMv9ZQaYi/bWt77tNUjsQmWxTttaae91uqrtfSOf151wRorqN9Ac1mgPgYNRBeSDnicncvdCcIwEADg90xxCyiXn6YGRBRXcIG75IKBppX2xI6vM/j6waerCGAozFyCiA2Jx+QJh5Rd8l5cHUiSdcVTzeZFq8wKY5TkamYsIWO1Xkau8VRdHNhF5BLJsUWqht76XFZ4tA532j4yTXDW1q95FdK2zG0/5qVfwPoUrIshWThgRDQ/7U1V/rnmVgpsSxdQ2dV8AbwRRT6TC3icnczNCQIxEEDhe6qYBpT8JwuyCHvybgOTmOBAsoE4ouUrluD1wfd4lgLexpqjL9G5kG6YUtY56ohqccbVaEzQoaLXAp98HxOu1GHDx6u0Biemfs6zINPY6X3Mo6+gzGKV9jYEOEgvpfjWTszlHysuOzFhg+03ER9fQDcKqQl4nDM0MDAzMVFIL0pNLcnMS9crqShhEHwQ5TRdT6bE+tY/8blzjRyr9lYcMoSoy60kVmVeajlYifjVm28/SzW0d12ZKCB++trFC8ZKOxBKjMBqauylWlkm6kbyCrH0Gp01vHQ9NnMNAFftOrq1AXic80jNyclXCM8vyknhckxJUSjOz03lAgBQjAcOPXicS8zLL8lILVJIy8xJ5QIAI9cEvLEBeJyrTC1RSMzLL8lILVJIy8xJ5QIAOsAGLmWAPnicm8lYOqEUAAX6AhVkEHicKw2aEAQABEABqqoCeJwzNDAwMzFRyK1ML0pNLcnMS9crqShhEHwQ5TRdT6bE+tY/8blzjRyr9lYcAgAxUhBDqAJ4nDM0MDAzMVFIL0pNLcnMS9crqShhEHwQ5TRdT6bE+tY/8blzjRyr9lYcAgAPuQ9dqAJ4nDM0MDAzMVFIL0pNLcnMS9crqShhCK3dYPty+oksL6Y+ub1WMq+Voh9ZAAAZvA8xPHic80jNyclXCM8vyknhAgAcMgQnuZAj3ZpSLQckQi9VfpQYWt+hefM=');
run([
  function testDecodePack() {
    var meta;
    var finished = false;
    var items = [];
    var write = codec.decodePack(function (item) {
      if (item === undefined) {
        finished = true;
      }
      else if (!meta) {
        meta = item;
      }
      else {
        if (item.type === "tree" || item.type === "tag" || item.type === "commit") {
          item.body = decoders[item.type](item.body);
        }
        else {
          item.body = bodec.toRaw(item.body);
        }
        items.push(item);
      }
    });
    for (var i = 0, l = pack.length; i < l; i += 128) {
      write(bodec.slice(pack, i, i + 128));
    }
    write();

    if (!finished) throw new Error("Codec didn't emit end");
    if (items.length !== meta.num) {
      throw new Error("Item count mistmatch");
    }
    console.log(meta);
    console.log(items);
  }
]);
