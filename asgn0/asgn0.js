// Asgn0.js

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

function writeLogText(str) {
	const log = document.getElementById('log');
	const logText = document.getElementById('logText');
	logText.textContent = str;

	if (str === "") {
	    log.classList.add('hidden');
		return;
	}

	log.classList.remove('hidden');
}

function drawVector(v, colour) {
	ctx.beginPath();
	ctx.moveTo(HW, HH);
	ctx.lineTo(HW + v.elements[0] * SCALE, HH - v.elements[1] * SCALE);
	ctx.strokeStyle = colour;
	ctx.stroke();
}

function GetVectors() {
	let ax = parseFloat(document.getElementById('v1x').value);
	let ay = parseFloat(document.getElementById('v1y').value);
	var v1 = new Vector3([ax ? ax : 0, ay ? ay : 0, 0]);

	let bx = parseFloat(document.getElementById('v2x').value);
	let by = parseFloat(document.getElementById('v2y').value);
	var v2 = new Vector3([bx ? bx : 0, by ? by : 0, 0]);

	return [v1, v2];
}

function handleDrawEvent() {
	clearCanvas();
	const [v1, v2] = GetVectors();
	drawVector(v1, "red");
	drawVector(v2, "blue");
}

function handleDrawOperationEvent() {
	clearCanvas();
	const [v1, v2] = GetVectors();
	drawVector(v1, "red");
	drawVector(v2, "blue");

	const op = document.getElementById('op').value;
	let scalar = parseFloat(document.getElementById('sc').value);
	scalar = isNaN(scalar) ? 1 : scalar;

	switch (op) {
		case 'add':
			drawVector(v1.add(v2), "green");
			break;
		case 'sub':
			drawVector(v1.sub(v2), "green");
			break;
		case 'mul':
			drawVector(v1.mul(scalar), "green");
			drawVector(v2.mul(scalar), "green");
			break;
		case 'div':
			if (scalar == 0) break;
			drawVector(v1.div(scalar), "green");
			drawVector(v1.div(scalar), "green");
			break;
		case 'norm':
			drawVector(v1.normalize(), "green");
			drawVector(v2.normalize(), "green");
			break;
		case 'mag':
			let a = `Magnitude v1: ${v1.magnitude()}`;
			let b = `Magnitude v2: ${v2.magnitude()}`;
			console.log(a);
			console.log(b);
			writeLogText(`${a}\n${b}`);
			break;
		case 'angle':
			console.log(`Angle: ${angleBetween(v1, v2)}`);
			writeLogText(`Angle: ${angleBetween(v1, v2)}`);
			break;
		case 'area':
			console.log(`Area of the triangle: ${areaTri(v1, v2)}`);
			writeLogText(`Area of the triangle: ${areaTri(v1, v2)}`);
			break;
	}
}

function angleBetween(v1, v2) {
	const v1m = v1.magnitude();
	const v2m = v2.magnitude();
	const cosTheta = Vector3.dot(v1, v2) / (v1m * v2m);
	return Math.acos(cosTheta) * RAD_TO_DEG;
}

// https://math.stackexchange.com/a/606720
// Good explanation.
function areaTri(v1, v2) {
	const cross = Vector3.cross(v1, v2);
	return cross.magnitude() / 2;
}
