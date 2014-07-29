var _ = require('underscore');
var Backbone = require('../lib/backbonej');
var THREE = require('three');
var Asset = require('./asset');
var Image = require('./image');
var getArray = require('../lib/get');

"use strict";

var basicMaterial = new THREE.MeshPhongMaterial();
basicMaterial.transparent = true;


var Mesh = Backbone.Model.extend({

    defaults : function () {
        return {
            alpha : 1,
            up : new THREE.Vector3(0, 1, 0),
            front : new THREE.Vector3(0, 0, 1)
        }
    },

    urlRoot: "meshes",

    initialize : function() {
        _.bindAll(this, 'changeAlpha', 'loadThumbnail', 'dispose',
                  'wireframeToggle');
        this.listenTo(this, "change:alpha", this.changeAlpha);
    },

    url: function () {
        return this.get('server').map(this.urlRoot + '/' + this.id);
    },

    up: function () {
        return this.get('up');
    },

    front: function () {
        return this.get('front');
    },

    alpha: function () {
        return this.get('alpha');
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

    isWireframeOn: function () {
        return this.get('t_mesh').material.wireframe;
    },

    textureOn: function() {
        if (this.isTextureOn() || !this.hasTexture()) {
            return;  // texture already off or no texture
        }
        var wf = this.isWireframeOn();
        this.get('t_mesh').material = this.get('texture');
        if (wf) {
            this.wireframeOn();
        } else {
            this.wireframeOff();
        }
        this.changeAlpha();
        this.set('textureOn', true);
    },

    textureOff: function() {
        if (!this.isTextureOn()) {
            return;  // texture already on
        }
        var wf = this.isWireframeOn();
        this.get('t_mesh').material = basicMaterial;
        if (wf) {
            this.wireframeOn();
        } else {
            this.wireframeOff();
        }
        this.changeAlpha();
        this.set('textureOn', false);
    },

    textureToggle: function () {
        if (this.isTextureOn()) {
            this.textureOff();
        } else {
            this.textureOn();
        }
    },

    wireframeOn: function() {
        if (this.isWireframeOn()) {
            return;
        }
        this.get('t_mesh').material.wireframe = true;
        this.set('wireframeOn', true);
        this.changeAlpha();
    },

    wireframeOff: function() {
        if (!this.isWireframeOn()) {
            return;
        }
        this.get('t_mesh').material.wireframe = false;
        this.set('wireframeOn', false);
        this.changeAlpha();
    },

    wireframeToggle: function () {
        if (this.isWireframeOn()) {
            this.wireframeOff();
        } else {
            this.wireframeOn();
        }
    },

    toJSON: function () {
        var trilist = _.map(this.get('t_mesh').geometry.faces, function (face) {
            return [face.a, face.b, face.c];
        });

        var points = _.map(this.get('t_mesh').geometry.vertices, function (v) {
            return [v.x, v.y, v.z];
        });

        return {
            points: points,
            trilist: trilist
        };
    },

    changeAlpha: function () {
        this.get('t_mesh').material.opacity = this.get('alpha');
    },

    parseBuffer: function () {
        var promise = getArray(this.url());
        var that = this;
        promise.then(function (buffer) {
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

            return that._newBufferMesh(points, normals, tcoords);
        }).catch(function () {
            console.log('something went wrong');
        });
        return promise;
    },

    _newBufferMesh: function(points, normals, tcoords) {
        console.log('in new buffer mesh');
        window.points = points;
        var geometry = new THREE.BufferGeometry();
        geometry.addAttribute('position', new THREE.BufferAttribute(points, 3));
        if (normals) {
            geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
        } else {
            geometry.computeVertexNormals();
        }
        var material;
        var result;
        var that = this;
        if (tcoords) {
            geometry.addAttribute('uv', new THREE.BufferAttribute(tcoords, 2));
            // this mesh has a texture - grab it
            var textureURL = this.get('server').map('textures/' + this.id);
            material = new THREE.MeshBasicMaterial(
                {
                    map: THREE.ImageUtils.loadTexture(textureURL,
                        new THREE.UVMapping(),
                        function() {that.trigger("change:texture");}
                    )
                }
            );
            material.transparent = true;
            result = {
                t_mesh: new THREE.Mesh(geometry, material),
                texture: material,
                textureOn: true
            };
        } else {
            // default to basic Phong lighting
            result = {
                t_mesh: new THREE.Mesh(geometry, basicMaterial)
            };
        }
        geometry.computeBoundingSphere();
        result.t_mesh.name = this.id;
        return this.set(result);
    },

    loadThumbnail: function () {
        var that = this;
        var image = new Image.Image({
            id: this.id,
            server: this.get('server'),
            thumbnailDelegate: this.collection
        });
        // load the thumbnail for this mesh
        image.fetch({
            success: function () {
                console.log('grabbed thumbnail preview!');
                that.set('thumbnail', image);
            },
            error: function () {
                // couldn't load a thumbnail - must be an untextured mesh!
                // trigger the thumbnail loaded so our progress bar finishes
                that.collection.trigger('thumbnailLoaded');
            }
        });
    },

    // reset this mesh back to how it was at fetch time.
    dispose : function () {
        var texture;
        this.get('t_mesh').geometry.dispose();
        if (this.hasTexture()) {
            texture = this.get('texture');
            texture.map.dispose();
            texture.dispose();
            this.unset('texture');
        }
        this.unset('t_mesh');
        this._previousAttributes = {};
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
        // kill any current fetches
        _.each(this.pending, function (xhr) {
            xhr.abort();
        }, this);
        this.set('assetIsLoading', true);
        // set the asset immediately (triggering change in UI, landmark fetch)
        that.set('asset', newMesh);
        if (newMesh.hasThumbnail()) {
            console.log('setting mesh to thumbnail');
            that.set('mesh', newMesh.get('thumbnail').get('mesh'));
        }
        // fetch the new asset and update the mesh when the fetch is complete
        var promise = newMesh.parseBuffer();
        this.pending[newMesh.id] = promise.xhr();
        promise.then(function () {
                console.log('grabbed new mesh');
                // once the mesh is downloaded, advance the mesh.
                that.set('mesh', newMesh);
                // now everyone has moved onto the new mesh, clean up the old
                // one.
                if (oldAsset) {
                    oldAsset.dispose();
                    oldAsset = null;
                }
                delete that.pending[newMesh.id];
                that.set('assetIsLoading', false);
        });
    }
});

exports.Mesh = Mesh;
exports.MeshList = MeshList;
exports.MeshSource = MeshSource;
