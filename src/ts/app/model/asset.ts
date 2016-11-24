import * as Backbone from 'backbone'
import * as THREE from 'three'
const placeholderUrl = require("../../../../img/placeholder.jpg")
import { Backend } from '../backend'
const FRONT = {
    image: new THREE.Vector3(0, 0, 1),
    mesh: new THREE.Vector3(0, 0, 1)
}

const UP = {
    image: new THREE.Vector3(1, 0, 0),
    mesh: new THREE.Vector3(0, 1, 0)
}

function mappedPlane(w: number, h: number) {
    const geometry = new THREE.Geometry()
    geometry.vertices.push(new THREE.Vector3(0, 0, 0))
    geometry.vertices.push(new THREE.Vector3(h, 0, 0))
    geometry.vertices.push(new THREE.Vector3(h, w, 0))
    geometry.vertices.push(new THREE.Vector3(0, w, 0))

    geometry.faces.push(new THREE.Face3(0, 1, 3))
    geometry.faces.push(new THREE.Face3(1, 2, 3))

    const t0:THREE.Vector2[] = []
    t0.push(new THREE.Vector2(0, 1)) // 1 0
    t0.push(new THREE.Vector2(0, 0)) // 1 1
    t0.push(new THREE.Vector2(1, 1)) // 0 1

    const t1:THREE.Vector2[] = []
    t1.push(new THREE.Vector2(0, 0)) // 0 1
    t1.push(new THREE.Vector2(1, 0)) // 0 0
    t1.push(new THREE.Vector2(1, 1)) // 1 0

    geometry.faceVertexUvs[0].push(t0)
    geometry.faceVertexUvs[0].push(t1)

    // needed for lighting to work
    geometry.computeFaceNormals()
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
    geometry.computeBoundingBox()

    return geometry
}

const UNTEXTURED_MESH_MATERIAL = new THREE.MeshPhongMaterial()
UNTEXTURED_MESH_MATERIAL.transparent = true

const IMAGE_PLACEHOLDER_GEOMETRY = mappedPlane(1, 1)
const IMAGE_PLACEHOLDER_TEXTURE = THREE.ImageUtils.loadTexture(placeholderUrl)
// the placeholder texture will not be powers of two size, so we need
// to set our resampling appropriately.
IMAGE_PLACEHOLDER_TEXTURE.minFilter = THREE.LinearFilter
const IMAGE_PLACEHOLDER_MATERIAL = new THREE.MeshPhongMaterial({
    map: IMAGE_PLACEHOLDER_TEXTURE
})

export class Image extends Backbone.Model {

    geometry: THREE.BufferGeometry = null
    thumbnailGeometry: THREE.Geometry = null
    textureGeometry: THREE.Geometry = null

    thumbnail: THREE.Material = null
    texture: THREE.Material = null

    _thumbnailPromise: Promise<THREE.Material> = null
    _geometryPromise: Promise<THREE.BufferGeometry> = null
    _texturePromise: Promise<THREE.Material> = null

    constructor(id: string, backend: Backend) {
        super()
        this.set({ id, textureOn: true })
        this.backend = backend
        const meshChanged = () => this.trigger('newMeshAvailable')
        this.listenTo(this, 'change:geometry', meshChanged)
        this.listenTo(this, 'change:thumbnail', meshChanged)
        this.listenTo(this, 'change:texture', meshChanged)
        this.listenTo(this, 'change:textureOn', meshChanged)
    }

    get backend(): Backend {
        return this.get('backend')
    }

    set backend(backend: Backend) {
        this.set('backend', backend)
    }

    hasTexture() {
        return this.texture !== null
    }

    hasThumbnail() {
        return this.thumbnail !== null
    }

    hasGeometry() {
        return this.geometry !== null
    }

    isTextureOn (): boolean {
        return this.hasTexture() && this.get('textureOn')
    }

    get hasGeometryPromise() {
        return this._geometryPromise !== null
    }

    get hasTexturePromise() {
        return this._geometryPromise !== null
    }

    get hasThumbnailPromise() {
        return this._geometryPromise !== null
    }

