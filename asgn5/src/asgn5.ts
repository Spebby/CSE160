import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FirstPersonCamera } from './FirstPersonCamera';
import { createSkyDome } from './sky';
import { isDebugMode, setDebugMode } from './debug';

const canvas = document.getElementById('webgl') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas element not found');

let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let fpCamera: FirstPersonCamera;
let cube: THREE.Mesh;
let clock: THREE.Clock;
let skyDome: ReturnType<typeof createSkyDome>;

function main(): void {
	scene = new THREE.Scene();
	scene.background = new THREE.Color(0x000000);

	camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
	camera.position.z = 5;

	renderer = new THREE.WebGLRenderer({ canvas });
	renderer.setSize(canvas.width, canvas.height);

	window.addEventListener('resize', onResize);
	onResize();

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

	const geometry = new THREE.BoxGeometry(1, 1, 1);
	const material = new THREE.MeshPhongMaterial({ color: 0xfacade });
	cube = new THREE.Mesh(geometry, material);
	scene.add(cube);

	skyDome = createSkyDome();
	scene.add(skyDome.mesh);
	scene.add(skyDome.sunLight);

	fpCamera = new FirstPersonCamera(camera, canvas);
	canvas.addEventListener('mousemove', (e) => fpCamera.onMouseMove(e));

	setupListeners();

	clock = new THREE.Clock();
	requestAnimationFrame(render);
}

function onResize(): void {
	const w = canvas.clientWidth;
	const h = canvas.clientHeight;
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
		}
	});

	document.addEventListener('pointerlockchange', () => {
		if (!document.pointerLockElement && isDebugMode()) {
			_debugMode = false;
			setDebugMode(false, canvas, () => fpCamera.clampToNormalLimits());
		}
	});
}

function render(): void {
	const dt = clock.getDelta();

	cube.rotation.x += 1.0 * dt;
	cube.rotation.y += 1.0 * dt;

	skyDome.update(clock.getElapsedTime());
	renderer.render(scene, camera);
	requestAnimationFrame(render);
}

main();
