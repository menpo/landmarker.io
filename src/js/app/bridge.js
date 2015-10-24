import store from './reduxindex'
import App from './model/app'
import { loadLandmarks } from './actions';

export default function bindToRedux(app) {
    app.on('change:landmarks', () => app.get('landmarks') !== null ? store.dispatch(loadLandmarks(app.get('landmarks'))) : null);
}
