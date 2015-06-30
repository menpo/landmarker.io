"use strict";

var Backbone = require('backbone'),
    $ = require('jquery');

var Modal = require('./modal'),
    Dropbox = require('../backend/dropbox');

var BackendSelectionModal = Modal.extend({

    closable: false,
    title: 'Select a datasource',

    choices: [
        ['Dropbox', 'Dropbox'],
        ['Server', 'Managed Server'],
        ['Demo', 'Demo']
    ],

    events: {
        'click .BackendOption--Dropbox': 'startDropbox',
        'click .BackendOption--Server': 'startServer',
        'click .BackendOption--Demo': 'startDemo'
    },

    content: function () {
        let $div = $('<div></div>');
        $div.addClass('BackendChoices');
        this.choices.forEach(function ([cls, text]) {
            $div.append($(`<div class='BackendOption--${cls}'>${text}</div>`));
        });
        return $div;
    },

    init: function ({cfg}) {
        this.cfg = cfg;
    },

    startDropbox: function () {
        var [url, state] = Dropbox.authorize();
        this.cfg.set('OAUTH_STATE', state);
        this.cfg.set('BACKEND_TYPE', Dropbox.Type);
        this.cfg.save();
        window.location = url;
    },

    startServer: function () {
        let u = window.prompt(
            'Please provide the url for the landmarker server');
        if (!u) {
            // Pass
        } else {
            _restartWithServer(u);
        }
    },

    startDemo: function () {
        _restartWithServer('demo');
    }
});

var _restartWithServer = function (u) {
    window.location = `${window.location.origin}?server=${u}`;
}

var _view;

module.exports.show = function () {
    if (_view) _view.open();
};

module.exports.hide = function () {
    if (_view) _view.close();
};

module.exports.init = function (cfg) {
    if (_view) {
        if (_view.isOpen) {
            _view.close();
        }
        _view.dispose();
    }
    _view = new BackendSelectionModal({cfg});
};
