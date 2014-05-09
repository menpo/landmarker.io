var _ = require('underscore');
var Backbone = require('backbone');
var Landmark = require('./landmark');
var Mesh = require('./mesh');
var Dispatcher = require('./dispatcher');

"use strict";

exports.App = Backbone.Model.extend({

    defaults: function () {
        return {
            landmarkType: 'ibug68',
            landmarkScale: 1,
            meshAlpha: 1
        }
    },

    server: function () {
        return this.get('server');
    },

    initialize: function () {
        _.bindAll(this, 'meshChanged', 'dispatcher', 'mesh', 'meshSource',
                        'landmarks');
        this.set('dispatcher', new Dispatcher.Dispatcher);
        // construct a mesh source (which can query for mesh information
        // from the server). Of course, we must pass the server in. The
        // mesh source will ensure that the meshes produced also get
        // attached to this server.
        this.set('meshSource', new Mesh.MeshSource(
            {
                server:this.server()
            }
        ));
        var meshSource = this.get('meshSource');
        var that = this;
        meshSource.fetch({
            success: function () {
                var meshSource = that.get('meshSource');
                meshSource.setMesh(meshSource.get('meshes').at(0));
            },
            error: function () {
                console.log('Failed to talk localhost:5000 (is landmarkerio' +
                    'running from your command line?).');
                console.log('Restarting in demo mode.');
                window.location.href = window.location.href + '?mode=demo'
            }
        });
        // whenever our mesh source changes it's current mesh we need
        // to run the application logic.
        this.listenTo(meshSource, 'change:mesh', this.meshChanged);
        this.listenTo(this, 'change:meshAlpha', this.changeMeshAlpha);
    },

    changeMeshAlpha: function () {
        this.mesh().set('alpha', this.get('meshAlpha'));
    },

    dispatcher: function () {
        return this.get('dispatcher');
    },

    meshChanged: function () {
        console.log('mesh has been changed on the meshSource!');
        this.set('mesh', this.get('meshSource').get('mesh'));
        // make sure the new mesh has the right alpha setting
        this.changeMeshAlpha();
        // build new landmarks - they need to know where to fetch from
        // so attach the server.
        var landmarks = new Landmark.LandmarkSet(
            {
                id: this.mesh().id,
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

    mesh: function () {
        return this.get('mesh');
    },

    meshSource: function () {
        return this.get('meshSource');
    },

    landmarks: function () {
        return this.get('landmarks');
    }
});
