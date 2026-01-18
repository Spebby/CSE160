// Asgn1.js
import { Circle, Triangle, Point } from './shapes.js';

// ColoredPoint.js (c) 2012 matsuda
// Vertex shader program
var VSHADER_SOURCE =
	`attribute vec4 a_Position;
	uniform float u_PointSize;
	void main() {
		gl_Position = a_Position;
		gl_PointSize = u_PointSize;
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

// :D
const Type = {
	POINT: 0,
	TRIANGLE : 1,
	CIRCLE : 2,
	SPECIAL : 3
};

// HTML -> GLSL
let TYPE = Type.POINT;
let COLOUR = [1.0, 1.0, 1.0, 1.0];
let SEG = 8;
let SIZE = 8;
var shapeList = [];

function main() {
	setupWebGL();
	setupListeners();
	connectVariablesToGLSL();

	// clear colour
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT);
	clearCanvas();
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
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

	window.gl = gl;

	setPaintMode();
}

function setupListeners() {
	document.getElementById('mPoint').onclick = function() { TYPE = Type.POINT; setPaintMode(); };
	document.getElementById('mTri').onclick = function() { TYPE = Type.TRIANGLE; setPaintMode(); };
	document.getElementById('mCircle').onclick = function() { TYPE = Type.CIRCLE; setPaintMode(); };
	document.getElementById('mSpecial').onclick = function() { drawSpecial(); TYPE = Type.SPECIAL; setPaintMode(); };
	// TODO: 'game' button.
	
	// RGBA
	document.getElementById('cR').addEventListener('mouseup', function() { COLOUR[0] = this.value / 255.0; });
	document.getElementById('cG').addEventListener('mouseup', function() { COLOUR[1] = this.value / 255.0; });
	document.getElementById('cB').addEventListener('mouseup', function() { COLOUR[2] = this.value / 255.0; });
	document.getElementById('cA').addEventListener('mouseup', function() { COLOUR[3] = this.value / 255.0; });

	// other options
	document.getElementById('cSeg').addEventListener('mouseup', function() { SEG = this.value; });
	document.getElementById('sSize').addEventListener('mouseup', function() { SIZE = this.value; });

	document.getElementById('clearCanvas').addEventListener('click', clearCanvas);
}

function setPaintMode() {
	if (TYPE == Type.SPECIAL) {
		canvas.onmousedown = null;
		canvas.onmousemove = null;
		return;
	}

	// standard
	canvas.onmousedown = function(env) { click(env) };
	canvas.onmousemove = function(env) { if(env.buttons == 1) click(env) };
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

	let tPs = gl.getUniformLocation(gl.program, 'u_PointSize');
	if (!tPs) {
		console.log('Failed to get storage location of u_PointSize');
	}
	window.u_PointSize = tPs;
}

function clearCanvas() {
	shapeList = [];
	renderAllShapes();
}

function click(env) {
	if (TYPE == Type.SPECIAL) return;
	const [x, y] = screenSpaceToCanvasSpace(env);

	let shape;
	switch (TYPE) {
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

function renderAllShapes() {
	gl.clear(gl.COLOR_BUFFER_BIT);
	// shapeList.forEach(shape => shape?.render()); <- too slow

	const shapes = shapeList;
	for (let i = 0, n = shapes.length; i < n; i++) {
		const shape = shapes[i];
		if (shape) shape.render();
	}
}

// call on module load
main();
