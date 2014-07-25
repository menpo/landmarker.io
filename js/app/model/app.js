var _ = require('underscore');
var Backbone = require('../lib/backbonej');
var Landmark = require('./landmark');
var Template = require('./template');
var Mesh = require('./mesh');
var Image = require('./image');
var Dispatcher = require('./dispatcher');

"use strict";

exports.App = Backbone.Model.extend({

    defaults: function () {
        return {
            landmarkSize: 0.5,
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

    dispatcher: function () {
        return this.get('dispatcher');
    },

    // returns the currently active Mesh.
    mesh: function () {
        return this.get('mesh');
    },

    // returns the currently active Asset (Image or Mesh).
    // changes independently of mesh() - care should be taken as to which one
    // subclasses should listen to.
    asset: function () {
        return this.get('asset');
    },

    assetSource: function () {
        return this.get('assetSource');
    },

    landmarks: function () {
        return this.get('landmarks');
    },

    initialize: function () {
        var that = this;
        var labels = null;
        _.bindAll(this, 'assetChanged', 'dispatcher', 'mesh', 'assetSource',
                        'landmarks');
        this.set('dispatcher', new Dispatcher.Dispatcher);
        // firstly, we need to find out what template we will use.
        // construct a template labels model to go grab the available labels.
        var templateLabels = new Template.TemplateLabels({server: this.server()});
        this.set('templateLabels', templateLabels);
        templateLabels.fetch({
            success: function () {
                labels = templateLabels.get('labels');
                console.log('Available templates are ' + labels + ' setting ' +
                    labels[0] + ' to start');
                that.set('landmarkType', labels[0]);
            },
            error: function () {
                console.log('Failed to talk server for templates (is landmarkerio' +
                    'running from your command line?).');
            }
        });

        // Construct an asset source (which can query for asset information
        // from the server). Of course, we must pass the server in. The
        // asset source will ensure that the assets produced also get
        // attached to this server.
        var assetSource;
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

        // All app state updates are then done in response to the asset
        // and mesh changes on the app
        this.listenTo(this, 'change:landmarkType', this.reloadLandmarks);
        this.listenTo(this, 'change:asset', this.reloadLandmarks);
        this.listenTo(this, 'change:mesh', this.changeMeshAlpha);


        assetSource.fetch({
            success: function () {
                console.log('asset source finished - setting');
                assetSource.setAsset(assetSource.assets().at(0));
            },
            error: function () {
                // load the url module and parse our URL
                var url = require('url');
                var u = url.parse(window.location.href, true);
                u.search = null;
                console.log('Failed to talk to server (is landmarkerio' +
                    'running from your command line?).');
                if (that.meshMode()) {
                    console.log('Restarting in image mode.');
                    u.query.mode = 'image';
                } else {
                    console.log('Restarting in demo mode.');
                    u.query.mode = 'mesh';
                    u.query.server = 'demo'
                }
                window.location.href = url.format(u)
            }
        });

        // TODO this seems messy, do we need this message passing?
        // whenever the user changes the meshAlpha, hit the callback
        this.listenTo(this, 'change:meshAlpha', this.changeMeshAlpha);
    },

    changeMeshAlpha: function () {
        this.mesh().set('alpha', this.get('meshAlpha'));
    },

    // Mirror the state of the asset source onto the app
    assetChanged: function () {
        this.set('asset', this.assetSource().asset());
    },

    meshChanged: function () {
        this.set('mesh', this.assetSource().mesh());
    },

    reloadLandmarks: function () {
        if (!this.get('asset') || !this.get('landmarkType')) {
            // can only proceed with an asset and a landmarkType...
            return;
        }
        // now we have a mesh and landmarkType we can get landmarks -
        // they need to know where to fetch from so attach the server.
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
                    },
                    error: function () {
                        console.log('FATAL ERROR:  could not get the template landmarks!');
                        landmarks.unset('from_template');
                    }
                });
            }
        });
    }

});
