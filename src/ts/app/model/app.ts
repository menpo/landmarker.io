import * as $ from 'jquery'
import * as Backbone from 'backbone'

import Tracker from '../lib/tracker'
import * as AssetSource from './assetsource'
import { LandmarkGroup } from './landmark'
import Modal from '../view/modal'

type AppOptions = {
    _activeTemplate?: string
    _activeCollection?: string
    _assetIndex?: number
}

export default class App extends Backbone.Model {

    constructor(opts: AppOptions) {
        super({
            landmarkSize: 0.2,
            mode: 'mesh',
            connectivityOn: true,
            editingOn: true,
            autoSaveOn: false,
            activeTemplate: undefined,
            activeCollection: undefined,
            helpOverlayIsDisplayed: false,
            tracker: {}
        })
        this.set(opts)

        // New collection? Need to find the assets on them again
        this.listenTo(this, 'change:activeCollection', this.reloadAssetSource)
        this.listenTo(this, 'change:activeTemplate', this.reloadLandmarks)

        this._initTemplates()
        this._initCollections()
    }

    isConnectivityOn() {
        return this.get('connectivityOn')
    }

    isAutoSaveOn() {
        return this.get('autoSaveOn')
    }

    toggleAutoSave() {
        return this.set('autoSaveOn', !this.isAutoSaveOn())
    }

    toggleConnectivity() {
        this.set('connectivityOn', !this.isConnectivityOn())
     }

    isEditingOn() {
        return this.get('editingOn')
     }

    toggleEditing() {
        this.set('editingOn', !this.isEditingOn())
        if (!this.isEditingOn() && this.landmarks()) {
            this.landmarks().deselectAll()
            this.landmarks().resetNextAvailable()
        }
     }

    isHelpOverlayOn() {
        return this.get('helpOverlayIsDisplayed')
     }

    toggleHelpOverlay() {
        this.set('helpOverlayIsDisplayed', !this.isHelpOverlayOn())
     }

    mode() {
        return this.get('mode')
     }

    imageMode() {
        return this.get('mode') === 'image'
     }

    meshMode() {
        return this.get('mode') === 'mesh'
     }

    server() {
        return this.get('server')
     }

    templates() {
        return this.get('templates')
     }

    activeTemplate() {
        return this.get('activeTemplate')
     }

    collections() {
        return this.get('collections')
     }

    activeCollection() {
        return this.get('activeCollection')
     }

    tracker() {
            return this.get('tracker')
     }

    hasAssetSource() {
        return this.has('assetSource')
     }

    assetSource = () => {
        return this.get('assetSource')
     }

    assetIndex() {
        if (this.has('assetSource')) {
            return this.get('assetSource').assetIndex()
        }
     }

    // returns the currently active Asset (Image or Asset).
    // changes independently of mesh() - care should be taken as to which one
    // other objects should listen to.
    asset() {
        return this.get('asset')
     }

    // returns the currently active THREE.Mesh.
    mesh = () => {
        if (this.hasAssetSource()) {
            return this.assetSource().mesh()
        } else {
            return null
        }
     }

    landmarks = () => {
        return this.get('landmarks')
     }

    landmarkSize() {
        return this.get('landmarkSize')
     }

    budgeLandmarks(vector:  [number, number]) {
        // call our onBudgeLandmarks callback
        this.onBudgeLandmarks(vector)
     }

    _initTemplates(override=false) {
        // firstly, we need to find out what template we will use.
        // construct a template labels model to go grab the available labels.
        this.server().fetchTemplates().then((templates) => {
            this.set('templates', templates)
            let selected = templates[0]
            if (!override && this.has('_activeTemplate')) {
                // user has specified a preset! Use that if we can
                // TODO should validate here if we can actually use template
                const preset = this.get('_activeTemplate')
                if (templates.indexOf(preset) > -1) {
                    selected = preset
                }
            }
            this.set('activeTemplate', selected)
        }, () => {
            throw new Error('Failed to talk server for templates (is ' +
                            'landmarkerio running from your command line?).')
        })
     }

    _initCollections(override=false) {
        this.server().fetchCollections().then((collections) => {
            this.set('collections', collections)
            let selected = collections[0]
            if (!override && this.has('_activeCollection')) {
                const preset = this.get('_activeCollection')
                if (collections.indexOf(preset) > -1) {
                    selected = preset
                }
            }
            this.set('activeCollection', selected)
        }, () => {
            throw new Error('Failed to talk server for collections (is ' +
                            'landmarkerio running from your command line?).')
        })
     }

