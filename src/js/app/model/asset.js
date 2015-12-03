'use strict';

import Backbone from 'backbone';
import THREE from 'three';
const placeholderUrl = require("../../../../img/placeholder.jpg");

const FRONT = {
    image: new THREE.Vector3(0, 0, 1),
    mesh: new THREE.Vector3(0, 0, 1)
};

const UP = {
    image: new THREE.Vector3(1, 0, 0),
    mesh: new THREE.Vector3(0, 1, 0)
};

function mappedPlane(w, h) {
    var geometry = new THREE.Geometry();
    geometry.vertices.push(new THREE.Vector3(0, 0, 0));
    geometry.vertices.push(new THREE.Vector3(h, 0, 0));
    geometry.vertices.push(new THREE.Vector3(h, w, 0));
    geometry.vertices.push(new THREE.Vector3(0, w, 0));

    geometry.faces.push(new THREE.Face3(0, 1, 3));
    geometry.faces.push(new THREE.Face3(1, 2, 3));

    var t0 = [];
    t0.push(new THREE.Vector2(0, 1)); // 1 0
    t0.push(new THREE.Vector2(0, 0)); // 1 1
    t0.push(new THREE.Vector2(1, 1)); // 0 1

    var t1 = [];
    t1.push(new THREE.Vector2(0, 0)); // 0 1
    t1.push(new THREE.Vector2(1, 0)); // 0 0
    t1.push(new THREE.Vector2(1, 1)); // 1 0

    geometry.faceVertexUvs[0].push(t0);
    geometry.faceVertexUvs[0].push(t1);

    // needed for lighting to work
    geometry.computeFaceNormals();
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();

    return geometry;
}

const untexturedMeshMaterial = new THREE.MeshPhongMaterial();
untexturedMeshMaterial.transparent = true;

const imagePlaceholderGeometry = mappedPlane(1, 1);
const imagePlaceholderTexture = THREE.ImageUtils.loadTexture(placeholderUrl);
// the placeholder texture will not be powers of two size, so we need
// to set our resampling appropriately.
imagePlaceholderTexture.minFilter = THREE.LinearFilter;
const imagePlaceholderMaterial = new THREE.MeshPhongMaterial({
    map: imagePlaceholderTexture
});

export const Image = Backbone.Model.extend({

    defaults: function () {
        return { textureOn: true };
    },

    hasTexture: function() {
        return this.hasOwnProperty('texture');
    },

    hasThumbnail: function() {
        return this.hasOwnProperty('thumbnail');
    },

    hasGeometry: function() {
        return this.hasOwnProperty('geometry');
    },

    isTextureOn: function () {
        return this.hasTexture() && this.get('textureOn');
    },

    initialize: function() {
        var that = this;

        var meshChanged = function () {
            that.trigger('newMeshAvailable');
        };
        this.listenTo(this, 'change:geometry', meshChanged);
        this.listenTo(this, 'change:thumbnail', meshChanged);
        this.listenTo(this, 'change:texture', meshChanged);
        this.listenTo(this, 'change:textureOn', meshChanged);
    },

    mesh: function () {
        // regenerate a THREE.Mesh from the current state. Note that no
        // texture, geometry or material is created in here - we just
        // wire up buffers that we own.
        // Once this asset is no longer required, dispose() can be called to
        // clear all state back up.
        var geometry, material, mesh, up, front, hasGeo, hasTex, hasThumb;
        hasGeo = this.hasGeometry();
        hasTex = this.hasTexture();
        hasThumb = this.hasThumbnail();

        up = UP.image;
        front = FRONT.image;

        // 1. Resolve which geometry should be used.
        if (hasGeo) {
            // actually is a mesh. adjust up and front accordingly.
            up = UP.mesh;
            front = FRONT.mesh;
            geometry = this.geometry;
        } else if (hasTex) {
            geometry = this.textureGeometry;
        } else if (hasThumb) {
            geometry = this.thumbnailGeometry;
        } else {
            // no geometry, no image - use the placeholder
            geometry = imagePlaceholderGeometry;
        }

        // 2. Resolve material
        // First set the defaults.
        if (hasGeo) {
            material = untexturedMeshMaterial;
        } else {
            material = imagePlaceholderMaterial;

        }
        if (hasGeo) {
            // MESH
            if (this.isTextureOn()) {
                // must have either thumbnail or texture.
                if (hasTex) {
                    material = this.texture;
                } else {
                    material = this.thumbnail;
                }
            }
        } else {
            if (hasTex) {
                material = this.texture;
            } else if (hasThumb) {
                material = this.thumbnail;
            }
        }
        mesh = new THREE.Mesh(geometry, material);
        mesh.name = this.id;
        return {
            mesh: mesh,
            up: up,
            front: front
        };
    },

    textureOn: function() {
        if (this.isTextureOn() || !this.hasTexture()) {
            return;  // texture already off or no texture
        }
        this.set('textureOn', true);
    },

    textureOff: function() {
        if (!this.isTextureOn()) {
            return;  // texture already on
        }
        this.set('textureOn', false);
    },

    textureToggle: function () {
        if (this.isTextureOn()) {
            this.textureOff();
        } else {
            this.textureOn();
        }
    },

    loadThumbnail: function () {
        if (!this.hasOwnProperty('_thumbnailPromise')) {
            this._thumbnailPromise = this.get('server').fetchThumbnail(this.id).then((material) => {
                delete this._thumbnailPromise;
                console.log('Asset: loaded thumbnail for ' + this.id);
                this.thumbnail = material;
                var img = material.map.image;
                this.thumbnailGeometry = mappedPlane(img.width, img.height);
                this.trigger('change:thumbnail');
                return material;
            }, () => {
                console.log('Failed to fetch thumbnail for', this.id);
            });
        }
        return this._thumbnailPromise;
    },

    loadTexture: function () {
        if (!this.hasOwnProperty('_texturePromise')) {
            this._texturePromise = this.get('server').fetchTexture(this.id).then((material) => {
                delete this._texturePromise;
                console.log('Asset: loaded texture for ' + this.id);
                this.texture = material;
                const img = material.map.image;
                this.sourceImage = img;
                this.textureGeometry = mappedPlane(img.width, img.height);
                this.trigger('change:texture');
                return material;
            }, () => {
                console.log('Failed to load texture for', this.id);
            });
        }
        return this._texturePromise;
    },

    // reset this asset back to how it was at fetch time.
    dispose: function () {
        if (this.hasGeometry()) {
            this.geometry.dispose();
        }
        if (this.hasTexture()) {
            this.texture.map.dispose();
            this.texture.dispose();
            this.textureGeometry.dispose();

        }
        if (this.hasThumbnail()) {
            this.thumbnail.map.dispose();
            this.thumbnail.dispose();
            this.thumbnailGeometry.dispose();

        }
        // null and delete everything
        this.thumbnailGeometry = null;
        delete this.thumbnailGeometry;

        this.textureGeometry = null;
        delete this.textureGeometry;

        this.geometry = null;
        delete this.geometry;

        this.thumbnail = null;
        delete this.thumbnail;

        this.texture = null;
        delete this.texture;

        this._thumbnailPromise = null;
        delete this._thumbnailPromise;

        this._texturePromise = null;
        delete this._texturePromise;

        this._geometryPromise = null;
        delete this._geometryPromise;
    }
});

