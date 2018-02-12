'use strict';

import _ from 'underscore';
import THREE from 'three';
import Backbone from 'backbone';

// the default scale for 1.0
const LM_SCALE = 0.01;

const LM_SPHERE_PARTS = 10;
const LM_SPHERE_SELECTED_COLOR = 0xff75ff;
const LM_SPHERE_UNSELECTED_COLOR = 0x3ACC3A;
const LM_CONNECTION_LINE_COLOR = LM_SPHERE_UNSELECTED_COLOR;
const LM_CONNECTION_LINE_COLOR_INVISIBLE = 0xffff00;
const LM_CONNECTION_LINE_COLOR_BAD = 0xFF0000;

// create a single geometry + material that will be shared by all landmarks
var lmGeometry = new THREE.SphereGeometry(
    LM_SCALE,
    LM_SPHERE_PARTS,
    LM_SPHERE_PARTS);

var lmMaterialForSelected = {
    true: new THREE.MeshBasicMaterial({color: LM_SPHERE_SELECTED_COLOR}),
    false: new THREE.MeshBasicMaterial({color: LM_SPHERE_UNSELECTED_COLOR})
};

var lineMaterial = new THREE.LineBasicMaterial({
    color: LM_CONNECTION_LINE_COLOR,
    linewidth: 1
});

export const LandmarkTHREEView = Backbone.View.extend({

    initialize: function (options) {
        _.bindAll(this, 'render', 'changeLandmarkSize');
        this.listenTo(this.model, "change", this.render);
        this.viewport = options.viewport;
        this.app = this.viewport.model;
        this.listenTo(this.app, "change:landmarkSize", this.changeLandmarkSize);
        this.symbol = null; // a THREE object that represents this landmark.
        // null if the landmark isEmpty
        this.render();
    },

    render: function () {
        if (this.symbol) {
            // this landmark already has an allocated representation..
            if (this.model.isEmpty()) {
                // but it's been deleted.
                this.dispose();
            } else {
                // the lm may need updating. See what needs to be done
                this.updateSymbol();
            }
        } else {
            // there is no symbol yet
            if (!this.model.isEmpty()) {
                // and there should be! Make it and update it
                this.symbol = this.createSphere(this.model.get('point'), true);
                this.updateSymbol();
                // trigger changeLandmarkSize to make sure sizing is correct
                this.changeLandmarkSize();
                // and add it to the scene
                this.viewport.sLms.add(this.symbol);
            }
        }
        // tell our viewport to update
        this.viewport.update();
    },

    createSphere: function (v, radius, selected) {
        //console.log('creating sphere of radius ' + radius);
        if(this.model.attributes.bad){
            lmMaterialForSelected.false = new THREE.MeshBasicMaterial({color: LM_CONNECTION_LINE_COLOR_BAD})
        } else if(this.model.attributes.invisible) {
            lmMaterialForSelected.false = new THREE.MeshBasicMaterial({color: LM_CONNECTION_LINE_COLOR_INVISIBLE})
        } else {
            lmMaterialForSelected.false = new THREE.MeshBasicMaterial({color: LM_CONNECTION_LINE_COLOR})
        }
        var landmark = new THREE.Mesh(lmGeometry, lmMaterialForSelected[selected]);
        landmark.name = 'Landmark ' + landmark.id;
        landmark.position.copy(v);
        return landmark;
    },

    updateSymbol: function () {
        this.symbol.position.copy(this.model.point());
        var selected = this.model.isSelected();
        this.symbol.material = lmMaterialForSelected[selected];
    },

    dispose: function () {
        if (this.symbol) {
            this.viewport.sLms.remove(this.symbol);
            // console.log(this.viewport)
            this.symbol = null;
        }
    },

    changeLandmarkSize: function () {
        if (this.symbol) {
            // have a symbol, and need to change it's size.
            var r = this.app.get('landmarkSize') * this.viewport.meshScale;
            this.symbol.scale.set(r, r, r);
            // tell our viewport to update
            this.viewport.update();
        }
    }
});

export const LandmarkConnectionTHREEView = Backbone.View.extend({

    initialize: function (options) {
        // Listen to both models for changes
        this.listenTo(this.model[0], "change", this.render);
        this.listenTo(this.model[1], "change", this.render);
        this.viewport = options.viewport;
        this.symbol = null; // a THREE object that represents this connection.
        // null if the landmark isEmpty
        this.render();
    },

    render: function () {
        if (this.symbol !== null) {
            // this landmark already has an allocated representation..
            if(this.model[0] || this.model[1]){
                if (this.model[0].isEmpty() || this.model[1].isEmpty()) {
                    // but it's been deleted.
                    this.dispose();

                } else {
                    // the connection may need updating. See what needs to be done
                    this.updateSymbol();
                }
            }
        } else {
            // there is no symbol yet
            if(this.model[0] && this.model[1]){
            if (!this.model[0].isEmpty() && !this.model[1].isEmpty()) {
                // and there should be! Make it and update it

                this.symbol = this.createLine(this.model[0].get('point'),
                this.model[1].get('point'));
                this.updateSymbol();
                // and add it to the scene
                this.viewport.sLmsConnectivity.add(this.symbol);
            }
        }
        }
        // tell our viewport to update
        this.viewport.update();
    },

    createLine: function (start, end) {


        var geometry = new THREE.Geometry();
        geometry.dynamic = true;
        geometry.vertices.push(start.clone());
        geometry.vertices.push(end.clone());

        if(this.model[1].attributes.bad && this.model[0].attributes.bad){
            lineMaterial = new THREE.LineBasicMaterial({
                color: LM_CONNECTION_LINE_COLOR_BAD,
                linewidth: 1
            });
        } else if(this.model[1].attributes.invisible && this.model[0].attributes.invisible) {
            lineMaterial = new THREE.LineBasicMaterial({
                color: LM_CONNECTION_LINE_COLOR_INVISIBLE,
                linewidth: 1});
        } else {
            lineMaterial = new THREE.LineBasicMaterial({
                color: LM_CONNECTION_LINE_COLOR,
                linewidth: 1
            });
        }
        return new THREE.Line(geometry, lineMaterial);
    },

    dispose: function () {
        if (this.symbol) {
            this.viewport.sLmsConnectivity.remove(this.symbol);
            this.symbol.geometry.dispose();
            this.symbol = null;
        }
    },

    updateSymbol: function () {
        this.symbol.geometry.vertices[0].copy(this.model[0].point());
        this.symbol.geometry.vertices[1].copy(this.model[1].point());
        this.symbol.geometry.verticesNeedUpdate = true;
    }
});
