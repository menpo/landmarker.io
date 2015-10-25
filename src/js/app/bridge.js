import store from './reduxindex'
import App from './model/app'
import { SET_SELECTED_LANDMARKS, SET_NEXT_INSERTION, loadLandmarks } from './actions';

export default function bindToRedux(app) {
    app.on('change:landmarks', () => app.landmarks() !== null ? store.dispatch(loadLandmarks(app.landmarks())) : null);

    window.app = app;

    store.subscribe(function() {
        const state = store.getState();
        switch(state.lastAction.type) {
            case SET_SELECTED_LANDMARKS:
                app.landmarks().deselectAll();
                state.selected.map((i) => app.landmarks().landmarks[i].select());
        }
    })

}
