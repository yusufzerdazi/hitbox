import { PLAYERS } from '../../constants/actionTypes';
  
export default (state = {}, action) => {
    switch (action.type) {
        case PLAYERS:
            return {
                ...state,
                players: action.players
            };
        default:
            return state;
    }
};