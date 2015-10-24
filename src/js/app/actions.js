// constants
export const LOAD_LANDMARKS = 'LOAD_LANDMARKS';
export const SELECT_LANDMARKS = 'SELECT_LANDMARKS';

// action creators
export function loadLandmarks(landmarks) {
    console.log('loading landmarks');
    console.log(landmarks);
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
