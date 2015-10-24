import { createStore } from 'redux';
import lmioApp from './reducers';

const store = createStore(lmioApp);
export default store;
