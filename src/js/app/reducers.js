import { LOAD_LANDMARKS, SELECT_LANDMARKS } from './actions';

const initialState = {
    landmarks2: {
        landmarks: {
            points: []
        },
        labels: []

    },
    selected: [],
    nextToInsert: -1,
    empty: []
};

// turn a set of boolean method calls into an index array
const booleanIndices = (xs, k) => xs.map((x, i) => x[k]() ? i : -1).filter((x) => x > -1);

function lmioApp(state = initialState, action) {
    switch (action.type) {
        case LOAD_LANDMARKS:
            const lms = action.landmarks.landmarks;
            const next = booleanIndices(lms, 'isNextAvailable');
            const newState = {
                landmarks2: action.landmarks.toJSON(),
                selected: booleanIndices(lms, 'isSelected'),
                empty: booleanIndices(lms, 'isEmpty'),
                nextToInsert: next.length === 0 ? -1 : next[0]
            };
            delete newState.landmarks2.version;
            return newState;
        case SELECT_LANDMARKS:
            return Object.assign({}, state, { selected: action.landmarks });
        default:
            return state;
    }
}

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
