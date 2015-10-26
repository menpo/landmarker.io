import { combineReducers } from 'redux';
import { LOAD_LANDMARKS, SET_SELECTED_LANDMARKS, AUGMENT_SELECTED_LANDMARKS,
         SET_NEXT_INSERTION, DELETE_LANDMARKS, CONNECTIVITY_DISPLAY, TEXTURE_DISPLAY } from './actions';

const lmioApp = combineReducers({
        landmarks: reduceLandmarks,
        selected: reduceSelected,
        nextToInsert: reduceNextToInsert,
        connectivityOn: reduceConnectivityOn,
        textureOn: reduceTextureOn,
        lastAction: reduceLastAction
});


// this is just whilst we port over from backbone to react.
function reduceLastAction(state=null, action) {
    return action;
}

function reduceConnectivityOn(state=false, action) {
    switch(action.type) {
        case CONNECTIVITY_DISPLAY:
            return action.flag;
        default:
            return state;
    }
}

function reduceTextureOn(state=false, action) {
    switch(action.type) {
        case TEXTURE_DISPLAY:
            return action.flag;
        default:
            return state;
    }
}


function reduceLandmarks(landmarks, action) {
    return {
        landmarks: {
            points: reducePoints(landmarks !== undefined ? landmarks.landmarks.points : undefined, action)
        },
        labels: reduceLabels(landmarks !== undefined ? landmarks.labels : undefined, action)
    };
}

const deepCopyArray = (l) => l.map((x) => [...x]);


// clones a nested structure of objects, arrays, strings, numbers, nulls, and undefined's safely.
function clone(x) {
    if (Array.isArray(x)) {
        return x.map((y) => clone(y));
    } else if (typeof(x) == "object" && x !== null && x !== undefined) {
        const newX = {};
        for (let k in x) {
            newX[k] = clone(x[k]);
        }
        return newX;
    } else {
        return x;
    }
}


function reducePoints(points = [], action) {
    switch (action.type) {
        case LOAD_LANDMARKS:
            return clone(action.landmarks.toJSON().landmarks.points);
        case DELETE_LANDMARKS:
            const newPoints = clone(points);
            action.indices.map((i) => newPoints[i] = null);
            return newPoints;
        default:
            return points;
    }
}

function reduceLabels(labels = [], action) {
    switch (action.type) {
        case LOAD_LANDMARKS:
            return clone(action.landmarks.toJSON().labels);
        default:
            return labels;
    }
}

function reduceNextToInsert(nextToInsert = -1, action) {
    switch (action.type) {
        case SET_NEXT_INSERTION:
            return action.index;
        default:
            return nextToInsert;
    }
}

function reduceSelected(selected = [], action) {
    switch (action.type) {
        case SET_SELECTED_LANDMARKS:
            return [...action.indices];
        case DELETE_LANDMARKS:
            // deleted landmarks cannot be selected.
            return selected.filter(i => action.indices.indexOf(i) === -1);
        default:
            return selected;
    }
}


// turn a set of boolean method calls into an index array
const booleanIndices = (xs, k) => xs.map((x, i) => x[k]() ? i : -1).filter((x) => x > -1);


export default lmioApp;
