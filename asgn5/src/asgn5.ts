import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FirstPersonCamera } from './FirstPersonCamera';
import { createSkyDome } from './sky';
import { createPainterlyMaterial } from './painterly';
import { isDebugMode, setDebugMode } from './debug';
import { createWaterMaterial, createWaterRenderer } from './water';
import ravineUrl from '../ravine.glb?url';
import burgerUrl from '../burger.glb?url';
import thingbabUrl from '../thingbab.glb?url';

const canvas = document.getElementById('webgl') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas element not found');

let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let fpCamera: FirstPersonCamera;
let thingbabMixer: THREE.AnimationMixer;
let clock: THREE.Clock;
let skyDome: ReturnType<typeof createSkyDome>;
let waterRenderer: ReturnType<typeof createWaterRenderer> | null = null;


let debugGroup: THREE.Group;


function degToRad(degrees) {
    return degrees * (Math.PI / 180);
}

function main(): void {
	scene = new THREE.Scene();
	scene.background = new THREE.Color(0x000000);

	renderer = new THREE.WebGLRenderer({ canvas });

	camera = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
	camera.position.set(-9.5, 2.15, -18.17);
	camera.rotation.set(degToRad(158), degToRad(-21), degToRad(172));
	fpCamera = new FirstPersonCamera(camera, canvas);
	window.addEventListener('mousemove', (e) => fpCamera.onMouseMove(e));
	window.addEventListener('resize', onResize);
	onResize();

	const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
	scene.add(ambientLight);

	skyDome = createSkyDome();
	scene.add(skyDome.mesh);
	scene.add(skyDome.sunLight);

	setupListeners();

	clock = new THREE.Clock();

	const loader = new GLTFLoader();
	const textureLoader = new THREE.TextureLoader();
	const waveTexture       = textureLoader.load('wave_texture.png');
	const waveNormalTexture = textureLoader.load('wave_normal.png');
	const foamTexture       = textureLoader.load('foam_texture.png');
	const causticsTexture   = textureLoader.load('caustics_texture.png');
	[waveTexture, waveNormalTexture, foamTexture, causticsTexture].forEach(t => {
		t.wrapS = t.wrapT = THREE.RepeatWrapping;
	});

	let thingbab;
	loader.load(thingbabUrl, (gltf) => {
		const thingbabMap = textureLoader.load('thingbab_albedo.png', () => {
			thingbabMap.colorSpace = THREE.SRGBColorSpace;
			thingbabMap.flipY = false;
		});

		thingbab = gltf.scene;
		thingbab.position.set(30.5, 36.0, 18.5);
		thingbab.rotation.set(degToRad(-180.0), degToRad(-55.5), degToRad(-180.0));

		const mat = new THREE.MeshStandardMaterial({
			map: thingbabMap,
			roughness: 0.8,
			metalness: 0.1,
			transparent: false,
			depthTest: true,
			depthWrite: true,
			side: THREE.FrontSide,
		});

		thingbab.traverse((obj) => {
			if (obj instanceof THREE.SkinnedMesh) {
				obj.material = mat;
			}
		});

		scene.add(thingbab);

		thingbabMixer = new THREE.AnimationMixer(thingbab);
		const anim = createAnimationController(thingbabMixer, gltf.animations);
		console.log(anim.list());
		anim.play(3);
	});

	// burger
	loader.load(burgerUrl, (gltf) => {
		const burgerTex = textureLoader.load('burger.png');
		burgerTex.colorSpace = THREE.SRGBColorSpace;
		burgerTex.flipY = false;

		const mat = createPainterlyMaterial({
			albedo: burgerTex,
			softness: 1.0,

			paintStrength: 0.15,
			paintScale: 8.0,
			paintDetail: 3.8,
			paintDetailScale: 1.6,
			paintCoordMode: 2,
			paintRoughness: 0.5,
			paintSmoothness: 0.086,

			shadowColor: new THREE.Color(37/255, 43/255, 53/255),
			shadowSize: 0.1,

			rimColor: new THREE.Color(118/255, 92/255, 255/255),
			rimSize: 0.37,
			highlightColor: new THREE.Color(1.0, 242/255, 148/255),
			highlightSize: 0.56,
		});

		gltf.scene.traverse((obj) => {
			if (obj instanceof THREE.Mesh) {
				obj.material = mat;
			}
		});

		gltf.scene.position.set(0, 2.5, 0);
		scene.add(gltf.scene);
	});

	const waterMat = createWaterMaterial({
		waveTexture: waveTexture,
		waveNormalTexture: waveNormalTexture,
		foamTexture: foamTexture,
		causticsTexture: causticsTexture,

		surfaceColor: new THREE.Color(101 / 255, 139 / 255, 91 / 255),
		depthColor: new THREE.Color(25 / 255, 60 / 255, 58 / 255),
		foamColor: new THREE.Color(143 / 255, 145 / 255, 116 / 255),
		depthSize: 9.0,

		waveScale: new THREE.Vector2(0.2, 0.2),
		waveLayerScale: new THREE.Vector2(0.5, 0.75),
		waveHighlight: 0.8,
		waveVelocity: new THREE.Vector2(0.04, 0.04),

		edgeFoamDepthSize: 0.485,
		waveFoamAmount: 0.0,
		foamStart: 0.0,
		foamEnd: 0.65,
		foamExponent: 1.0,

		causticsStrength: 1.0,
		causticsScale: new THREE.Vector2(0.7, 0.7),

		refractionAmount: 0.5,
		refreactionExponent: 0.5,

		displacementAmount: 0.3,
	});

	const pillarMat = createPainterlyMaterial({
		albedoTint: new THREE.Color(180/255, 192/255, 199/255),
		paintDetail: 3.8,
		paintDetailScale: 0.4,
		paintCoordMode: 2,
		paintStrength: 0.11,
		paintRoughness: 0.398,
		paintScale: 8.0,
		shadowColor: new THREE.Color(37/255, 43/255, 53/255),
		rimColor: new THREE.Color(171/255, 127/255, 229/255),
		rimSize: 0.515,
		highlightColor: new THREE.Color(1.0, 242/255, 148/255),
		highlightSize: 0.207,
	});
	const groundMat = new THREE.MeshStandardMaterial({
		color: 0xB5835A,
		roughness: 1.0,
		metalness: 0.0,
		transparent: false,
		depthTest: true,
		depthWrite: true,
		side: THREE.FrontSide,
	});
	const grassMat = new THREE.MeshStandardMaterial({
		color: 0xB1BF40,
		roughness: 1.0,
		metalness: 0.0,
		transparent: false,
		depthTest: true,
		depthWrite: true,
		side: THREE.FrontSide,
	});
	const foliage = textureLoader.load('foliage_atlas.png');
	foliage.colorSpace = THREE.SRGBColorSpace;
	foliage.flipY = false;
	const treeMat = new THREE.MeshStandardMaterial({
		map: foliage,
		alphaTest: 0.5,
		side: THREE.DoubleSide,
		roughness: 1.0,
		metalness: 0.0
	});

	loader.load(ravineUrl, (gltf) => {
		const ravine = gltf.scene;
		scene.add(ravine);

		// material swap...
		ravine.traverse((obj) => {
			if (!(obj instanceof THREE.Mesh)) return;
			const matName = (obj.material as THREE.Material).name;

			switch (matName) {
				case 'Trees': obj.material = treeMat; break;
				case 'pillar': obj.material = pillarMat; break;
				case 'ground': obj.material = groundMat; break;
				case 'grass':  obj.material = grassMat; break;
				case 'water':
					obj.material = waterMat;
					if (!waterRenderer) {
						waterRenderer = createWaterRenderer(renderer, obj);
						window.addEventListener('resize', () => waterRenderer!.resize(window.innerWidth, window.innerHeight));
					}
					break;
				default:
					console.log(`Unknown material: ${matName}`);
					break;
			}
		});
	});

	let light = new THREE.HemisphereLight(new THREE.Color(0x57E389), new THREE.Color(0xFACADE), 0.5);
	light.position.set(25.0, 5.0, 26.370);
	scene.add(light);

	// the "20 primitives"
	debugGroup = createDebugObjects();
	scene.add(debugGroup);


	requestAnimationFrame(render);
}

function onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(window.devicePixelRatio);
	camera.aspect = w / h;
	camera.updateProjectionMatrix();
}

function setupListeners(): void {
	let _debugMode = false;

	window.addEventListener('keydown', (e: KeyboardEvent) => {
		if (e.key === 'l' || e.key === 'L') {
			_debugMode = !_debugMode;
			setDebugMode(_debugMode, canvas, () => fpCamera.clampToNormalLimits());
			debugGroup.visible = _debugMode;
		}
	});

	document.addEventListener('pointerlockchange', () => {
		if (!document.pointerLockElement && isDebugMode()) {
			_debugMode = false;
			setDebugMode(false, canvas, () => fpCamera.clampToNormalLimits());
			debugGroup.visible = false;
		}
	});
}

function createAnimationController(mixer: THREE.AnimationMixer, animations: THREE.AnimationClip[]) {
    let current: THREE.AnimationAction | null = null;

    function play(index: number, fadeTime = 0.3) {
        const clip = animations[index];
        if (!clip) { console.warn(`No animation at index ${index}`); return; }

        const next = mixer.clipAction(clip);
        if (current && current !== next) {
            next.reset().fadeIn(fadeTime);
            current.fadeOut(fadeTime);
        } else {
            next.reset().play();
        }
        current = next;
    }

    function playByName(name: string, fadeTime = 0.3) {
        const index = animations.findIndex(a => a.name === name);
        if (index === -1) { console.warn(`No animation named "${name}"`); return; }
        play(index, fadeTime);
    }

    function stop(fadeTime = 0.3) {
        current?.fadeOut(fadeTime);
        current = null;
    }

    function list() {
        return animations.map((a, i) => `[${i}] ${a.name}`).join('\n');
    }

    return { play, playByName, stop, list };
}

