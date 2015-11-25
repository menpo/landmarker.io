'use strict';

import _ from 'underscore';
import THREE from 'three';
import Backbone from 'backbone';

// the default scale for 1.0
const LM_SCALE = 0.01;

const LM_SPHERE_PARTS = 10;
const LM_SPHERE_SELECTED_COLOR = 0xff75ff;
const LM_SPHERE_UNSELECTED_COLOR = 0xffff00;
const LM_CONNECTION_LINE_COLOR = LM_SPHERE_UNSELECTED_COLOR;

// create a single geometry + material that will be shared by all landmarks
const lmGeometry = new THREE.SphereGeometry(
    LM_SCALE,
    LM_SPHERE_PARTS,
    LM_SPHERE_PARTS);

const lmMaterialForSelected = {
    true: new THREE.MeshBasicMaterial({color: LM_SPHERE_SELECTED_COLOR}),
    false: new THREE.MeshBasicMaterial({color: LM_SPHERE_UNSELECTED_COLOR})
};

const lineMaterial = new THREE.LineBasicMaterial({
    color: LM_CONNECTION_LINE_COLOR,
    linewidth: 1
});

function createLine(start, end) {
    var geometry = new THREE.Geometry();
    geometry.dynamic = true;
    geometry.vertices.push(start.clone());
    geometry.vertices.push(end.clone());
    return new THREE.Line(geometry, lineMaterial);
}

/*
Required state:

position (THREE.Vector) / null
lmSize (float)

 */
export const LandmarkTHREEView = Backbone.View.extend({

    initialize: function (options) {
        this.viewport = options.viewport;
        this.symbol = null; // a THREE object that represents this landmark.
        // null if the landmark isEmpty

        // backbone stuff that we aim to remove
        _.bindAll(this, 'render', 'setLandmarkSize');
        this.listenTo(this.model, "change", this.render);

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
                this.symbol = this.createSphere(this.model.point(), true);
                this.updateSymbol();
                // and add it to the scene
                this.viewport._sLms.add(this.symbol);
            }
        }
        // tell our viewport to update
        this.viewport._update();
    },

    createSphere: function (v, radius, selected) {
        //console.log('creating sphere of radius ' + radius);
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
            this.viewport._sLms.remove(this.symbol);
            this.symbol = null;
        }
    },

    setLandmarkSize: function (lmSize) {
        if (this.symbol) {
            // have a symbol, and need to change it's size.
            var r = lmSize * this.viewport._meshScale;
            this.symbol.scale.set(r, r, r);
            // tell our viewport to update
            this.viewport._update();
        }
    }
});

export const LandmarkConnectionTHREEView = Backbone.View.extend({

    initialize: function (options) {
        // BB to remove
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
            if (this.model[0].isEmpty() || this.model[1].isEmpty()) {
                // but it's been deleted.
                this.dispose();

            } else {
                // the connection may need updating. See what needs to be done
                this.updateSymbol();
            }
        } else {
            // there is no symbol yet
            if (!this.model[0].isEmpty() && !this.model[1].isEmpty()) {
                // and there should be! Make it and update it
                this.symbol = createLine(this.model[0].point(),
                                         this.model[1].point());
                this.updateSymbol();
                // and add it to the scene
                this.viewport._sLmsConnectivity.add(this.symbol);
            }
        }
        // tell our viewport to update
        this.viewport._update();
    },

    dispose: function () {
        if (this.symbol) {
            this.viewport._sLmsConnectivity.remove(this.symbol);
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
