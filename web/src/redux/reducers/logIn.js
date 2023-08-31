import { LOG_IN, USERNAME_UPDATED, IMAGE_UPDATED } from '../../constants/actionTypes';
  
export default (state = {}, action) => {
    switch (action.type) {
        case LOG_IN:
            return {
                ...state,
                user: {
                    loggedIn: true,
                    name: action.payload.DisplayName,
                    id: action.payload.PlayerId,
                    image: action.payload.AvatarUrl
                }
            };
        case USERNAME_UPDATED:
            return {
                ...state,
                user: {
                    ...state.user,
                    loggedIn: true,
                    name: action.name
                }
            };
        case IMAGE_UPDATED:
            return {
                ...state,
                user: {
                    ...state.user,
                    image: action.image
                }
            };
        default:
            return state;
    }
};