export const Mesh = Image.extend({

    geometryUrl: function () {
        return this.get('server').map('meshes/' + this.id);
    },

    loadGeometry: function () {
        if (this.hasOwnProperty('_geometryPromise')) {
            // already loading this geometry
            return this._geometryPromise;
        }
        const arrayPromise = this.get('server').fetchGeometry(this.id);

        if (arrayPromise.isGeometry) { // Backend says it parses the geometry
            this._geometryPromise = arrayPromise.then((geometry) => {
                delete this._geometryPromise;
                geometry.computeBoundingSphere();
                geometry.computeFaceNormals();
                geometry.computeVertexNormals();

                this.geometry = geometry;
                this.trigger('change:geometry');

                return geometry;
            }, (err) => {
                console.log('failed to load geometry (OBJ) for ' + this.id);
                console.log(err);
            });
        } else { // Backend sends raw optimised ArrayBuffer through > build 3D
            this._geometryPromise = arrayPromise.then((buffer) => {
                // now the promise is fullfilled, delete the promise.
                delete this._geometryPromise;
                var geometry;

                var lenMeta = 4;
                var bytes = 4;
                var meta = new Uint32Array(buffer, 0, lenMeta);
                var nTris = meta[0];
                var isTextured = Boolean(meta[1]);
                var hasNormals = Boolean(meta[2]);
                var hasBinning = Boolean(meta[2]);  // used for efficient lookup
                var stride = nTris * 3;

                // Points
                var pointsOffset = lenMeta * bytes;
                var points = new Float32Array(buffer, pointsOffset, stride * 3);
                var normalOffset = pointsOffset + stride * 3 * bytes;

                // Normals (optional)
                var normals = null;  // initialize for no normals
                var tcoordsOffset = normalOffset;  // no normals -> tcoords next
                if (hasNormals) {
                    // correct if has normals
                    normals = new Float32Array(
                        buffer, normalOffset, stride * 3);
                    // need to advance the pointer on tcoords offset
                    tcoordsOffset = normalOffset + stride * 3 * bytes;
                }

                // Tcoords (optional)
                var tcoords = null;  // initialize for no tcoords
                var binningOffset = tcoordsOffset;  // no tcoords -> binning next
                if (isTextured) {
                    tcoords = new Float32Array(
                        buffer, tcoordsOffset, stride * 2);
                    binningOffset = tcoordsOffset + stride * 2 * bytes;
                }

                // Binning (optional)
                if (hasBinning) {
                    console.log(
                        'ready to read from binning file at ',
                        binningOffset
                    );
                }
                geometry = this._newBufferGeometry(points, normals, tcoords);
                console.log('Asset: loaded Geometry for ' + this.id);
                this.geometry = geometry;
                this.trigger('change:geometry');

                return geometry;
            }, (err) => {
                console.log('failed to load geometry (AB) for ' + this.id);
                console.log(err);
            });
        }

        // mirror the arrayPromise xhr() API
        this._geometryPromise.xhr = () => {
            return arrayPromise.xhr ? arrayPromise.xhr() : {abort: () => null};
        };
        // return a promise that this Meshes Geometry will be correctly
        // configured. Can access the raw underlying xhr request at xhr().
        // Aborting this will cause the promise to fail.
        return this._geometryPromise;
    },

    _newBufferGeometry: function(points, normals, tcoords) {
        const geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.BufferAttribute(points, 3));
        if (normals) {
            geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
        } else {
            geometry.computeVertexNormals();
        }
        if (tcoords) {
            geometry.addAttribute('uv', new THREE.BufferAttribute(tcoords, 2));
        }
        geometry.computeBoundingSphere();
        return geometry;
    }

});
