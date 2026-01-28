// Asgn2.js
import { Cube } from './shapes.js';

// ColoredPoint.js (c) 2012 matsuda
// Vertex shader program
var VSHADER_SOURCE =
	`attribute vec4 a_Position;

	uniform mat4 u_LocalMatrix;
	uniform mat4 u_GlobalRotation;


	// consider normal stuff
	void main() {
		gl_PointSize = u_GlobalRotation * u_LocalMatrix * a_Position;
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

// HTML -> GLSL
let COLOUR = [1.0, 1.0, 1.0, 1.0];

function main() {
	setupWebGL();
	setupListeners();
	connectVariablesToGLSL();

	// clear colour
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	clearCanvas();

	canvas.addEventListener('contextmenu', function(env) {
		if (env.buttons == 2) {
			env.preventDefault();
		}
	});

	// TODO: setup logic for orbital camera
	canvas.addEventListener('mousedown', function(env) {
		
	});
}

function setupWebGL() {
	canvas = document.getElementById('webgl');
	if (!canvas) {
		console.log('Failed to retrieve the <canvas> element');
		return;
	}

	W = canvas.width;
	H = canvas.height;
	HW = W / 2;
	HH = H / 2;

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
	setPaintMode();
}

function setupListeners() {
	document.getElementById('mPoint').onclick    = function() { setPaintMode(); };
	document.getElementById('mTri').onclick      = function() { setPaintMode(); };
	document.getElementById('mCircle').onclick   = function() { setPaintMode(); };
	document.getElementById('mPolyline').onclick = function() { setPaintMode(); };
	document.getElementById('mPolygon').onclick  = function() { setPaintMode(); };
	document.getElementById('mSpecial').onclick  = function() { drawSpecial(); };
	
	// RGBA
	document.getElementById('cR').addEventListener('mouseup', function() { COLOUR[0] = this.value / 255.0; });
	document.getElementById('cG').addEventListener('mouseup', function() { COLOUR[1] = this.value / 255.0; });
	document.getElementById('cB').addEventListener('mouseup', function() { COLOUR[2] = this.value / 255.0; });
	document.getElementById('cA').addEventListener('mouseup', function() { COLOUR[3] = this.value / 255.0; });

	// other options
	document.getElementById('cSeg').addEventListener('mouseup', function() { SEG = this.value; });
	document.getElementById('sSize').addEventListener('mouseup', function() { SIZE = this.value; });
	document.getElementById('pCloseMult').addEventListener('mouseup', function() { POLY_CLOSE_MULT = this.value; });

	document.getElementById('clearCanvas').addEventListener('click', clearCanvas);
	document.getElementById('undo').addEventListener('click', undo);
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
}

function click(env) {
	const [x, y] = screenSpaceToCanvasSpace(env);

	let shape;
	switch (getMode()) {
		case Type.POINT:
			shape = new Point([x, y].slice(), COLOUR.slice(), SIZE);
			break;
		case Type.TRIANGLE:
			shape = new Triangle([x, y].slice(), COLOUR.slice(), SIZE);
			break;
		case Type.CIRCLE:
			shape = new Circle([x, y].slice(), COLOUR.slice(), SIZE, SEG);
			break;
		default:
			return;
	}

	shapeList.push(shape);
	renderAllShapes();
}

// call on module load
main();
