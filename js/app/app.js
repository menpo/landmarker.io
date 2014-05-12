var _ = require('underscore');
var Backbone = require('backbone');
var Landmark = require('./landmark');
var Mesh = require('./mesh');
var Image = require('./image');
var Dispatcher = require('./dispatcher');

"use strict";

exports.App = Backbone.Model.extend({

    defaults: function () {
        return {
            // TODO remove default landmarkType as ibug68
            landmarkType: 'ibug68',
            landmarkScale: 1,
            meshAlpha: 1,
            mode: 'mesh'
        }
    },

    imageMode: function () {
        return this.get('mode') === 'image';
    },

    meshMode: function () {
        return this.get('mode') === 'mesh';
    },

    server: function () {
        return this.get('server');
    },

    initialize: function () {
        _.bindAll(this, 'assetChanged', 'dispatcher', 'mesh', 'assetSource',
                        'landmarks');
        this.set('dispatcher', new Dispatcher.Dispatcher);
        // Construct an asset source (which can query for asset information
        // from the server). Of course, we must pass the server in. The
        // asset source will ensure that the assets produced also get
        // attached to this server.
        var assetSource;
        var that = this;
        if (this.imageMode()) {
            // In image mode, the asset source is an ImageSource
            console.log('App in image mode - creating image source');
            assetSource = new Image.ImageSource({ server: this.server() });
        } else if (this.meshMode()){
            // In mesh mode, the asset source is a MeshSource
            console.log('App in mesh mode - creating mesh source');
            assetSource = new Mesh.MeshSource({ server: this.server() });
        } else {
            console.error('WARNING - illegal mode setting on app! Must be' +
                ' mesh or image');
        }
        this.set('assetSource', assetSource);
        // whenever our asset source changes it's current asset and mesh we need
        // to update the app state.
        this.listenTo(assetSource, 'change:asset', this.assetChanged);
        this.listenTo(assetSource, 'change:mesh', this.meshChanged);
        assetSource.fetch({
            success: function () {
                console.log('asset source finished - setting');
                assetSource.setAsset(assetSource.assets().at(0));
            },
            error: function () {
                console.log('Failed to talk localhost:5000 (is landmarkerio' +
                    'running from your command line?).');
                if (that.meshMode()) {
                    console.log('Restarting in image mode.');
                    window.location.href = window.location.href + '?mode=image'
                } else {
                    console.log('Restarting in demo mode.');
                    window.location.href = window.location.href + '?server=demo'
                }
            }
        });

        // TODO this seems messy, do we need this message passing?
        // whenever the user changes the meshAlpha, hit the callback
        this.listenTo(this, 'change:meshAlpha', this.changeMeshAlpha);
    },

    changeMeshAlpha: function () {
        this.mesh().set('alpha', this.get('meshAlpha'));
    },

    dispatcher: function () {
        return this.get('dispatcher');
    },

    assetChanged: function () {
        console.log('asset has been changed on the assetSource!');
        this.set('asset', this.assetSource().asset());
    },

    meshChanged: function () {
        console.log('mesh has been changed on the assetSource!');
        this.set('mesh', this.assetSource().mesh());
        // make sure the new mesh has the right alpha setting
        this.changeMeshAlpha();
        // now we have a mesh we can get landmarks - they need to know where
        // to fetch from so attach the server.
        // note that mesh changes are guaranteed to happen after asset changes,
        // so we are safe that this.asset() contains the correct asset id
        var landmarks = new Landmark.LandmarkSet(
            {
                id: this.asset().id,
                type: this.get('landmarkType'),
                server: this.get('server')
            }
        );
        var that = this;
        landmarks.fetch({
            success: function () {
                console.log('got the landmarks!');
                that.set('landmarks', landmarks);
            },
            error: function () {
                // can't find landmarks for this person! Grab the template
                // instead
                console.log("couldn't get the landmarks");
                landmarks.set('from_template', 'true');
                landmarks.fetch({
                    success: function () {
                        console.log('got the template landmarks!');
                        that.set('landmarks', landmarks);
                        landmarks.unset('from_template');
                    }
                });
            }
        });
    },

    // returns the currently active Mesh.
    mesh: function () {
        return this.get('mesh');
    },

    // returns the currently active Asset (Image or Mesh).
    // changes independently of mesh() - care should be taken as to which one
    // subclasses should listen to.
    asset: function () {
        return this.get('mesh');
    },

    assetSource: function () {
        return this.get('assetSource');
    },

    landmarks: function () {
        return this.get('landmarks');
    }

});
