// Asgn1.js
import { Point, Triangle, Circle, Polygon, Polyline } from './shapes.js';

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

const POLY_CLOSE_THRES = 0.05;

// :D
const Type = {
	POINT: 0,
	TRIANGLE : 1,
	CIRCLE : 2,
	POLYLINE : 3,
	POLYGON: 4,
};

// HTML -> GLSL
let COLOUR = [1.0, 1.0, 1.0, 1.0];
let SEG = 8;
let SIZE = 8;
var shapeList = [];

// Polygon Tool
var previewPoly = null;
var currPolyVerts = [];

function main() {
	setupWebGL();
	setupListeners();
	connectVariablesToGLSL();

	// clear colour
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT);
	clearCanvas();

	// TODO: when site reloads, it keeps previous page's settings.
	// make sure to either reset HTML, or pull at init.
	COLOUR[0] = document.getElementById('cR').value / 255.0;
	COLOUR[1] = document.getElementById('cG').value / 255.0;
	COLOUR[2] = document.getElementById('cB').value / 255.0;
	COLOUR[3] = document.getElementById('cA').value / 255.0;

	SEG  = Number(document.getElementById('cSeg').value);
	SIZE = Number(document.getElementById('sSize').value);
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
	document.getElementById('mPoint').onclick   = function() { setPaintMode(); };
	document.getElementById('mTri').onclick     = function() { setPaintMode(); };
	document.getElementById('mCircle').onclick  = function() { setPaintMode(); };
	document.getElementById('mPolyline').onclick    = function() { setPaintMode(); };
	document.getElementById('mPolygon').onclick = function() { setPaintMode(); };
	document.getElementById('mSpecial').onclick = function() { drawSpecial(); };
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
	document.getElementById('undo').addEventListener('click', undo);
}

function getMode() {
	const checked = document.querySelector('#drawingMode input[name="mode"]:checked');
	return checked ? Type[checked.value] : null;
}

