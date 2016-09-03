'use strict';

import { Viewport } from './viewport';

const landmarkForBBLandmark = bbLm => ({
    point: bbLm.point(),
    isSelected: bbLm.isSelected(),
    index: bbLm.index()
});

// A wrapper around the standalone viewport that hooks it into the legacy
// Backbone Landmarker.io code.

export class BackboneViewport {

    constructor(app) {
        this.model = app;

        this.model.onBudgeLandmarks = vector => this.viewport.budgeLandmarks(vector);

        const on = {
            selectLandmarks: is => is.forEach(i => this.model.landmarks().landmarks[i].select()),
            deselectLandmarks: is => is.forEach(i => this.model.landmarks().landmarks[i].deselect()),
            deselectAllLandmarks: () => {
                const lms = this.model.landmarks();
                if (lms) {
                    lms.deselectAll()
                }
            },
            selectLandmarkAndDeselectRest: i => this.model.landmarks().landmarks[i].selectAndDeselectRest(),
            setLandmarkPoint: (i, point) => this.model.landmarks().setLmAt(this.model.landmarks().landmarks[i], point),
            setLandmarkPointWithHistory: (i, point) => this.model.landmarks().landmarks[i].setPoint(point),
            addLandmarkHistory: points => this.model.landmarks().tracker.record(points),
            insertNewLandmark: point => this.model.landmarks().insertNew(point)
        };
        this.viewport = new Viewport(app.meshMode(), on);

        this.model.on('newMeshAvailable', this.setMesh);
        this.model.on("change:landmarks", this.setLandmarks);
        this.model.on("change:landmarkSize", this.setLandmarkSize);
        this.model.on("change:connectivityOn", this.updateConnectivityDisplay);
        this.model.on("change:editingOn", this.updateEditingDisplay);

        // make sure we didn't miss any state changes on load
        this.setMesh();
        this.setLandmarkSize();
        this.updateConnectivityDisplay();
        this.updateEditingDisplay();
    }

    setMesh = () => {
        const meshPayload = this.model.mesh();
        if (meshPayload === null) {
            return;
        }
        this.viewport.setMesh(meshPayload.mesh, meshPayload.up, meshPayload.front);
    };

    setLandmarks = () => {
        const landmarks = this.model.landmarks();
        if (landmarks !== null) {
            this.viewport.setLandmarksAndConnectivity(landmarks.landmarks.map(landmarkForBBLandmark),
                                                      landmarks.connectivity);

            // TODO will this be collected properly?
            landmarks.landmarks.forEach(lm => lm.on('change', () => this.updateLandmark(lm.index())));
        }

    };

    setLandmarkSize = () => {
        this.viewport.setLandmarkSize(this.model.landmarkSize());
    };

    updateEditingDisplay = () => {
        this.viewport.updateEditingDisplay(this.model.isEditingOn());
    };

    updateConnectivityDisplay = () => {
        this.viewport.updateConnectivityDisplay(this.model.isConnectivityOn());
    };

    updateLandmark = i => {
        console.log(`updating landmark ${i}`);
        this.viewport.updateLandmarks([
                landmarkForBBLandmark(this.model.landmarks().landmarks[i])
            ]
        )
    };

}
