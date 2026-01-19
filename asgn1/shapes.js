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

export class Polyline extends Shape {
	constructor(pos, colour, size, verts, closed = false) {
		super(pos, colour, size);
		this.closed = closed;
		this.updateVertices(verts, closed);
	}

	updateVertices(verts, closed = this.closed) {
		if (verts.length < 4) {
			this.vertexCount = 0;
			return;
		}
		
		this.verts = verts;
		this.closed = closed;
		
		const thickness = this.size / window.gl.canvas.width;
		const numVerts = verts.length / 2;

		// calc perp offsets for each vertex
		// this code is pretty long & ugly since we need to handle open/closed
		// lines differently.
		const offsets = [];
		for (let i = 0; i < numVerts; i++) {
			const prevIdx = closed ? (i - 1 + numVerts) % numVerts : Math.max(0, i - 1);
			const nextIdx = closed ? (i + 1) % numVerts : Math.min(numVerts - 1, i + 1);
			
			// Get three points
			const x0 = verts[prevIdx * 2], y0 = verts[prevIdx * 2 + 1];
			const x1 = verts[i * 2], y1 = verts[i * 2 + 1];
			const x2 = verts[nextIdx * 2], y2 = verts[nextIdx * 2 + 1];
			
			// Calculate averaged perpendicular
			let px = 0, py = 0;
			
			if (i > 0 || closed) {
				const dx1 = x1 - x0, dy1 = y1 - y0;
				const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
				if (len1 > 0) { px -= dy1 / len1; py += dx1 / len1; }
			}
			
			if (i < numVerts - 1 || closed) {
				const dx2 = x2 - x1, dy2 = y2 - y1;
				const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
				if (len2 > 0) { px -= dy2 / len2; py += dx2 / len2; }
			}
			
			// Normalize
			const plen = Math.sqrt(px * px + py * py);
			if (plen > 0) { px /= plen; py /= plen; }
			
			offsets.push(px * thickness, py * thickness);
		}

		const flatVerts = [];
		const numSegments = closed ? numVerts : numVerts - 1;
		
		for (let i = 0; i < numSegments; i++) {
			// We want to reuse the previous line's ending verts to have a smooth look.
			const i1 = i;
			const i2 = (i + 1) % numVerts; // wrap for closed
			
			const x1 = verts[i1 * 2];
			const y1 = verts[i1 * 2 + 1];
			const x2 = verts[i2 * 2];
			const y2 = verts[i2 * 2 + 1];
			
			const px1 = offsets[i1 * 2];
			const py1 = offsets[i1 * 2 + 1];
			const px2 = offsets[i2 * 2];
			const py2 = offsets[i2 * 2 + 1];

			flatVerts.push(
				this.pos[0] + x1 + px1, this.pos[1] + y1 + py1,
				this.pos[0] + x1 - px1, this.pos[1] + y1 - py1,
				this.pos[0] + x2 + px2, this.pos[1] + y2 + py2,

				this.pos[0] + x2 + px2, this.pos[1] + y2 + py2,
				this.pos[0] + x1 - px1, this.pos[1] + y1 - py1,
				this.pos[0] + x2 - px2, this.pos[1] + y2 - py2
			);
		}
		
		this.vertexCount = flatVerts.length / 2;
		
		const GL = window.gl;
		if (!this.vBuff) {
			this.vBuff = GL.createBuffer();
		}
		GL.bindBuffer(GL.ARRAY_BUFFER, this.vBuff);
		GL.bufferData(GL.ARRAY_BUFFER, new Float32Array(flatVerts), GL.STATIC_DRAW);
	}
	
	render() {
		if (this.vertexCount === 0) return;
		const GL = window.gl;
		this.setColour();
		GL.bindBuffer(GL.ARRAY_BUFFER, this.vBuff);
		GL.vertexAttribPointer(window.a_Position, 2, GL.FLOAT, false, 0, 0);
		GL.enableVertexAttribArray(window.a_Position);
		GL.drawArrays(GL.TRIANGLES, 0, this.vertexCount);
	}
}

export class Polygon extends Shape {
	constructor(pos, colour, size, verts) {
		super(pos, colour, size);
		this.updateVertices(verts);
	}

