'use strict'

import { getJSON, putJSON, getArrayBuffer } from '../lib/requests'
import { capitalize } from '../lib/utils'
import * as support from '../lib/support'
import ImagePromise from '../lib/imagepromise'

import { Backend } from './base'

export default class Server implements Backend {

    // Used to identify backends in local storage
    static Type = 'LANDMARKER SERVER'

    url: string
    demoMode = false
    version = 2
    httpAuth = false

    constructor(url: string) {
        this.url = url

        if (this.url === 'demo') {
            this.url = ''
            this.demoMode = true
        } else if (!/^(?:f|ht)tps?\:\/\//.test(url)) {
            this.url = 'http://' + this.url
        }

        this.httpAuth = url.indexOf('https://') === 0

        if (!this.demoMode && support.https && url.indexOf('https://') !== 0) {
            throw new Error('Mixed Content')
        }

    }

    apiHeader() {
        return `/api/v${this.version}/`
    }

    map(url: string) {
        if (this.demoMode) {
            // demoMode so we ignore the server url
            const mapping = window.location.pathname.slice(0, -1) +
                    this.apiHeader() + url
            // this just means we map everything to .json..except images
            // which have to be jpeg and mesh data (.raw)
            if ((new RegExp('textures/')).test(url)) {
                return mapping + '.jpg'
            } else if ((new RegExp('thumbnails/')).test(url)) {
                return mapping + '.jpg'
            } else if ((new RegExp('meshes/')).test(url)) {
                return mapping + '.raw'
            } else {
                return mapping + '.json'
            }
        } else {
            return this.url + this.apiHeader() + url
        }
    }

    fetchJSON(basepath: string) {
        const url = this.map(basepath)
        return getJSON(url, {auth: this.httpAuth})
    }

    fetchMode() {
        return this.fetchJSON('mode')
    }

    fetchTemplates() {
        return this.fetchJSON('templates')
    }

    fetchCollections() {
        return this.fetchJSON('collections')
    }

    fetchCollection(collectionId: string) {
        return this.fetchJSON(`collections/${collectionId}`)
    }

    fetchLandmarkGroup(id: string, type: string) {
        return getJSON(this.map(`landmarks/${id}/${type}`), {auth: this.httpAuth})
    }

    saveLandmarkGroup(id: string, group: string, json: Object) {
        return putJSON(this.map(`landmarks/${id}/${group}`), {
            data: json,
            auth: this.httpAuth
        })
    }

    fetchThumbnail(assetId: string) {
        return ImagePromise(this.map(`thumbnails/${assetId}`), this.httpAuth)
    }

    fetchTexture(assetId: string) {
        return ImagePromise(this.map(`textures/${assetId}`), this.httpAuth)
    }

    fetchGeometry(assetId: string) {
        return getArrayBuffer(this.map(`meshes/${assetId}`), {
            auth: this.httpAuth
        })
    }

}
