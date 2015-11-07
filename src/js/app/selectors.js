const applyMask = (objs, indices, k, v) => (indices.map((i) => objs[i][k] = v));

function landmark(points, id) {
    return {
        id: id,
        isEmpty: points === null,
        isSelected: false,
        isNextAvailable: false
    };
}

function arraysToObjects(state) {
    let lms = state.landmarks.landmarks.points.map(landmark);
    applyMask(lms, state.selected, 'isSelected', true);
    if (state.nextToInsert !== -1) {
        applyMask(lms, [state.nextToInsert], 'isNextAvailable', true);
    }
    return lms;
}

export function selectLandmarkObjects(state) {
    const labels = state.landmarks.labels;
    const lms = arraysToObjects(state);
    return {
        groups: labels.map((g) => ({label: g.label, landmarks: g.mask.map((i) => lms[i])})),
        landmarks: lms
    };
}
