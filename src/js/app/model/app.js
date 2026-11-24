'use strict';

import _ from 'underscore';
import $ from 'jquery';
import Backbone from 'backbone';

import Tracker from '../lib/tracker';
import * as AssetSource from './assetsource';
import LandmarkGroup from './landmark_group';
import Modal from '../view/modal';

// How many points of a landmark group's JSON differ from `before` (a list of points)
function countMoved (before, json) {
    return json.landmarks.points.filter(
        (p, i) => !before[i] || p[0] !== before[i][0] || p[1] !== before[i][1]).length;
}

// The message of a failed request: what the server said, else the status text
function messageOf (error) {
    let message = error.message;
    try {
        message = (error.body && error.body.message) || message;
    } catch (e) { /* keep the status text */ }
    return message;
}

// The points of an asset's landmarks if all of them are placed, else null
function completePoints (json) {
    const points = json && json.landmarks && json.landmarks.points;
    return points && points.length && points.every(p => p.every(v => v !== null)) ?
        points : null;
}

// The landmarks of the previous image of the collection (its JSON, saved or proposed by the
// pre-fit), or null: this is the first image, or it has none
function previousLandmarks (app) {
    const source = app.assetSource();
    if (!source.hasPredecessor()) {
        return Promise.resolve(null);
    }
    const previous = source.assets()[source.assetIndex() - 1];
    return app.server().fetchLandmarkGroup(previous.id, app.activeTemplate())
        .then(json => json, () => null);
}

// Ask the server to fit the landmarks that are on the screen; resolves with the fitted JSON,
// rejects with a message. See App#autoFitLandmarks for the options.
function requestFit (app, {box, fromCurrent=true, fromPrevious=false, model}={}) {
    const lms = app.landmarks();
    if (!lms) {
        return Promise.reject('No landmarks to refine');
    }
    const name = model !== undefined ? model : app.get('fitModel');
    const sent = lms.toJSON();
    const start = fromPrevious && !box ? previousLandmarks(app) : Promise.resolve(null);
    return start.then((previous) => {
        const points = completePoints(previous);
        if (points) {
            sent.landmarks.points = points;
        } else if (!fromCurrent && !box) {
            // an incomplete annotation is not a start: the server uses the model's own
            sent.landmarks.points = sent.landmarks.points.map(p => p.map(() => null));
        }
        return app.server().fitLandmarkGroup(
            app.asset().id, app.activeTemplate(), sent, box, name || undefined);
    }).then(json => json, error => Promise.reject(messageOf(error)));
}

// Put a fit on the landmarks (undoable); resolves with the number of points that moved
function applyFit (lms, json) {
    const before = lms.toJSON().landmarks.points;
    lms.tracker.recordState(lms.toJSON());
    lms.restore(json);
    lms.tracker.recordState(lms.toJSON(), false, true);
    return countMoved(before, json);
}

