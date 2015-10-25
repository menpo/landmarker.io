// constants
export const LOAD_LANDMARKS = 'LOAD_LANDMARKS';
export const SET_LANDMARK = 'SET_LANDMARK';
export const SET_NEXT_INSERTION = 'SET_NEXT_INSERTION';
export const SET_SELECTED_LANDMARKS = 'SET_SELECTED_LANDMARKS';
export const AUGMENT_SELECTED_LANDMARKS = 'AUGMENT_SELECTED_LANDMARKS';
export const DELETE_LANDMARKS = 'DELETE_LANDMARKS';


// action creators
export function loadLandmarks(landmarks) {
    console.log('loading landmarks');
    console.log(landmarks);
    return {
        type: LOAD_LANDMARKS,
        landmarks: landmarks
    };
}

export function setSelectedLandmarks(indices) {
    return {
        type: SET_SELECTED_LANDMARKS,
        indices: indices
    };
}

export function augmentSelectedLandmarks(indices) {
    return {
        type: AUGMENT_SELECTED_LANDMARKS,
        indices: indices
    };
}


export function setLandmark(landmark, index) {
    return {
        type: SET_LANDMARK,
        landmark: landmark,
        index: index
    };
}

export function deleteLandmarks(indices) {
    return {
        type: DELETE_LANDMARKS,
        indices: indices
    };
}

export function setNextInsertion(index) {
    return {
        type: SET_NEXT_INSERTION,
        index: index
    };
}
