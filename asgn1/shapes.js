// shapes.js

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

// shape interface
export default class Shape {
	constructor(pos, colour, size) {
		this.pos = pos;
		this.colour = colour;
		this.size = size;
	}

	setColour() {
		const [r, g, b, a] = this.colour;
		window.gl.uniform4f(window.u_FragColor, r, g, b, a);
	}

	render() {
		throw new Error("render() not implemented");
	}
}

export class Point extends Shape {
	render() {
		const GL = window.gl;
		this.setColour();
		GL.disableVertexAttribArray(window.a_Position);
		GL.vertexAttrib3f(window.a_Position, this.pos[0], this.pos[1], 0.0);
        GL.uniform1f(window.u_PointSize, this.size);
        GL.drawArrays(GL.POINTS, 0, 1);
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

export class Circle extends Shape {
	constructor(pos, colour, size, segments) {
		super(pos, colour, size);

		const r = size / window.gl.canvas.width;
		const step = 2 * Math.PI / segments;

		const verts = [pos[0], pos[1]];
		for (let i = 0; i <= segments; i++) {
			const a = i * step;
			verts.push(
				pos[0] + Math.cos(a) * r,
				pos[1] + Math.sin(a) * r
			);
		}

		this.vertexCount = verts.length / 2;

		const GL = window.gl;
		this.vBuff = GL.createBuffer();
		GL.bindBuffer(GL.ARRAY_BUFFER, this.vBuff);
		GL.bufferData(GL.ARRAY_BUFFER, new Float32Array(verts), GL.STATIC_DRAW);
	}

	render() {
		const GL = window.gl;
		this.setColour();

		GL.bindBuffer(GL.ARRAY_BUFFER, this.vBuff);
		GL.vertexAttribPointer(window.a_Position, 2, GL.FLOAT, false, 0, 0);
		GL.enableVertexAttribArray(window.a_Position);
		GL.drawArrays(GL.TRIANGLE_FAN, 0, this.vertexCount);
		// Triangle fans suck on modern hardware, except for circles only.
	}
}

export class Polygon extends Shape {
	constructor(pos, colour, size, verts) {
		// pos is optional offset; verts are relative to pos
		super(pos, colour, size);

		const flatVerts = [];
		for (let i = 0; i < verts.length; i += 2) {
			flatVerts.push(
				this.pos[0] + verts[i],
				this.pos[1] + verts[i + 1]
			);
		}

		this.vertexCount = flatVerts.length / 2;

		const GL = window.gl;
		this.vBuff = GL.createBuffer();
		GL.bindBuffer(GL.ARRAY_BUFFER, this.vBuff);
		GL.bufferData(GL.ARRAY_BUFFER, new Float32Array(flatVerts), GL.STATIC_DRAW);
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
