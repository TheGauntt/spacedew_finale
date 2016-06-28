var ws;

var util = {};
util.array_buffer_to_string = function(buf) {
    return String.fromCharCode.apply(null, new Uint16Array(buf));
};

util.string_to_array_buffer = function(str) {
    var buf = new ArrayBuffer(str.length * 2);
    var buf_view = new DataView(buf);

    for (var i = 0; i < str.length; i++) {
        buf_view.setUint16(i * 2, str.charCodeAt(i), true);
    }

    return buf;
};

util.blob_from_buffer = function(buffer, meta) {
    var header = util.string_to_array_buffer(JSON.stringify(meta));

    var header_length = new ArrayBuffer(4);    // 4 bytes = 32-bits.
    new DataView(header_length).setUint32(0, header.byteLength, true); // explicit little endian

    return new Blob([header_length, header, buffer]); // roll it up
};

addEventListener('message', function(e) {
    var params = e.data.params;

    switch (e.data.action) {

        case 'connect':
            ws = new WebSocket(params.server_ip);
            ws.binaryType = "arraybuffer";

            ws.onopen = function(event) {
                postMessage({action: 'connect'});
            };

            ws.onerror = function(event) {
                postMessage({action: 'error'});
            };

            ws.onclose = function(event) {
                postMessage({action: 'disconnect'});
            };

            ws.onmessage = function(event) {
                var parsed_message = JSON.parse(event.data);
                postMessage({
                    action: 'message',
                    params: {
                        message: parsed_message
                    }
                });
            };

            break;

        case 'disconnect':
            if (ws != null) {
                ws.close();
            }
            break;

        case 'send':
            ws.send(JSON.stringify(params.message));
            break;

        case 'send_binary':
            var blob = util.blob_from_buffer(params.blob, params.meta);
            ws.send(blob);
            break;

        default:
            break;
    }

});