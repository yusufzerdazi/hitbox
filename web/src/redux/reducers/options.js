import { CAMERA, PLAYING } from '../../constants/actionTypes';
import { FOLLOWING } from '../../constants/cameraTypes';
  
export default (state = {cameraType: FOLLOWING, playing: false}, action) => {
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
        default:
            return state;
    }
};