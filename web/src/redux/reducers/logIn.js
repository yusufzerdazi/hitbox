import { LOG_IN } from '../../constants/actionTypes';
  
export default (state = {}, action) => {
    switch (action.type) {
        case LOG_IN:
            return {
                ...state,
                user: {
                    loggedIn: true,
                    name: action.payload.DisplayName
                }
            };
        default:
            return state;
    }
};