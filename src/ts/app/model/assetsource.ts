import * as Backbone from 'backbone'
import * as _ from 'underscore'

import * as Asset from './asset'
import {loading} from '../view/notification'

function abortAllObj (obj) {
    _.values(obj).forEach(function (x) {
        x.abort()
    })
}

// Holds a list of available assets.
abstract class AssetSource extends Backbone.Model {

    constructor(server, id: string) {
        super({
            assets: new Backbone.Collection(),
            assetIsLoading: false,
            server,
            id
         })
    }

    abstract setAsset(asset: Asset.Image): void

    server() {
        return this.get('server')
    }

    fetch() {
        return (
            this.server().fetchCollection(this.id).then((response) => {
                this.set('assets', this.parse(response).assets)
            })
        )
    }

    asset() {
        return this.get('asset')
    }

    assets() {
        return this.get('assets')
    }

    mesh() {
        const asset = this.asset()
        return asset ? asset.mesh() : undefined
    }

    assetIsLoading() {
        return this.get('assetIsLoading')
    }

    nAssets() {
        return this.get('assets').length
    }

    hasPredecessor() {
        return this.assetIndex() !== 0
    }

    hasSuccessor() {
        return this.nAssets() - this.assetIndex() !== 1
    }

    // returns the index of the currently active mesh
    assetIndex() {
        return this.assets().indexOf(this.get('asset'))
    }


    next() {
        if (!this.hasSuccessor()) {
            return undefined
        }
        return this.setAsset(this.assets()[this.assetIndex() + 1])
    }

    previous() {
        if (!this.hasPredecessor()) {
            return undefined
        }
        return this.setAsset(this.assets()[this.assetIndex() - 1])
    }

    setIndex(newIndex) {
        if (newIndex < 0 || newIndex >= this.nAssets()) {
            console.log(`Can't go to asset with index ${newIndex + 1}`)
            return null
        } else {
            return this.setAsset(this.assets()[newIndex])
        }
    }

    updateMesh() {
        this.trigger('change:mesh')
    }
}

export class MeshSource extends AssetSource {

    parse(response: string[]) {
        const meshes = response.map(assetId => new Asset.Mesh(assetId, this.server()))
        return { assets: meshes }
    }

    setAsset(newMesh: Asset.Mesh) {
        var oldAsset = this.asset()
        // stop listening to the old asset
        if (oldAsset) {
            this.stopListening(oldAsset)
        }
        if (!this.hasOwnProperty('pending')) {
            this.pending = {}
        }
        // kill any current fetches
        console.log("Starting abort")
        abortAllObj(this.pending)
        this.set('assetIsLoading', true)
        const asyncId = loading.start()
        // set the asset immediately (triggering change in UI)
        this.set('asset', newMesh)

        this.listenTo(newMesh, 'newMeshAvailable', this.updateMesh)

        // update the mesh immediately (so we get a placeholder if nothing else)
        this.updateMesh()

        // fetch the thumbnail and texture aggressively asynchronously.
        // TODO should track the thumbnail here too
        newMesh.loadThumbnail()
        newMesh.loadTexture()
        // fetch the geometry
        const geometry = newMesh.loadGeometry()

        // track the request
        this.pending[newMesh.id] = geometry.xhr()

        // after the geometry is ready, we want to clear up our tracking of
        // loading requests.
        geometry.then(() => {
            console.log('grabbed new mesh geometry')
            // now everyone has moved onto the new mesh, clean up the old
            // one.
            if (oldAsset) {
                //oldAsset.dispose()
                oldAsset = null
            }
            delete this.pending[newMesh.id]
            loading.stop(asyncId)
            this.set('assetIsLoading', false)
        }, function (err) {
            loading.stop(asyncId)
            console.log('geometry.then something went wrong ' + err.stack)
        })
        // return the geometry promise
        return geometry
    }
}

// Holds a list of available images, and a ImageList. The ImageList
// is populated immediately, although images aren't fetched until demanded.
// Also has a mesh parameter - the currently active mesh.
export class ImageSource extends AssetSource {

    parse(response) {
        const images = response.map((assetId) => {
            return new Asset.Image(assetId, this.server())
        })

        return { assets: images }
    }

    setAsset(newAsset: Asset.Image) {
        const oldAsset = this.asset()
        // stop listening to the old asset
        if (oldAsset) {
            this.stopListening(oldAsset)
        }
        this.set('assetIsLoading', true)
        const asyncId = loading.start()
        // set the asset immediately (triggering change in UI)
        this.set('asset', newAsset)

        this.listenTo(newAsset, 'newMeshAvailable', this.updateMesh)

        // update the mesh immediately (so we get a placeholder if nothing else)
        this.updateMesh()

        // fetch the thumbnail and texture aggressively asynchronously.
        newAsset.loadThumbnail()
        const texture = newAsset.loadTexture()

        // after the texture is ready, we want to clear up our tracking of
        // loading requests.
        texture.then(() => {
            console.log('grabbed new image texture')
            this.set('assetIsLoading', false)
            loading.stop(asyncId)
        }, function (err) {
            loading.stop(asyncId)
            console.log('texture.then something went wrong ' + err.stack)
        })
        // return the texture promise. Once the texture is ready, landmarks
        // can be displayed.
        return texture
    }
}
