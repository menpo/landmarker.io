import { combineReducers } from 'redux';
import { LOAD_LANDMARKS, SET_SELECTED_LANDMARKS, AUGMENT_SELECTED_LANDMARKS, SET_NEXT_INSERTION, DELETE_LANDMARKS } from './actions';

const lmioApp = combineReducers({
        landmarks: reduceLandmarks,
        selected: reduceSelected,
        nextToInsert: reduceNextToInsert,
        lastAction: reduceLastAction
});


// this is just whilst we port over from backbone to react.
function reduceLastAction(state=null, action) {
    return action;
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

function reducePoints(points = [], action) {
    switch (action.type) {
        case LOAD_LANDMARKS:
            return deepCopyArray(action.landmarks.toJSON().landmarks.points);
        case DELETE_LANDMARKS:
            // TODO this should probably be a single null just to make everything simpler.
            const emptyPoint = points[0].length === 3 ? [null, null, null] : [null, null];
            const newPoints = deepCopyArray(points);
            action.indices.map((i) => newPoints[i] = [...emptyPoint]);
            return newPoints;
        default:
            return points;
    }
}

function reduceLabels(labels = [], action) {
    switch (action.type) {
        case LOAD_LANDMARKS:
            // this is bad - not copying
            return action.landmarks.toJSON().labels;
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
        default:
            return selected;
    }
}


// turn a set of boolean method calls into an index array
const booleanIndices = (xs, k) => xs.map((x, i) => x[k]() ? i : -1).filter((x) => x > -1);


//// conversion helpers
//function lmToReact(l) {
//    return {
//        id: 1,
//        isEmpty: l.isEmpty(),
//        isSelected: l.isSelected(),
//        isNextAvailable: l.isNextAvailable()
//    };
//}
//
//export function backboneToReduxLms(lms) {
//    return lms.labels.map((l) => ({'label': l.label, 'landmarks': l.landmarks.map(lmToReact)}));
//}

export default lmioApp;
