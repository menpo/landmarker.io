"use strict";
import { createStore } from 'redux';

// constants
const LOAD_LANDMARKS = 'LOAD_LANDMARKS';
const SELECT_LANDMARKS = 'SELECT_LANDMARKS';

// action creators
export function loadLandmarks(landmarks) {
    return {
        type: LOAD_LANDMARKS,
        landmarks: landmarks
    };
}

export function selectLandmarks(lmIndicies) {
    return {
        type: SELECT_LANDMARKS,
        landmarks: lmIndicies
    };
}

// reducers

const initialState = {
    landmarks: {}
};

function reducer(state = initialState, action) {
    switch (action.type) {
        case LOAD_LANDMARKS:
            return { landmarks: backboneToReduxLms(action.landmarks) };
        default:
            return state;
    }
}

// store
let store = createStore(reducer);
export { store };

// conversion helpers
function lmToReact(l) {
    return {
        isEmpty: l.isEmpty(),
        isSelected: l.isSelected(),
        isNextAvailable: l.isNextAvailable()
    };
}

export function backboneToReduxLms(lms) {
    return lms.labels.map((l) => ({'label': l.label, 'landmarks': l.landmarks.map(lmToReact)}));
}
