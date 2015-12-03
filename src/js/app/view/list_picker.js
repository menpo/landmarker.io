'use strict';

import _ from 'underscore';
import $ from 'jquery';

import Modal from './modal';

/**
 * List picker modal, takes the following parameters:
 *
 *  +   list : an array of tuples [content (string), key]
 *  +   useFilter : whether or not to display the search bar
 *  +   submit: the callback
 *  +   batchSize (50): the number of elements to be displayed. A 'Load More'
 *      element will be placed at the bottom of the list to expand the content.
 *
 * All tags will have the data attributes value, key and index
 * The callback is called with the key (which is the content if key is
 * undefined)
 */
export default Modal.extend({

    events: {
        'click li': 'click',
        'keyup input': 'filter'
    },

    init: function ({list, submit, useFilter, batchSize = 50}) {
        this.list = list.map(([c, k], i) => [c, k !== undefined ? k : i]);
        this._list = this.list;
        this.submit = submit;
        this.useFilter = !!useFilter;
        // only batchSize elements will be displayed at once.
        this.batchSize = batchSize;
        // we increment this every time the user wants to expand the number
        // of visible elements
        this.batchesVisible = 1;
        _.bindAll(this, 'filter');
    },

    filter: _.throttle(function (evt) {
        const value = evt.currentTarget.value.toLowerCase();
        if (!value || value === "") {
            this._list = this.list;
        }

        this._list = this.list.filter(([content]) => {
            return content.toLowerCase().indexOf(value) > -1;
        });

        this.update();
    }, 50),

    makeList: function () {
        const $ul = $(`<ul></ul>`);
        this._list.slice(0, this.batchSize * this.batchesVisible).forEach(function ([content, key, index]) {
            $ul.append($(
                `<li data-value='${content}' data-key='${key}' data-index='${index}'>${content}</li>`));
        });
        if (this._list.length > this.batchSize) {
            $ul.append($(
                `<li data-value='Load more...' data-key='-1' data-index='-1'>Load more...</li>`));
        }
        return $ul;
    },

    update: function () {
        this.$content.find('ul').remove();
        this.$content.append(this.makeList());
    },

    content: function () {
        const $content = $(`<div class='ListPicker'></div>`);

        if (this.useFilter) {
            $content.append(`<input type="text" placeholder='Search'/>`);
        }

        $content.append(this.makeList());
        this.$content = $content;
        return $content;
    },

    click: function (evt) {
        if (evt.currentTarget.dataset.index === '-1') {
            this.batchesVisible += 1;  // load an extra batch
            this.update();
        } else{
            this.submit(evt.currentTarget.dataset.key);
            this.close();
        }
    }
});
