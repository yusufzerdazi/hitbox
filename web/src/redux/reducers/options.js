import { CAMERA, PLAYING, ADDAI, REMOVEAI } from '../../constants/actionTypes';
import { FOLLOWING } from '../../constants/cameraTypes';
  
export default (state = {cameraType: FOLLOWING, playing: false, ai: 0}, action) => {
    switch (action.type) {
        case CAMERA:
            return {
                ...state,
                cameraType: action.cameraType
            };
        case PLAYING:
            return {
                ...state,
                playing: action.playing
            }
        case ADDAI:
            return {
                ...state,
                ai: state.ai + 1
            }
        case REMOVEAI:
            return {
                ...state,
                ai: state.ai - 1
            }
        default:
            return state;
    }
};