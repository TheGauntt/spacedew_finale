module.exports = function($parent, options) {
    get_page('chatterbox', function(page) {
        var event_bus = require('../../../shared/event_bus');
        var linkomatic = require('../app/linkomatic')();
        $parent.append(page.$container);

        var scroll_chat = function($chat) {
            if ($chat.length > 0) {
                $chat.scrollTop($chat[0].scrollHeight);
            }
        };

        var show_notification = function(message) {

            if (!document.hasFocus()) {
                if (app.settings.notify === true) {
                    var n = new Notification(message);

                    n.onclick = function() {
                        window.focus();
                        n.close();
                    };

                    setTimeout(function() {
                        n.close();
                    }, 2500);
                }

                // Do the favicon thing.
                if (app.new_message_alert !== true) {
                    $('#favicon').attr('href', '/images/favicon-alert.png');
                    app.new_message_alert = true;

                    $(window).one('focus', function() {
                        app.new_message_alert = false;
                        $('#favicon').attr('href', '/images/favicon-normal.png');
                    });
                }
            }

        };

        var append_custom = function($blargh, append_options) {
            append_options = $.extend({
                room_id: null
            }, append_options);

            if (typeof($blargh) == "string") {
                $blargh = $('<div>' + $blargh + '</div>');
            }

            var $chat = page.$("div[room_id='" + append_options.room_id + "']");
            $chat.append($blargh);

            show_notification("New MYSTERY message!");

            if (app.settings.scroll_lock !== true) {
                $chat.scrollTop($chat[0].scrollHeight);
                scroll_chat($chat);
            }
        };

        var append_system = function(message, append_options) {
            append_options = $.extend({
                room_id: null,
                class_name: null
            }, append_options);

            if (append_options.room_id == null) {
                return;
            }

            var $chat = page.$("div[room_id='" + append_options.room_id + "']");
            var $message = $('<div class="message"><span class="timestamp">[' + moment().format("h:mm:ss A") + ']</span>' +
                '<span class="message_text">' + message + '</span></div>');

            $message.addClass(append_options.class_name);
            $chat.append($message);

            show_notification(message);

            if (app.settings.scroll_lock !== true) {
                scroll_chat($chat);
            }
        };

        var append_chat = function(data) {
            if (data.room_id == null) {
                return;
            }

            var $chat = page.$("div[room_id='" + data.room_id + "']");
            var message = data.message;

            var lines = message.split('<br/>');
            message = '';

            var maybe_something = [];

            lines.forEach(function(line) {
                var parts = line.split(/\s/);

                // Consider a more robust link parser (heh!)
                for (var i = 0; i < parts.length; i++) {
                    parts[i] = parts[i].replace(/(http.*)/, function(url) {
                        maybe_something.push(url);
                        return '<a target="_blank" href="' + encodeURI(url) + '">' + url + '</a>';
                    });
                }

                if (message == '') {
                    message = parts.join(' ');
                }
                else {
                    message += '<br/>' + parts.join(' ');
                }
            });

            var $link_box = linkomatic(maybe_something);

            var this_fucking_guy = app.world.user_settings[data.username];
            this_fucking_guy = $.extend(true, {
                outfit: {
                    chat: {
                        bg_color: 'white',
                        fg_color: 'black',
                        font_family: 'Verdana',
                        font_size: 14,
                        username_color: 'blue'
                    }
                }
            }, this_fucking_guy);

            var outfit = this_fucking_guy.outfit.chat;

            var $message = $('<div class="message"><span class="timestamp">[' + moment().format("h:mm:ss A") + ']</span><span class="username">' + data.username + ': </span>'
                + '<span class="message_text">' + message + '</span></div>');
            $message.css({background: outfit.bg_color, color: outfit.fg_color, fontFamily: outfit.font_family, fontSize: outfit.font_size + 'px'});
            $message.find('.username').css({color: outfit.username_color});
            $message.find('a').css({color: outfit.username_color});

            $chat.append($message);
            show_notification(data.username + ": " + data.message);

            if ($link_box != null) {
                $link_box.find('img, iframe').each(function() {
                    $(this).on('load', function() {
                        if (app.settings.scroll_lock !== true) {
                            scroll_chat($chat);
                        }
                    });
                });

                $link_box.find('video').each(function() {
                    var $video = $(this);

                    var scroll_of_doom = function() {
                        $video[0].removeEventListener('canplay', scroll_of_doom);
                        if (app.settings.scroll_lock !== true) {
                            scroll_chat($chat);
                        }
                    };

                    $video[0].addEventListener('canplay', scroll_of_doom);
                });

                $message.after($link_box);
            }

            if (app.settings.scroll_lock !== true) {
                scroll_chat($chat);
            }
        };

        event_bus.on('users.roams_the_earth', function(event) {
            append_system(event.username + " roams the earth.", {class_name: 'happy', room_id: event.room_id})
        });

        event_bus.on('users.has_gone_to_a_better_place', function(event) {
            append_system(event.username + " has gone to a better place.", {class_name: 'sad', room_id: event.room_id})
        });

        event_bus.on('blargher.send', function(params) {
            var room_id = app.get_active_room(true);
            page.send('blargh', {message: params.message, room_id: room_id});
        });

        event_bus.on('tom_clancy.change_room_name', function(params) {
            page.send('change_room_name', params);
        });

        event_bus.on('ws.disconnect', function() {
            if (app.disconnected === true) {
                return;
            }

            app.disconnected = true;

            $("<div>Disconnected from server</div>").dialog({
                title: "Oh shit",
                modal: true,
                buttons: {
                    'Ok': function() {
                        $(this).dialog('close');
                    }
                },
                close: function() {
                    app.disconnected = false;
                    window.location = '/';
                    $(this).destroy();
                }
            });
        });

        page.listen('chat', function(data) {
            append_chat(data);
        });

        page.listen('system', function(data) {
            append_system(data.message, {class_name: 'sad', room_id: data.room_id})
        });

        page.listen('blargh', function(data) {
            var $blargh = $('<div class="blargh prehensile"/>');
            $blargh.append('<div class="header">' + data.username + ' <span class="close">x</span></div>');
            $blargh.append('<div class="body"/>');
            var $body = $blargh.find('.body');
            $body.text(data.message);

            append_custom($blargh, {room_id: data.room_id});
        });

        page.listen('change_room_name', function(data) {
            append_system(data.blame + ' changed the room name to ' + data.new_name, {room_id: data.room_id, class_name: 'wup'});
            app.rename_room_tab(data.room_id, data.new_name);
        });

        var lobby = options.lobby;
        app.add_room_tab(options.lobby, {focus: true});
        app.ready = true;

        app.handle_binary = function(buffer, meta) {
            var blob = new Blob([buffer], {type: meta.type});
            var blob_url = URL.createObjectURL(blob);

            var $blob_wrapper = $('<div class="file_transfer"/>');
            $blob_wrapper.prop('blob_url', blob_url);

            var nice_size = meta.size / (1024 * 1024);
            nice_size = nice_size.toFixed(3);

            var $header = $('<div class="header"/>');
            var $author = $('<span class="username"/>').text(meta.username);
            var $file_name = $('<span class="file_name"/>').text(meta.name);
            var $file_size = $('<span class="file_size"/>').text(nice_size);
            var $save = $('<a target="_blank" class="save">Save</a>').attr({download: meta.name, href: blob_url});
            var $close = $('<span class="close">x</span>');

            $header.append($author, ' has sent ', $file_name, ' size: ', $file_size, ' mb', $save, $close);
            $blob_wrapper.append($header);

            var handlers = {
                image: function() {
                    var $elm = $('<img/>').attr('src', blob_url);
                    $elm.on('load', function() {
                        scroll_chat($elm.closest('.chat_thing'));
                    });

                    $blob_wrapper.append($elm);
                },
                video: function() {
                    var $elm = $('<video controls autoplay muted/>');
                    var $src = $('<source/>').attr('src', blob_url);
                    $elm.append($src);

                    $elm[0].addEventListener('loadedmetadata', function scroll_of_doom() {
                        this.removeEventListener('loadedmetadata', scroll_of_doom);
                        scroll_chat($elm.closest('.chat_thing'));
                    });

                    $blob_wrapper.append($elm);
                },
                audio: function() {
                    var $elm = $('<audio controls/>');
                    var $src = $('<source/>').attr('src', blob_url);
                    $elm.append($src);

                    $elm.on('load', function() {
                        scroll_chat($elm.closest('.chat_thing'));
                    });

                    $blob_wrapper.append($elm);
                },
                generic_file: function() {

                }

            };

            var type = meta.type && meta.type.split('/')[0];

            if (handlers[type]) {
                handlers[type]();
            }
            else {
                handlers.generic_file();
            }

            append_custom($blob_wrapper, {room_id: meta.room_id});
        };

        if (lobby.recent_messages.length > 0) {
            var $blargh = $('<div class="blargh"/>');
            $blargh.append('<div class="header">Recent Messages <span class="close">x</span></div>');
            $blargh.append('<div class="body"/>');
            var $body = $blargh.find('.body');

            lobby.recent_messages.forEach(function(mess) {
                $body.append('<div>[' + moment(mess.timestamp).format('hh:mm:ss A') + '] ' + mess.message + '</div>');
            });

            append_custom($blargh, {room_id: lobby.id});
        }
    });

    return {};
};