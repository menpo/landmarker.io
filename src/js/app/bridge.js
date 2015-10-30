import store from './store'
import * as ac from './actionCreators'
import { TYPE } from './constants'

import App from './model/app'

export default function bindToRedux(app) {
    app.on('change:landmarks', () => app.landmarks() !== null ? store.dispatch(ac.loadLandmarks(app.landmarks())) : null);

    window.app = app;

    store.subscribe(function() {
        const state = store.getState();
        switch(state.lastAction.type) {
            case TYPE.SET_SELECTED_LANDMARKS:
                app.landmarks().deselectAll();
                state.selected.map((i) => app.landmarks().landmarks[i].select());
        }
    })

}
