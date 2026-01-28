// Asgn2.js
import { Cube } from './shapes.js';

// Vertex shader program
var VSHADER_SOURCE =
	`attribute vec4 a_Position;
	uniform mat4 u_ModelMatrix;
	uniform mat4 u_GlobalRotation;
	uniform mat4 u_ProjectionMatrix;

	// consider normal stuff for lighting
	void main() {
		gl_Position = u_ProjectionMatrix * u_GlobalRotation * u_ModelMatrix * a_Position;
	}`;

// Fragment shader program
var FSHADER_SOURCE =
	`precision mediump float;
	uniform vec4 u_FragColor;
	void main() {
		gl_FragColor = u_FragColor;
	}`;


var canvas;
var gl;

var W;
var H;
var HW;
var HH;
var TIME;
var START_TIME = performance.now() / 1000.0;

var FOV = 70;
var oDist = 5;

function main() {
	setupWebGL();
	setupListeners();
	connectVariablesToGLSL();

	// clear colour
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	canvas.addEventListener('contextmenu', function(env) {
		if (env.buttons == 2) {
			env.preventDefault();
		}
	});

	// TODO: setup logic for orbital camera
	canvas.addEventListener('mousedown', function(env) {
		
	});

	FOV = document.getElementById('FOV').value;
	oDist = document.getElementById('oDist').value;

	resizeCanvas();
	requestAnimationFrame(tick);
}

function setupWebGL() {
	canvas = document.getElementById('webgl');
	if (!canvas) {
		console.log('Failed to retrieve the <canvas> element');
		return;
	}

	// Get the rendering context for 2DCG <- (2)
	// suggested by vid 1.8
	gl = canvas.getContext("webgl", { preserveDrawingBuffer: true});
	if (!gl) {
		console.log('Failed to get the rendering context for WebGL');
		return;
	}

	// Alpha
    gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

	window.gl = gl;
	window.addEventListener('resize', resizeCanvas);
}

function setupListeners() {
	document.getElementById('toggleCameraMode').addEventListener('click', toggleCameraMode);
	document.getElementById('FOV').addEventListener('input', function() { FOV = this.value; updateProjMatrix(); });
	document.getElementById('oDist').addEventListener('input', function() { oDist = this.value; });

	/*
	document.getElementById('mPoint').onclick    = function() { return; };
	document.getElementById('mTri').onclick      = function() { return; };
	document.getElementById('mCircle').onclick   = function() { return; };

	// RGBA
	document.getElementById('cR').addEventListener('mouseup', function() { return; });
	document.getElementById('cG').addEventListener('mouseup', function() { return; });
	document.getElementById('cB').addEventListener('mouseup', function() { return; });
	document.getElementById('cA').addEventListener('mouseup', function() { return; });

	document.getElementById('clearCanvas').addEventListener('click', clearCanvas);
	document.getElementById('undo').addEventListener('click', undo);
	*/
}

function toggleCameraMode() {
	return;
}

function screenSpaceToCanvasSpace(env) {
	var x = env.clientX;
	var y = env.clientY;
	var rect = env.target.getBoundingClientRect();
	x = ((x - rect.left) - HW) / (HW);
	y = (HH - (y - rect.top)) / HH;

	return [x, y];
}

function connectVariablesToGLSL() {
	if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
		console.log('Failed to init shaders.');
		return;
	}

	// Get vars we want & store them
	let tPos = gl.getAttribLocation(gl.program, 'a_Position');
	if (tPos < 0) {
		console.log('Failed to get storage location of a_Position');
		return;
	}
	window.a_Position = tPos;

	let tCol = gl.getUniformLocation(gl.program, 'u_FragColor');
	if (!tCol) {
		console.log('Failed to get storage location of u_FragColor');
		return;
	}
	window.u_FragColor = tCol;

	let tMod = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
	if (!tMod) {
		console.log('Failed to get storage location of u_ModelMatrix');
		return;
	}
	window.u_ModelMatrix = tMod;
	var identityMatrix = new Matrix4();
	gl.uniformMatrix4fv(window.u_ModelMatrix, false, identityMatrix.elements);

	let tGol = gl.getUniformLocation(gl.program, 'u_GlobalRotation');
	if (!tGol) {
		console.log('Failed to get storage location of u_GlobalRotation');
		return;
	}
	window.u_GlobalRotation = tGol;
	var globalRotation = new Matrix4();
	globalRotation.setIdentity();
	gl.uniformMatrix4fv(window.u_GlobalRotation, false, globalRotation.elements);


	let tProj = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
	if (!tProj) {
		console.log('Failed to get storage location of u_ProjectionMatrix');
		return;
	}
	window.u_ProjectionMatrix = tProj;
}

function click(env) {
	const [x, y] = screenSpaceToCanvasSpace(env);


}

function tick() {
	renderAllShapes();
	requestAnimationFrame(tick);
}

function renderAllShapes() {
	const now = performance.now();
	const nowSeconds = now / 1000;
	TIME = nowSeconds;
	const frameTime = now - START_TIME;

	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	
	var body = new Cube([0, 0].slice(), [1.0, 0.0, 0.0, 1.0].slice(), new Matrix4().setIdentity());
	body.matrix.scale(1, 1, 1);
	body.matrix.translate(0, 0, -5);
	body.matrix.rotate(45, 0, 0, 1);
	body.render();

	//writeToLog("ms: " + frameTime.toFixed(2) + " fps: " + (1000/frameTime).toFixed(2));

	START_TIME = now;
}

function resizeCanvas() {
	const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Set the internal resolution (accounting for high-DPI displays)
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    W = canvas.width;
    H = canvas.height;
    HW = W / 2;
    HH = H / 2;
    
    gl.viewport(0, 0, canvas.width, canvas.height);
	
	updateProjMatrix();
}

function updateProjMatrix() {
	var projMatrix = new Matrix4();
	var aspect = W / H;
	projMatrix.setPerspective(FOV, aspect, 0.05, 100);
	gl.uniformMatrix4fv(window.u_ProjectionMatrix, false, projMatrix.elements);
}

// call on module load
main();