    reloadAssetSource() {
        // needs to have an activeCollection to preceed. AssetSource should be
        // updated every time the active collection is updated.
        if (!this.get('activeCollection')) {
            // can only proceed with an activeCollection...
            console.log('App:reloadAssetSource with no activeCollection - doing nothing')
            return
        }

        console.log('App: reloading asset source')

        let oldIndex
        if (this.has('asset') && this.has('assetSource')) {
            const idx = this.assetSource().assetIndex(this.asset())
            if (idx > -1) {
                oldIndex = idx
            }
        }

        if (this.hasChanged('mode')) {
            $('#viewportContainer').trigger('resetCamera')
        }

        // Construct an asset source (which can query for asset information
        // from the server). Of course, we must pass the server in. The
        // asset source will ensure that the assets produced also get
        // attached to this server.
        const ASC = this._assetSourceConstructor()
        const assetSource = new ASC(this.server(), this.activeCollection())
        if (this.has('assetSource')) {
            this.stopListening(this.get('assetSource'))
        }
        this.set('assetSource', assetSource)
        this.set('tracker', {})
        // whenever our asset source changes it's current asset and mesh we need
        // to update the app state.
        this.listenTo(assetSource, 'change:asset', this.assetChanged)
        this.listenTo(assetSource, 'change:mesh', this.meshChanged)

        assetSource.fetch().then(() => {
            let i

            console.log('assetSource retrieved - setting')

            if (oldIndex >= 0 && !this.hasChanged('activeCollection')) {
                i = oldIndex
            } else if (this.has('_assetIndex') && !this.has('asset')) {
                i = this.get('_assetIndex')
            } else {
                i = 0
            }

            if (i < 0 || i > assetSource.nAssets() - 1) {
                throw Error(`Error trying to set index to ${i} - needs to be in the range 0-${assetSource.nAssets()}`)
            }

            return this.goToAssetIndex(i)
        }, () => {
            throw new Error('Failed to fetch assets (is landmarkerio' +
                            'running from your command line?).')
        })
     }

    getTracker(assetId, template) {
        const tracker = this.tracker()
        if (!tracker[assetId]) {
            tracker[assetId] = {}
        }

        if (!tracker[assetId][template]) {
            tracker[assetId][template] = new Tracker()
        }

        return tracker[assetId][template]
     }

    reloadLandmarks() {
        if (this.landmarks() && this.asset()) {
            this.autoSaveWrapper(() => {
                this.set('landmarks', null)
                this.loadLandmarksPromise().then((lms) => {
                    this.set('landmarks', lms)
                })
            })
        }
     }

    autoSaveWrapper(fn) {
        const lms = this.landmarks()
        if (lms && !lms.tracker.isUpToDate()) {
            if (!this.isAutoSaveOn()) {
                Modal.confirm('You have unsaved changes, are you sure you want to proceed? (Your changes will be lost). Turn autosave on to save your changes by default.', fn)
            } else {
                lms.save().then(fn)
            }
        } else {
            fn()
        }
     }

    _assetSourceConstructor() {
        if (this.imageMode()) {
            return AssetSource.ImageSource
        } else if (this.meshMode()) {
            return AssetSource.MeshSource
        } else {
            console.error('WARNING - illegal mode setting on app! Must be' +
                ' mesh or image')
        }
     }

    // Mirror the state of the asset source onto the app
    assetChanged = () => {
        console.log('App.assetChanged')
        this.set('asset', this.assetSource().asset())
     }

    meshChanged() {
        console.log('App.meshChanged')
        this.trigger('newMeshAvailable')
     }

    loadLandmarksPromise() {
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
            )
        }, () => {
            console.log('Error in fetching landmark JSON file')
        })
     }

    _promiseLandmarksWithAsset(loadAssetPromise) {
        // returns a promise that will only resolve when the asset and
        // landmarks are both downloaded and ready.

        // if both come true, then set the landmarks
        return Promise.all([this.loadLandmarksPromise(),
                            loadAssetPromise]).then((args) => {
            const landmarks = args[0]
            console.log('landmarks are loaded and the asset is at a suitable ' +
                'state to display')
            // now we know that this is resolved we set the landmarks on the
            // app. This way we know the landmarks will always be set with a
            // valid asset.
            this.set('landmarks', landmarks)
        })
     }

    _switchToAsset(newAssetPromise) {
        // The asset promise should come from the assetSource and will only
        // resolve when all the key data for annotating is loaded, the
        // promiseLandmark wraps it and only resolves when both landmarks (if
        // applicable) and asset data are present
        if (newAssetPromise) {
            this.set('landmarks', null)
            return this._promiseLandmarksWithAsset(newAssetPromise)
        }
     }

    nextAsset() {
        if (this.assetSource().hasSuccessor()) {
            this.autoSaveWrapper(() => {
                this._switchToAsset(this.assetSource().next())
            })
        }
     }

    previousAsset() {
        if (this.assetSource().hasPredecessor()) {
            this.autoSaveWrapper(() => {
                this._switchToAsset(this.assetSource().previous())
            })
        }
     }

    goToAssetIndex(newIndex) {
        this.autoSaveWrapper(() => {
            this._switchToAsset(this.assetSource().setIndex(newIndex))
        })
     }

    reloadLandmarksFromPrevious() {
        const lms = this.landmarks()
        if (lms) {
            const as = this.assetSource()
            if (this.assetSource().hasPredecessor()) {
                this.server().fetchLandmarkGroup(
                    as.assets()[as.assetIndex() - 1].id,
                    this.activeTemplate()
                ).then((json) => {
                    lms.tracker.recordState(lms.toJSON())
                    lms.restore(json)
                    lms.tracker.recordState(lms.toJSON(), false, true)
                }, () => {
                    console.log('Error in fetching landmark JSON file')
                })
            }
        }
     }

    incrementLandmarkSize() {
        const size = this.get('landmarkSize')
        const factor = Math.floor(size / 0.25) + 1
        this.set('landmarkSize', Math.min(0.25 * factor, 1))
     }

    decrementLandmarkSize() {
        const size = this.get('landmarkSize')
        const factor = Math.floor(size / 0.25) - 1
        this.set('landmarkSize', Math.max(0.25 * factor, 0.05))
    }

}
