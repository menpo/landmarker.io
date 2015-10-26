import React, { Component, PropTypes } from 'react'; // eslint-disable-line no-unused-vars

// generic toggle class for the sidebar
export default class Toggle extends Component {

    render() {
        return (
            <div className="Toolbar-Row" onClick={() => this.props.onClick(!this.props.checked)}>
                <div className="Toolbar-Row-Item">{this.props.title}</div>
                <div className="Toolbar-Row-Item">
                    <p>{ this.props.checked ? 'ON' : 'OFF' }</p>
                </div>
            </div>
        );
    }
}


Toggle.propTypes = {
    title: PropTypes.string.isRequired,
    checked: PropTypes.bool.isRequired,
    onClick: PropTypes.func.isRequired
};