	updateVertices(verts) {
		// ear clipping algorithm makes the assumption that verts have counter-clockwise winding.
		// so, make sure all verts are counter-clockwise.
		verts = this.ensureCounterClockwise(verts);
		this.verts = verts;

		const flatVerts = [];
		for (let i = 0; i < verts.length; i += 2) {
			flatVerts.push(
				this.pos[0] + verts[i],
				this.pos[1] + verts[i + 1]
			);
		}

		// Triangulate the polygon for rendering
		const triangulated = this.triangulate(flatVerts);
		this.vertexCount = triangulated.length / 2;

		const GL = window.gl;
		if (!this.vBuff) {
			this.vBuff = GL.createBuffer();
		}
		GL.bindBuffer(GL.ARRAY_BUFFER, this.vBuff);
		GL.bufferData(GL.ARRAY_BUFFER, new Float32Array(triangulated), GL.STATIC_DRAW);
	}

	ensureCounterClockwise(verts) {
		if (verts.length < 6) return verts;
		let signedArea = 0;
		for (let i = 0; i < verts.length; i += 2) {
			const x1 = verts[i];
			const y1 = verts[i + 1];
			const x2 = verts[(i + 2) % verts.length];
			const y2 = verts[(i + 3) % verts.length];

			signedArea += (x1 * y2 - x2 * y1);
		}

		// If area is negative, polygon is clockwise and needs to be flipped.
		if (signedArea < 0) {
			const rev = [];
			for (let i = verts.length - 2; i >= 0; i -= 2) {
				rev.push(verts[i], verts[i + 1]);
			}
			
			return rev;
		}

		return verts;
	}

	// ear clipping triangulation (generated w/ Claude AI)
	// Claude claims the algorithm is based on David Eberly's work, which seems accurate.
	// https://www.geometrictools.com/Documentation/TriangulationByEarClipping.pdf
	triangulate(flatVerts) {
		const numVerts = flatVerts.length / 2;
		if (numVerts < 3) return [];

		const verts = [];
		for (let i = 0; i < flatVerts.length; i += 2) {
			verts.push({x: flatVerts[i], y: flatVerts[i+1]});
		}

		const tris = [];
		const inds = [];
		for (let i = 0; i < verts.length; i++) {
			inds.push(i);
		}

		// Ear clipping algorithm
		while (inds.length > 3) {
			let earFound = false;

			for (let i = 0; i < inds.length; i++) {
				const prev = inds[(i - 1 + inds.length) % inds.length];
				const curr = inds[i];
				const next = inds[(i + 1) % inds.length];
				
				if (this.isEar(verts, inds, prev, curr, next)) {
					tris.push(
						verts[prev].x, verts[prev].y,
						verts[curr].x, verts[curr].y,
						verts[next].x, verts[next].y
					);

					// remove ear
					inds.splice(i, 1);
					earFound = true;
					break;
				}
			}

			if (!earFound) break; // no inf loop
		}

		if (inds.length === 3) {
			tris.push(
				verts[inds[0]].x, verts[inds[0]].y,
				verts[inds[1]].x, verts[inds[1]].y,
				verts[inds[2]].x, verts[inds[2]].y
			);
		}

		return tris;
	}

	isEar(verts, inds, prev, curr, next) {
		const a = verts[prev];
		const b = verts[curr];
		const c = verts[next];

		// is the triangle counter-clockwise (convex)?
		const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
		if (cross < 0) return false;

		for (let i = 0; i < inds.length; i++) {
			const idx = inds[i];
			if (idx === prev || idx === curr || idx === next) continue;

			if (this.pointInTriangle(verts[idx], a, b, c)) {
				return false;
			}
		}

		return true;
	}

	// claude claims this is based on https://blackpawn.com/texts/pointinpoly/
	pointInTriangle(p, a, b, c) {
		const sign = (p1, p2, p3) => {
			return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
		};
		
		const d1 = sign(p, a, b);
		const d2 = sign(p, b, c);
		const d3 = sign(p, c, a);

		const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
		const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);

		return !(hasNeg && hasPos);
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
