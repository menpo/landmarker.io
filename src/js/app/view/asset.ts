'use strict';

import _ from 'underscore';
import Backbone from 'backbone';
import $ from 'jquery';

import * as Notification from './notification';
import Intro from './intro';
import { pad, randomString, truncate } from '../lib/utils';
import { Dropbox, Server } from '../backend';

import Modal from './modal';
import ListPicker from './list_picker';

export const AssetPagerView = Backbone.View.extend({

    el: '#assetPager',

    events: {
        'click #next': 'next',
        'click #previous': 'previous'
    },

    initialize: function() {
        _.bindAll(this, 'render');
        this.listenTo(this.model, "change:asset", this.render);
    },

    render: function () {
        this.$el.find('#next').toggleClass('Button--Disabled',
            !this.model.assetSource().hasSuccessor());
        this.$el.find('#previous').toggleClass('Button--Disabled',
            !this.model.assetSource().hasPredecessor());
        return this;
    },

    next: function () {
        this.model.nextAsset();
    },

    previous: function () {
        this.model.previousAsset();
    }

});

export const BackendNameView = Backbone.View.extend({

    el: '#backendName',

    events: {
        click: "handleClick"
    },

    initialize: function () {
        _.bindAll(this, 'render');
        this.render();
        this.listenTo(this.model, "change:server", this.render);
    },

    render: function () {
        const server = this.model.server();

        this.$el.find('.octicon-globe').remove();
        this.$el.show();

        if (server instanceof Dropbox) {
            this.$el.find('.content').html('Dropbox');
            this.$el.addClass('BackendName--Dropbox');
        } else if (server instanceof Server) {
            this.$el.find('.content').html(
                server.demoMode ? 'demo' : server.url);
            this.$el.addClass('BackendName--Server');
            this.$el.prepend($('<span class="octicon octicon-globe"></span>'));
        } else {
            this.$el.hide();
        }

        return this;
    },

    handleClick: function () {
        if (this.model.has('server')) {
            Modal.confirm(
                'Log out of the current data source and restart the landmarker ?', Intro.open);
        }
    }
});

export const AssetNameView = Backbone.View.extend({

    el: '#assetName',

    events: {
        click: "chooseAssetName"
    },

    initialize: function () {
        _.bindAll(this, 'render');
        this.listenTo(this.model, "change:asset", this.render);
    },

    render: function () {
        this.$el.find('.content').html(
            truncate(this.model.asset().id, 64, true, true));
        this.$el.toggleClass(
            'Disabled', this.model.assetSource().nAssets() <= 1);
        return this;
    },

    chooseAssetName: function () {
        const source = this.model.assetSource();
        const assetsList = source.assets().map(function (asset, index) {
            return [asset.id, index];
        });

        if (assetsList.length <= 1) {
            return;
        }

        const picker = new ListPicker({
            list: assetsList,
            title: 'Select a new asset to load',
            closable: true,
            disposeOnClose: true,
            useFilter: true,
            submit: this.model.goToAssetIndex.bind(this.model)
        });
        picker.open();
    }
});

export const AssetIndexView = Backbone.View.extend({

    el: '#assetIndex',

    events: {
        click: "handleClick"
    },

    initialize: function () {
        _.bindAll(this, 'render');
        this.listenTo(this.model, "change:asset", this.render);
    },

    render: function () {
        const nStr = pad(this.model.assetSource().nAssets(), 2);
        const iStr = pad(this.model.assetIndex() + 1, 2);
        this.$el.find('.content').html(iStr + "/" + nStr);
        this.$el.toggleClass(
            'Disabled', this.model.assetSource().nAssets() <= 1);
        return this;
    },

    handleClick: function () {

        if (
            !this.model.landmarks() ||
            this.model.assetSource().nAssets() <= 1
        ) {
            return null;
        }

        if (!this._input) {
            this._oldHtml = this.$el.find('.content').html();
            this._input = randomString(8);
            this.$el.find('.content')
                    .html(`<input type='text' id="${this._input}"/>`);
            this.$el.find(`input`).focus();

            $(window).on('keydown', _.throttle((evt) => {
                if (evt.target.id !== this._input) {
                    return;
                }

                if (evt.which === 27) { // ESC
                    this._input = undefined;
                    this.$el.find('.content').html(this._oldHtml);
                    evt.stopPropagation();
                    evt.preventDefault();
                } else if (evt.which === 13) { // Enter
                    const input = this.$el.find(`input`);
                    const value = input.val();
                    input.remove();
                    this.chooseAssetNumber(value);
                    this._input = undefined;
                    evt.stopPropagation();
                    evt.preventDefault();
                }
            }, 300));
        }

    },

    chooseAssetNumber: function (newIndex) {

        if (!newIndex || newIndex === '') {
            return null; // ESC key or empty prompt, do nothing
        }

        if (isNaN(newIndex)) {
            this.$el.find('.content').html(this._oldHtml || '');
            return new Notification.BaseNotification({
                msg: 'Enter a valid Number', type: 'error'});
        }

        newIndex = Number(newIndex);

        if (newIndex <= 0 || newIndex > this.model.assetSource().nAssets() ) {
            this.$el.find('.content').html(this._oldHtml || '');
            return Notification.notify({
                msg: 'Cannot select asset ' + newIndex + ' (out of bounds)',
                type: 'error'
            });
        }

        if (newIndex - 1 !== this.model.assetSource().assetIndex()) {
            this.model.goToAssetIndex(Number(newIndex) - 1);
        } else {
            this.$el.find('.content').html(this._oldHtml || '');
        }
    }
});

export const CollectionName = Backbone.View.extend({
    el: '#collectionName',

    events: {
        click: "chooseCollection"
    },

    initialize: function() {
        _.bindAll(this, 'render');
        this.listenTo(this.model, "change:activeCollection", this.render);
    },

    render: function () {
        const server = this.model.server();
        this.$el.find('.content').html(
            `${this.model.activeCollection()} (${this.model.mode()})`);
        this.$el.toggleClass(
            'Disabled',
            ( this.model.collections().length <= 1 &&
              !(typeof server.pickAssets === 'function') )
        );
        return this;
    },

    chooseCollection: function () {

        const backend = this.model.server();
        if (backend && typeof backend.pickAssets === 'function') {
            backend.pickAssets((path) => {
                this.model.set('mode', backend.mode);
                this.model.set('activeCollection', path);
            }, function (err) {
                Notification.notify({
                    type: 'error',
                    msg: 'Error switching assets ' + err
                });
            }, true);
        } else { // Assume we have previous knowledge of all collections

            if (this.model.collections().length <= 1) {
                return;
            }

            const collections = this.model.collections().map(c => [c, c]);

            const picker = new ListPicker({
                list: collections,
                title: 'Select a new collection to load',
                closable: true,
                useFilter: true,
                disposeOnClose: true,
                submit: (collection) => {
                    this.model.set({'activeCollection': collection});
                }
            });
            picker.open();
        }
    }

});

export default Backbone.View.extend({
    initialize: function ({restart}) {
        new BackendNameView({model: this.model, restart});
        new CollectionName({model: this.model});
        new AssetPagerView({model: this.model});
        new AssetNameView({model: this.model});
        new AssetIndexView({model: this.model});
    }
});
