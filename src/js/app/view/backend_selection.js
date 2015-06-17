"use strict";

var Backbone = require('backbone'),
    $ = require('jquery');

var Dropbox = require('../backend/dropbox');

var BackendSelectionView = Backbone.View.extend({
    'el': '#backendSelection',

    events: {
        'click .BackendChoice--Dropbox': 'startDropbox',
        'click .BackendChoice--Server': 'startServer',
        'click .BackendChoice--Demo': 'startDemo'
    },

    initialize: function () {},

    startDropbox: function () {
        Dropbox.authorize();
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

    startDemo: function () { _restartWithServer('demo'); }
});

var _restartWithServer = function (u) {
    window.location = `${window.location.origin}?server=${u}`;
}

module.exports.show = function () {
    $('#backendSelectionWrapper').addClass('-is-visible');
};

module.exports.hide = function () {
    $('#backendSelectionWrapper').removeClass('-is-visible');
};

var _view;

module.exports.init = function () {
    if (_view) {
        _view.undelegateEvents();
    }
    _view = new BackendSelectionView();
}
