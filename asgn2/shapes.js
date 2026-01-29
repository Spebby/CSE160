// shapes.js
/**
 * We can pack a bunch of vertex information in here & use offsets
 * to avoid reassigning buffer data.
 * This is a little messy but for a project of this scale it's probably
 * the simplest thing to do.
 */

const CUBE_OFFSET = 0;
const CYLINDER_OFFSET = 33;
const SPHERE_OFFSET = 999;
const shapeArray = [
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
	-0.5, -0.5,  0.5


	//////////
];


const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

// shape interface
export default class Shape {
	static vBuffer = null;
	static vertexData = null;
	static vertexCount = 0;
	static vertexOffset = 0;

	static initSharedBuffer() {
		if (this.vBuffer) return;
		if (!this.vertexData)
			throw new Error(`${this.name}: vertexData not defined`);

		const GL = window.gl;

		this.vBuffer = GL.createBuffer();
		GL.bindBuffer(GL.ARRAY_BUFFER, this.vBuffer);
		GL.bufferData(
			GL.ARRAY_BUFFER,
			new Float32Array(this.vertexData),
			GL.STATIC_DRAW
		);
	}

	/**
	 * @param {Array<number>} pos - the reference position (offset) for the triangle
	 * @param {Array<number>} colour - RGBA color
	 * @param {Matrix4} matrix - Local model matrix.
	 */
	constructor(pos, colour, matrix) {
		this.pos = pos;
		this.colour = colour;
		this.matrix = matrix;
		this.constructor.initSharedBuffer();
	}

	setColour() {
		const [r, g, b, a] = this.colour;
		window.gl.uniform4f(window.u_FragColor, r, g, b, a);
	}

	render() {
		this.setColour();
		const GL = window.gl;
		const C = this.constructor;

		GL.uniformMatrix4fv(
			window.u_ModelMatrix,
			false,
			this.matrix.elements
		);

		GL.bindBuffer(GL.ARRAY_BUFFER, C.vBuffer);
		GL.vertexAttribPointer(window.a_Position, 3, GL.FLOAT, false, 0, 0);
		GL.enableVertexAttribArray(window.a_Position);
		GL.drawArrays(GL.TRIANGLES, C.vertexOffset, C.vertexCount);
	}
}

export class Cube extends Shape {
	static vertexData = shapeArray;
	static vertexCount = 36;
	static vertexOffset = CUBE_OFFSET;
}
