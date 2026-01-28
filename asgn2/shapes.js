// shapes.js

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

// shape interface
export default class Shape {
	constructor(pos, colour, matrix) {
		this.pos = pos;
		this.colour = colour;
		this.matrix = matrix;
	}

	setColour() {
		const [r, g, b, a] = this.colour;
		window.gl.uniform4f(window.u_FragColor, r, g, b, a);
	}

	render() {
		throw new Error("render() not implemented");
	}
}

export class Cube extends Shape {
	/**
	 * @param {Array<number>} pos - the reference position (offset) for the triangle
	 * @param {Array<number>} colour - RGBA color
	 * @param {Matrix4} matrix - Local model matrix.
	 */
	constructor(pos, colour, matrix) {
		super(pos, colour, matrix);

		const GL = window.gl;

		this.vBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
		gl.bufferData(
		  gl.ARRAY_BUFFER,
		  new Float32Array([
			// front (+Z)
			-0.5, -0.5,  0.5,
			 0.5, -0.5,  0.5,
			 0.5,  0.5,  0.5,
			-0.5, -0.5,  0.5,
			 0.5,  0.5,  0.5,
			-0.5,  0.5,  0.5,

			// back (-Z)
			 0.5, -0.5, -0.5,
			-0.5, -0.5, -0.5,
			-0.5,  0.5, -0.5,
			 0.5, -0.5, -0.5,
			-0.5,  0.5, -0.5,
			 0.5,  0.5, -0.5,

			// left (-X)
			-0.5, -0.5, -0.5,
			-0.5, -0.5,  0.5,
			-0.5,  0.5,  0.5,
			-0.5, -0.5, -0.5,
			-0.5,  0.5,  0.5,
			-0.5,  0.5, -0.5,

			// right (+X)
			 0.5, -0.5,  0.5,
			 0.5, -0.5, -0.5,
			 0.5,  0.5, -0.5,
			 0.5, -0.5,  0.5,
			 0.5,  0.5, -0.5,
			 0.5,  0.5,  0.5,

			// top (+Y)
			-0.5,  0.5,  0.5,
			 0.5,  0.5,  0.5,
			 0.5,  0.5, -0.5,
			-0.5,  0.5,  0.5,
			 0.5,  0.5, -0.5,
			-0.5,  0.5, -0.5,

			// bottom (-Y)
			-0.5, -0.5, -0.5,
			 0.5, -0.5, -0.5,
			 0.5, -0.5,  0.5,
			-0.5, -0.5, -0.5,
			 0.5, -0.5,  0.5,
			-0.5, -0.5,  0.5,
		  ]),
		  gl.STATIC_DRAW
		);

		this.vCount = 36;
	}

	render() {
		const GL = window.gl;

		GL.uniformMatrix4vf(
			window.u_ModelMatrix,
			false,
			this.matrix
		);

		GL.bindBuffer(GL.ARRAY_BUFFER, this.vBuffer);
		GL.vertexAttribPointer(window.a_Position, 3, GL.FLOAT, false 0, 0);
		GL.enableVertexAttribArray(window.a_Position);
		GL.drawArrays(GL.TRIANGLES, 0, this.vCount);
	}
}

// for both triangle & circle, pre-compute and bind buffers inadvanced.
// creating every frame is performance killer
export class Triangle extends Shape {
	/**
	 * @param {Array<number>} pos - the reference position (offset) for the triangle
	 * @param {Array<number>} colour - RGBA color
	 * @param {number} size - used if verts not provided, scales the default triangle
	 * @param {Array<number>} verts - optional, flat array of 3 pairs [x0,y0,x1,y1,x2,y2] relative to pos
	 */
	constructor(pos, colour, size, verts = null) {
		super(pos, colour, size);

		let finalVerts;
		if (verts && verts.length === 6) {
			// use provided vertices relative to pos
			finalVerts = [
				pos[0] + verts[0], pos[1] + verts[1],
				pos[0] + verts[2], pos[1] + verts[3],
				pos[0] + verts[4], pos[1] + verts[5]
			];
		} else {
			// default equilateral triangle centered at pos
			const r = size / window.gl.canvas.width;
			finalVerts = [
				pos[0], pos[1] + r,
				pos[0] - r, pos[1] - r,
				pos[0] + r, pos[1] - r
			];
		}

		this.vertexCount = finalVerts.length / 2;

		const GL = window.gl;
		this.vBuff = GL.createBuffer();
		GL.bindBuffer(GL.ARRAY_BUFFER, this.vBuff);
		GL.bufferData(GL.ARRAY_BUFFER, new Float32Array(finalVerts), GL.STATIC_DRAW);
	}

	render() {
		const GL = window.gl;
		this.setColour();
		GL.bindBuffer(GL.ARRAY_BUFFER, this.vBuff);
		GL.vertexAttribPointer(window.a_Position, 2, GL.FLOAT, false, 0, 0);
		GL.enableVertexAttribArray(window.a_Position);
		GL.drawArrays(GL.TRIANGLES, 0, this.vertexCount);
	}
}
