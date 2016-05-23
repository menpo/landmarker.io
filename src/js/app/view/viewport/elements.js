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


export class LandmarkTHREEView {

    constructor (lm, options) {
        this.onCreate = options.onCreate;
        this.onDispose = options.onDispose;
        this.onUpdate = options.onUpdate;

        // a THREE object that represents this landmark.
        // null if the landmark isEmpty
        this.symbol = null;
        this.index = lm.index

        this.render(lm);
    }

    render = (lm) => {
        if (this.symbol) {
            // this landmark already has an allocated representation..
            if (lm.point === null) {
                // but it's been deleted.
                this.dispose();
            } else {
                // the lm may need updating. See what needs to be done
                this.updateSymbol(lm);
            }
        } else {
            // there is no symbol yet
            if (lm.point !== null) {
                // and there should be! Make it and update it
                this.symbol = createSphere(lm.index);
                this.updateSymbol(lm);
                // and add it to the scene
                this.onCreate(this.symbol);
            }
        }
    };

    updateSymbol = (lm) => {
        this.symbol.position.copy(lm.point);
        this.symbol.material = LM_MATERIAL_FOR_SELECTED[lm.isSelected];
    };

    dispose = () => {
        if (this.symbol) {
            this.onDispose(this.symbol);
            this.symbol = null;
        }
    }
}

export class LandmarkConnectionTHREEView {

    constructor(lmA, lmB, options) {
        this.onCreate = options.onCreate;
        this.onDispose = options.onDispose;
        this.symbol = null; // a THREE object that represents this connection.
        // null if the landmark isEmpty
        this.render(lmA, lmB);
    }

    render = (lmA, lmB) => {
        const shouldBeVisible = lmA.point !== null && lmB.point !== null;
        if (this.symbol !== null) {
            // this landmark already has an allocated representation..
            if (!shouldBeVisible) {
                // but it's been deleted.
                this.dispose();
            } else {
                // the connection may need updating. See what needs to be done
                this.updateSymbol(lmA, lmB);
            }
        } else {
            // there is no symbol yet
            if (shouldBeVisible) {
                // and there should be! Make it and update it
                this.symbol = createLine(lmA.point, lmB.point);
                this.updateSymbol(lmA, lmB);
                // and add it to the scene
                this.onCreate(this.symbol);
            }
        }
    };

    updateSymbol = (lmA, lmB) => {
        this.symbol.geometry.vertices[0].copy(lmA.point);
        this.symbol.geometry.vertices[1].copy(lmB.point);
        this.symbol.geometry.verticesNeedUpdate = true;
    };

    dispose = () => {
        if (this.symbol) {
            this.onDispose(this.symbol);
            this.symbol.geometry.dispose();
            this.symbol = null;
        }
    };

}
