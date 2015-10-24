import React, { Component, PropTypes } from 'react'; // eslint-disable-line no-unused-vars
import classNames from 'classnames';

export default class Landmark extends Component {

    render() {
        const classes = classNames(['Lm', {
            'Lm-Empty': this.props.isEmpty,
            'Lm-Value': !this.props.isEmpty,
            'Lm-Selected': this.props.isSelected,
            'Lm-NextAvailable': this.props.isNextAvailable
        }]);
        return <div className={classes} onClick={() => this.props.onClick(this.props.id)}></div>;
    }
}

// for usage in higher components (notice no callback)
export const landmarkPropType = PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number.isRequired,
    isEmpty: PropTypes.bool.isRequired,
    isSelected: PropTypes.bool.isRequired,
    isNextAvailable: PropTypes.bool.isRequired
}).isRequired);

Landmark.propTypes = {
    id: PropTypes.number.isRequired,
    isEmpty: PropTypes.bool.isRequired,
    isSelected: PropTypes.bool.isRequired,
    isNextAvailable: PropTypes.bool.isRequired,
    onClick: PropTypes.func.isRequired
};
