import React, { Component, PropTypes } from 'react'; // eslint-disable-line no-unused-vars
import Landmark, { landmarkPropType } from './Landmark';

export default class LandmarkList extends Component {

    render() {
        return (
            <div className="LmGroup-Flex">
                {this.props.landmarks.map((lm, index) =>
                        <Landmark {...lm}
                            key={index}
                            onClick={this.props.onClick} />
                )}
            </div>
        );
    }
}

LandmarkList.propTypes = {
    onClick: PropTypes.func.isRequired,
    landmarks: landmarkPropType.isRequired
};
