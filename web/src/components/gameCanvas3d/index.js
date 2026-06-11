import React from 'react';
import * as THREE from 'three';

import styles from './styles.module.css';

// Palette lifted from the 2D canvas so both modes share a vibe.
const SKY_TOP = new THREE.Color(0x7fb5fb);
const SKY_HORIZON = new THREE.Color(0xebf0fe);
const SUN = 0xfbff91;
const WATER_SHALLOW = new THREE.Color(0x1583c9);
const WATER_DEEP = new THREE.Color(0x064273);
const PLATFORM = 0x4a3520;
const GRASS_GREENS = [0x44db6c, 0x3bc75f, 0x55e87c];
const HALO = 0xf0af00;
const TEAM_COLOURS = { red: 0xff5050, blue: 0x6a5acd };

const BODY_W = 50, BODY_H = 50, BODY_D = 44;
const LEG_H = 24;

let sharedFaceTexture = null;
let sharedBallTexture = null;
let sharedParticleTexture = null;
let sharedCloudTexture = null;

function faceTexture(){
    if(sharedFaceTexture) return sharedFaceTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    // Big friendly eyes and a little smile, Fall Guys style.
    ctx.fillStyle = "white";
    [44, 84].forEach(x => {
        ctx.beginPath();
        ctx.ellipse(x, 56, 15, 19, 0, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.fillStyle = "#1c1c28";
    [44, 84].forEach(x => {
        ctx.beginPath();
        ctx.ellipse(x, 60, 7.5, 10, 0, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.strokeStyle = "#1c1c28";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(64, 86, 12, 0.25 * Math.PI, 0.75 * Math.PI);
    ctx.stroke();
    sharedFaceTexture = new THREE.CanvasTexture(canvas);
    return sharedFaceTexture;
}

function ballTexture(){
    if(sharedBallTexture) return sharedBallTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = "#f4f4f4";
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = "#222";
    for(let i = 0; i < 8; i++){
        for(let j = 0; j < 4; j++){
            const x = i * 32 + (j % 2 ? 16 : 0);
            const y = j * 32 + 16;
            ctx.beginPath();
            ctx.arc(x, y, 9, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    sharedBallTexture = new THREE.CanvasTexture(canvas);
    return sharedBallTexture;
}

function particleTexture(){
    if(sharedParticleTexture) return sharedParticleTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.6, "rgba(255,255,255,0.6)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    sharedParticleTexture = new THREE.CanvasTexture(canvas);
    return sharedParticleTexture;
}

function cloudTexture(){
    if(sharedCloudTexture) return sharedCloudTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    // A few overlapping soft blobs make a puffy cloud.
    [[70, 80, 45], [120, 65, 55], [175, 80, 45], [120, 90, 60]].forEach(([x, y, r]) => {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, "rgba(255,255,255,0.95)");
        gradient.addColorStop(0.7, "rgba(255,255,255,0.55)");
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 128);
    });
    sharedCloudTexture = new THREE.CanvasTexture(canvas);
    return sharedCloudTexture;
}

function lerpAngle(a, b, t){
    let difference = (b - a) % (Math.PI * 2);
    if(difference > Math.PI) difference -= Math.PI * 2;
    if(difference < -Math.PI) difference += Math.PI * 2;
    return a + difference * t;
}

class GameCanvas3D extends React.Component {
    constructor(props){
        super(props);
        this.mountRef = React.createRef();
        this.playerRigs = new Map();
        this.platformMeshes = [];
        this.foamMeshes = [];
        this.particles = [];
        this.levelName = null;
        this.state3d = null;
        this.myName = null;
        this.clock = new THREE.Clock();
        this.elapsed = 0;

        // Orbit camera around the tracked player.
        this.cameraYaw = Math.PI / 4;
        this.cameraPitch = 0.42;
        this.cameraDistance = 850;
        this.cameraTarget = new THREE.Vector3(0, 250, 0);
        this.analogZoom = 0;
        this.dragging = false;
        this.windTime = { value: 0 };
    }

    // Lambert material whose vertices sway in the wind, bending more toward
    // the blade tips (same recipe as the simulation project's flora).
    swayMaterial(amount){
        const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
        material.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = this.windTime;
            shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
                '#include <begin_vertex>',
                `vec3 transformed = vec3( position );
                #ifdef USE_INSTANCING
                    vec3 fIpos = vec3(instanceMatrix[3]);
                    float fPh = fIpos.x * 0.024 + fIpos.z * 0.033;
                    float fW = smoothstep(2.0, 28.0, position.y) * ${amount.toFixed(2)};
                    transformed.x += (sin(uTime * 2.2 + fPh) + sin(uTime * 3.7 + fPh * 1.6) * 0.5) * fW;
                    transformed.z += cos(uTime * 1.9 + fPh) * fW * 0.6;
                #endif`
            );
        };
        return material;
    }

    // 7 thin triangular blades fanned around the tuft centre, dark at the
    // roots and brighter at the tips via vertex colours.
    buildTuftGeometry(){
        const positions = [], normals = [], colours = [];
        for(let b = 0; b < 7; b++){
            const ang = (b / 7) * Math.PI * 2 + Math.random() * 0.8;
            const r = 3 + Math.random() * 6;
            const bx = Math.cos(ang) * r, bz = Math.sin(ang) * r;
            const h = 21 + Math.random() * 18;
            const lean = 7 + Math.random() * 11;
            const tx = bx + Math.cos(ang) * lean, tz = bz + Math.sin(ang) * lean;
            const w = 2.1;
            const px = -Math.sin(ang) * w, pz = Math.cos(ang) * w;
            positions.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, tx, h, tz);
            for(let k = 0; k < 3; k++) normals.push(Math.cos(ang) * 0.4, 0.9, Math.sin(ang) * 0.4);
            const t = 0.9 + Math.random() * 0.5;
            colours.push(0.14 * t, 0.40 * t, 0.13 * t, 0.14 * t, 0.40 * t, 0.13 * t, 0.32 * t, 0.78 * t, 0.28 * t);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
        return geometry;
    }

    // Dark stem + six white petals + a yellow centre; the petals are white in
    // vertex colour so the material colour paints them per-palette.
    buildFlowerGeometry(){
        const positions = [], normals = [], colours = [];
        const stemH = 22;
        positions.push(-0.9, 0, 0, 0.9, 0, 0, 0, stemH, 0);
        for(let k = 0; k < 3; k++) normals.push(0, 0, 1);
        for(let k = 0; k < 3; k++) colours.push(0.06, 0.12, 0.05);
        for(let p = 0; p < 6; p++){
            const a = (p / 6) * Math.PI * 2;
            const ca = Math.cos(a), sa = Math.sin(a);
            const r0 = 1.8, r1 = 8, w = 2.5;
            const pxa = -sa * w, pza = ca * w;
            const y0 = stemH, y1 = stemH + 2.5;
            positions.push(ca * r0 - pxa, y0, sa * r0 - pza, ca * r0 + pxa, y0, sa * r0 + pza, ca * r1, y1, sa * r1);
            for(let k = 0; k < 3; k++) normals.push(0, 1, 0);
            for(let k = 0; k < 3; k++) colours.push(1, 1, 1);
        }
        for(let p = 0; p < 4; p++){
            const a0 = (p / 4) * Math.PI * 2, a1 = ((p + 1) / 4) * Math.PI * 2;
            const r = 2;
            positions.push(Math.cos(a0) * r, stemH, Math.sin(a0) * r, Math.cos(a1) * r, stemH, Math.sin(a1) * r, 0, stemH + 2.2, 0);
            for(let k = 0; k < 3; k++) normals.push(0, 1, 0);
            for(let k = 0; k < 3; k++) colours.push(0.95, 0.8, 0.2);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
        return geometry;
    }

    // Sampler-driven scatter shared by flat platforms and terrain: ~7% of
    // spots become flowers, the rest grass tufts.
    scatterFlora(sampler, tries){
        if(!this.tuftGeometry){
            this.tuftGeometry = this.buildTuftGeometry();
            this.flowerGeometry = this.buildFlowerGeometry();
            this.grassMaterial = this.swayMaterial(4.2);
            this.flowerMaterials = [0xfff2f8, 0xff9fd0, 0xffe066].map(tint => {
                const material = this.swayMaterial(3.2);
                material.color.setHex(tint);
                return material;
            });
        }
        const grassSpots = [];
        const flowerBuckets = [[], [], []];
        sampler(tries, (x, y, z) => {
            if(Math.random() < 0.07){
                flowerBuckets[Math.floor(Math.random() * 3)].push({ x, y, z });
            } else {
                grassSpots.push({ x, y, z });
            }
        });
        const dummy = new THREE.Object3D();
        const place = (spots, geometry, material) => {
            if(!spots.length) return;
            const instanced = new THREE.InstancedMesh(geometry, material, spots.length);
            spots.forEach((spot, i) => {
                dummy.position.set(spot.x, spot.y - 1, spot.z);
                dummy.rotation.y = Math.random() * Math.PI * 2;
                const s = 0.7 + Math.random() * 0.7;
                dummy.scale.set(s, s, s);
                dummy.updateMatrix();
                instanced.setMatrixAt(i, dummy.matrix);
            });
            instanced.instanceMatrix.needsUpdate = true;
            this.scene.add(instanced);
            this.grassMeshes.push(instanced);
        };
        place(grassSpots, this.tuftGeometry, this.grassMaterial);
        flowerBuckets.forEach((bucket, i) => place(bucket, this.flowerGeometry, this.flowerMaterials[i]));
    }

    componentDidMount(){
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(SKY_HORIZON.getHex(), 5000, 16000);

        this.camera = new THREE.PerspectiveCamera(60, width / height, 1, 40000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.mountRef.current.appendChild(this.renderer.domElement);

        this.buildSky();
        this.buildWater();
        this.buildClouds();

        this.addPointerListeners();
        this.resizeListener = () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', this.resizeListener);

        this.running = true;
        const animate = () => {
            if(!this.running) return;
            requestAnimationFrame(animate);
            this.tick();
        };
        animate();
    }

    componentWillUnmount(){
        this.running = false;
        window.removeEventListener('resize', this.resizeListener);
        this.removePointerListeners();
        if (this.renderer) {
            this.renderer.dispose();
            if (this.mountRef.current && this.renderer.domElement.parentNode === this.mountRef.current) {
                this.mountRef.current.removeChild(this.renderer.domElement);
            }
        }
    }

    // ---------- world dressing ----------

    buildSky(){
        const geometry = new THREE.SphereBufferGeometry(20000, 24, 16);
        const material = new THREE.ShaderMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            fog: false,
            uniforms: {
                top: { value: SKY_TOP },
                horizon: { value: SKY_HORIZON }
            },
            vertexShader: `
                varying vec3 vPos;
                void main(){
                    vPos = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }`,
            fragmentShader: `
                uniform vec3 top;
                uniform vec3 horizon;
                varying vec3 vPos;
                void main(){
                    float h = clamp(vPos.y / 8000.0, 0.0, 1.0);
                    gl_FragColor = vec4(mix(horizon, top, pow(h, 0.8)), 1.0);
                }`
        });
        this.skyDome = new THREE.Mesh(geometry, material);
        this.scene.add(this.skyDome);

        const hemisphere = new THREE.HemisphereLight(0xeaf3ff, 0x3a6b4a, 0.85);
        this.scene.add(hemisphere);

        this.sun = new THREE.DirectionalLight(0xfff3d6, 0.95);
        this.sun.position.set(60, 6000, 0);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(2048, 2048);
        this.sun.shadow.camera.left = -3500;
        this.sun.shadow.camera.right = 3500;
        this.sun.shadow.camera.top = 3500;
        this.sun.shadow.camera.bottom = -3500;
        this.sun.shadow.camera.near = 100;
        this.sun.shadow.camera.far = 16000;
        this.sun.shadow.bias = -0.0005;
        this.scene.add(this.sun);
        this.scene.add(this.sun.target);

        const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: particleTexture(), color: SUN, fog: false, depthWrite: false }));
        sunGlow.scale.set(4500, 4500, 1);
        sunGlow.position.set(1500, 11000, -3000);
        this.scene.add(sunGlow);
        const sunBall = new THREE.Mesh(
            new THREE.SphereBufferGeometry(600, 16, 16),
            new THREE.MeshBasicMaterial({ color: SUN, fog: false }));
        sunBall.position.copy(sunGlow.position);
        this.scene.add(sunBall);
    }

    buildWater(){
        const geometry = new THREE.PlaneBufferGeometry(60000, 60000, 96, 96);
        this.waterUniforms = {
            time: { value: 0 },
            shallow: { value: WATER_SHALLOW },
            deep: { value: WATER_DEEP },
            fogColor: { value: SKY_HORIZON },
            fogNear: { value: 5000 },
            fogFar: { value: 16000 }
        };
        const material = new THREE.ShaderMaterial({
            transparent: true,
            uniforms: this.waterUniforms,
            vertexShader: `
                uniform float time;
                varying float vWave;
                varying float vFogDepth;
                varying vec2 vPos;
                void main(){
                    vec3 p = position;
                    // Several non-aligned directions so no banding pattern repeats.
                    float wave = sin(dot(p.xy, vec2(0.0041, 0.0017)) + time * 1.4) * 0.42
                               + sin(dot(p.xy, vec2(-0.0023, 0.0051)) - time * 1.1) * 0.3
                               + sin(dot(p.xy, vec2(0.0013, -0.0031)) + time * 0.7) * 0.2
                               + sin(dot(p.xy, vec2(0.0093, 0.0078)) + time * 2.3) * 0.1;
                    p.z += wave * 26.0;
                    vWave = wave;
                    vPos = p.xy;
                    vec4 mv = modelViewMatrix * vec4(p, 1.0);
                    vFogDepth = -mv.z;
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: `
                uniform float time;
                uniform vec3 shallow;
                uniform vec3 deep;
                uniform vec3 fogColor;
                uniform float fogNear;
                uniform float fogFar;
                varying float vWave;
                varying float vFogDepth;
                varying vec2 vPos;

                float hash(vec2 p){
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
                }
                float noise(vec2 p){
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    vec2 u = f * f * (3.0 - 2.0 * f);
                    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
                }

                void main(){
                    // Large drifting patches break up the tone; small ripple
                    // noise adds texture; rare bright cells read as sun glints.
                    float patches = noise(vPos * 0.0006 + vec2(time * 0.03, -time * 0.02));
                    float ripple = noise(vPos * 0.006 + vec2(-time * 0.12, time * 0.09));
                    vec3 colour = mix(deep, shallow, clamp(vWave * 0.35 + patches * 0.55 + 0.25, 0.0, 1.0));
                    colour += (ripple - 0.5) * 0.06;
                    float glint = smoothstep(0.86, 0.99, noise(vPos * 0.012 + vec2(time * 0.22, time * 0.18)));
                    colour += glint * 0.18;
                    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
                    gl_FragColor = vec4(mix(colour, fogColor, fogFactor), 0.92);
                }`
        });
        this.waterMesh = new THREE.Mesh(geometry, material);
        this.waterMesh.rotation.x = -Math.PI / 2;
        this.waterMesh.position.y = 0;
        this.scene.add(this.waterMesh);
        this.waterLevel = 0;
    }

    buildClouds(){
        this.clouds = [];
        for(let i = 0; i < 10; i++){
            const cloud = new THREE.Sprite(new THREE.SpriteMaterial({
                map: cloudTexture(), transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
            const scale = 1500 + Math.random() * 2500;
            cloud.scale.set(scale, scale * 0.5, 1);
            cloud.position.set(
                (Math.random() - 0.5) * 24000,
                2500 + Math.random() * 2500,
                (Math.random() - 0.5) * 24000);
            cloud.userData.drift = 1.2 + Math.random() * 2;
            this.scene.add(cloud);
            this.clouds.push(cloud);
        }
    }

    // ---------- pointer-driven orbit camera ----------

    addPointerListeners(){
        const dom = this.renderer.domElement;
        this.onPointerDown = (e) => {
            this.dragging = true;
            this.lastPointer = { x: e.clientX, y: e.clientY };
        };
        this.onPointerMove = (e) => {
            if(!this.dragging) return;
            const dx = e.clientX - this.lastPointer.x;
            const dy = e.clientY - this.lastPointer.y;
            this.lastPointer = { x: e.clientX, y: e.clientY };
            this.cameraYaw -= dx * 0.005;
            this.cameraPitch = Math.min(1.35, Math.max(0.08, this.cameraPitch + dy * 0.005));
        };
        this.onPointerUp = () => { this.dragging = false; };
        this.onWheel = (e) => {
            this.cameraDistance = Math.min(4000, Math.max(320, this.cameraDistance + e.deltaY));
        };
        dom.addEventListener('mousedown', this.onPointerDown);
        window.addEventListener('mousemove', this.onPointerMove);
        window.addEventListener('mouseup', this.onPointerUp);
        dom.addEventListener('wheel', this.onWheel);

        dom.addEventListener('touchstart', this.onTouchStart = (e) => {
            if(e.touches.length === 1){
                this.dragging = true;
                this.lastPointer = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        });
        dom.addEventListener('touchmove', this.onTouchMove = (e) => {
            if(this.dragging && e.touches.length === 1){
                this.onPointerMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
            }
        });
        dom.addEventListener('touchend', this.onTouchEnd = () => { this.dragging = false; });
    }

    removePointerListeners(){
        const dom = this.renderer && this.renderer.domElement;
        if(!dom) return;
        dom.removeEventListener('mousedown', this.onPointerDown);
        window.removeEventListener('mousemove', this.onPointerMove);
        window.removeEventListener('mouseup', this.onPointerUp);
        dom.removeEventListener('wheel', this.onWheel);
        dom.removeEventListener('touchstart', this.onTouchStart);
        dom.removeEventListener('touchmove', this.onTouchMove);
        dom.removeEventListener('touchend', this.onTouchEnd);
    }

    // Camera-forward on the XZ plane: the service projects WASD through this.
    getForward(){
        return { x: -Math.sin(this.cameraYaw), z: -Math.cos(this.cameraYaw) };
    }

    // ---------- interface shared with the 2D canvas ----------

    draw(state, name, lastWinner, showGui){
        this.state3d = state;
        this.myName = name;
    }

    event(event){
        if(!event) return;
        const at = event.location && event.location.z !== undefined ? event.location : null;
        switch(event.type){
            case "collision":
                if(at) this.burst(at, event.type === "collision" && event.speed > 30 ? 0xffe066 : 0xfff3b0, 14, 16, 0.4);
                break;
            case "boost":
                if(at) this.burst(at, 0xaadcff, 10, 12, 0.3);
                break;
            case "hit":
                if(at) this.burst(at, 0xefe6d5, 8, 8, 0.25);
                break;
            case "death":
                if(at && event.causeOfDeath === "water"){
                    this.splash(at);
                } else if(at){
                    this.burst(at, 0xff5577, 22, 20, 0.6);
                }
                break;
            case "goal":
            case "capture":
                if(at) this.confetti(at);
                break;
            case "box":
                if(at) this.burst(at, 0xffd700, 18, 14, 0.5);
                break;
            default:
                break;
        }
    }

    setCountdown(countdown){ }
    setGameMode(gameMode){ }
    updateGameCountdown(gameCountdown){ }
    setScale(scale){ }
    newGame(players){ }
    changeAvatar(avatar){ }
    fullScreen(enabled){ }
    resetCamera(){
        this.cameraYaw = Math.PI / 4;
        this.cameraPitch = 0.42;
        this.cameraDistance = 850;
    }
    analogScale(value){
        this.analogZoom = value;
    }

    // ---------- per-frame update ----------

    tick(){
        const dt = Math.min(this.clock.getDelta(), 0.1);
        this.elapsed += dt;
        const state = this.state3d;
        if(state){
            this.syncLevel(state.level);
            this.syncWater(state.level, dt);
            this.syncPlatformDurability(state.level);
            this.syncPlayers(state, dt);
        }
        this.updateClouds(dt);
        this.updateParticles(dt);
        this.updateCamera(dt);
        this.waterUniforms.time.value = this.elapsed;
        this.windTime.value = this.elapsed;
        this.renderer.render(this.scene, this.camera);
    }

    updateClouds(dt){
        this.clouds.forEach(cloud => {
            cloud.position.x += cloud.userData.drift * dt * 60;
            if(cloud.position.x > 14000) cloud.position.x = -14000;
        });
    }

    syncWater(level, dt){
        const target = level ? (level.waterLevel || 0) : 0;
        this.waterLevel += (target - this.waterLevel) * Math.min(1, dt * 4);
        this.waterMesh.position.y = this.waterLevel;
        this.foamMeshes.forEach(foam => {
            foam.mesh.position.y = this.waterLevel + 4;
            foam.mesh.visible = foam.platform.y <= this.waterLevel && foam.platform.y + foam.platform.height >= this.waterLevel;
        });
    }

    // ---------- level ----------

    clearLevel(){
        this.platformMeshes.forEach(m => this.scene.remove(m.mesh));
        this.platformMeshes = [];
        this.foamMeshes.forEach(m => this.scene.remove(m.mesh));
        this.foamMeshes = [];
        if(this.grassMeshes){
            this.grassMeshes.forEach(m => this.scene.remove(m));
        }
        this.grassMeshes = [];
        if(this.terrainMesh){
            this.scene.remove(this.terrainMesh);
            this.terrainMesh.geometry.dispose();
            this.terrainMesh = null;
        }
    }

    // Client-side mirror of the server's bilinear terrain lookup.
    terrainHeightAt(x, z){
        const level = this.state3d && this.state3d.level;
        if(!level || !level.terrainCols) return null;
        const fx = (x - level.terrainX) / level.terrainElement;
        const fz = (z - level.terrainZ) / level.terrainElement;
        if(fx < 0 || fz < 0 || fx > level.terrainCols - 1 || fz > level.terrainRows - 1) return null;
        const ix = Math.min(Math.floor(fx), level.terrainCols - 2);
        const iz = Math.min(Math.floor(fz), level.terrainRows - 2);
        const tx = fx - ix, tz = fz - iz;
        const h = (i, j) => level.terrain[i * level.terrainRows + j];
        return h(ix, iz) * (1 - tx) * (1 - tz)
             + h(ix + 1, iz) * tx * (1 - tz)
             + h(ix, iz + 1) * (1 - tx) * tz
             + h(ix + 1, iz + 1) * tx * tz;
    }

    buildTerrain(level){
        if(!level.terrainCols) return;
        const cols = level.terrainCols, rows = level.terrainRows, element = level.terrainElement;
        const positions = [];
        const colours = [];
        const indices = [];
        const sand = new THREE.Color(0xe8d8a8);
        const grassLow = new THREE.Color(0x3bb863);
        const grassHigh = new THREE.Color(0x6fe392);
        const colour = new THREE.Color();
        for(let ix = 0; ix < cols; ix++){
            for(let iz = 0; iz < rows; iz++){
                const h = level.terrain[ix * rows + iz];
                positions.push(level.terrainX + ix * element, h, level.terrainZ + iz * element);
                // Sandy at the shoreline, fresh green low, lighter on the tops.
                if(h < 20){
                    colour.copy(sand);
                } else if(h < 55){
                    colour.copy(sand).lerp(grassLow, (h - 20) / 35);
                } else {
                    colour.copy(grassLow).lerp(grassHigh, Math.min(1, (h - 55) / 420));
                }
                colours.push(colour.r, colour.g, colour.b);
            }
        }
        for(let ix = 0; ix < cols - 1; ix++){
            for(let iz = 0; iz < rows - 1; iz++){
                const a = ix * rows + iz;
                const b = (ix + 1) * rows + iz;
                indices.push(a, a + 1, b, b, a + 1, b + 1);
            }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        this.terrainMesh = new THREE.Mesh(geometry,
            new THREE.MeshLambertMaterial({ vertexColors: true }));
        this.terrainMesh.receiveShadow = true;
        this.terrainMesh.castShadow = true;
        this.scene.add(this.terrainMesh);

        this.scatterFlora((tries, place) => {
            for(let i = 0; i < tries; i++){
                const x = level.terrainX + Math.random() * (cols - 1) * element;
                const z = level.terrainZ + Math.random() * (rows - 1) * element;
                const h = this.terrainHeightAt(x, z);
                if(h == null || h < this.waterLevel + 45) continue;
                place(x, h, z);
            }
        }, Math.floor(cols * rows / 2.2));
    }

    syncLevel(level){
        if(!level) return;
        // The Flood adds and prunes pads mid-round, so rebuild on count
        // changes as well as on a new map.
        if(level.name === this.levelName && level.platforms.length === this.lastPlatformCount) return;
        this.levelName = level.name;
        this.lastPlatformCount = level.platforms.length;
        this.clearLevel();
        this.levelMaxTop = level.platforms.reduce((acc, p) =>
            p.type === "goal" ? acc : Math.max(acc, p.y + p.height), 0);
        if(level.terrain){
            level.terrain.forEach(h => { this.levelMaxTop = Math.max(this.levelMaxTop, h); });
        }
        this.buildTerrain(level);

        level.platforms.forEach(platform => {
            let mesh;
            if(platform.type === "tree"){
                mesh = this.buildTree(platform);
            } else if(platform.type === "house"){
                mesh = this.buildHouse(platform);
            } else if(platform.type === "goal"){
                const colour = TEAM_COLOURS[platform.colour] || 0xffffff;
                mesh = new THREE.Mesh(
                    new THREE.BoxBufferGeometry(platform.width, platform.height, platform.depth),
                    new THREE.MeshLambertMaterial({ color: colour, transparent: true, opacity: 0.22, depthWrite: false }));
                const frame = new THREE.LineSegments(
                    new THREE.EdgesGeometry(new THREE.BoxBufferGeometry(platform.width, platform.height, platform.depth)),
                    new THREE.LineBasicMaterial({ color: colour }));
                mesh.add(frame);
            } else {
                mesh = this.buildIsland(platform);
            }
            mesh.position.set(
                platform.x + platform.width / 2,
                platform.y + platform.height / 2,
                platform.z + platform.depth / 2);
            this.scene.add(mesh);
            this.platformMeshes.push({
                mesh,
                platform,
                bounds: new THREE.Box3(
                    new THREE.Vector3(platform.x, platform.y, platform.z),
                    new THREE.Vector3(platform.x + platform.width, platform.y + platform.height, platform.z + platform.depth)),
                fade: 1
            });

            if(platform.type !== "goal" && platform.type !== "tree" && platform.type !== "house"){
                this.addFoam(platform);
                this.addGrass(platform);
            }
        });
    }

    // Decorative tree: trunk + two stacked leafy blobs filling the box.
    buildTree(platform){
        const group = new THREE.Group();
        const trunkHeight = platform.height * 0.45;
        const trunk = new THREE.Mesh(
            new THREE.CylinderBufferGeometry(platform.width * 0.09, platform.width * 0.13, trunkHeight, 7),
            new THREE.MeshLambertMaterial({ color: 0x6b4a2a }));
        trunk.position.y = -platform.height / 2 + trunkHeight / 2;
        trunk.castShadow = true;
        group.add(trunk);
        const leafMaterial = new THREE.MeshLambertMaterial({ color: 0x2fae57 });
        const lower = new THREE.Mesh(new THREE.SphereBufferGeometry(platform.width * 0.55, 10, 8), leafMaterial);
        lower.position.y = -platform.height / 2 + trunkHeight + platform.width * 0.25;
        lower.castShadow = true;
        group.add(lower);
        const upper = new THREE.Mesh(
            new THREE.SphereBufferGeometry(platform.width * 0.38, 9, 7),
            new THREE.MeshLambertMaterial({ color: 0x44db6c }));
        upper.position.y = lower.position.y + platform.width * 0.42;
        upper.castShadow = true;
        group.add(upper);
        return group;
    }

    // Solid little cottage: walls, pyramid roof, door.
    buildHouse(platform){
        const group = new THREE.Group();
        const wallHeight = platform.height * 0.62;
        const walls = new THREE.Mesh(
            new THREE.BoxBufferGeometry(platform.width, wallHeight, platform.depth),
            new THREE.MeshLambertMaterial({ color: 0xf2e3c6 }));
        walls.position.y = -platform.height / 2 + wallHeight / 2;
        walls.castShadow = true;
        walls.receiveShadow = true;
        group.add(walls);
        const roof = new THREE.Mesh(
            new THREE.ConeBufferGeometry(platform.width * 0.78, platform.height - wallHeight, 4),
            new THREE.MeshLambertMaterial({ color: 0xc1453a }));
        roof.position.y = -platform.height / 2 + wallHeight + (platform.height - wallHeight) / 2;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        group.add(roof);
        const door = new THREE.Mesh(
            new THREE.PlaneBufferGeometry(platform.width * 0.22, wallHeight * 0.55),
            new THREE.MeshLambertMaterial({ color: 0x5a3a22 }));
        door.position.set(0, -platform.height / 2 + wallHeight * 0.28, platform.depth / 2 + 2);
        group.add(door);
        return group;
    }

    buildIsland(platform){
        const group = new THREE.Group();
        const topColour = platform.colour ? TEAM_COLOURS[platform.colour] : GRASS_GREENS[0];

        // Platforms sitting in the sea get earthy soil sides; raised ground
        // (plateaus, tiers, floating pads) reads as grassy banks instead of
        // towering mud walls.
        const elevated = platform.y > this.waterLevel + 1;
        const sideColour = platform.type === "pad" ? 0xd9e8f5 : elevated ? 0x35a85b : PLATFORM;
        const soil = new THREE.Mesh(
            new THREE.BoxBufferGeometry(platform.width, platform.height, platform.depth),
            new THREE.MeshLambertMaterial({ color: sideColour }));
        soil.castShadow = true;
        soil.receiveShadow = true;
        group.add(soil);

        // The 2D maps' green strip becomes a turf slab that slightly overhangs.
        const turfHeight = Math.min(26, platform.height / 3);
        const turf = new THREE.Mesh(
            new THREE.BoxBufferGeometry(platform.width + 8, turfHeight, platform.depth + 8),
            new THREE.MeshLambertMaterial({ color: platform.type === "pad" ? 0xfafdff : topColour }));
        turf.position.y = platform.height / 2 - turfHeight / 2 + 2;
        turf.castShadow = true;
        turf.receiveShadow = true;
        group.add(turf);

        return group;
    }

    addFoam(platform){
        const foam = new THREE.Mesh(
            new THREE.PlaneBufferGeometry(platform.width + 44, platform.depth + 44),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false }));
        foam.rotation.x = -Math.PI / 2;
        foam.position.set(
            platform.x + platform.width / 2,
            this.waterLevel + 4,
            platform.z + platform.depth / 2);
        this.scene.add(foam);
        this.foamMeshes.push({ mesh: foam, platform });
    }

    addGrass(platform){
        if(platform.type === "pad" || platform.colour) return;
        const area = platform.width * platform.depth;
        const tries = Math.min(280, Math.floor(area / 14000));
        if(tries <= 0) return;
        this.scatterFlora((n, place) => {
            for(let i = 0; i < n; i++){
                place(
                    platform.x + 25 + Math.random() * (platform.width - 50),
                    platform.y + platform.height,
                    platform.z + 25 + Math.random() * (platform.depth - 50));
            }
        }, tries);
    }

    syncPlatformDurability(level){
        if(!level) return;
        this.platformMeshes.forEach(({ mesh, platform }, index) => {
            const live = level.platforms[index];
            if(!live || live.type === "border" || live.type === "goal") return;
            const durability = live.durability != null ? live.durability : 100;
            if(durability <= 0 && mesh.visible){
                mesh.visible = false;
                this.burst({
                    x: live.x + live.width / 2,
                    y: live.y + live.height,
                    z: live.z + live.depth / 2
                }, 0xdde9f5, 16, 18, 0.5);
            } else if(durability > 0){
                mesh.visible = true;
                if(live.type === "pad"){
                    // Pads blush red as they crumble.
                    const stress = 1 - durability / 100;
                    mesh.children.forEach(child => {
                        if(child.material && child.material.color){
                            child.material.color.setRGB(1, 1 - stress * 0.55, 1 - stress * 0.7);
                        }
                    });
                    mesh.position.x = live.x + live.width / 2 + (Math.random() - 0.5) * stress * 14;
                    mesh.position.z = live.z + live.depth / 2 + (Math.random() - 0.5) * stress * 14;
                }
            }
        });
    }

    // ---------- players ----------

    syncPlayers(state, dt){
        const seen = new Set();
        state.players.forEach(player => {
            const key = player.clientId || player.sessionId || player.name;
            seen.add(key);
            let rig = this.playerRigs.get(key);
            const wantType = player.type || "player";
            if(rig && rig.type !== wantType){
                this.scene.remove(rig.group);
                this.playerRigs.delete(key);
                rig = null;
            }
            if(!rig){
                rig = wantType === "ball" ? this.createBall(player)
                    : wantType === "orb" ? this.createOrb(player)
                    : wantType === "flag" ? this.createFlag(player)
                    : this.createPlayer(player);
                rig.type = wantType;
                this.playerRigs.set(key, rig);
                this.scene.add(rig.group);
            }
            if(wantType === "ball") this.updateBall(rig, player, dt);
            else if(wantType === "orb") this.updateOrb(rig, player, dt);
            else if(wantType === "flag") this.updateFlag(rig, player, dt);
            else this.updatePlayer(rig, player, dt);
        });
        Array.from(this.playerRigs.keys()).forEach(key => {
            if(!seen.has(key)){
                this.scene.remove(this.playerRigs.get(key).group);
                this.playerRigs.delete(key);
            }
        });
    }

    createPlayer(player){
        const group = new THREE.Group();
        const colour = new THREE.Color(player.colour || '#999');
        const limbMaterial = new THREE.MeshLambertMaterial({ color: 0x16161e });

        const pose = new THREE.Group();   // squash & stretch happens here
        // Yaw first, then lean: with the default XYZ order the lean would be
        // around the world x-axis and players would tilt sideways when
        // running along x.
        pose.rotation.order = 'YXZ';
        group.add(pose);

        const body = new THREE.Mesh(
            new THREE.BoxBufferGeometry(BODY_W, BODY_H, BODY_D),
            new THREE.MeshLambertMaterial({ color: colour, transparent: true }));
        body.position.y = LEG_H + BODY_H / 2;
        body.castShadow = true;
        pose.add(body);

        const face = new THREE.Mesh(
            new THREE.PlaneBufferGeometry(BODY_W * 0.9, BODY_H * 0.9),
            new THREE.MeshBasicMaterial({ map: faceTexture(), transparent: true, depthWrite: false }));
        face.position.set(0, LEG_H + BODY_H / 2 + 3, BODY_D / 2 + 1.5);
        pose.add(face);

        // Slim black legs ending in little black boots, hip-pivoted.
        const makeLeg = () => {
            const leg = new THREE.Group();
            const shin = new THREE.Mesh(new THREE.BoxBufferGeometry(7, LEG_H, 8), limbMaterial);
            shin.position.y = -LEG_H / 2;
            shin.castShadow = true;
            leg.add(shin);
            const boot = new THREE.Mesh(new THREE.BoxBufferGeometry(11, 8, 18), limbMaterial);
            boot.position.set(0, -LEG_H + 4, 4);
            leg.add(boot);
            return leg;
        };
        const legLeft = makeLeg();
        legLeft.position.set(-12, LEG_H, 0);
        pose.add(legLeft);
        const legRight = makeLeg();
        legRight.position.set(12, LEG_H, 0);
        pose.add(legRight);

        const band = new THREE.Mesh(
            new THREE.BoxBufferGeometry(BODY_W + 6, 10, BODY_D + 6),
            new THREE.MeshLambertMaterial({ color: 0xffffff }));
        band.position.y = LEG_H + 12;
        band.visible = false;
        pose.add(band);

        const nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: new THREE.CanvasTexture(this.nameCanvas(player.name, 100)), fog: false, depthWrite: false }));
        nameSprite.scale.set(300, 75, 1);
        nameSprite.position.y = LEG_H + BODY_H + 80;
        group.add(nameSprite);

        const halo = new THREE.Mesh(
            new THREE.TorusBufferGeometry(40, 7, 10, 28),
            new THREE.MeshBasicMaterial({ color: HALO }));
        halo.rotation.x = Math.PI / 2;
        halo.position.y = LEG_H + BODY_H + 35;
        halo.visible = false;
        group.add(halo);

        return {
            group, pose, body, face, legLeft, legRight,
            band, nameSprite, halo,
            facing: 0, walkPhase: 0, stretch: 1, wasOnSurface: true, lastNameKey: null,
            dustTimer: 0
        };
    }

    nameCanvas(name, health){
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        // Same health fade as 2D: names cool from white-hot to pink as health drops.
        const proportion = Math.round(255 * (health / 100));
        ctx.font = "bold 56px UnitBlock, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,0.7)";
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
        ctx.fillStyle = `rgb(255, ${proportion}, ${proportion})`;
        ctx.fillText(name || "", 256, 64);
        return canvas;
    }

    updatePlayer(rig, player, dt){
        const { group, pose, body, legLeft, legRight } = rig;
        group.visible = !!player.alive;
        if(!player.alive) return;

        // Snap far teleports (respawns), smooth small movements.
        const target = new THREE.Vector3(player.x, player.y, player.z);
        if(group.position.distanceTo(target) > 400){
            group.position.copy(target);
        } else {
            group.position.lerp(target, 0.55);
        }

        const horizontalSpeed = Math.hypot(player.xVelocity || 0, player.zVelocity || 0);

        // Face the direction of travel.
        if(horizontalSpeed > 1.2){
            const targetFacing = Math.atan2(player.xVelocity, player.zVelocity);
            rig.facing = lerpAngle(rig.facing, targetFacing, Math.min(1, dt * 10));
        }
        pose.rotation.y = rig.facing;

        // Lean into motion.
        const lean = Math.min(0.35, horizontalSpeed * 0.012);
        pose.rotation.x = lean;

        // Walk cycle: legs scissor on the ground, tuck mid-air.
        if(player.onSurface && horizontalSpeed > 0.5){
            rig.walkPhase += dt * (6 + horizontalSpeed * 0.55);
            const swing = Math.sin(rig.walkPhase) * Math.min(1, horizontalSpeed * 0.12);
            legLeft.rotation.x = swing;
            legRight.rotation.x = -swing;
        } else if(!player.onSurface){
            const rising = (player.yVelocity || 0) > 2;
            legLeft.rotation.x += ((rising ? 0.7 : 0.35) - legLeft.rotation.x) * 0.2;
            legRight.rotation.x += ((rising ? 0.4 : 0.1) - legRight.rotation.x) * 0.2;
        } else {
            legLeft.rotation.x *= 0.8;
            legRight.rotation.x *= 0.8;
        }

        // Squash & stretch: stretch on launch, squash on landing, flat when ducked.
        if(!rig.wasOnSurface && player.onSurface){
            rig.stretch = 0.62;
            if(this.elapsed - (rig.lastDustAt || 0) > 0.2){
                rig.lastDustAt = this.elapsed;
                this.burst({ x: player.x, y: player.y + 6, z: player.z }, 0xf5efdc, 8, 8, 0.3, 0.4);
            }
        }
        if(rig.wasOnSurface && !player.onSurface && (player.yVelocity || 0) > 4){
            rig.stretch = 1.35;
        }
        rig.wasOnSurface = !!player.onSurface;
        const targetScale = player.ducked ? 0.42 : 1;
        rig.stretch += (targetScale - rig.stretch) * Math.min(1, dt * 9);
        pose.scale.set(1 / Math.sqrt(rig.stretch) * (player.ducked ? 1.35 : 1), rig.stretch, 1 / Math.sqrt(rig.stretch) * (player.ducked ? 1.35 : 1));

        // Running kicks up dust.
        rig.dustTimer -= dt;
        if(player.onSurface && horizontalSpeed > 14 && rig.dustTimer <= 0){
            rig.dustTimer = 0.12;
            this.burst({ x: player.x, y: player.y + 4, z: player.z }, 0xf0e9d8, 2, 5, 0.22, 0.35);
        }

        // Invincibility flicker + damage wobble.
        body.material.opacity = player.invincibility > 0 ? 0.45 + 0.3 * Math.sin(this.elapsed * 24) : 1;
        const damage = 1 - (player.health || 0) / 100;
        pose.rotation.z = Math.sin(this.elapsed * 13) * 0.25 * damage;

        rig.halo.visible = !!player.it;
        if(rig.halo.visible){
            rig.halo.rotation.z = this.elapsed * 2;
            rig.halo.position.y = LEG_H + BODY_H + 35 + Math.sin(this.elapsed * 3) * 5;
        }

        rig.band.visible = !!player.team;
        if(player.team){
            rig.band.material.color.setHex(TEAM_COLOURS[player.team] || 0xffffff);
        }

        // Redraw the name texture when name or health bucket changes.
        const nameKey = `${player.name}|${Math.round((player.health || 0) / 10)}`;
        if(rig.lastNameKey !== nameKey){
            rig.lastNameKey = nameKey;
            if(rig.nameSprite.material.map){
                rig.nameSprite.material.map.dispose();
            }
            rig.nameSprite.material.map = new THREE.CanvasTexture(this.nameCanvas(player.name, player.health || 0));
            rig.nameSprite.material.needsUpdate = true;
        }
    }

    // ---------- entities ----------

    createBall(player){
        const group = new THREE.Group();
        const ball = new THREE.Mesh(
            new THREE.SphereBufferGeometry(player.width / 2, 24, 18),
            new THREE.MeshLambertMaterial({ map: ballTexture() }));
        ball.castShadow = true;
        ball.position.y = player.width / 2;
        group.add(ball);
        return { group, ball, radius: player.width / 2 };
    }

    updateBall(rig, player, dt){
        const target = new THREE.Vector3(player.x, player.y, player.z);
        if(rig.group.position.distanceTo(target) > 500) rig.group.position.copy(target);
        else rig.group.position.lerp(target, 0.55);

        // Roll: rotate about the axis perpendicular to travel.
        const vx = player.xVelocity || 0, vz = player.zVelocity || 0;
        const speed = Math.hypot(vx, vz);
        if(speed > 0.3){
            const axis = new THREE.Vector3(vz / speed, 0, -vx / speed);
            rig.ball.rotateOnWorldAxis(axis, speed * dt * 60 / rig.radius);
        }
    }

    createOrb(player){
        const group = new THREE.Group();
        const box = new THREE.Mesh(
            new THREE.BoxBufferGeometry(46, 46, 46),
            new THREE.MeshLambertMaterial({ color: 0xffd700, emissive: 0x8a6d00 }));
        box.castShadow = true;
        group.add(box);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: particleTexture(), color: 0xffe680, transparent: true, opacity: 0.55, depthWrite: false }));
        glow.scale.set(160, 160, 1);
        group.add(glow);
        return { group, box, glow, sparkleTimer: 0 };
    }

    updateOrb(rig, player, dt){
        rig.group.position.set(player.x, player.y + 50 + Math.sin(this.elapsed * 2.4) * 14, player.z);
        rig.box.rotation.y = this.elapsed * 1.6;
        rig.box.rotation.x = Math.sin(this.elapsed * 0.9) * 0.3;
        rig.sparkleTimer -= dt;
        if(rig.sparkleTimer <= 0){
            rig.sparkleTimer = 0.5;
            this.burst({ x: player.x, y: player.y + 60, z: player.z }, 0xffe680, 2, 3, 0.2, 0.5);
        }
    }

    createFlag(player){
        const group = new THREE.Group();
        const colour = TEAM_COLOURS[player.colour] || 0xffffff;
        const pole = new THREE.Mesh(
            new THREE.CylinderBufferGeometry(4, 4, 130, 8),
            new THREE.MeshLambertMaterial({ color: 0xe8e3d8 }));
        pole.position.y = 65;
        group.add(pole);
        const cloth = new THREE.Mesh(
            new THREE.PlaneBufferGeometry(70, 42, 8, 1),
            new THREE.MeshLambertMaterial({ color: colour, side: THREE.DoubleSide }));
        cloth.position.set(37, 105, 0);
        group.add(cloth);
        return { group, cloth, basePositions: cloth.geometry.attributes.position.array.slice() };
    }

    updateFlag(rig, player, dt){
        const target = new THREE.Vector3(player.x, player.y, player.z);
        if(rig.group.position.distanceTo(target) > 500) rig.group.position.copy(target);
        else rig.group.position.lerp(target, 0.6);

        // Ripple the cloth.
        const positions = rig.cloth.geometry.attributes.position;
        for(let i = 0; i < positions.count; i++){
            const baseX = rig.basePositions[i * 3];
            positions.setZ(i, Math.sin(baseX * 0.12 + this.elapsed * 7) * 5 * ((baseX + 35) / 70));
        }
        positions.needsUpdate = true;
    }

    // ---------- particles ----------

    spawnParticle(at, colour, velocity, life, size, gravity){
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: particleTexture(), color: colour, transparent: true, depthWrite: false }));
        sprite.position.set(at.x, at.y, at.z);
        sprite.scale.set(size, size, 1);
        this.scene.add(sprite);
        this.particles.push({ sprite, velocity, life, maxLife: life, gravity });
    }

    burst(at, colour, count, speed, life, gravity = 0.2){
        for(let i = 0; i < count; i++){
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const magnitude = speed * (0.4 + Math.random() * 0.6) * 60;
            this.spawnParticle(at, colour, new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta) * magnitude,
                Math.abs(Math.cos(phi)) * magnitude * 0.9,
                Math.sin(phi) * Math.sin(theta) * magnitude
            ), life * (0.7 + Math.random() * 0.6), 18 + Math.random() * 26, gravity);
        }
    }

    splash(at){
        for(let i = 0; i < 26; i++){
            const theta = Math.random() * Math.PI * 2;
            const radial = 60 + Math.random() * 240;
            this.spawnParticle({ x: at.x, y: this.waterLevel + 6, z: at.z },
                i % 3 ? 0x9fd4ff : 0xffffff,
                new THREE.Vector3(Math.cos(theta) * radial, 400 + Math.random() * 500, Math.sin(theta) * radial),
                0.7 + Math.random() * 0.4, 20 + Math.random() * 24, 1.6);
        }
    }

    confetti(at){
        const colours = [0xff5050, 0x6a5acd, 0xffd700, 0x44db6c, 0x9fd4ff, 0xff9ff3];
        for(let i = 0; i < 42; i++){
            const theta = Math.random() * Math.PI * 2;
            const radial = 80 + Math.random() * 320;
            this.spawnParticle(at, colours[i % colours.length],
                new THREE.Vector3(Math.cos(theta) * radial, 500 + Math.random() * 600, Math.sin(theta) * radial),
                1.1 + Math.random() * 0.7, 14 + Math.random() * 18, 1.1);
        }
    }

    updateParticles(dt){
        this.particles = this.particles.filter(particle => {
            particle.life -= dt;
            if(particle.life <= 0){
                this.scene.remove(particle.sprite);
                particle.sprite.material.dispose();
                return false;
            }
            particle.sprite.position.addScaledVector(particle.velocity, dt);
            particle.velocity.y -= particle.gravity * 1600 * dt;
            particle.sprite.material.opacity = Math.min(1, particle.life / particle.maxLife * 1.6);
            return true;
        });
    }

    // ---------- camera ----------

    updateCamera(dt){
        this.cameraDistance = Math.min(4000, Math.max(320, this.cameraDistance + this.analogZoom * 30));

        let me = null;
        if(this.state3d && this.myName){
            this.state3d.players.forEach(p => {
                if(p.name === this.myName && p.alive && !p.type){
                    me = p;
                }
            });
        }

        if(me){
            // The camera keeps a constant angle: it tracks the player's
            // position smoothly but only the user rotates it (drag / stick).
            const targetPoint = new THREE.Vector3(me.x, me.y + 110, me.z);
            this.cameraTarget.lerp(targetPoint, Math.min(1, dt * 8));
        } else {
            // Spectator: drift slowly around the arena, above the terrain and water.
            this.cameraYaw += dt * 0.06;
            const overlookY = Math.max(350, this.waterLevel + 300, (this.levelMaxTop || 0) + 150);
            this.cameraTarget.lerp(new THREE.Vector3(0, overlookY, 0), Math.min(1, dt * 1.2));
        }

        const offset = new THREE.Vector3(
            Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch),
            Math.sin(this.cameraPitch),
            Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch)
        ).multiplyScalar(this.cameraDistance);

        this.camera.position.copy(this.cameraTarget).add(offset);
        // Don't dip the camera underwater.
        this.camera.position.y = Math.max(this.camera.position.y, this.waterLevel + 70);
        this.camera.lookAt(this.cameraTarget);
        this.fadeOccluders(dt);

        // Keep the sky and shadow frustum centred on the action.
        this.skyDome.position.copy(this.cameraTarget);
        this.sun.target.position.copy(this.cameraTarget);
        this.sun.position.copy(this.cameraTarget).add(new THREE.Vector3(60, 6000, 0));
    }

    // Terrain between the camera and the player goes translucent so you never
    // lose sight of yourself behind a hill.
    fadeOccluders(dt){
        const direction = new THREE.Vector3().subVectors(this.cameraTarget, this.camera.position);
        const distanceToTarget = direction.length();
        if(distanceToTarget < 1) return;
        const ray = new THREE.Ray(this.camera.position, direction.normalize());
        const hit = new THREE.Vector3();
        this.platformMeshes.forEach(entry => {
            if(entry.platform.type === "goal") return;
            const intersection = ray.intersectBox(entry.bounds, hit);
            const blocking = !!intersection && hit.distanceTo(this.camera.position) < distanceToTarget - 40;
            const targetFade = blocking ? 0.22 : 1;
            if(Math.abs(entry.fade - targetFade) < 0.01 && !blocking) return;
            entry.fade += (targetFade - entry.fade) * Math.min(1, dt * 8);
            const apply = (object) => {
                if(object.material && object.material.opacity !== undefined){
                    object.material.transparent = entry.fade < 0.99;
                    object.material.opacity = entry.fade;
                }
                if(object.children) object.children.forEach(apply);
            };
            apply(entry.mesh);
        });
    }

    render(){
        return <div ref={this.mountRef} className={styles.canvas3d}></div>;
    }
}

export default GameCanvas3D;