export default Backbone.Model.extend({

    defaults: function () {
        return {
            landmarkSize: 0.5,
            mode: 'mesh',
            connectivityOn: true,
            editingOn: true,
            autoSaveOn: false,
            autoSpaceOn: false,
            activeTemplate: undefined,
            activeCollection: undefined,
            helpOverlayIsDisplayed: false,
            fitBoxMode: false,
            fitBox: null,
            fitModel: null,      // the model the Fit panel uses (its name; null: the default)
            fitCompare: null,    // the fits of several models to choose from, see compareFits
            tracker: {}
        };
    },

    isConnectivityOn: function () {
        return this.get('connectivityOn');
    },

    isAutoSaveOn: function () {
        return this.get('autoSaveOn');
    },

    // space the curves evenly whenever a landmark has been dragged
    isAutoSpaceOn: function () {
        return this.get('autoSpaceOn');
    },

    toggleAutoSpace: function () {
        return this.set('autoSpaceOn', !this.isAutoSpaceOn());
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

    _initTemplates: function (override=false) {
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

    _initCollections: function (override=false) {
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
        const lms = this.landmarks();
        if (lms && !lms.tracker.isUpToDate()) {
            if (!this.isAutoSaveOn()) {
                Modal.confirm('You have unsaved changes, are you sure you want to proceed? (Your changes will be lost). Turn autosave on to save your changes by default.', fn);
            } else {
                lms.save().then(fn);
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
        // a box to fit from belongs to one image
        if (this.get('fitBoxMode')) {
            this.endFitBox();
        }
        if (this.get('fitCompare')) {
            this.endCompare();
        }
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
                    lms.tracker.recordState(lms.toJSON());
                    lms.restore(json);
                    lms.tracker.recordState(lms.toJSON(), false, true);
                }, () => {
                    console.log('Error in fetching landmark JSON file');
                });
            }
        }
    },

    // Refine the landmarks that are on the asset with a model of the server (undoable). Resolves
    // with the number of points that moved; rejects with a message to show.
    //   box: [[min, min], [max, max]] (the order of the points) to start from the model's
    //        initial shape in it
    //   fromCurrent: false to ignore the landmarks that are placed and start from the model's
    //        own initial shape (default true: complete landmarks are what the fit starts from)
    //   fromPrevious: start from the landmarks of the previous image in the collection (the
    //        frame before this one) if it has complete ones, instead of the current landmarks
    //   model: the name of the model (default: the one chosen in the Fit panel, `fitModel`)
    autoFitLandmarks: function (options={}) {
        const lms = this.landmarks();
        if (!lms) {
            return Promise.reject('No landmarks to refine');
        }
        return requestFit(this, options).then(
            json => applyFit(lms, json), message => Promise.reject(message));
    },

    // Fit the landmarks with several models at once and show each result on the image to
    // choose from (`fitCompare`: {asset, results: [{model, json, moved}], failed: [{model,
    // message}]}). Nothing changes until `useFit(model)`. Takes the options of autoFitLandmarks
    // (a box is a start for every model), and `models`, the names to compare.
    compareFits: function (options={}) {
        const lms = this.landmarks();
        const models = options.models || [];
        if (!lms || models.length < 2) {
            return Promise.reject('Comparing needs landmarks and two models');
        }
        const asset = this.asset();
        const before = lms.toJSON().landmarks.points;
        return Promise.all(models.map(model => requestFit(this, Object.assign(
            {}, options, {model})).then(
                json => ({model, json, moved: countMoved(before, json)}),
                message => ({model, message}))
        )).then((all) => {
            const results = all.filter(r => r.json);
            const failed = all.filter(r => !r.json);
            if (!results.length) {
                return Promise.reject(failed.map(f => `${f.model}: ${f.message}`).join('; '));
            }
            if (this.asset() === asset) {  // only if still on the image
                this.set('fitCompare', {asset, results, failed});
            }
            return {results, failed};
        });
    },

    // Take the fit of one model from the comparison (undoable like any fit)
    useFit: function (model) {
        const compare = this.get('fitCompare');
        const lms = this.landmarks();
        const result = compare && compare.results.find(r => r.model === model);
        if (!lms || !result) {
            return Promise.reject('No such fit to use');
        }
        this.endCompare();
        return Promise.resolve(applyFit(lms, result.json));
    },

    endCompare: function () {
        this.set('fitCompare', null);
    },

    // Drawing the box to start a fit from: the viewport shows `fitBox` and lets it be redrawn
    // while `fitBoxMode` is on. It starts as the box the model suggests, if it can.
    beginFitBox: function () {
        const server = this.server();
        this.set({fitBoxMode: true, fitBox: null});
        if (server && server.fetchFitBox && this.asset()) {
            const asset = this.asset();
            return server.fetchFitBox(asset.id, this.get('fitModel')).then((box) => {
                // only if still wanted, for the same image
                if (this.get('fitBoxMode') && this.asset() === asset) {
                    this.set('fitBox', box);
                }
            }, () => {});  // no suggestion: the annotator draws it
        }
        return Promise.resolve();
    },

    endFitBox: function () {
        this.set({fitBoxMode: false, fitBox: null});
    },

    // Fit from the box that is shown
    fitInBox: function () {
        const box = this.get('fitBox');
        if (!box) {
            return Promise.reject('Draw a box first');
        }
        this.endFitBox();
        return this.autoFitLandmarks({box});
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
