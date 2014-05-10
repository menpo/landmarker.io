var _ = require('underscore');
var Backbone = require('backbone');
Backbone.$ = require('jquery');
var THREE = require('three');
var Mesh = require('./mesh');

"use strict";

var Image = Backbone.Model.extend({

    // TODO change to images
    urlRoot: "textures",

    url: function () {
        return this.get('server').map(this.urlRoot + '/' + this.id);
    },

    mesh: function () {
        return this.get('mesh');
    },

    load: function () {
        var geometry = new THREE.Geometry();
        geometry.vertices.push(new THREE.Vector3(1, 0, 0));
        geometry.vertices.push(new THREE.Vector3(1, 1, 0));
        geometry.vertices.push(new THREE.Vector3(0, 1, 0));
        geometry.vertices.push(new THREE.Vector3(0, 0, 0));

        geometry.faces.push(new THREE.Face3(0, 1, 2));
        geometry.faces.push(new THREE.Face3(2, 3, 0));

        var material;
        var that = this;
        material = new THREE.MeshPhongMaterial(
            {
                map: THREE.ImageUtils.loadTexture(
                    that.url(), new THREE.UVMapping(),
                    function() {
                        that.trigger("textureSet");
                    } )
            }
        );
        material.transparent = true;

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
        this.set('mesh', new Mesh.Mesh(
            {
                t_mesh: t_mesh,
                // Images point the other way
                up: new THREE.Vector3(1, 0, 0)
            }));
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
            assets: new ImageList
        };
    },

    url: function () {
        // TODO change to images
        return this.get('server').map("textures");
    },

    parse: function (response) {
        var that = this;
        var images = _.map(response, function (assetId) {
            return new Image({
                id: assetId,
                server: that.get('server')
            })
        });
        var imageList = new ImageList(images);
        return {
            assets: imageList
        };
    },

    mesh: function () {
        // TODO this needs to return a real mesh object
        return this.asset().mesh();
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
        // Trigger the loading of the texture
        newImage.load();
        console.log('loaded new image');
        this.set('asset', newImage);
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
