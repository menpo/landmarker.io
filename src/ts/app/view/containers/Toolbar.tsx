import React, { Component, PropTypes } from 'react' // eslint-disable-line no-unused-vars
import { connect } from 'react-redux'
import * as ac from  '../actionCreators'
import Toggle from '../components/Toggle'

export default class Toolbar extends Component {

    render() {
        const { dispatch, connectivityOn, textureOn, autosaveOn, snapOn } = this.props
        return (
            <div>
            <Toggle
                title="Links" checked={connectivityOn}
                onClick={ checked => dispatch(ac.connectivityDisplay(checked))} />
            <Toggle
                title="Texture" checked={textureOn}
                onClick={ checked => dispatch(ac.textureDisplay(checked))} />
            <Toggle
                title="Snap" checked={snapOn}
                onClick={ checked => dispatch(ac.snapMode(checked))} />
            <Toggle
                title="Autosave" checked={autosaveOn}
                onClick={ checked => dispatch(ac.setAutosave(checked))} />
            </div>
        )
    }
}

Toolbar.propTypes = {
    connectivityOn: PropTypes.bool.isRequired,
    textureOn: PropTypes.bool.isRequired,
    snapOn: PropTypes.bool.isRequired,
    autosaveOn: PropTypes.bool.isRequired
}

function select(state) {
    return {
        connectivityOn: state.connectivityOn,
        textureOn: state.textureOn,
        snapOn: state.snapOn,
        autosaveOn: state.autosaveOn
    }
}

// Wrap the component to inject dispatch and state into it
export default connect(select)(Toolbar)
