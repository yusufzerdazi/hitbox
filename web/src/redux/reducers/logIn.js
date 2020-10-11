import { LOG_IN, USERNAME_UPDATED } from '../../constants/actionTypes';
  
export default (state = {}, action) => {
    switch (action.type) {
        case LOG_IN:
            console.log(action);
            return {
                ...state,
                user: {
                    loggedIn: true,
                    name: action.payload.DisplayName,
                    id: action.payload.PlayerId
                }
            };
        case USERNAME_UPDATED:
            return {
                ...state,
                user: {
                    loggedIn: true,
                    name: action.name
                }
            };
        default:
            return state;
    }
};