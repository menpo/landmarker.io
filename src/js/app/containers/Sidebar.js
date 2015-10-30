import React, { Component } from 'react' // eslint-disable-line no-unused-vars
import { connect } from 'react-redux'
import * as ac from  '../actionCreators'
import LandmarkGroupList from '../components/LandmarkGroupList'

export default class Sidebar extends Component {

    render() {
        // Injected by connect() call:
        const { dispatch, groups, landmarks } = this.props;
        return (
            <LandmarkGroupList
                groups={ groups }
                onClick={ (index) => landmarks[index].isEmpty ? dispatch(ac.setNextInsertion(index)) :
                dispatch(ac.setSelectedLandmarks([index])) } />
        );
    }
}

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

function select(state) {
    const labels = state.landmarks.labels;
    const lms = arraysToObjects(state);
    return {
        groups: labels.map((g) => ({label: g.label, landmarks: g.mask.map((i) => lms[i])})),
        landmarks: lms
    };
}


// Wrap the component to inject dispatch and state into it
export default connect(select)(Sidebar);
