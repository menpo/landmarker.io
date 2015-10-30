import store from './store'
import { TYPE } from './constants'

export function loadLandmarks(landmarks) {
    return {
        type: TYPE.LOAD_LANDMARKS,
        landmarks: landmarks
    }
}

export function setSelectedLandmarks(indices) {
    return {
        type: TYPE.SET_SELECTED_LANDMARKS,
        indices: indices
    }
}

export function augmentSelectedLandmarks(indices) {
    return {
        type: TYPE.AUGMENT_SELECTED_LANDMARKS,
        indices: indices
    }
}


export function setLandmark(landmark, index) {
    return {
        type: TYPE.SET_LANDMARK,
        landmark: landmark,
        index: index
    }
}

export function deleteLandmarks(indices) {
    return {
        type: TYPE.DELETE_LANDMARKS,
        indices: indices
    }
}

export function deleteAllSelectedLandmarks() {
    return {
        type: TYPE.DELETE_LANDMARKS,
        indices: store.getState().selected
    }
}

export function setNextInsertion(index) {
    return {
        type: TYPE.SET_NEXT_INSERTION,
        index: index
    }
}

export function connectivityDisplay(flag) {
    return {
        type: TYPE.CONNECTIVITY_DISPLAY,
        flag: flag
    }
}

export function textureDisplay(flag) {
    return {
        type: TYPE.TEXTURE_DISPLAY,
        flag: flag
    }
}

export function snapMode(flag) {
    return {
        type: TYPE.SNAP_MODE,
        flag: flag
    }
}

export function setAutosave(flag) {
    return {
        type: TYPE.SET_AUTOSAVE,
        flag: flag
    }
}
