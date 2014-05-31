var _ = require('underscore');
var Backbone = require('backbone');
Backbone.$ = require('jquery');
var THREE = require('three');
var Mesh = require('./mesh');
var Asset = require('./asset');

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
var ImageSource = Asset.AssetSource.extend({

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

    setAsset: function (newImage) {
        // trigger the loading of the full texture
        newImage.loadTexture();
        this.set('asset', newImage);
        if (newImage.mesh()) {
            // image already has a mesh! set it immediately.
            this.setMeshFromImage(newImage)
        } else {
            // keep our ear to the ground and update when there is a change.
            this.listenToOnce(newImage, 'change:mesh', this.setMeshFromImage);
        }
    },

    setMeshFromImage: function (newImage) {
        // the image now has a proper texture, set it.
        this.set('mesh', newImage.mesh());
    }

});

exports.Image = Image;
exports.ImageList = ImageList;
exports.ImageSource = ImageSource;
