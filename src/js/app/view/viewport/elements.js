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
const LM_GEOMETRY = new THREE.SphereGeometry(
    LM_SCALE,
    LM_SPHERE_PARTS,
    LM_SPHERE_PARTS);

const LM_MATERIAL_FOR_SELECTED = {
    true: new THREE.MeshBasicMaterial({color: LM_SPHERE_SELECTED_COLOR}),
    false: new THREE.MeshBasicMaterial({color: LM_SPHERE_UNSELECTED_COLOR})
};

const LINE_MATERIAL = new THREE.LineBasicMaterial({
    color: LM_CONNECTION_LINE_COLOR,
    linewidth: 1
});

function createSphere(index) {
    const landmark = new THREE.Mesh(LM_GEOMETRY, LM_MATERIAL_FOR_SELECTED[false]);
    landmark.name = 'Landmark ' + index;
    landmark.userData.index = index;
    return landmark
}

function createLine(start, end) {
    const geometry = new THREE.Geometry();
    geometry.dynamic = true;
    geometry.vertices.push(start.clone());
    geometry.vertices.push(end.clone());
    return new THREE.Line(geometry, LINE_MATERIAL)
}


export const LandmarkTHREEView = Backbone.View.extend({

    initialize: function (options) {
        this.onCreate = options.onCreate;
        this.onDispose = options.onDispose;
        this.onUpdate = options.onUpdate;
        // a THREE object that represents this landmark.
        // null if the landmark isEmpty
        this.symbol = null;

        this.render();

        // TODO BB to remove
        _.bindAll(this, 'render');
        this.listenTo(this.model, "change", this.render);
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
                this.symbol = createSphere(this.model.index());
                this.updateSymbol();
                // and add it to the scene
                this.onCreate(this.symbol);
            }
        }
        // TODO BB to remove (should be handled at Viewport level)
        this.onUpdate();
    },

    updateSymbol: function () {
        this.symbol.position.copy(this.model.point());
        var selected = this.model.isSelected();
        this.symbol.material = LM_MATERIAL_FOR_SELECTED[selected];
    },

    dispose: function () {
        if (this.symbol) {
            this.onDispose(this.symbol);
            this.symbol = null;
        }
    }
});

export const LandmarkConnectionTHREEView = Backbone.View.extend({

    initialize: function (options) {
        this.onCreate = options.onCreate;
        this.onDispose = options.onDispose;
        this.onUpdate = options.onUpdate;
        this.symbol = null; // a THREE object that represents this connection.
        // null if the landmark isEmpty
        this.render();


        // TODO BB to remove
        this.listenTo(this.model[0], "change", this.render);
        this.listenTo(this.model[1], "change", this.render);
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
                this.onCreate(this.symbol);
            }
        }
        // TODO BB to remove (should be handled at Viewport level)
        this.onUpdate();
    },

    updateSymbol: function () {
        this.symbol.geometry.vertices[0].copy(this.model[0].point());
        this.symbol.geometry.vertices[1].copy(this.model[1].point());
        this.symbol.geometry.verticesNeedUpdate = true;
    },

    dispose: function () {
        if (this.symbol) {
            this.onDispose(this.symbol);
            this.symbol.geometry.dispose();
            this.symbol = null;
        }
    }

});