function createDebugObjects(): THREE.Group {
    const group = new THREE.Group();
    const geometries = [
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.SphereGeometry(0.5, 8, 8),
        new THREE.CylinderGeometry(0.4, 0.4, 1.2, 8),
    ];
    const mat = new THREE.MeshStandardMaterial({ color: 0xff4444, wireframe: true });

    for (let i = 0; i < 20; i++) {
        const geo = geometries[i % geometries.length];
        const mesh = new THREE.Mesh(geo, mat);
        const angle = (i / 20) * Math.PI * 2;
        const radius = 8 + (i % 4) * 3;
        mesh.position.set(
            Math.cos(angle) * radius,
            (i % 5) * 1.5,
            Math.sin(angle) * radius,
        );
        group.add(mesh);
    }

const uvMap = new THREE.TextureLoader().load(
    '../asgn3/uvtest.png',
    () => console.log('uv texture loaded'),
    undefined,
    (err) => console.error('uv texture failed:', err)
);

const uvCube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ map: uvMap, color: 0xffffff })
);

	uvCube.position.set(-4, 3, -2);
	group.add(uvCube);

    group.visible = false;
    return group;
}

function render(): void {
	const dt = clock.getDelta();

	thingbabMixer?.update(dt);
	fpCamera.update(dt);
	skyDome.update(clock.getElapsedTime());
	waterRenderer?.update(scene, camera, clock.getElapsedTime());
	renderer.render(scene, camera);
	requestAnimationFrame(render);
}

main();
