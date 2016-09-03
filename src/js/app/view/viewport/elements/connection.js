'use strict';

import THREE from 'three';

const LINE_COLOR = 0xffff00;

const LINE_MATERIAL = new THREE.LineBasicMaterial({
    color: LINE_COLOR,
    linewidth: 1
});

function createLine(start, end) {
    const geometry = new THREE.Geometry();
    geometry.dynamic = true;
    geometry.vertices.push(start.clone());
    geometry.vertices.push(end.clone());
    return new THREE.Line(geometry, LINE_MATERIAL)
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
