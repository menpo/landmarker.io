import { createStore } from 'redux';
import lmioApp from './reducers';

const store = createStore(lmioApp);
export default store;

window.states = [];
store.subscribe(() => window.states.push(store.getState()));
