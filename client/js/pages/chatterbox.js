import "../../less/chatterbox.less";

export default function ($parent, options) {
	const moment = require('moment');

	get_page('chatterbox', function (page) {
		var event_bus = app.event_bus;
		var linkomatic = require('../app/linkomatic')();
		$parent.append(page.$container);

		// Adopted from Diego's gist https://gist.github.com/dperini/729294
		var url_validator = /^(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,}))\.?)(?::\d{2,5})?(?:[/?#]\S*)?$/i;

		app.event_bus.on('window.resize', function () {
			page.$("#chat_rooms .chat_thing").each(function () {
				scroll_thing($(this));
			});
		});

		var scroll_thing = function ($chat) {
			if (app.settings.scroll_lock == true) {
				return;
			}

			if ($chat.length > 0) {
				$chat.scrollTop($chat[0].scrollHeight);
			}
		};
		app.scroll_chat = scroll_thing;

		var get_links_from_message = function (message) {
			var lines = message.split('<br/>');
			message = '';

			var maybe_something = [];

			lines.forEach(function (line) {
				var parts = line.split(/\s/);

				// Consider a more robust link parser (heh!)
				for (var i = 0; i < parts.length; i++) {

					parts[i] = parts[i].replace(url_validator, function (url) {
						maybe_something.push(url);
						return '<a target="_blank" href="' + encodeURI(url) + '">' + url + '</a>';
					});
				}

				if (message == '') {
					message = parts.join(' ');
				} else {
					message += '<br/>' + parts.join(' ');
				}

			});

			return {
				message: message,
				maybe_something: maybe_something
			};
		};

		var show_notification = function (message, append_options) {
			if (append_options.room_id && app.get_active_room(true) != append_options.room_id) {
				app.alert_tab(append_options.room_id);
			}

			if (!document.hasFocus()) {
				if (app.settings.notify === true) {
					var n = new Notification(message);

					n.onclick = function () {
						window.focus();
						n.close();
					};

					setTimeout(function () {
						n.close();
					}, 2500);
				}

				app.unread_messages++;
				document.title = '(' + app.unread_messages + ') ' + app.original_title;

				if (!app.new_message_alert) {
					$('link[rel="shortcut icon"]').attr('href', '/public/favicon-alert.ico');
					app.new_message_alert = true;

					clearInterval(app.check_for_focus);
					app.check_for_focus = setInterval(function () {
						if (document.hasFocus()) {
							app.new_message_alert = false;
							app.unread_messages = 0;
							document.title = app.original_title;
							$('link[rel="shortcut icon"]').attr('href', '/public/favicon-normal.ico');
							clearInterval(app.check_for_focus);
						}
					}, 100);
				}
			}

		};

		var append_custom = function ($blargh, append_options) {
			append_options = $.extend({
				room_id: null
			}, append_options);

			if (typeof ($blargh) == "string") {
				$blargh = $('<div>' + $blargh + '</div>');
			}

			show_notification($blargh.text(), append_options);

			var do_append = function (room_id) {
				var $chat = page.$("div[room_id='" + room_id + "']");
				$chat.append($blargh);
				scroll_thing($chat);
			};

			if (append_options.room_id == null) {
				page.$(".chat_thing").each(function () {
					var room_id = $(this).attr('room_id');
					do_append(room_id);
					$blargh = $blargh.clone(); // this doesn't entirely work for some $blarghs.
				});
			} else {
				do_append(append_options.room_id);
			}

		};

		var append_system = function (message, append_options) {
			append_options = $.extend({
				room_id: null,
				class_name: null,
				color: null
			}, append_options);

			show_notification(message, append_options);

			var do_append = function (room_id) {
				var $chat = page.$("div[room_id='" + room_id + "']");
				var $message = $('<div class="message"><span class="timestamp">[' + moment().format("h:mm:ss A") + ']</span>' +
					'<span class="message_text">' + message + '</span></div>');

				$message.addClass(append_options.class_name);

				if (append_options.color != null) {
					$message.css('color', append_options.color);
				}

				$chat.append($message);
				scroll_thing($chat);
			};

			if (append_options.room_id == null) {
				page.$(".chat_thing").each(function () {
					var room_id = $(this).attr('room_id');
					do_append(room_id);
				});
			} else {
				do_append(append_options.room_id);
			}
		};

		var append_chat = function (data) {
			show_notification(data.username + ": " + data.message, data);

			var do_append = function (room_id) {
				var $chat = page.$("div[room_id='" + room_id + "']");
				var message = data.message;

				var message_parts = get_links_from_message(message);
				message = message_parts.message;
				var maybe_something = message_parts.maybe_something;
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

				if (data.username == 'Ryebrarian') {
					this_fucking_guy.outfit.chat.username_color = 'teal';
					this_fucking_guy.outfit.chat.font_family = 'Courier New';
					this_fucking_guy.outfit.chat.font_size = 16;
				}

				var outfit = this_fucking_guy.outfit.chat;
				var username_thing = data.username;
				if (data.team == true) {
					username_thing = '[TEAM] ' + data.username;
				}

				var $message = $('<div class="message"><span class="timestamp">[' + moment().format("h:mm:ss A") + ']</span><span class="username">' + username_thing + ': </span>' +
					'<span class="message_text">' + message + '</span></div>');
				$message.css({
					background: outfit.bg_color,
					color: outfit.fg_color,
					fontFamily: outfit.font_family,
					fontSize: outfit.font_size + 'px'
				});
				$message.find('.username').css({
					color: outfit.username_color
				});
				$message.find('a').css({
					color: outfit.fg_color
				});

				$chat.append($message);

				if ($link_box != null) {
					$link_box.find('img, iframe').each(function () {
						$(this).on('load', function () {
							scroll_thing($chat);
						});
					});

					$link_box.find('video').each(function () {
						var $video = $(this);

						var scroll_of_doom = function () {
							$video[0].removeEventListener('canplay', scroll_of_doom);
							scroll_thing($chat);
						};

						$video[0].addEventListener('canplay', scroll_of_doom);
					});

					$message.after($link_box);
				}

				scroll_thing($chat);
			};

			if (data.room_id == null) {
				page.$(".chat_thing").each(function () {
					var room_id = $(this).attr('room_id');
					do_append(room_id);
				});
			} else {
				do_append(data.room_id);
			}
		};

		function ButtsFactory() {
			this.newButts = function (buttFrequency, jumbleFrequency) {
				var butts = {};
				butts.buttFrequency = buttFrequency;
				butts.jumbleFrequency = jumbleFrequency;
				butts.buttArray = [];

				butts.init = function (initArray) {
					butts.buttArray = initArray.slice(0);
				}

				butts.buttTime = function () {
					if (Math.floor(Math.random() * butts.buttFrequency) == 0) {
						return true;
					}
				}

				butts.buttify = function (word) {
					var result = word;
					if (this.buttTime()) {
						if (Math.floor(Math.random() * 2) == 0) {
							result = "butt";
						} else {
							result = "butts";
						}
					}
					return result;
				}

				butts.big = function (word) {
					if (Math.floor(Math.random() * 15) == 0) {
						return word.toUpperCase();
					} else {
						return word;
					}
				}

				butts.cap = function (string) {
					return string.charAt(0).toUpperCase() + string.slice(1);
				}

				butts.pick = function (a) {
					var i = Math.floor(a.length * Math.random());
					return a[i];
				}

				butts.emptyKiller = function () {
					// butts.buttArray = butts.buttArray.filter(butt => butt.trim() != '');
					return this;
				}

				butts.shuffle = function () {
					for (var i = butts.buttArray.length - 1; i > 0; i--) {
						var j = Math.floor(Math.random() * (i + 1));
						var temp = butts.buttArray[i];
						butts.buttArray[i] = butts.buttArray[j];
						butts.buttArray[j] = temp;
					}

					return this;
				}

				butts.postProcess = function () {
					var temp = butts.buttArray.slice(0);
					butts.buttArray = [];
					temp.forEach(function (segment) {
						var words = segment.split(' ');
						var new_words = [];
						var new_segment;

						words.forEach(function (processed_word) {
							processed_word = butts.buttify(processed_word);
							processed_word = butts.big(processed_word);
							new_words.push(processed_word);
						});

						new_segment = new_words.join(' ');
						butts.buttArray.push(new_segment);
					});

					return this;
				}

				butts.punct = function () { // punctuate paragraph randomly
					for (i = 0; i < butts.buttArray.length - 2; i++) {
						if (Math.floor(Math.random() * 5) == 0) {
							butts.buttArray[i] = butts.buttArray[i].trim() + butts.pick(['!', '?', '.', '...']);
							butts.buttArray[i + 1] = butts.cap(butts.buttArray[i + 1]);
						} else if (Math.floor(Math.random() * 9 == 0)) {
							butts.buttArray[i] = butts.buttArray[i].trim() + ',';
						}
					}

					return this;
				}

				butts.end = function () { // Capitalize first word.  Punctuate last word.
					butts.buttArray[0] = butts.cap(butts.buttArray[0].trim());
					butts.buttArray[butts.buttArray.length - 1] = butts.buttArray[butts.buttArray.length - 1] + butts.pick(['!', '?', '.', '...']);
					butts.buttArray[butts.buttArray.length - 1].trim();

					return this;
				}

				butts.rgx = function (s, reg) {
					return s.toLowerCase().split(reg);
				}

				butts.cap_all = function (s) {
					var teach = s.split(" ");
					var taught = [];
					teach.forEach(function (s) {
						taught.push(butts.cap(s));
					});
					return taught.join(" ");
				}

				butts.butter = function (elTexto) {
					var newBase = elTexto;
					var aBase = butts.rgx(newBase, / |\.|,|\?|!/);
					butts.init(aBase);
					butts.emptyKiller().shuffle().postProcess().punct().end();

					var convertedButts = Array.prototype.slice.call(butts.buttArray);
					return convertedButts.join(' ');
				}

				return butts;
			}

		}

		var buttsFactory = new ButtsFactory();
		var butts = buttsFactory.newButts(10, 5);

		page.peepy('users.roams_the_earth', function (event) {
			// append_system(event.username + butts.butter(" roams the earth. Diablo's minions grow stronger."), { class_name: 'happy', room_id: app.get_lobby(true) })
			append_system(event.username + " roams the earth. Diablo's minions grow stronger.", {
				class_name: 'happy',
				room_id: app.get_lobby(true)
			})
		});

		page.peepy('users.has_gone_to_a_better_place', function (event) {
			// append_system(event.username + butts.butter(" went to the clearing at the end of the path. Diablo's minions are mildly frustrated."), { class_name: 'sad', room_id: app.get_lobby(true) })
			append_system(event.username + " went to the clearing at the end of the path. Diablo's minions are mildly frustrated.", {
				class_name: 'sad',
				room_id: app.get_lobby(true)
			})
		});

		event_bus.on('blargher.send', function (params) {
			var room_id = app.get_active_room(true);
			page.send('blargh', {
				message: params.message,
				room_id: room_id
			});
		});

		event_bus.on('tom_clancy.change_room_name', function (params) {
			page.send('change_room_name', params);
		});

		event_bus.on('ws.connect', function () {
			var room_id = app.get_lobby(true);
			append_system("Reconnected! Soothing lobster bisque...", {
				room_id: room_id,
				color: 'green'
			});
			page.ws.send('login', 'reconnect', {
				auth_key: localStorage.auth_key,
				username: app.profile.username
			});
		});

		event_bus.on('ws.binary_disconnect', function () {
			app.append_system("Binary disconnected. Hopefully it comes back! (it doesn't)", {
				room_id: app.get_active_room(true),
				color: 'red'
			});
		});

		event_bus.on('ws.disconnect', function () {
			if (localStorage.instance_id != null && localStorage.instance_id != app.instance_id) {
				console.log('localStorage', localStorage.instance_id);
				console.log('app', app.instance_id);
				page.alert('Whew.', 'Disconnected. Another, more recent instance of yehrye exists. Did you open another tab, Canister?');
				return;
			}

			if (!page.ws.reconnecting) {
				var room_id = app.get_active_room(true);
				var $blargh = $('<div class="reconnect_meter">Disconnected from server. Attempting to reconnect (attempt: <span id="reconnect_attempt">1</span>)</div>');
				append_custom($blargh, {
					room_id: room_id
				});
			} else {
				var attempt = page.$(".reconnect_meter").last().find('#reconnect_attempt').text();
				attempt = parseInt(attempt);
				attempt++;
				page.$(".reconnect_meter").last().find('#reconnect_attempt').text(attempt)
			}

			app.disconnected = true;
			page.ws.reconnect();
		});

		page.listen('blargh_grid', function (grid_data) {
			var grid_width = grid_data.grid_width || 500;

			var $blargh = $('<div class="blargh"/>').css({
				width: grid_width
			});
			$blargh.append('<div class="header">' + grid_data.username + ' (' + grid_data.title + ') <span class="close">x</span></div>');
			$blargh.append('<div class="body" style="padding: 0;"/>');
			var $body = $blargh.find('.body');

			var $table = $('<table class="wupfindtable center_content"><thead></thead><tbody><tr><td colspan="' + grid_data.columns.length + '">No data in table.</td></tr></tbody>');
			var $header = $('<tr/>');
			$table.find('thead').append($header);

			grid_data.columns.forEach(function (col) {
				$header.append('<th>' + col + '</th>');
			});

			var $tbody = $table.find('tbody');

			if (grid_data.rows.length > 0) {
				$tbody.empty();
			}

			grid_data.rows.forEach(function (row) {
				var $row = $('<tr/>');
				row.forEach(function (col) {
					$row.append('<td>' + col + '</td>');
				});

				$tbody.append($row);
			});


			$body.append($table);
			append_custom($blargh, {
				room_id: grid_data.room_id
			});
		});

		page.listen('chat', function (data) {
			append_chat(data);
		});

		page.listen('system', function (data) {
			append_system(data.message, {
				class_name: 'sad',
				color: data.color,
				room_id: data.room_id
			})
		});

		page.listen('boom_boom', function (data) {
			page.toolio.confirm("Invitation", data.invited_by + " invited you to chat.<br/><br/><b>Room Name:</b> " + data.room_name, function () {
				page.send('join_room', {
					room_id: data.room_id
				});
			});
		});

		page.listen('sorry_jimmy', function (data) {

			page.toolio.confirm("Invitation", data.invited_by + " invited you to play " + data.game_type + ".<br/><br/><b>Game Name:</b> " + data.game_name, function () {

				var already_open = app.popups.some(function (p) {
					if (p.closed != true && p.woboy && p.woboy.room_id == data.room_id) {
						p.focus();
						return true;
					}
				});

				if (already_open) {
					return;
				}

				var popup = window.open('index.html?wup=yownet', '_blank', 'width=1300,height=830,left=200,top=100');

				popup.woboy = {
					room_id: data.room_id,
					game_name: data.game_name
				};

				page.ws.register_popup({
					page_key: 'yownet',
					room_id: data.room_id,
					instance_id: instance_id,
					popup: popup
				});
			});
		});

		page.listen('join_room', function (room) {
			app.add_room_tab(room, {
				focus: true
			});

			if (room.recent_messages.length > 0) {
				var $blargh = $('<div class="blargh recent_messages"/>');
				$blargh.append('<div class="header">Recent Messages <span class="close">x</span></div>');
				$blargh.append('<div class="body"/>');
				var $body = $blargh.find('.body');

				room.recent_messages.forEach(function (mess) {
					var message = get_links_from_message(mess.message).message;
					$body.append('<div>[' + moment(mess.timestamp).format('hh:mm:ss A') + '] ' + message + '</div>');
				});

				append_custom($blargh, {
					room_id: room.id
				});
				scroll_thing($blargh);
			}

			app.render_users_list();
		});

		page.listen('blargh', function (data) {
			var $blargh = $('<div class="blargh prehensile"/>');
			$blargh.append('<div class="header">' + data.username + ' <span class="close">x</span></div>');
			$blargh.append('<div class="body"/>');
			var $body = $blargh.find('.body');
			$body.text(data.message);

			append_custom($blargh, {
				room_id: data.room_id
			});
		});

		page.listen('change_room_name', function (data) {
			append_system(data.blame + ' changed the room name to ' + data.new_name, {
				room_id: data.room_id,
				class_name: 'wup'
			});
			app.rename_room_tab(data.room_id, data.new_name);
		});

		page.listen('create_transfer_progress', function (data) {
			var $wrapper = $('<div class="transfer_progress" transfer_id="' + data.transfer_id + '"/>');
			$wrapper.prop('meta', data);
			var message = data.username + " is sending " + data.name + " (" + page.toolio.nice_size(data.size) + ")";

			var $progress = $('<progress value="0" max="100"/>');
			$wrapper.append(message);
			$wrapper.append($progress);
			append_custom($wrapper, {
				room_id: data.room_id
			});
		});

		page.listen('reconnect', function (data) {
			if (!data.success) {
				app.force_logout = true;
				delete localStorage.auth_key;
				window.location = '/';
				return;
			}

			var room_id = app.get_lobby(true);
			append_system("Logged in (again).", {
				room_id: room_id,
				color: 'green'
			});

			localStorage.auth_key = data.auth_key;
			lobby = data.lobby;
			page.ws.send('users', 'sync', {
				room_id: app.get_active_room(true),
				mobile: app.is_mobile
			});

			if (lobby.recent_messages.length > 0) {
				var $blargh = $('<div class="blargh recent_messages"/>');
				$blargh.append('<div class="header">Recent Messages <span class="close">x</span></div>');
				$blargh.append('<div class="body"/>');
				var $body = $blargh.find('.body');

				lobby.recent_messages.forEach(function (mess) {
					$body.append('<div>[' + moment(mess.timestamp).format('hh:mm:ss A') + '] ' + mess.message + '</div>');
				});

				append_custom($blargh, {
					room_id: lobby.id
				});
				scroll_thing($blargh);
			}

			app.idleTracker.reset(true);
		});

		var lobby = options.lobby;
		app.add_room_tab(options.lobby, {
			focus: true
		});
		app.ready = true;
		app.logged_in = true;

		app.handle_binary = function (binary_parts, meta) {
			var blob = new Blob(binary_parts, {
				type: meta.type
			});
			var blob_url = URL.createObjectURL(blob);

			var $blob_wrapper = $('<div class="file_transfer"/>');
			$blob_wrapper.prop('blob_url', blob_url);

			var $header = $('<div class="header"/>');
			var $author = $('<span class="username"/>').text(meta.username);
			var $file_name = $('<span class="file_name"/>').text(meta.name);
			var $file_size = $('<span class="file_size"/>').text(page.toolio.nice_size(meta.size));
			var $save = $('<a target="_blank" class="save">Save</a>').attr({
				download: meta.name,
				href: blob_url
			});
			var $close = $('<span class="close">x</span>');

			$header.append($author, ' has sent ', $file_name, ' (', $file_size, ')', $save, $close);
			$blob_wrapper.append($header);

			var handlers = {
				image: function () {
					var $elm = $('<img/>').attr('src', blob_url);
					$elm.on('load', function () {
						scroll_thing($elm.closest('.chat_thing'));
					});

					$blob_wrapper.append($elm);
				},
				video: function () {
					var $elm = $('<video controls autoplay muted/>');
					var $src = $('<source/>').attr('src', blob_url);
					$elm.append($src);

					$elm[0].addEventListener('loadedmetadata', function scroll_of_doom() {
						this.removeEventListener('loadedmetadata', scroll_of_doom);
						scroll_thing($elm.closest('.chat_thing'));
					});

					$blob_wrapper.append($elm);
				},
				audio: function () {
					var $elm = $('<audio controls/>');
					var $src = $('<source/>').attr('src', blob_url);
					$elm.append($src);

					$elm.on('load', function () {
						scroll_thing($elm.closest('.chat_thing'));
					});

					$blob_wrapper.append($elm);
				},
				generic_file: function () {

				}

			};

			var type = meta.type && meta.type.split('/')[0];

			if (handlers[type]) {
				handlers[type]();
			} else {
				handlers.generic_file();
			}

			append_custom($blob_wrapper, {
				room_id: meta.room_id
			});
		};

		append_system("I like it spooky.", {
			class_name: 'welcoming',
			room_id: lobby.id
		});

		app.append_system = function (message, append_options) {
			var room_id = app.get_active_room(true);

			append_options = $.extend({
				room_id: room_id
			}, append_options);

			append_system(message, append_options);
		};

		if (lobby.recent_messages.length > 0) {
			var $blargh = $('<div class="blargh recent_messages"/>');
			$blargh.append('<div class="header">Recent Messages <span class="close">x</span></div>');
			$blargh.append('<div class="body"/>');
			var $body = $blargh.find('.body');

			lobby.recent_messages.forEach(function (mess) {
				var message = get_links_from_message(mess.message).message;
				$body.append('<div>[' + moment(mess.timestamp).format('hh:mm:ss A') + '] ' + message + '</div>');
			});

			append_custom($blargh, {
				room_id: lobby.id
			});
			scroll_thing($blargh);
		}

		var instance_id = app.toolio.generate_id();
		localStorage.instance_id = instance_id;
		app.instance_id = instance_id;
	});

	return {};
};