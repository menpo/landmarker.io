'use strict';

import $ from 'jquery';

import Modal from './modal';
import Backend from '../backend';
import { baseUrl, restart } from '../lib/utils';

import support from '../lib/support';
import { version } from '../../../../package.json';


const contents = `\
<div class='Intro'>\
    <h1>Landmarker.io</h1>\
    <h3><a href="https://github.com/menpo/landmarker.io/releases" title="release notes">v${version}</a></h3>\
    <div class='IntroItems'>\
        <div class='IntroItem IntroItem--Dropbox'>\
            <div>Connect to Dropbox</div>\
        </div>\
        <div class='IntroItem IntroItem--Server'>\
            <span class="octicon octicon-globe"></span>\
            <div>Connect to a landmarker server</div>\
        </div>\
        <div class='IntroItem IntroItem--Demo'>\
            See a demo\
        </div>\
    </div>\
    <a href="https://github.com/menpo/landmarker.io" class='IntroFooter'>\
        <span class="octicon octicon-mark-github"></span>\
        More info on Github\
    </a>\
</div>\
`;

const lsWarning = `\
<p class='IntroWarning'>\
    Your browser doesn't support LocalStorage, so Dropbox login has been\
    disabled.\
</p>`;

const httpsWarning = `\
<p class='IntroWarning'>\
    You are currently on an non-https connection. For security reasons Dropbox integration has been disabled.
</p>`;

const Intro = Modal.extend({

    closable: false,
    modifiers: ['Small'],

    events: {
        'click .IntroItem--Dropbox': 'startDropbox',
        'click .IntroItem--Server': 'startServer',
        'click .IntroItem--Demo': 'startDemo'
    },

    init: function ({cfg}) {
        this._cfg = cfg;
    },

    content: function () {
        const $contents = $(contents);

        if (!support.localstorage) {
            $contents.find('.IntroItem--Dropbox').remove();
            $contents.find('.IntroItems').append($(lsWarning));
        }

        if (
            !support.https &&
            window.location.origin !== "http://localhost:4000"
        ) {
            $contents.find('.IntroItem--Dropbox').remove();
            $contents.find('.IntroItems').append($(httpsWarning));
        }

        return $contents;
    },

    startDropbox: function () {
        this._cfg.clear();
        const [dropUrl, state] = Backend.Dropbox.authorize();
        this._cfg.set({
            'OAUTH_STATE': state,
            'BACKEND_TYPE': Backend.Dropbox.Type
        }, true);
        window.location.replace(dropUrl);
    },

    startDemo: function () {
        restart('demo');
    },

    startServer: function () {
        Modal.prompt('Where is your server located ?', (value) => {
            restart(value);
        }, () => {
            this.open();
        });
    }
});

let instance;
export default {
    init: function (opts) { instance = new Intro(opts); },

    open: function () {
        instance._cfg.clear();
        history.replaceState(null, null, baseUrl());
        instance.open();
    },

    close: function () { instance.close(); },
    initialized: function () { return !!instance; }
};