function setPaintMode() {
	const TYPE = getMode();

	// Arguably both of the polytools could probably be "merged" together
	// such that their click & hover functions largely reuse code.
	if (TYPE == Type.POLYLINE) {
		canvas.onmousedown = function(env) { polylineClick(env) };
		canvas.onmousemove = function(env) { polylineHover(env) };
		canvas.oncontextmenu = function(env) {
			env.preventDefault();
			polylineFinish();
			return false;
		}

		// if it already exists, we need to swap it to preview polyline
		if (previewPoly) {
			previewPoly = new Polyline([0, 0], [...COLOUR, 0.5], SIZE, currPolyVerts, false);
			renderAllShapes();
			previewPoly.render();
			drawPolylineOutline(previewVerts);
		}
		return;
	}

	if (TYPE == Type.POLYGON) {
		canvas.onmousedown = function(env) { polygonClick(env) };
		canvas.onmousemove = function(env) { polygonHover(env) };
		canvas.oncontextmenu = function (env) {
			env.preventDefault();
			polygonFinish();
			return false;
		};

		// if it already exists, we need to swap it to preview polygon
		if (previewPoly) {
			previewPoly = new Polygon([0, 0], [...COLOUR, 0.5], SIZE, currPolyVerts);
			renderAllShapes();
			previewPoly.render();
			drawPolygonOutline(previewVerts, true);
		}
		return;
	}

	// standard
	canvas.onmousedown = function(env) { click(env) };
	canvas.onmousemove = function(env) { if(env.buttons == 1) click(env) };
	canvas.oncontextmenu = null;
	currPolyVerts = [];
	previewPoly = null;
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

function undo() {
	shapeList.pop();
	renderAllShapes();
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

function polygonClick(env) {
	if (getMode() != Type.POLYGON) return;
	const [x, y] = screenSpaceToCanvasSpace(env);

	if (currPolyVerts.length >= 6) { // at least a triangle
		const fx = currPolyVerts[0];
		const fy = currPolyVerts[1];
		const dist = Math.sqrt((x - fx) ** 2 + (y - fy) ** 2);
		if (dist < POLY_CLOSE_THRES) {
			polygonFinish();
			return;
		}
	}

	currPolyVerts.push(x, y);
	drawPolygonOutline(currPolyVerts, false);
}

function polygonHover(env) {
	if (currPolyVerts.length === 0) return;
	const [x, y] = screenSpaceToCanvasSpace(env);
	const previewVerts = [...currPolyVerts, x, y];
	if (previewPoly) {
		previewPoly.updateVertices(previewVerts);
	} else {
		previewPoly = new Polygon([0, 0], [...COLOUR, 0.5], SIZE, previewVerts);
	}

	renderAllShapes();
	previewPoly.render();
	drawPolygonOutline(previewVerts, true);
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

// Polygon Draw
function drawPolygonOutline(verts, includeClosing) {
	for (let i = 0; i < verts.length; i += 2) {
		const pt = new Point([verts[i], verts[i+1]], [1, 1, 1, 0.5], 5);
		pt.render();
	}

	if (verts.length >= 6) {
		const firstPt = new Point([verts[0], verts[1]], [0, 1, 0, 0.5], 8);
		firstPt.render();
	}
}

function polygonFinish() {
	if (currPolyVerts.length >= 6) {
		const shape = new Polygon([0, 0], COLOUR.slice(), SIZE, currPolyVerts.slice());
		shapeList.push(shape);
	}

	currPolyVerts = [];
	previewPoly = null;
	renderAllShapes();
}

function polylineClick(env) {
	if (getMode() != Type.POLYLINE) return;
	const [x, y] = screenSpaceToCanvasSpace(env);
	if (currPolyVerts.length >= 4) {
		const fx = currPolyVerts[0];
		const fy = currPolyVerts[1];
		const dist = Math.sqrt((x - fx) ** 2 + (y - fy) ** 2);
		// cheaper to convert w/ square dist, but this doesn't run often so idc

		if (dist < POLY_CLOSE_THRES) {
			polylineFinish(true);
			return;
		}

		// or if we are very close to the most recent points...
		const lx = currPolyVerts[currPolyVerts.length - 2];
		const ly = currPolyVerts[currPolyVerts.length - 1];
		const lDist = Math.sqrt((x - lx) ** 2 + (y - ly) ** 2);
		if (lDist < POLY_CLOSE_THRES) {
			polylineFinish();
			return;
		}
	}

	currPolyVerts.push(x, y);
}

function polylineHover(env) {
	if (currPolyVerts.length === 0) return;
	const [x, y] = screenSpaceToCanvasSpace(env);
	const previewVerts = [...currPolyVerts, x, y];

	if (previewPoly) {
		previewPoly.updateVertices(previewVerts, false);
	} else {
		previewPoly = new Polyline([0, 0], [...COLOUR, 0.5], SIZE, previewVerts, false);
	}

	renderAllShapes();
	previewPoly.render();
	drawPolylineOutline(previewVerts);
}

function drawPolylineOutline(verts) {
	for (let i = 0; i < verts.length; i += 2) {
		const pt = new Point([verts[i], verts[i+1]], [1, 1, 1, 0.5], 5);
		pt.render();
	}

	// Highlight first vertex if enough points to close
	if (verts.length >= 4) {
		const firstPt = new Point([verts[0], verts[1]], [0, 1, 0, 0.5], 8);
		firstPt.render();
	}
}

function polylineFinish(isClosed = false) {
	if (currPolyVerts.length >= 4) { // At least 2 vertices
		const shape = new Polyline([0, 0], COLOUR.slice(), SIZE, currPolyVerts.slice(), isClosed);
		shapeList.push(shape);
	}
	
	currPolyVerts = [];
	previewPoly = null;
	renderAllShapes();
}

// draw fellowship broach
function drawSpecial() {
	fetch("../assets/data/fellowshipbroach.json")
		.then(res => res.json())
		.then(data => {
			for (const entry of data) {
				const pos = entry.pos;
				const colour = entry.colour;
				const size = typeof entry.size === "string" ? parseInt(entry.size) : entry.size;
				const verts = entry.verts.slice();
		
				if ("closed" in entry) {
					const isClosed = entry.closed;
					const shape = new Polyline(pos, colour.slice(), size, verts, isClosed);
					shapeList.push(shape);
				} else {
					const shape = new Polygon(pos, colour.slice(), size, verts);
					shapeList.push(shape);
				}
			}
			renderAllShapes();
		}
	).catch(err => console.error(err));
}

// call on module load
main();
