'use strict';

var _ = require('underscore');
var Backbone = require('backbone');
var $ = require('jquery');

var Notification = require('./notification');
var { pad } = require('../lib/utils');
var { Dropbox, Server } = require('../backend');
var Modal = require('./modal');
var Intro = require('./intro');
var ListPicker = require('./list_picker');

var AssetPagerView = Backbone.View.extend({

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

var BackendNameView = Backbone.View.extend({

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

        if (server instanceof Dropbox) {
            this.$el.find('.content').html('Dropbox');
            this.$el.addClass('BackendName--Dropbox');
        } else if (server instanceof Server) {
            this.$el.find('.content').html(
                server.demoMode ? 'demo' : server.url);
            this.$el.addClass('BackendName--Server');
            this.$el.prepend($('<span class="octicon octicon-globe"></span>'));
        } else {
            this.fadeOut();
        }
        return this;
    },

    handleClick: function () {
        if (this.model.has('server')) {
            Modal.confirm(
                'Log out of the current data source and restart the landmarker ?',
                Intro.open);
        }
    }
});

var AssetNameView = Backbone.View.extend({

    el: '#assetName',

    events: {
        click: "chooseAssetName"
    },

    initialize: function () {
        _.bindAll(this, 'render');
        this.listenTo(this.model, "change:asset", this.render);
    },

    render: function () {
        this.$el.find('.content').html(this.model.asset().id);
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

var AssetIndexView = Backbone.View.extend({

    el: '#assetIndex',

    events: {
        click: "chooseAssetNumber"
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

    chooseAssetNumber: function () {

        if (this.model.assetSource().nAssets() <= 1) {
            return null;
        }

        var newIndex = window.prompt(
            "Input asset index:", pad(this.model.assetIndex() + 1, 2));

        if (!newIndex || newIndex === '') {
            return null; // ESC key or empty prompt, do nothing
        }

        if (isNaN(newIndex)) {
          return new Notification.BaseNotification({
              msg: 'Enter a valid Number', type: 'error'});
        }

        newIndex = Number(newIndex);

        if (newIndex <= 0 || newIndex > this.model.assetSource().nAssets() ) {
            return Notification.notify({
                msg: 'Cannot select asset ' + newIndex + ' (out of bounds)',
                type: 'error'
            });
        }

        this.model.goToAssetIndex(Number(newIndex) - 1);
    }
});

var CollectionName = Backbone.View.extend({
    el: '#collectionName',

    events: {
        click: "chooseCollection"
    },

    initialize: function() {
        _.bindAll(this, 'render');
        this.listenTo(this.model, "change:activeCollection", this.render);
    },

    render: function () {
        this.$el.find('.content').html(
            `${this.model.activeCollection()} (${this.model.mode()})`);
        this.$el.toggleClass(
            'Disabled',
            ( this.model.collections().length <= 1 &&
              !(this.model.server() instanceof Dropbox) )
        );
        return this;
    },

    chooseCollection: function () {

        const backend = this.model.server();
        if (backend instanceof Dropbox) {
            backend.pickAssets((path) => {
                this.model.set('mode', backend.mode);
                this.model.set('activeCollection', path);
            }, function (err) {
                Notification.notify({
                    type: 'error',
                    msg: 'Error switching assets ' + err
                });
            }, true);
        } else if (backend instanceof Server) {

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

exports.AssetView = Backbone.View.extend({

    initialize: function() {
        new BackendNameView({model: this.model});
        new CollectionName({model: this.model});
        new AssetPagerView({model: this.model});
        new AssetNameView({model: this.model});
        new AssetIndexView({model: this.model});
    }
});
