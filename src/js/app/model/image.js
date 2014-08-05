var _ = require('underscore');
var Backbone = require('../lib/backbonej');
var loadImage = require('../lib/image');
var THREE = require('three');
var Mesh = require('./mesh');
var Asset = require('./asset');

"use strict";

//var placeholderMesh = imageMesh('./img/placeholder.jpg');
//
//placeholderMesh.then(function (mesh) {
//    window.tempMesh = mesh;
//});


var Image = Backbone.Model.extend({

    parse: function (response) {
        var w = response.width;
        var h = response.height;

        var geometry = new THREE.Geometry();
        geometry.vertices.push(new THREE.Vector3(0, 0, 0));
        geometry.vertices.push(new THREE.Vector3(h, 0, 0));
        geometry.vertices.push(new THREE.Vector3(h, w, 0));
        geometry.vertices.push(new THREE.Vector3(0, w, 0));

        geometry.faces.push(new THREE.Face3(0, 1, 3));
        geometry.faces.push(new THREE.Face3(1, 2, 3));

        var material;
        var that = this;
        // Load the thumbnail immediately.
        material = new THREE.MeshPhongMaterial(
            {
                map: THREE.ImageUtils.loadTexture(
                    that.thumbnailUrl(), new THREE.UVMapping(),
                    function() {
                        console.log('loaded thumbnail for ' + that.id);
                        that.get('mesh').trigger("change:texture");
                        // If we have a thumbnail delegate then trigger the change
                        if (that.has('thumbnailDelegate')) {
                            that.get('thumbnailDelegate').trigger('thumbnailLoaded');
                        }
                    } )
            }
        );

        var t_mesh = new THREE.Mesh(geometry, material);
        return {
            mesh: new Mesh.Mesh(
                {
                    t_mesh: t_mesh,
                    // Set up vector so viewport can rotate
                    up: new THREE.Vector3(1, 0, 0)

                }),
            thumbnailMaterial: material
        };
    },

    loadThumbnail: function () {
        var that = this;
        return imageMesh(this.thumbnailUrl()).then(function(mesh) {
            console.log('loaded thumbnail for ' + that.id);
            that.get('mesh').trigger("change:texture");
            // If we have a thumbnail delegate then trigger the change
            if (that.has('thumbnailDelegate')) {
                that.get('thumbnailDelegate').trigger('thumbnailLoaded');
            }
            that.set({
                mesh: new Mesh.Mesh(
                    {
                        t_mesh: mesh,
                        // Set up vector so viewport can rotate
                        up: new THREE.Vector3(1, 0, 0)

                    }),
                thumbnailMaterial: mesh.material
            });
        });
    },

    loadTexture: function () {
        var existingMaterial = this.get('material');
        if (existingMaterial) {
            console.log(this.id + ' already has material. Skipping');
            return new Promise(function(resolve) {
                resolve(existingMaterial);
            });
        }
        // load the full texture for this image and set it on the mesh
        var that = this;
        return loadImage(this.textureUrl()).then(function(material) {
                that.get('mesh').get('t_mesh').material = material;
                that.set('material', material);
                // trigger the texture change on our mesh
                that.get('mesh').trigger("change:texture");
            });
    },


});

var ImageList = Backbone.Collection.extend({
    model: Image
});

// Holds a list of available images, and a ImageList. The ImageList
// is populated immediately, although images aren't fetched until demanded.
// Also has a mesh parameter - the currently active mesh.
var ImageSource = Asset.AssetSource.extend({

    parse: function (response) {
        var that = this;
        var image;
        var imageList = new ImageList();
        var images = _.map(response, function (assetId) {
            image =  new Image({
                id: assetId,
                server: that.get('server'),
                thumbnailDelegate: imageList
            });
            return image;
        });
        imageList.add(images);
        return {
            assets: imageList
        };
    },

    _changeAssets: function () {
        this.get('assets').each(function(image) {
            // after change in assets always call fetch to acquire thumbnails
            image.loadThumbnail();
        })
    },

    setAsset: function (newImage) {
        var that = this;
        var oldAsset = this.get('asset');
        this.set('assetIsLoading', true);
        // trigger the loading of the full texture
        newImage.loadTexture().then(function () {
            that.set('assetIsLoading', false);
            if (oldAsset) {
                oldAsset.dispose();
            }
        });
        this.set('asset', newImage);
        if (newImage.has('mesh')) {
            // image already has a mesh! set it immediately.
            this.setMeshFromImage(newImage);
        } else {
            // keep our ear to the ground and update when there is a change.
            this.listenToOnce(newImage, 'change:mesh', this.setMeshFromImage);
        }
    },

    setMeshFromImage: function (newImage) {
        // the image now has a proper texture, set it.
        this.set('mesh', newImage.get('mesh'));
    }

});

exports.Image = Image;
exports.ImageList = ImageList;
exports.ImageSource = ImageSource;
