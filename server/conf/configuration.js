/* Configuration specific to server. */
// Custom values can be provided in conf/server_config.json
// Note, there's also shared/shared_settings.js for settings that should be sync'd.

// For avoiding making either config file dirty:
// http://stackoverflow.com/questions/3319479/git-can-i-commit-a-file-and-ignore-the-content-changes
"use strict";
var fs = require('fs');
var _ = require('lodash');
const SERVER_CONFIG_PATH = './conf/server_config.json';
const DEFAULT_CONFIG_PATH = './conf/default_config.json';

exports.load = function() {
    var default_config = JSON.parse(fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf8'));

    var server_config = {};

    try {
        server_config = JSON.parse(fs.readFileSync(SERVER_CONFIG_PATH, 'utf8'));
    }
    catch (e) {
        console.warn("Custom config not found. Defaults will be used, but may be wonky. Custom config path:", SERVER_CONFIG_PATH);
    }

    var shared_config = require(app.shared_root + '/shared_config');

    var merged_config = _.assign(default_config, server_config, shared_config);
    console.log('Server configuration', merged_config);

    return merged_config;
};

exports.set = function(key, value) {
    app.config[key] = value;

    fs.readFile('./conf/server_config.json', 'utf8', function(err, contents) {
        if (err != null) {
            console.log('update configuration', err);
            return;
        }

        var server_config = JSON.parse(contents);
        server_config[key] = value;

        fs.writeFile(SERVER_CONFIG_PATH, JSON.stringify(server_config, null, 4), function() {
            console.log("Server settings probably updated");
        });

    });

};