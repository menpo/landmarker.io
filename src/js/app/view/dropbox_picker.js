'use strict';

import _ from 'underscore';
import $ from 'jquery';
import Promise from 'promise-polyfill';

import { basename, extname } from '../lib/utils';
import Modal from './modal';

const _icons = {
    'folder': 'file-directory',

    'yaml': 'file-code',
    'yml': 'file-code',
    'json': 'file-code',
    'ljson': 'file-code',
    'html': 'file-code',

    'pdf': 'file-pdf',

    'txt': 'file-text',
    'plain': 'file-text',
    'text': 'file-text',
    'md': 'file-text',
    'markdown': 'file-text',

    'raw': 'file-media',

    'jpg': 'device-camera',
    'jpeg': 'device-camera',
    'png': 'device-camera'
};

function Icon (item) {
    let ext;
    if (typeof item === 'string') {
        ext = extname(item);
    } else {
        ext = item.is_dir ? 'folder' : extname(item.path);
    }

    const icon = _icons[ext] || 'file-binary';
    return $(`<span class='octicon octicon-${icon}'></span>`);
}

function DropboxRadio (opts, index, preset) {

    const id = `dropboxRadios_${index}`;
    const $radio = $(`<div class='DropboxRadio' id='${id}'></div>`);
    preset = preset || opts[0][1];

    opts.forEach(function ([text, key], j) {
        $radio.append($(`\
            <label class='radio'>\
                <input id='${id}_${j}' value='${key}' type="radio" name="${id}" ${key === preset ? 'checked' : ''}/>\
                <span>${text}</span>\
            </label>\
        `));
    });

    return $radio;
}

