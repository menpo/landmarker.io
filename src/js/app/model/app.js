var _ = require('underscore');
var Promise = require('promise-polyfill');
var Backbone = require('../lib/backbonej');
var Landmark = require('./landmark');
var Template = require('./template');
var AssetSource = require('./assetsource');
var Collection = require('./collection');

"use strict";


exports.App = Backbone.Model.extend({

    defaults: function () {
        return {
            landmarkSize: 0.5,
            meshAlpha: 1,
            mode: 'mesh',
            activeTemplate: undefined,
            activeCollection: undefined
        }
    },

    imageMode: function () {
        return this.get('mode') === 'image';
    },

    meshMode: function () {
        return this.get('mode') === 'mesh';
    },

    server: function () {
        return this.get('server');
    },

    templates: function () {
        return this.get('templates');
    },

    activeTemplate: function () {
        return this.get('activeTemplate');
    },

    collections: function () {
        return this.get('collections');
    },

    activeCollection: function () {
        return this.get('activeCollection');
    },

    hasAssetSource: function () {
        return this.has('assetSource');
    },

    assetSource: function () {
        return this.get('assetSource');
    },

    assetIndex: function () {
        return this.get('assetSource').assetIndex();
    },

    // returns the currently active Asset (Image or Asset).
    // changes independently of mesh() - care should be taken as to which one
    // other objects should listen to.
    asset: function () {
        return this.get('asset');
    },

    // returns the currently active THREE.Mesh.
    mesh: function () {
        if (this.hasAssetSource()) {
            return this.assetSource().mesh();
        } else {
            return null;
        }
    },

    landmarks: function () {
        return this.get('landmarks');
    },

    initialize: function () {
        _.bindAll(this, 'assetChanged', 'mesh', 'assetSource', 'landmarks');

        // New collection? Need to find the assets on them again
        this.listenTo(this, 'change:activeCollection', this.reloadAssetSource);

        this._initTemplates();
        this._initCollections();
    },

    _initTemplates: function () {
        var that = this;
        // firstly, we need to find out what template we will use.
        // construct a template labels model to go grab the available labels.
        var labels;
        var templates = new Template.TemplateLabels({server: this.server()});
        this.set('templates', templates);
        templates.fetch({
            success: function () {
                labels = templates.get('labels');
                var label = labels[0];
                console.log('Available templates are ' + labels);
                if (that.has('_activeTemplate')) {
                    // user has specified a preset! Use that if we can
                    // TODO should validate here if we can actually use template
                    label = that.get('_activeTemplate');
                    console.log("template is preset to '" + label + "'");
                }
                console.log("template set to '" + label + "'");
                that.set('activeTemplate', label);

            },
            error: function () {
                console.log('Failed to talk server for templates (is landmarkerio' +
                    'running from your command line?).');
            }
        });
    },

    _initCollections: function () {
        var that = this;
        // we also need to find out what collections are available.
        var labels;
        var collections = new Collection.CollectionLabels({server: this.server()});
        this.set('collections', collections);
        collections.fetch({
            success: function () {
                labels = collections.get('labels');
                console.log('Available collections are ' + labels + ' setting ' +
                    labels[0] + ' to start');
                if (that.has('_activeCollection')) {
                    that.set('activeCollection',
                        that.get('_activeCollection'));
                } else {
                    that.set('activeCollection', labels[0]);
                }
            },
            error: function () {
                console.log('Failed to talk server for collections (is landmarkerio' +
                    'running from your command line?).');
            }
        });
    },

    reloadAssetSource: function () {
        // needs to have an activeCollection to preceed. AssetSource should be
        // updated every time the active collection is updated.
        var that = this;
        if (!this.get('activeCollection')) {
            // can only proceed with an activeCollection...
            console.log('App:reloadAssetSource with no activeCollection - doing nothing');
            return;
        }
        console.log('App: reloading asset source');

        // Construct an asset source (which can query for asset information
        // from the server). Of course, we must pass the server in. The
        // asset source will ensure that the assets produced also get
        // attached to this server.
        var asc = this._assetSourceConstructor();
        var assetSource = new asc({
            server: this.server(),
            id: this.activeCollection()
        });
        if (this.has('assetSource')) {
            this.stopListening(this.get('assetSource'));
        }
        this.set('assetSource', assetSource);
        // whenever our asset source changes it's current asset and mesh we need
        // to update the app state.
        this.listenTo(assetSource, 'change:asset', this.assetChanged);
        this.listenTo(assetSource, 'change:mesh', this.meshChanged);

        Backbone.promiseFetch(assetSource).then(function () {
                var i = 0;
                console.log('assetSource retrieved - setting');
                if (that.has('_assetIndex')) {
                    i = that.get('_assetIndex');
                }
                if (i < 0 ||  i > (assetSource.nAssets() - 1)) {
                    console.error(
                            'Error trying to set index to ' + i + ' - needs to'
                    + ' be in the range 0-' + assetSource.nAssets());
                    return;
                }
                return that.setAsset(assetSource.assets()[i]);
            },
            function () {
                console.log('Failed to fetch assets (is landmarkerio' +
                    'running from your command line?).');
            });
    },

    _assetSourceConstructor: function () {
        if (this.imageMode()) {
            return AssetSource.ImageSource;
        } else if (this.meshMode()) {
            return AssetSource.MeshSource;
        } else {
            console.error('WARNING - illegal mode setting on app! Must be' +
                ' mesh or image');
        }
    },

    // Mirror the state of the asset source onto the app
    assetChanged: function () {
        console.log('App.assetChanged');
        this.set('asset', this.assetSource().asset());
    },

    meshChanged: function () {
        console.log('App.meshChanged');
        this.trigger('newMeshAvailable');
    },

    setAsset: function (newAsset) {
        this.set('landmarks', null);
        // get a promise of the new asset. this promise will only resolve
        // once we have the key data loaded to start annotating - for an image
        // that's the full texture. For a mesh, that's the geometry.
        var newAssetPromise = this.assetSource().setAsset(newAsset);
        // 'wrap' this promise in a landmark promise. All this will only
        // resolve when we have both landmarks (if there are landmarks)
        // and an asset suitable for display
        return this._promiseLandmarksWithAsset(newAssetPromise);
    },

    _promiseLandmarksWithAsset: function (loadAssetPromise) {
        // returns a promise that will only resolve when the asset and
        // landmarks are both downloaded and ready.
        var that = this;
        // Make a new landmark object for the new asset.
        var landmarks = new Landmark.LandmarkSet({
            id: this.asset().id,
            type: this.activeTemplate(),
            server: this.get('server')
        });
        // get promises for the both the asset and the landmarks
        var loadLandmarksPromise = Backbone.promiseFetch(landmarks);
        // if both come true, then set the landmarks
        return Promise.all([loadLandmarksPromise, loadAssetPromise]).then(function () {
            console.log('landmarks are loaded and the asset is at a suitable ' +
                'state to display');
            // now we know that this is resolved we set the landmarks on the
            // app. This way we know the landmarks will always be set with a
            // valid asset.
            that.set('landmarks', landmarks);
        });
    },

    nextAsset: function () {
        // see setAsset for docs
        this.set('landmarks', null);
        return this._promiseLandmarksWithAsset(
            this.assetSource().next());
    },

    previousAsset: function () {
        // see setAsset for docs
        this.set('landmarks', null);
        return this._promiseLandmarksWithAsset(
            this.assetSource().previous());
    }

});
