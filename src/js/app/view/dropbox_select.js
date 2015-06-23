"use strict";

var Backbone = require('backbone'),
    $ = require('jquery'),
    _ = require('underscore');

var { irp } = require('../lib/utils');

var Modal = require('./modal');

function _$fileOcticon (item) {

    let extension = item.is_dir ? 'folder' :
                    !!item.mime_type ? item.mime_type.split('/').pop(-1) :
                    item.path.split('.').pop();
    let icon = {
        'folder': 'file-directory',

        'yaml': 'file-code',
        'yml': 'file-code',
        'text': 'file-code',
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

var DropboxSelect = Modal.extend({

    closable: false,
    title: 'Choose a folder from which to load assets',

    events: {
        'click .DropboxSelectListItem': 'handleClick',
        'click .Back': 'back',
        'click .Reload': 'reload',
        'click .Home': 'goHome',
        'click .Btn': 'handleSubmit'
    },

    init: function ({
        dropbox, submit,
        showFoldersOnly=false, showHidden=false,
        selectFoldersOnly=false, allowedFileExtensions=[],
        selectFilesOnly=false
    }) {

        this.dropbox = dropbox;
        this.showFoldersOnly = showFoldersOnly;
        this.showHidden = showHidden;
        this.selectFoldersOnly = selectFoldersOnly;
        this.selectFilesOnly = !selectFoldersOnly && selectFilesOnly;
        this.extensions = allowedFileExtensions;

        this._cache = {};

        this.submit = submit;

        this.state = {
            selected: undefined,
            root: '/',
            currentList: [],
            history: []
        }

        _.bindAll(this, 'fetch', 'makeList', 'update', 'select',
            'dive', 'canonical', 'handleSubmit', 'reload');
    },

    handleSubmit: function () {
        if (!this.submit || !this.state.selected) {
            return;
        }
        this.submit(this.state.selected);
    },


    fetch: function () {
        this.state.loading = true;
        this.update();

        let q;
        if (this._cache[this.state.root]) {
            q = irp(this._cache[this.state.root]);
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

    canonical: function (fullPath) {
        let path = fullPath.replace(this.state.root, '')
        return path.charAt(0) === '/' ? path.slice(1) : path;
    },

    pathId: function (path) {
        let id = path.replace('/', '').replace('.', '');
        return `__path__${id}__`;
    },

    makeList: function () {

        if (this.state.loading) {
            return $(`<div class='DropboxSelectList Empty'><div class="loader">Loading...</div></div>`);
        }

        if (this.state.currentList.length === 0) {
            return $(`<div class='DropboxSelectList Empty'>Empty directory</div>`);
        }

        let $wrapper = $(`<div class='DropboxSelectList'></div>`),
            $list = $('<ul></ul>');

        this.state.currentList.forEach((item) => {
            let path = item.path;

            let $item = $(
                `<li id='${this.pathId(path)}' class='DropboxSelectListItem' data-folder='${item.is_dir}' data-path='${path}'>\
                    ${this.canonical(path)}\
                </li>`);

            let selectable = (
                item.is_dir ||
                (this.extensions.length &&
                 this.extensions.indexOf(item.path.split('.').pop()) === -1)
            );

            if (!selectable) {
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

        this.$body.find('.DropboxSelectSubmit > span')
                .text(this.state.selected || 'Nothing selected');

        if (this.state.selected) {
            this.$body.find(`#${this.pathId(this.state.selected)}`)
                      .addClass('Selected');
        }
    },

    handleClick: function (evt) {

        if ($(evt.currentTarget).hasClass('Disabled')) {
            return;
        }

        let path = evt.currentTarget.dataset.path,
            isFolder = evt.currentTarget.dataset.folder;

        let _dive = () => {
            clearTimeout(this[`clicked##${path}`]);
            delete this[`clicked##${path}`];
            this.dive(path);
        }

        if (path === this.state.selected && isFolder) {
            return _dive();
        }

        let selectable = (
            !(this.selectFilesOnly && isFolder) &&
            !(this.selectFoldersOnly && !isFolder));

        if (this[`clicked##${path}`]) {
            return _dive();
        }

        this[`clicked##${path}`] = setTimeout(() => {
            delete this[`clicked##${path}`];

            if (selectable) {
                this.select(path);
            }

        }, 100);
    },

    select: function (path) {
        this.state.selected = path;
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
                    <span class='Selection'>Nothing selected</span>\
                    <div class='Btn'>Submit</div>\
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

module.exports = DropboxSelect;
