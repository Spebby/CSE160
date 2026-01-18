// Asgn1.js

// ColoredPoint.js (c) 2012 matsuda
// Vertex shader program
var VSHADER_SOURCE =
  'attribute vec4 a_Position;\n' +
  'void main() {\n' +
  '  gl_Position = a_Position;\n' +
  '  gl_PointSize = 10.0;\n' +
  '}\n';

// Fragment shader program
var FSHADER_SOURCE =
  'precision mediump float;\n' +
  'uniform vec4 u_FragColor;\n' +  // uniform変数
  'void main() {\n' +
  '  gl_FragColor = u_FragColor;\n' +
  '}\n';


var ctx;
var W;
var H;
var HH;
var HW;
const SCALE = 20;
const RAD_TO_DEG = 180 / Math.PI;

function main() {
	// Retrieve <canvas> element <- (1)
	var canvas = document.getElementById('example');
	if (!canvas) {
		console.log('Failed to retrieve the <canvas> element');
		return;
	}

	// Get the rendering context for 2DCG <- (2)
	ctx = canvas.getContext('2d');
	W = canvas.width;
	H = canvas.height;
	HW = W / 2;
	HH = H / 2;
}

function clearCanvas() {
	ctx.fillStyle = 'rgba(0, 0, 0, 1.0)';
	ctx.fillRect(0, 0, W, H);
	writeLogText("");
}

function handleDrawEvent() {
	clearCanvas();
	const [v1, v2] = GetVectors();
	drawVector(v1, "red");
	drawVector(v2, "blue");
}
