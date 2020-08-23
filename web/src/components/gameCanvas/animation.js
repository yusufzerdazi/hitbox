import runningf1 from '../../assets/images/running/1.png';
import runningf2 from '../../assets/images/running/2.png';
import runningf3 from '../../assets/images/running/3.png';
import runningf4 from '../../assets/images/running/4.png';
import runningf5 from '../../assets/images/running/5.png';
import runningf6 from '../../assets/images/running/6.png';
import runningf7 from '../../assets/images/running/7.png';
import runningf8 from '../../assets/images/running/8.png';
import runningf9 from '../../assets/images/running/9.png';

import runningr1 from '../../assets/images/runningrev/1.png';
import runningr2 from '../../assets/images/runningrev/2.png';
import runningr3 from '../../assets/images/runningrev/3.png';
import runningr4 from '../../assets/images/runningrev/4.png';
import runningr5 from '../../assets/images/runningrev/5.png';
import runningr6 from '../../assets/images/runningrev/6.png';
import runningr7 from '../../assets/images/runningrev/7.png';
import runningr8 from '../../assets/images/runningrev/8.png';
import runningr9 from '../../assets/images/runningrev/9.png';

import standing1 from '../../assets/images/standing/1.png';
import standing2 from '../../assets/images/standing/2.png';
import standing3 from '../../assets/images/standing/3.png';
import standing4 from '../../assets/images/standing/4.png';

var forwardImageSources = [
    runningf1, runningf2, runningf3, runningf4, runningf5, runningf6, runningf7, runningf8, runningf9
]

var backwardImageSources = [
    runningr1, runningr2, runningr3, runningr4, runningr5, runningr6, runningr7, runningr8, runningr9
]

var standingImageSources = [
    standing1, standing2, standing3, standing4
]

var RunningForward = forwardImageSources.map(f => {
    var img = new Image();
    img.src = f;
    return img;
});

var RunningBackward = backwardImageSources.map(f => {
    var img = new Image();
    img.src = f;
    return img;
});

var Standing = standingImageSources.map(f => {
    var img = new Image();
    img.src = f;
    return img;
});

export {
    RunningForward,
    RunningBackward,
    Standing
};