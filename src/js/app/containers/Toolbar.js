import React, { Component, PropTypes } from 'react'; // eslint-disable-line no-unused-vars
import { connect } from 'react-redux';
import Toggle from '../components/Toggle';
import store from '../reduxindex'
import { connectivityDisplay, textureDisplay } from  '../actions';

export default class Toolbar extends Component {

    render() {
        return (
            <div>
            <Toggle
                title="Links" checked={this.props.connectivityOn}
                onClick={ checked => store.dispatch(connectivityDisplay(checked))} />
            <Toggle
                title="Texture" checked={this.props.textureOn}
                onClick={ checked => store.dispatch(textureDisplay(checked))} />
            </div>
        );
    }
}

Toolbar.propTypes = {
    connectivityOn: PropTypes.bool.isRequired,
    textureOn: PropTypes.bool.isRequired
};

function select(state) {
    return {
        connectivityOn: state.connectivityOn,
        textureOn: state.textureOn
    };
}

// Wrap the component to inject dispatch and state into it
export default connect(select)(Toolbar);
