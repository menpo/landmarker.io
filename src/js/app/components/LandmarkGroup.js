import React, { Component, PropTypes } from 'react'; // eslint-disable-line no-unused-vars
import { landmarkPropType } from './Landmark';
import LandmarkList from './LandmarkList';

export default class LandmarkGroup extends Component {

    render() {
        return (
            <div className="LmGroup">
                <div className="LmGroup-Label" >{this.props.label}</div>
                <LandmarkList
                    landmarks={this.props.landmarks}
                    onClick={this.props.onClick} />
            </div>
        );
    }
}

LandmarkGroup.propTypes = {
    label: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired,
    landmarks: landmarkPropType.isRequired
};
