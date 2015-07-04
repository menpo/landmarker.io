"use strict";

var $ = require('jquery'),
    _ = require('underscore');

var Modal = require('./modal');

var ListPicker = Modal.extend({

    events: {
        'click li': 'click',
        'keydown input': 'filter',
    },

    init: function ({list, submit, useFilter}) {
        this.list = list;
        this._list = list;
        this.submit = submit;
        this.useFilter = !!useFilter;
        _.bindAll(this, 'filter');
    },

    filter: _.debounce(function (evt) {
        const value = evt.currentTarget.value.toLowerCase();
        this.$el.find('li').each(function (index, li) {
            if (li.dataset.value.toLowerCase().indexOf(value) > -1) {
                $(li).removeClass('Hidden');
            } else {
                $(li).addClass('Hidden');
            }
        });
    }, 100),

    content: function () {
        const $content = $(`<div class='ListPicker'></div>`);

        if (this.useFilter) {
            $content.append(`<input placeholder='Search'/>`);
        }

        const $ul = $(`<ul></ul>`);
        this.list.forEach(function ([content, key], index) {
            if (content instanceof $) {
                const $li = $(`<li data-index='${index}'></li>`);
                $li.append(content);
                $ul.append($li);
            } else {
                $ul.append($(`<li data-value='${content}' data-index='${index}'>${content}</li>`));
            }
        });
        $content.append($ul);
        return $content;
    },

    click: function (evt) {
        const idx = evt.currentTarget.dataset.index;
        this.submit(this.list[idx][1]);
        this.close();
    }
});

module.exports = ListPicker;
