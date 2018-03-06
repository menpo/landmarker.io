'use strict';

import _ from 'underscore';
import $ from 'jquery';
import Promise from 'promise-polyfill';
import Backbone from 'backbone';

import Tracker from '../lib/tracker';
import * as AssetSource from './assetsource';
import LandmarkGroup from './landmark_group';
import Modal from '../view/modal';

export default Backbone.Model.extend({


    defaults: function () {
        return {
            landmarkSize: 0.5,
            mode: 'mesh',
            gender: undefined,
            setTypeOfPhoto: undefined,
            connectivityOn: true,
            editingOn: true,
            autoSaveOn: false,
            activeTemplate: undefined,
            activeCollection: undefined,
            helpOverlayIsDisplayed: false,
            tracker: {}
        };
    },

    isConnectivityOn: function () {
        return this.get('connectivityOn');
    },

    isAutoSaveOn: function () {
        return this.get('autoSaveOn');
    },
    getGender: function () {
        return this.get('gender');
    },
    setGender: function (gender) {
        return this.set('gender', gender);
    },
    setTypeOfPhoto: function (typeOfPhoto) {
        return this.set('typeOfPhoto', typeOfPhoto);
    },
    getTypeOfPhoto: function () {
        return this.get('typeOfPhoto');
    },

    toggleAutoSave: function () {
        return this.set('autoSaveOn', !this.isAutoSaveOn());
    },

    toggleConnectivity: function () {
        this.set('connectivityOn', !this.isConnectivityOn());
    },

    isEditingOn: function () {
        return this.get('editingOn');
    },

    toggleEditing: function () {
        this.set('editingOn', !this.isEditingOn());
        if (!this.isEditingOn() && this.landmarks()) {
            this.landmarks().deselectAll();
            this.landmarks().resetNextAvailable();
        }
    },

    isHelpOverlayOn: function () {
        return this.get('helpOverlayIsDisplayed');
    },

    toggleHelpOverlay: function () {
        this.set('helpOverlayIsDisplayed', !this.isHelpOverlayOn());
    },

    mode: function () {
        return this.get('mode');
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

    tracker: function () {
        return this.get('tracker');
    },

    hasAssetSource: function () {
        return this.has('assetSource');
    },

    assetSource: function () {
        return this.get('assetSource');
    },

    assetIndex: function () {
        if (this.has('assetSource')) {
            return this.get('assetSource').assetIndex();
        }
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
        this.listenTo(this, 'change:activeTemplate', this.reloadLandmarks);

        this._initTemplates();
        this._initCollections();
    },

    _initTemplates: function (override = false) {
        // firstly, we need to find out what template we will use.
        // construct a template labels model to go grab the available labels.
        this.server().fetchTemplates().then((templates) => {
            this.set('templates', templates);
            let selected = templates[0];
            if (!override && this.has('_activeTemplate')) {
                // user has specified a preset! Use that if we can
                // TODO should validate here if we can actually use template
                const preset = this.get('_activeTemplate');
                if (templates.indexOf(preset) > -1) {
                    selected = preset;
                }
            }
            this.set('activeTemplate', selected);
        }, () => {
            throw new Error('Failed to talk server for templates (is ' +
                'landmarkerio running from your command line?).');
        });
    },

    _initCollections: function (override = false) {
        this.server().fetchCollections().then((collections) => {
            this.set('collections', collections);
            let selected = collections[0];
            if (!override && this.has('_activeCollection')) {
                const preset = this.get('_activeCollection');
                if (collections.indexOf(preset) > -1) {
                    selected = preset;
                }
            }
            this.set('activeCollection', selected);
        }, () => {
            throw new Error('Failed to talk server for collections (is ' +
                'landmarkerio running from your command line?).');
        });
    },

    reloadAssetSource: function () {
        // needs to have an activeCollection to preceed. AssetSource should be
        // updated every time the active collection is updated.
        if (!this.get('activeCollection')) {
            // can only proceed with an activeCollection...
            console.log('App:reloadAssetSource with no activeCollection - doing nothing');
            return;
        }

        console.log('App: reloading asset source');

        let oldIndex;
        if (this.has('asset') && this.has('assetSource')) {
            const idx = this.assetSource().assetIndex(this.asset());
            if (idx > -1) {
                oldIndex = idx;
            }
        }

        if (this.hasChanged('mode')) {
            $('#viewportContainer').trigger('resetCamera');
        }

        // Construct an asset source (which can query for asset information
        // from the server). Of course, we must pass the server in. The
        // asset source will ensure that the assets produced also get
        // attached to this server.
        const ASC = this._assetSourceConstructor();
        const assetSource = new ASC({
            server: this.server(),
            id: this.activeCollection()
        });
        if (this.has('assetSource')) {
            this.stopListening(this.get('assetSource'));
        }
        this.set('assetSource', assetSource);
        this.set('tracker', {});
        // whenever our asset source changes it's current asset and mesh we need
        // to update the app state.
        this.listenTo(assetSource, 'change:asset', this.assetChanged);
        this.listenTo(assetSource, 'change:mesh', this.meshChanged);

        assetSource.fetch().then(() => {
            let i;

            console.log('assetSource retrieved - setting');

            if (oldIndex >= 0 && !this.hasChanged('activeCollection')) {
                i = oldIndex;
            } else if (this.has('_assetIndex') && !this.has('asset')) {
                i = this.get('_assetIndex');
            } else {
                i = 0;
            }

            if (i < 0 || i > assetSource.nAssets() - 1) {
                throw Error(`Error trying to set index to ${i} - needs to be in the range 0-${assetSource.nAssets()}`);
            }

            return this.goToAssetIndex(i);
        }, () => {
            throw new Error('Failed to fetch assets (is landmarkerio' +
                'running from your command line?).');
        });
    },

    getTracker: function (assetId, template) {
        const tracker = this.tracker();
        if (!tracker[assetId]) {
            tracker[assetId] = {};
        }

        if (!tracker[assetId][template]) {
            tracker[assetId][template] = new Tracker();
        }

        return tracker[assetId][template];
    },

    reloadLandmarks: function () {
        if (this.landmarks() && this.asset()) {
            this.autoSaveWrapper(() => {
                this.set('landmarks', null);
                this.loadLandmarksPromise().then((lms) => {
                    this.set('landmarks', lms);
                });
            });
        }
    },

    autoSaveWrapper: function (fn) {
        const gender = this.getGender();
        const typeOfPhoto = this.getTypeOfPhoto();
        const lms = this.landmarks();
        if (lms && gender && (typeOfPhoto || typeOfPhoto == '') && !lms.tracker.isUpToDate()) {
            if (!this.isAutoSaveOn()) {
                Modal.confirm('You have unsaved changes, are you sure you want to proceed? (Your changes will be lost). Turn autosave on to save your changes by default.', fn);
            } else {
                console.log("saveeeeeeeeee")

                lms.save(gender, typeOfPhoto).then(fn);
            }
        } else {
            fn();
        }
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

    loadLandmarksPromise: function () {
        return this.server().fetchLandmarkGroup(
            this.asset().id,
            this.activeTemplate()
        ).then((json) => {
            this.setGender(json.gender);
            this.setTypeOfPhoto(json.typeOfPhoto);
            return LandmarkGroup.parse(
                json,
                this.asset().id,
                this.activeTemplate(),
                this.server(),
                this.getTracker(this.asset().id, this.activeTemplate())
            );
        }, () => {
            console.log('Error in fetching landmark JSON file');
        });
    },

    _promiseLandmarksWithAsset: function (loadAssetPromise) {
        // returns a promise that will only resolve when the asset and
        // landmarks are both downloaded and ready.

        // if both come true, then set the landmarks
        return Promise.all([this.loadLandmarksPromise(),
            loadAssetPromise]).then((args) => {
            const landmarks = args[0];
            console.log('landmarks are loaded and the asset is at a suitable ' +
                'state to display');
            // now we know that this is resolved we set the landmarks on the
            // app. This way we know the landmarks will always be set with a
            // valid asset.
            this.set('landmarks', landmarks);
        });
    },

    _switchToAsset: function (newAssetPromise) {
        // The asset promise should come from the assetSource and will only
        // resolve when all the key data for annotating is loaded, the
        // promiseLandmark wraps it and only resolves when both landmarks (if
        // applicable) and asset data are present

        if (newAssetPromise) {
            this.set('landmarks', null);
            return this._promiseLandmarksWithAsset(newAssetPromise);
        }
    },

    nextAsset: function () {
        if (this.assetSource().hasSuccessor()) {
            this.autoSaveWrapper(() => {
                this._switchToAsset(this.assetSource().next());
            });
        }
    },

    previousAsset: function () {
        if (this.assetSource().hasPredecessor()) {
            this.autoSaveWrapper(() => {
                this._switchToAsset(this.assetSource().previous());
            });
        }
    },

    goToAssetIndex: function (newIndex) {
        this.autoSaveWrapper(() => {
            this._switchToAsset(this.assetSource().setIndex(newIndex));
        });

    },

    reloadLandmarksFromPrevious: function () {
        const lms = this.landmarks();
        if (lms) {
            const as = this.assetSource();
            if (this.assetSource().hasPredecessor()) {
                this.server().fetchLandmarkGroup(
                    as.assets()[as.assetIndex() - 1].id,
                    this.activeTemplate()
                ).then((json) => {
                    this.setGender(json.gender);
                    this.setTypeOfPhoto(json.typeOfPhoto);
                    lms.tracker.recordState(lms.toJSON());
                    lms.restore(json, true);
                    lms.tracker.recordState(lms.toJSON(), false, true);
                }, () => {
                    console.log('Error in fetching landmark JSON file');
                });
            }
        }
    },

    incrementLandmarkSize: function () {
        const size = this.get('landmarkSize');
        const factor = Math.floor(size / 0.25) + 1;
        this.set('landmarkSize', Math.min(0.25 * factor, 1));
    },

    decrementLandmarkSize: function () {
        const size = this.get('landmarkSize');
        const factor = Math.floor(size / 0.25) - 1;
        this.set('landmarkSize', Math.max(0.25 * factor, 0.05));
    }

});
