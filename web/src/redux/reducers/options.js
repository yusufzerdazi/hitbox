import { CAMERA } from '../../constants/actionTypes';
import { FOLLOWING } from '../../constants/cameraTypes';
  
export default (state = {cameraType: FOLLOWING}, action) => {
    switch (action.type) {
        case CAMERA:
            return {
                ...state,
                cameraType: action.cameraType
            };
        default:
            return state;
    }
};