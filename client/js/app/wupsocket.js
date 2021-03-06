module.exports = (function () {
    "use strict";
    const pako = require('pako');
    const toolio = app.toolio;
    const event_bus = app.event_bus;
    const DEFAULT_CHUNK_SIZE = 1024 * 1024;
    var chunk_size = DEFAULT_CHUNK_SIZE;

    if (localStorage.chunk_size) {
        var user_chunk_size = Number(localStorage.chunk_size);

        if (!isNaN(user_chunk_size) && user_chunk_size > 0) {
            chunk_size = user_chunk_size;
        }
    }

    var wupsocket = {
        binary_transfers: {}
    };

    var ws_connected = false;
    var binary_connected = false;
    var manually_closed = false;
    var key;

    var prime_socket = new Worker('js/public/prime_socket.js');
    prime_socket.postMessage({});

    var ws_handlers = {
        connection: function (message) {
            switch (message.sub_type) {
                case 'heartbeat':
                    wupsocket.send('connection', 'heartbeat', message.data);
                    break;
                case 'connection_info':
                    wupsocket.connection_info = message.data;
                    event_bus.emit('ws.connect');

                    // Thinking here is that if the client sends a message on a regular interval, it'll trigger a disconnect faster.
                    clearInterval(wupsocket.pong);
                    wupsocket.pong = setInterval(function () {
                        wupsocket.send('connection', 'pong', {});
                    }, 7500);

                    // Hook up the Prime Socket.
                    prime_socket.postMessage({
                        action: 'binary_connect',
                        params: {
                            server_ip: app.settings.binary_server,
                            connection_info: wupsocket.connection_info
                        }
                    });

                    break;
                default:
                    break;
            }
        }

    };

    prime_socket.addEventListener('message', function (e) {
        var params = e.data.params;

        switch (e.data.action) {
            case 'connect':
                wupsocket.reconnecting = false;
                wupsocket.last_reconnect_attempt = 0;
                ws_connected = true;
                break;

            case 'binary_connect':
                binary_connected = true;
                event_bus.emit('ws.binary_connect');
                break;

            case 'binary_disconnect':
                binary_connected = false;
                event_bus.emit('ws.binary_disconnect');
                break;

            case 'binary_reconnect_attempt':
                app.append_system("Attempting to reconnect binary...", {
                    color: 'green'
                });
                break;

            case 'disconnect':
                if (manually_closed === false) {
                    event_bus.emit('ws.disconnect');
                }

                ws_connected = false;
                break;

            case 'message':
                var message = params.message;
                if (typeof (ws_handlers[message.type]) == "function") {
                    ws_handlers[message.type](message);
                }

                if (message.type != null && message.sub_type != null && message.data != null) {
                    event_bus.emit(message.type + '.' + message.sub_type, message.data);
                }

                wupsocket.popups.forEach(function (p) {
                    if (p.room_id == message.data.room_id || p.instance_id == message.data.instance_id) {
                        var popup_message = $.extend(message, {
                            listener_name: 'ws.' + message.type
                        });
                        p.popup.postMessage(popup_message, app.domain);
                    }
                });

                break;

            case 'message_buffer':
                var meta = params.meta;

                if (meta.type == 'blackboard') {
                    var inflated_response = pako.inflate(params.buffer, {
                        to: 'string'
                    });
                    var response_as_json = JSON.parse(inflated_response);
                    var useful_response = {
                        bg_color: meta.bg_color,
                        room_id: meta.room_id,
                        commands: response_as_json
                    };

                    event_bus.emit('black_board.load', useful_response);
                    return;
                }

                // I'm sure it's fine.
                if (meta.debut === true && wupsocket.binary_transfers[meta.transfer_id] == null) {
                    wupsocket.binary_transfers[meta.transfer_id] = {
                        data: []
                    };
                } else if (wupsocket.binary_transfers[meta.transfer_id] == null) {
                    console.debug("Ignoring partial transfer " + meta.transfer_id);
                    return;
                }

                if (meta.no_data !== true) {
                    wupsocket.binary_transfers[meta.transfer_id].data.push(params.buffer);
                } else {
                    if (wupsocket.binary_transfers[meta.transfer_id].chunk == null) {
                        wupsocket.binary_transfers[meta.transfer_id].chunk = 0;
                    } else {
                        wupsocket.binary_transfers[meta.transfer_id].chunk++;
                    }
                }

                if (meta.compvare == true) {
                    meta.file_info.username = meta.username;
                    app.handle_binary(wupsocket.binary_transfers[meta.transfer_id].data, meta.file_info);
                    delete wupsocket.binary_transfers[meta.transfer_id];
                    event_bus.emit('ws.transfer_complete', {
                        transfer_id: meta.transfer_id
                    });
                } else {
                    var stored_size;

                    if (meta.no_data == true) {
                        var cur_chunk = wupsocket.binary_transfers[meta.transfer_id] && wupsocket.binary_transfers[meta.transfer_id].chunk;
                        cur_chunk = cur_chunk || 0;
                        stored_size = cur_chunk * chunk_size;
                    } else {
                        stored_size = wupsocket.binary_transfers[meta.transfer_id].data.reduce(function (prev, chunk) {
                            return prev + chunk.byteLength;
                        }, 0);
                    }

                    event_bus.emit('ws.transfer_update', {
                        transfer_id: meta.transfer_id,
                        stored_size: stored_size
                    });
                }

                break;

            case 'error':
                event_bus.emit('ws.error');
                break;

            default:
                break;
        }
    });


    wupsocket.send_binary = function (blob, meta) {
        if (!binary_connected) {
            app.append_system('Unable to send: Binary not connected.', {
                color: 'red'
            });
        }
        var transfer_id = meta.transfer_id;

        prime_socket.postMessage({
            action: 'create_transfer_progress',
            params: {
                meta: meta
            }
        });

        var send_chunk = function (buffer, meta, start) {
            var transfer_info = {
                compvare: false,
                transfer_id: transfer_id,
                room_id: meta.room_id
            };

            if (start === 0) {
                transfer_info.debut = true;
            }

            if (start + chunk_size >= buffer.byteLength) {
                transfer_info.compvare = true;
                transfer_info.file_info = meta;

                var chunk = buffer.slice(start);
                prime_socket.postMessage({
                    action: 'send_binary',
                    params: {
                        blob: chunk,
                        meta: transfer_info
                    }
                }, [chunk]);
            } else {
                var chunk = buffer.slice(start, start + chunk_size);
                prime_socket.postMessage({
                    action: 'send_binary',
                    params: {
                        blob: chunk,
                        meta: transfer_info
                    }
                }, [chunk]);

                setTimeout(function () {
                    send_chunk(buffer, meta, start + chunk_size);
                }, 0);
            }
        };

        wupsocket.binary_transfers[transfer_id] = {
            data: [blob]
        };
        send_chunk(blob, meta, 0);
    };

    wupsocket.send = function (type, sub_type, data) {
        if (ws_connected === false) {
            console.error("Wupsocket is not connected");
            event_bus.emit('ws.error');
            return;
        }

        var wrapped_message = {
            type: type,
            sub_type: sub_type,
            data: data
        };

        prime_socket.postMessage({
            action: 'send',
            params: {
                message: wrapped_message
            }
        });
    };

    Object.defineProperty(wupsocket, 'connected', {
        get: function() {
            return ws_connected
        }
    });

    wupsocket.is_connected = function () {
        return ws_connected;
    };

    wupsocket.close = function () {
        manually_closed = true;
        prime_socket.postMessage({
            action: 'disconnect'
        });
    };

    app.register_window_listener('ws.send', function (data) {
        wupsocket.send(data.type, data.sub_type, data.message);
    });

    app.register_window_listener('ws.set_room_id', function (data) {
        var page_name = data.page_name;

        wupsocket.popups.forEach(function (p) {
            if (p.instance_id == data.instance_id) {
                p.room_id = data.room_id;
            }
        });
    });

    wupsocket.popups = [];
    wupsocket.register_popup = function (registration) {
        var page_key = registration.page_key;
        wupsocket.popups.push(registration);
        app.popups.push(registration.popup);
    };

    wupsocket.reconnect = function () {
        wupsocket.reconnecting = true;

        if (Date.now() - wupsocket.last_reconnect_attempt >= 5000) {
            wupsocket.last_reconnect_attempt = Date.now();

            prime_socket.postMessage({
                action: 'connect',
                params: {
                    server_ip: app.settings.server
                }
            });
        } else {
            var diff = 5000 - (Date.now() - wupsocket.last_reconnect_attempt);
            setTimeout(function () {
                wupsocket.reconnect();
            }, diff)
        }

    };

    wupsocket.connect = function () {
        prime_socket.postMessage({
            action: 'disconnect'
        });

        prime_socket.postMessage({
            action: 'connect',
            params: {
                server_ip: app.settings.server
            }
        });
    };

    return wupsocket;
})();