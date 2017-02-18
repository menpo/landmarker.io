import * as THREE from 'three'

import { getJSON, putJSON, getArrayBuffer } from '../lib/requests'
import { capitalize } from '../lib/utils'

import * as support from '../lib/support'
import ImagePromise from '../lib/imagepromise'

import { Backend } from './base'


function bufferGeometryFromArrays(points: Float32Array, normals: Float32Array, tcoords: Float32Array) {
    const geometry = new THREE.BufferGeometry()
    geometry.addAttribute('position', new THREE.BufferAttribute(points, 3))
    if (normals) {
        geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3))
    } else {
        geometry.computeVertexNormals()
    }
    if (tcoords) {
        geometry.addAttribute('uv', new THREE.BufferAttribute(tcoords, 2))
    }
    geometry.computeBoundingSphere()
    return geometry
}


function serverBufferToGeometry(buffer: ArrayBuffer) {
    const lenMeta = 4
    const bytes = 4
    const meta = new Uint32Array(buffer, 0, lenMeta)
    const nTris = meta[0]
    const isTextured = Boolean(meta[1])
    const hasNormals = Boolean(meta[2])
    const hasBinning = Boolean(meta[2])  // used for efficient lookup
    const stride = nTris * 3

    // Points
    const pointsOffset = lenMeta * bytes
    const points = new Float32Array(buffer, pointsOffset, stride * 3)
    const normalOffset = pointsOffset + stride * 3 * bytes

    // Normals (optional)
    let normals: Float32Array = null  // initialize for no normals
    let tcoordsOffset = normalOffset  // no normals -> tcoords next
    if (hasNormals) {
        // correct if has normals
        normals = new Float32Array(
            buffer, normalOffset, stride * 3)
        // need to advance the pointer on tcoords offset
        tcoordsOffset = normalOffset + stride * 3 * bytes
    }

    // Tcoords (optional)
    let tcoords: Float32Array = null  // initialize for no tcoords
    let binningOffset = tcoordsOffset  // no tcoords -> binning next
    if (isTextured) {
        tcoords = new Float32Array(
            buffer, tcoordsOffset, stride * 2)
        binningOffset = tcoordsOffset + stride * 2 * bytes
    }

    // Binning (optional)
    if (hasBinning) {
        console.log(
            'ready to read from binning file at ',
            binningOffset
        )
    }
    return bufferGeometryFromArrays(points, normals, tcoords)
}

export class Server implements Backend {

    // Used to identify backends in local storage
    static Type = 'LANDMARKER SERVER'

    url: string
    demoMode = false
    version = 3
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

    fetchLandmarkGroups(id: string) {
        return getJSON(this.map(`landmarks/json/${id}`), {auth: this.httpAuth})
    }

    saveLandmarkGroups(id: string, json: Object) {
        return putJSON(this.map(`landmarks/json/${id}`), {
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
        }).then(buffer => serverBufferToGeometry(buffer))
    }

}
