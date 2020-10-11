import { combineReducers } from 'redux';
import logIn from './reducers/logIn';
import options from './reducers/options';
import stats from './reducers/stats';

export default combineReducers({
    logIn,
    options,
    stats
});