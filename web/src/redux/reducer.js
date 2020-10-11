import { combineReducers } from 'redux';
import logIn from './reducers/logIn';
import options from './reducers/options';

export default combineReducers({
    logIn,
    options
});