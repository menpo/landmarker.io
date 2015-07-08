"use strict";

var $ = require('jquery'),
    _ = require('underscore');

var Modal = require('./modal');
var { notify } = require('./notification');
var Backend = require('../backend');
var { baseUrl } = require('../lib/utils');

var version = require('../../../../package.json').version;

var contents = `\
<div class='Intro'>\
    <h1>Landmarker.io<h1>\
    <h3>v${version}</h3>\
    <div class='IntroItems'>\
        <div class='IntroItem IntroItem--Dropbox'>\
            <div>Connect to Dropbox</div>\
        </div>\
        <div class='IntroItem IntroItem--Server'>\
            <span class="octicon octicon-globe"></span>\
            <div>Connect your own server</div>\
        </div>\
        <div class='IntroItem IntroItem--Demo'>\
            See a demo\
        </div>\
    </div>\
</div>\
`;

var lsWarning = `\
<p class='IntroWarning'>\
    Your browser doesn't support LocalStorage, so Dropbox login has been\
    disabled.\
</p>\
`;

var Intro = Modal.extend({

    closable: false,
    modifiers: ['Small'],

    events: {
        'click .IntroItem--Dropbox': 'startDropbox',
        'click .IntroItem--Server': 'startServer',
        'click .IntroItem--Demo': 'startDemo',
    },

    init: function ({cfg, localstorage}) {
        this.localStorageSupport = localstorage;
        this._cfg = cfg;
    },

    content: function () {
        const $contents = $(contents);
        if (!this.localStorageSupport) {
            $contents.find('.IntroItem--Dropbox').remove();
            $contents.find('.IntroItems').append($(lsWarning));
        }
        return $contents;
    },

    _restart: function (serverUrl) {
        this._cfg.clear();
        let restartUrl = (
            baseUrl() + (serverUrl ? `?server=${serverUrl}` : '')
        );
        window.location.replace(restartUrl);
    },

    startDropbox: function () {
        this._cfg.clear();
        var [dropUrl, state] = Backend.Dropbox.authorize();
        this._cfg.set({
            'OAUTH_STATE': state,
            'BACKEND_TYPE': Backend.Dropbox.Type
        }, true);
        window.location.replace(dropUrl);
    },

    startDemo: function () {
        this._restart('demo');
    },

    startServer: function () {
        let u = window.prompt(
            'Please provide the url for the landmarker server');
        if (u) {
            this._restart(u);
        }
    }
});

let instance;
module.exports = {
    init: function (opts) { instance = new Intro(opts); },

    open: function () {
        instance._cfg.clear();
        history.replaceState(
            null, null, baseUrl());
        instance.open();
    },

    close: function () { instance.close(); },
    initialized: function () { return !!instance }
}
