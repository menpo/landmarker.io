var _ = require('underscore');
var Backbone = require('backbone');
Backbone.$ = require('jquery');
var THREE = require('three');
var Mesh = require('./mesh');

"use strict";

var Image = Backbone.Model.extend({

    urlRoot: "images",

    url: function () {
        return this.get('server').map(this.urlRoot + '/' + this.id);
    },

    textureUrl: function () {
        return this.get('server').map('textures/' + this.id);
    },

    thumbnailUrl: function () {
        return this.get('server').map('thumbnails/' + this.id);
    },

    mesh: function () {
        return this.get('mesh');
    },

    parse: function (response) {
        var w = response.width;
        var h = response.height;

        var geometry = new THREE.Geometry();
        geometry.vertices.push(new THREE.Vector3(0, h, 0));
        geometry.vertices.push(new THREE.Vector3(w, h, 0));
        geometry.vertices.push(new THREE.Vector3(w, 0, 0));
        geometry.vertices.push(new THREE.Vector3(0, 0, 0));

        geometry.faces.push(new THREE.Face3(0, 1, 2));
        geometry.faces.push(new THREE.Face3(2, 3, 0));

        var material;
        var that = this;
        // Load the thumbnail immediately.
        material = new THREE.MeshPhongMaterial(
            {
                map: THREE.ImageUtils.loadTexture(
                    that.thumbnailUrl(), new THREE.UVMapping(),
                    function() {
                        console.log('loaded thumbnail for ' + that.id);
                        that.trigger("textureSet");
                        that.collection.trigger("thumbnailLoaded");
                    } )
            }
        );

        var t0 = [];
        t0.push(new THREE.Vector2(0, 0)); // 1 0
        t0.push(new THREE.Vector2(1, 0)); // 1 1
        t0.push(new THREE.Vector2(1, 1)); // 0 1

        var t1 = [];
        t1.push(new THREE.Vector2(1, 1)); // 0 1
        t1.push(new THREE.Vector2(0, 1)); // 0 0
        t1.push(new THREE.Vector2(0, 0)); // 1 0

        geometry.faceVertexUvs[0].push(t0);
        geometry.faceVertexUvs[0].push(t1);

        geometry.computeCentroids();
        // needed for lighting to work
        geometry.computeFaceNormals();
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        var t_mesh = new THREE.Mesh(geometry, material);
        return {
            mesh: new Mesh.Mesh(
                {
                    t_mesh: t_mesh,
                    // Set up vector so viewport can rotate
                    up: new THREE.Vector3(0, -1, 0)
                }),
            thumbnailMaterial: material
        };
    },

    loadTexture: function () {
        if (this.get('material')) {
            console.log(this.id + ' already has material. Skipping');
            return;
        }
        var that = this;
        // load the full texture for this image and set it on the mesh
        var material = new THREE.MeshPhongMaterial(
            {
                map: THREE.ImageUtils.loadTexture(
                    that.textureUrl(), new THREE.UVMapping(),
                    function() {
                        that.mesh().t_mesh().material = material;
                        that.set('material', material);
                        // trigger the textureSet causing the viewport to update
                        that.trigger("textureSet");
                    } )
            }
        );
    }

});

var ImageList = Backbone.Collection.extend({
    model: Image
});

// Holds a list of available images, and a ImageList. The ImageList
// is populated immediately, although images aren't fetched until demanded.
// Also has a mesh parameter - the currently active mesh.
var ImageSource = Backbone.Model.extend({

    defaults: function () {
        return {
            assets: new ImageList,
            nPreviews: 0
        };
    },

    initialize : function() {
        this.listenTo(this, "change:assets", this.changeAssets);
    },

    changeAssets: function () {
        this.listenTo(this.get('assets'), "thumbnailLoaded", this.previewCount);
    },

    previewCount : function () {
        this.set('nPreviews', this.get('nPreviews') + 1);
    },

    url: function () {
        return this.get('server').map("images");
    },

    parse: function (response) {
        var that = this;
        var image;
        var images = _.map(response, function (assetId) {
            image =  new Image({
                id: assetId,
                server: that.get('server')
            });
            // fetch the JSON info and thumbnail immediately.
            image.fetch();
            return image;
        });
        var imageList = new ImageList(images);
        return {
            assets: imageList
        };
    },

    mesh: function () {
        return this.get('mesh');
    },

    asset: function () {
        return this.get('asset');
    },

    assets: function () {
        return this.get('assets');
    },

    nAssets: function () {
        return this.get('assets').length;
    },

    nPreviews: function () {
        return this.get('nPreviews');
    },

    next: function () {
        if (!this.hasSuccessor()) {
            return;
        }
        this.setAsset(this.assets().at(this.assetIndex() + 1));
    },

    previous: function () {
        if (!this.hasPredecessor()) {
            return;
        }
        this.setAsset(this.assets().at(this.assetIndex() - 1));
    },

    setAsset: function (newImage) {
        // trigger the loading of the full texture
        newImage.loadTexture();
        this.set('asset', newImage);
        if (newImage.mesh()) {
            // image already has a mesh! set it immediately.
            this.setMesh(newImage)
        } else {
            // keep our ear to the ground and update when there is a change.
            this.listenToOnce(newImage, 'change:mesh', this.setMesh);
        }
    },

    setMesh: function (newImage) {
        // the image now has a mesh, set it.
        this.set('mesh', newImage.mesh());
    },

    hasPredecessor: function () {
        return this.assetIndex() !== 0;
    },

    hasSuccessor: function () {
        return this.nAssets() - this.assetIndex() !== 1;
    },

    // returns the index of the currently active mesh
    assetIndex: function () {
        return this.assets().indexOf(this.get('asset'));
    }
});

exports.Image = Image;
exports.ImageList = ImageList;
exports.ImageSource = ImageSource;
