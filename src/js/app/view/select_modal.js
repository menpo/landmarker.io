"use strict";

var Backbone = require('backbone'),
    _ = require('underscore'),
    $ = require('jquery');

var Modal = require('./modal');

var SelectModal = Modal.extend({

    events: {
        'click .ModalOption': 'handleClick'
    },

    init: function ({actions=[]}) {
        this.actions = actions;
    },

    content: function () {
        const $div = $(`<div class='ModalOptions'></div>`);
        this.actions.forEach(([text, func], index) => {
            $div.append(`\
                <div class='ModalOption' data-index='${index}' id='modalOption:${this.key}:${index}'>\
                    ${text}\
                </div>`);
        });
        return $div;
    },

    handleClick: function (evt) {
        if (this.isOpen) {
            const idx = evt.currentTarget.dataset.index;
            this.actions[idx][1]();
            this.close();
        }
    }
});

module.exports = SelectModal;
