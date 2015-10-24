import React, { Component } from 'react'; // eslint-disable-line no-unused-vars
import LandmarkGroupList from '../components/LandmarkGroupList';
import { selectLandmarks } from  '../actions';
import { connect } from 'react-redux';

export default class Sidebar extends Component {

    render() {
        // Injected by connect() call:
        const { dispatch, groups } = this.props;
        return (
            <LandmarkGroupList
                groups={ groups }
                onClick={ (index) => dispatch(selectLandmarks([index])) } />
        );
    }
}

const applyMask = (objs, indices, k, v) => (indices.map((i) => objs[i][k] = v));

function landmark(id) {
    return {
        id: id,
        isEmpty: false,
        isSelected: false,
        isNextAvailable: false
    };
}

function arraysToObjects(state) {
    let lms = state.landmarks2.landmarks.points.map((_, i) => landmark(i));
    applyMask(lms, state.empty, 'isEmpty', true);
    applyMask(lms, state.selected, 'isSelected', true);
    if (state.nextToInsert !== -1) {
        applyMask(lms, [state.nextToInsert], 'isNextAvailable', true);
    }
    return lms;
}

function select(state) {
    const labels = state.landmarks2.labels;
    const lms = arraysToObjects(state);
    return {
        groups: labels.map((g) => ({label: g.label, landmarks: g.mask.map((i) => lms[i])}))
    };
}

// Wrap the component to inject dispatch and state into it
export default connect(select)(Sidebar);
