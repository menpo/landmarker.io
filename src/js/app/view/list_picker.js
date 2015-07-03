"use strict";

var Backbone = require('backbone'),
    $ = require('jquery'),
    _ = require('underscore'),
    Promise = require('promise-polyfill');

var { basename, extname } = require('../lib/utils');

var { Modal } = require('./modal');

var ListPicker = Modal.extend({

    events: {
        'click li': 'click'
    },

    init: function ({
        list,
        submit,
        closable=false
    }) {
        this.disposeOnClose = true;
        this.list = list;
        this.submit = submit;
    },

    content: function () {
        const $content = $('<ul class=\'ListPicker\'></ul>');
        this.list.forEach(function ([content, key], index) {
            if (content instanceof $) {
                const $li = $(`<li data-index='${index}'></li>`);
                $li.append(content);
            } else {
                $content.append($(`<li data-index='${index}'>${content}</li>`));
            }
        });
        return $content;
    },

    click: function (evt) {
        const idx = evt.currentTarget.dataset.index;
        this.submit(this.list[idx][1]);
        this.dispose();
    }
});

module.exports = ListPicker;
