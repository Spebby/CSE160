// Asgn1.js

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
