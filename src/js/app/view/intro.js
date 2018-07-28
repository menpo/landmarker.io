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

const Intro = Modal.extend({

    closable: false,
    modifiers: ['Small'],

    events: {
        'click .IntroItem--Server': 'startServer',
        'click .IntroItem--Demo': 'startDemo'
    },

    init: function ({cfg}) {
        this._cfg = cfg;
    },

    content: function () {
        const $contents = $(contents);
        return $contents;
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