    get mesh() {
        // regenerate a THREE.Mesh from the current state. Note that no
        // texture, geometry or material is created in here - we just
        // wire up buffers that we own.
        // Once this asset is no longer required, dispose() can be called to
        // clear all state back up.
        let geometry: THREE.Geometry | THREE.BufferGeometry
        let material: THREE.Material
        const hasGeo = this.hasGeometry()
        const hasTex = this.hasTexture()
        const hasThumb = this.hasThumbnail()

        // Start assuming that we have an image
        let up = UP.image
        let front = FRONT.image

        // 1. Resolve which geometry should be used.
        if (hasGeo) {
            // actually is a mesh. adjust up and front accordingly.
            up = UP.mesh
            front = FRONT.mesh
            geometry = this.geometry
        } else if (hasTex) {
            geometry = this.textureGeometry
        } else if (hasThumb) {
            geometry = this.thumbnailGeometry
        } else {
            // no geometry, no image - use the placeholder
            geometry = IMAGE_PLACEHOLDER_GEOMETRY
        }

        // 2. Resolve material
        // First set the defaults
        material = hasGeo ? UNTEXTURED_MESH_MATERIAL : IMAGE_PLACEHOLDER_MATERIAL

        if (hasGeo) {
            // MESH
            if (this.isTextureOn()) {
                // must have either thumbnail or texture
                material = hasTex ? this.texture : this.thumbnail
            }
        } else {
            if (hasTex) {
                material = this.texture
            } else if (hasThumb) {
                material = this.thumbnail
            }
        }
        const mesh = new THREE.Mesh(geometry, material)
        mesh.name = this.id
        return {
            mesh: mesh,
            up: up,
            front: front
        }
    }

    textureOn() {
        if (this.isTextureOn() || !this.hasTexture()) {
            return  // texture already off or no texture
        }
        this.set('textureOn', true)
    }

    textureOff() {
        if (!this.isTextureOn()) {
            return  // texture already on
        }
        this.set('textureOn', false)
    }

    textureToggle() {
        if (this.isTextureOn()) {
            this.textureOff()
        } else {
            this.textureOn()
        }
    }

    loadThumbnail() {
        if (!this.hasThumbnailPromise) {
            this._thumbnailPromise = this.backend.fetchThumbnail(this.id).then((material) => {
                delete this._thumbnailPromise
                console.log('Asset: loaded thumbnail for ' + this.id)
                this.thumbnail = material
                var img = material.map.image
                this.thumbnailGeometry = mappedPlane(img.width, img.height)
                this.trigger('change:thumbnail')
                return material
            }, () => {
                console.log('Failed to fetch thumbnail for', this.id)
            })
        }
        return this._thumbnailPromise
    }

    loadTexture() {
        if (!this.hasTexturePromise) {
            this._texturePromise = this.backend.fetchTexture(this.id).then(material => {
                delete this._texturePromise
                console.log('Asset: loaded texture for ' + this.id)
                this.texture = material
                var img = material.map.image
                this.textureGeometry = mappedPlane(img.width, img.height)
                this.trigger('change:texture')
                return material
            }, () => {
                console.log('Failed to load texture for', this.id)
            })
        }
        return this._texturePromise
    }

    // reset this asset back to how it was at fetch time.
    dispose() {
        if (this.hasGeometry()) {
            this.geometry.dispose()
        }
        if (this.hasTexture()) {
            this.texture.map.dispose()
            this.texture.dispose()
            this.textureGeometry.dispose()

        }
        if (this.hasThumbnail()) {
            this.thumbnail.map.dispose()
            this.thumbnail.dispose()
            this.thumbnailGeometry.dispose()

        }
        // null everything
        this.thumbnailGeometry = null
        this.textureGeometry = null
        this.geometry = null
        this.thumbnail = null
        this.texture = null
        this._thumbnailPromise = null
        this._texturePromise = null
        this._geometryPromise = null
    }
}

export class Mesh extends Image {

    loadGeometry() {
        if (this.hasGeometryPromise) {
            // already loading this geometry
            return this._geometryPromise
        }
        const arrayPromise = this.backend.fetchGeometry(this.id)

        this._geometryPromise = arrayPromise.then((geometry) => {
            delete this._geometryPromise
            geometry.computeBoundingSphere()
            geometry.computeFaceNormals()
            geometry.computeVertexNormals()

            this.geometry = geometry
            this.trigger('change:geometry')

            return geometry
        }, (err) => {
            console.log('failed to load geometry (OBJ) for ' + this.id)
            console.log(err)
        })

        // mirror the arrayPromise xhr() API
        this._geometryPromise.xhr = () => {
            return arrayPromise.xhr ? arrayPromise.xhr() : { abort: () => null }
        }
        // return a promise that this Meshes Geometry will be correctly
        // configured. Can access the raw underlying xhr request at xhr().
        // Aborting this will cause the promise to fail.
        return this._geometryPromise
    }
}
