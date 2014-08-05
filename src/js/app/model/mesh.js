var R = require('ramda');
var _ = require('underscore');
var Backbone = require('../lib/backbonej');
var THREE = require('three');
var Asset = require('./asset');

var getArray = require('../lib/get');
var loadImage = require('../lib/image');

"use strict";

var abortAll = R.each(function (x) {
    x.abort();
});

var extractABC = R.map(function (f) {
    return [f.a, f.b, f.c];
});

var extractXYZ = R.map(function (v) {
    return [v.x, v.y, v.z];
});

var FRONT = {
    image: new THREE.Vector3(0, 0, 1),
    mesh: new THREE.Vector3(0, 0, 1)
};

var UP = {
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

var untexturedMeshMaterial = new THREE.MeshPhongMaterial();
untexturedMeshMaterial.transparent = true;

var imagePlaceholderGeometry = mappedPlane(1, 1);
var imagePlaceholderMaterial = new THREE.MeshPhongMaterial(
    {
        map: THREE.ImageUtils.loadTexture('./img/placeholder.jpg',
            new THREE.UVMapping())
    }
);


var Image = Backbone.Model.extend({

    defaults : function () {
        return {
            textureOn : true
        }
    },

    thumbnailUrl: function () {
        return this.get('server').map('thumbnails/' + this.id);
    },

    textureUrl: function () {
        return this.get('server').map('textures/' + this.id);
    },

    hasTexture: function() {
        return this.has('texture');
    },

    hasThumbnail: function() {
        return this.has('thumbnail');
    },

    isTextureOn: function () {
        return this.hasTexture() && this.get('textureOn');
    },

    initialize : function() {
        var that = this;

        var meshChanged = function () {
            that.trigger('meshChanged');
        };
        this.listenTo(this, 'change:geometry', meshChanged);
        this.listenTo(this, 'change:thumbnail', meshChanged);
        this.listenTo(this, 'change:texture', meshChanged);
        this.listenTo(this, 'change:textureOn', meshChanged);
    },

    mesh: function () {
        var geometry, material, image, mesh, up, front, hasGeo, hasTex, hasThumb;
        hasGeo = this.has('geometry');
        hasTex = this.has('texture');
        hasThumb = this.has('thumb');

        up = UP.image;
        front = FRONT.image;

        // 1. Resolve geometry
        if (hasGeo) {
            geometry = this.get('geometry');
            up = UP.mesh;
            front = FRONT.mesh;
        } else if (hasTex || hasThumb) {
            // there is some kind of texture set, use that to build the
            // appropriate sized geometry
            if (hasTex) {
                image = this.get('texture').map.image;
            } else {
                image = this.get('thumbnail').map.image;
            }
            geometry = mappedPlane(image.width, image.height);
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
                if (this.has('texture')) {
                    material = this.get('texture');
                } else {
                    material = this.get('thumbnail');
                }
            }
        } else {
            if (this.has('texture')) {
                material = this.get('texture');
            } else if (this.has('thumbnail')) {
                material = this.get('thumbnail');
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
        this.trigger('meshChanged');
    },

    textureOff: function() {
        if (!this.isTextureOn()) {
            return;  // texture already on
        }
        this.set('textureOn', false);
        this.trigger('meshChanged');
    },

    textureToggle: function () {
        if (this.isTextureOn()) {
            this.textureOff();
        } else {
            this.textureOn();
        }
    },

    toJSON: function () {
        return {
            points: extractXYZ(this.get('t_mesh').geometry.vertices),
            trilist: extractABC(this.get('t_mesh').geometry.faces)
        };
    },

    loadThumbnail: function () {
        var that = this;
        return loadImage(this.thumbnailUrl()).then(function(material) {
            console.log('Mesh: loaded thumbnail for ' + that.id);
            that.set('thumbnail', material);
            return material;
        });
    },

    loadTexture: function () {
        var existingTexture = this.get('texture');
        if (existingTexture) {
            console.log(this.id + ' already has texture. Skipping');
            return new Promise(function(resolve) {
                resolve(existingTexture);
            });
        }
        var that = this;
        return loadImage(this.textureUrl()).then(function(material) {
            console.log('Mesh: loaded texture for ' + that.id);
            that.set('texture', material);
            return material;
        });
    }

//    // reset this mesh back to how it was at fetch time.
//    dispose : function () {
//        var texture;
//        this.get('t_mesh').geometry.dispose();
//        if (this.hasTexture()) {
//            texture = this.get('texture');
//            texture.map.dispose();
//            texture.dispose();
//            this.unset('texture');
//        }
//
//        this.get('mesh').get('t_mesh').material = this.get('thumbnailMaterial');
//        // dispose of the old texture
//        if (this.has('material')) {
//            var m = this.get('material');
//            // if there was a texture mapping (likely!) dispose of it
//            if (m.map) {
//                m.map.dispose();
//            }
//            // dispose of the material itself.
//            m.dispose();
//            this.unset('material');
//        }
//    }
});


var Mesh = Image.extend({

    geometryUrl: function () {
        return this.get('server').map('meshes/' + this.id);
    },

    loadGeometry: function () {
        var that = this;
        return getArray(this.geometryUrl()).then(function (buffer) {
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
                normals = new Float32Array(buffer, normalOffset, stride * 3);
                // need to advance the pointer on tcoords offset
                tcoordsOffset = normalOffset + stride * 3 * bytes;
            }

            // Tcoords (optional)
            var tcoords = null;  // initialize for no tcoords
            var binningOffset = tcoordsOffset;  // no tcoords -> binning next
            if (isTextured) {
                tcoords = new Float32Array(buffer, tcoordsOffset, stride * 2);
                binningOffset = tcoordsOffset + stride * 2 * bytes;
            }

            // Binning (optional)
            if (hasBinning) {
                console.log('ready to read from binning file at ' + binningOffset)
            }
            geometry = that._newBufferGeometry(points, normals, tcoords);
            console.log('Mesh: loaded Geometry for ' + that.id);
            that.set('geometry', geometry);

            return geometry;
        }, function () {
            console.log('failed to load geometry for ' + that.id);
        });
    },

    _newBufferGeometry: function(points, normals, tcoords) {
        var geometry = new THREE.BufferGeometry();
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

var MeshList = Backbone.Collection.extend({
    model: Mesh
});

// Holds a list of available meshes, and a MeshList. The MeshList
// is populated immediately, although meshes aren't fetched until demanded.
// Also has a mesh parameter - the currently active mesh.
var MeshSource = Asset.AssetSource.extend({

    parse: function (response) {
        var that = this;
        var mesh;
        var meshes = _.map(response, function (assetId) {
            mesh = new Mesh({
                id: assetId,
                server: that.get('server')
            });
            return mesh;
        });
        var meshList = new MeshList(meshes.slice(0, 100));
        return {
            assets: meshList
        };
    },

    _changeAssets: function () {
        this.assets().each(function(mesh) {
            // immediately load the preview texture for the mesh
            // TODO this may need to be less agressive on large datasets
            mesh.loadThumbnail();
        })
    },

    setAsset: function (newMesh) {
        var that = this;
        var oldAsset = this.get('asset');
        // stop listening to the old asset
        if (oldAsset) {
            this.stopListening(oldAsset);
        }
        // kill any current fetches
//        abortAll(this.pending);
        this.set('assetIsLoading', true);
        // set the asset immediately (triggering change in UI)
        that.set('asset', newMesh);

        this.listenTo(newMesh, 'meshChanged', this.updateMesh);

        // update the mesh immediately (so we get a placeholder if nothing else)
        this.updateMesh();

        // fetch the thumbnail and texture aggressively asynchronously.
        // TODO should track the thumbnail here too
        var thumbnail = newMesh.loadThumbnail();
        var texture = newMesh.loadTexture();
        // fetch the geometry
        var geometry = newMesh.loadGeometry();

        // track the request
//        this.pending[newMesh.id] = geometry.xhr();
        geometry.then(function () {
                console.log('grabbed new mesh geometry');
                // now everyone has moved onto the new mesh, clean up the old
                // one.
                if (oldAsset) {
                    oldAsset.dispose();
                    oldAsset = null;
                }
//                delete that.pending[newMesh.id];
                that.set('assetIsLoading', false);
        }, function (err) {
            console.log('geometry.then something went wrong ' + err.stack);
        });
        // return the geometry promise
        return geometry;
    },

    updateMesh: function () {
        console.log('MeshSource.updateMesh');
        this.set('mesh', this.get('asset').mesh());
    }
});

exports.Mesh = Mesh;
exports.MeshList = MeshList;
exports.MeshSource = MeshSource;
