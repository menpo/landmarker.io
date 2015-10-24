import React, { Component } from 'react'; // eslint-disable-line no-unused-vars
import LandmarkGroup from './LandmarkGroup';

export default class LandmarkGroupList extends Component {

    render() {
        return (
            <div>
                {this.props.groups.map((group, i) =>
                        <LandmarkGroup {...group}
                            key={i}
                            onClick={this.props.onClick} />
                )}
            </div>
        );
    }
}