export default Modal.extend({

    events: {
        'click .DropboxSelectListItem': 'handleClick',
        'click .Back': 'back',
        'click .Reload': 'reload',
        'click .Home': 'goHome',
        'click .Submit': 'handleSubmit'
    },

    init: function ({
        dropbox, submit,
        showFoldersOnly=false, showHidden=false, selectFoldersOnly=false,
        extensions=[], selectFilesOnly=false,
        radios=[], presets={}
    }) {

        this.disposeOnClose = true;
        this.dropbox = dropbox;
        this.showFoldersOnly = showFoldersOnly;
        this.showHidden = showHidden;
        this.selectFoldersOnly = selectFoldersOnly;
        this.selectFilesOnly = !selectFoldersOnly && selectFilesOnly;
        this.extensions = extensions;
        this.radios = radios;
        this.presets = presets;

        this._cache = {};

        this.submit = submit;

        this.state = {
            selected: undefined,
            selectedIsFolder: false,
            root: presets.root || '/',
            currentList: [],
            history: []
        };

        _.bindAll(this, 'fetch', 'makeList', 'update', 'select',
            'dive', 'handleSubmit', 'reload', 'handleClick');
    },

    handleSubmit: function () {

        if (!this.submit || !this.state.selected) {
            return;
        }

        const options = {};
        if (this.radios && this.radios.length) {
            this.radios.forEach(function ({name}, index) {
                const id = `dropboxRadios_${index}`;
                const value = $(`input[name='${id}']:checked`, `#${id}`).val();
                options[name] = value;
            });
        }

        this.submit(this.state.selected, this.state.selectedIsFolder, options);
    },

    fetch: function (noCache=false) {
        this.state.loading = true;
        this.update();

        let q;
        if (this._cache[this.state.root]) {
            q = Promise.resolve(this._cache[this.state.root]);
        } else {
            q = this.dropbox.list(this.state.root, {
                showHidden: this.showHidden,
                foldersOnly: this.showFoldersOnly,
                extensions: this.extensions,
                noCache
            });
        }

        return q.then((items) => {
            this.state.currentList = items;
            this._cache[this.state.root] = items;
            this.state.loading = false;
        }, () => {
            console.log('Error fetching');
        });
    },

    pathId: function (path) {
        const id = path.replace(/\W/g, '');
        return `__path__${id}__`;
    },

    makeList: function () {

        if (this.state.loading) {
            return $(`<div class='DropboxSelectList Empty'></div>`);
        }

        if (this.state.currentList.length === 0) {
            return $(`<div class='DropboxSelectList Empty'></div>`);
        }

        const $wrapper = $(`<div class='DropboxSelectList'></div>`),
              $list = $('<ul></ul>');

        this.state.currentList.forEach((item) => {
            const path = item.path;

            const $item = $(
                `<li id='${this.pathId(path)}' class='DropboxSelectListItem' data-folder='${item.is_dir}' data-path='${path}'>\
                    ${basename(path)}\
                </li>`);

            const clickable = (
                item.is_dir ||
                ( !this.selectFoldersOnly &&
                  ( !this.extensions.length ||
                    this.extensions.indexOf(extname(path)) > -1 )
                )
            );

            if (!clickable) {
                $item.addClass('Disabled');
            }

            $item.prepend(Icon(item));
            $item.appendTo($list);
        });

        $list.appendTo($wrapper);
        return $wrapper;
    },

    update: function () {
        this.undelegateEvents();

        this.$body.find('.DropboxSelectList').replaceWith(this.makeList());

        this.$body.find('.DropboxSelectExplore .Path')
                  .text(this.state.root);

        if (this.state.history.length > 0) {
            this.$body.find('.DropboxSelectExplore .Back')
                      .removeClass('Unavailable');
        } else {
            this.$body.find('.DropboxSelectExplore .Back')
                      .addClass('Unavailable');
        }

        this.updateSelected();

        this.delegateEvents();
    },

    updateSelected: function () {

        this.$body.find('.DropboxSelectListItem.Selected')
                  .removeClass('Selected');

        const $submitText = this.$body.find('.DropboxSelectSubmit > span');
        $submitText.text(this.state.selected || 'Nothing selected');

        if (this.state.selected) {
            this.$body.find(`#${this.pathId(this.state.selected)}`)
                      .addClass('Selected');
            $submitText.removeClass('Empty');
        } else {
            $submitText.addClass('Empty');
        }
    },

    handleClick: function (evt) {

        if ($(evt.currentTarget).hasClass('Disabled')) {
            return null;
        }

        const path = evt.currentTarget.dataset.path,
            isFolder = evt.currentTarget.dataset.folder === 'true',
            selectable = (
                !(this.selectFilesOnly && isFolder) &&
                !(this.selectFoldersOnly && !isFolder)
            );

        if (selectable) {
            this.select(path, isFolder);
        }

        if (isFolder && path === this._lastClickedItem) {
            this._lastClickedItem = undefined;
            return this.dive(path);
        } else if (isFolder) {
            this._lastClickedItem = path;
            setTimeout(() => {
                this._lastClickedItem = undefined;
            }, 300);
        }
    },

    select: function (path, isFolder) {
        this.state.selected = path;
        this.state.selectedIsFolder = !!isFolder;
        this.updateSelected();
    },

    back: function () {
        const prev = this.state.history.pop();
        if (prev) {
            this.state.root = prev;
            this.fetch().then(this.update);
        }
    },

    dive: function (path) {
        this.state.history.push(this.state.root);
        this.state.root = path;
        this.fetch().then(this.update);
    },

    content: function () {

        const $content = $(`\
            <div class='DropboxSelect'>\
                <div class='DropboxSelectExplore'>\
                    <div class='Action Back Unavailable'>\
                        <span class="octicon octicon-arrow-left"></span>\
                    </div>\
                    <div class='Action Home'>\
                        <span class="octicon octicon-home"></span>\
                    </div>\
                    <div class='Path'></div>\
                    <div class='Action Reload'>\
                        <span class="octicon octicon-sync"></span>\
                    </div>\
                </div>\
                <div class='DropboxSelectList'><ul></ul></div>\
                <div class='DropboxSelectSubmit'>\
                    <span>Nothing selected</span>\
                    <div class='Submit'>Submit</div>\
                </div>\
            </div>\
        `);

        if (this.radios && this.radios.length > 0) {
            const $radios = $("<div class='DropboxRadios'></div>");
            this.radios.forEach(({name, options}, i) => {
                $radios.prepend(DropboxRadio(
                    options,
                    i,
                    this.presets.radios ? this.presets.radios[i] : null));
            });
            $content.prepend($radios);
        }

        this.$body = $content;
        return $content;
    },

    reload: function () {
        delete this._cache[this.state.root];
        this.fetch(true).then(this.update);
    },

    goHome: function () {
        this.state.root = '/';
        this.state.history = [];
        this.fetch().then(this.update);
    },

    afterRender: function () {
        this.fetch().then(this.update);
    }
});
