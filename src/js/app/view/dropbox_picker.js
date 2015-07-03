"use strict";

var Backbone = require('backbone'),
    $ = require('jquery'),
    _ = require('underscore'),
    Promise = require('promise-polyfill');

var { basename, extname } = require('../lib/utils');

var { Modal } = require('./modal');

function _$fileOcticon (item) {

    let extension = item.is_dir ? 'folder' :
                    !!item.mime_type ? item.mime_type.split('/').pop() :
                    extname(item.path);
    let icon = {
        'folder': 'file-directory',

        'yaml': 'file-code',
        'yml': 'file-code',
        'json': 'file-code',
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
    }[extension];

    if (!icon) {
        icon = 'file-binary';
    }

    return $(`<span class='octicon octicon-${icon}'></span>`);
}

var DropboxPicker = Modal.extend({

    events: {
        'click .DropboxSelectListItem': 'handleClick',
        'click .Back': 'back',
        'click .Reload': 'reload',
        'click .Home': 'goHome',
        'click .Submit': 'handleSubmit'
    },

    init: function ({
        dropbox, submit,
        showFoldersOnly=false, showHidden=false,
        selectFoldersOnly=false, extensions=[],
        selectFilesOnly=false,
        closable=false
    }) {

        this.disposeOnClose = true;
        this.dropbox = dropbox;
        this.showFoldersOnly = showFoldersOnly;
        this.showHidden = showHidden;
        this.selectFoldersOnly = selectFoldersOnly;
        this.selectFilesOnly = !selectFoldersOnly && selectFilesOnly;
        this.extensions = extensions;
        this.closable = !!closable;

        this._cache = {};

        this.submit = submit;

        this.state = {
            selected: undefined,
            selectedIsFolder: false,
            root: '/',
            currentList: [],
            history: []
        }

        _.bindAll(this, 'fetch', 'makeList', 'update', 'select',
            'dive', 'handleSubmit', 'reload', 'handleClick');
    },

    handleSubmit: function () {
        if (!this.submit || !this.state.selected) {
            return;
        }

        this.submit(this.state.selected, this.state.selectedIsFolder);
    },


    fetch: function () {
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
        let id = path.replace(/\W/g, '');
        return `__path__${id}__`;
    },

    makeList: function () {

        if (this.state.loading) {
            return $(`<div class='DropboxSelectList Empty'></div>`);
        }

        if (this.state.currentList.length === 0) {
            return $(`<div class='DropboxSelectList Empty'></div>`);
        }

        let $wrapper = $(`<div class='DropboxSelectList'></div>`),
            $list = $('<ul></ul>');

        this.state.currentList.forEach((item) => {
            let path = item.path;

            let $item = $(
                `<li id='${this.pathId(path)}' class='DropboxSelectListItem' data-folder='${item.is_dir}' data-path='${path}'>\
                    ${basename(path)}\
                </li>`);

            let clickable = (
                item.is_dir ||
                ( !this.selectFoldersOnly &&
                  ( !this.extensions.length ||
                    this.extensions.indexOf(extname(path)) > -1 )
                )
            );

            if (!clickable) {
                $item.addClass('Disabled');
            }

            $item.prepend(_$fileOcticon(item));
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

        let $submitText = this.$body.find('.DropboxSelectSubmit > span');
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
            return;
        }

        let path = evt.currentTarget.dataset.path,
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
        let prev = this.state.history.pop();
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
        let $content = $(`\
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

        this.$body = $content;
        return $content;
    },

    reload: function () {
        delete this._cache[this.state.root];
        this.fetch().then(this.update);
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

module.exports = DropboxPicker;
