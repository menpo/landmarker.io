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

// turn a set of boolean method calls into an index array
const booleanIndices = (xs, k) => xs.map((x, i) => x[k]() ? i : -1).filter((x) => x > -1);

//
const applyMask = (objs, indices, k, v) => (indices.map((i) => objs[i][k] = v))

function reducer(state = initialState, action) {
    switch (action.type) {
        case LOAD_LANDMARKS:
            const lms = action.landmarks.landmarks;
            const next = booleanIndices(lms, 'isNextAvailable');
            let newState = {
                landmarks: backboneToReduxLms(action.landmarks),
                landmarks2: action.landmarks.toJSON(),
                selected: booleanIndices(lms, 'isSelected'),
                empty: booleanIndices(lms, 'isEmpty'),
                nextToInsert: next.length === 0 ? -1 : next[0]
            };
            delete newState.landmarks2.version;
            return newState;
        default:
            return state;
    }
}

// store
const store = createStore(reducer);
export { store };
window.store = store;

// conversion helpers
function lmToReact(l) {
    return {
        id: 1,
        isEmpty: l.isEmpty(),
        isSelected: l.isSelected(),
        isNextAvailable: l.isNextAvailable()
    };
}

export function backboneToReduxLms(lms) {
    return lms.labels.map((l) => ({'label': l.label, 'landmarks': l.landmarks.map(lmToReact)}));
}

function landmark(id) {
    return {
        id: id,
        isEmpty: false,
        isSelected: false,
        isNextAvailable: false
    };
}

export function arraysToObjects(state) {
    let lms = state.landmarks2.landmarks.points.map((_, i) => landmark(i));
    applyMask(lms, state.empty, 'isEmpty', true);
    applyMask(lms, state.selected, 'isSelected', true);
    if (state.nextToInsert !== -1) {
        applyMask(lms, [state.nextToInsert], 'isNextAvailable', true);
    }
    return lms;
}

window.arraysToObjects = arraysToObjects;
