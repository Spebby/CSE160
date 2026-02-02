const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export default class Transform {
	// idk js that well but afaik you can't explicitly mark things as private
	// so I can't stop someone from manually modifying these, but
	// you shouldn't mark these directly if you can avoid it.
	position = [0, 0, 0];
	rotation = [0, 0, 0];  // degrees, XYZ
	scale = [1, 1, 1];
	parent = null;
	children = [];

	localMatrix = new Matrix4();
	worldMatrix = new Matrix4();

	constructor(pos = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], parent = null) {
		this.position = pos.slice();
		this.rotation = rotation.slice();
		this.scale = scale.slice();
		this.setParent(parent);
		this.children = [];
		this.recomputeCache();
	}

	setPos(x, y, z) {
		this.position[0] = x;
		this.position[1] = y;
		this.position[2] = z;
		this.recomputeCache();
		return this;
	}

	setRot(rx, ry, rz) {
		this.rotation[0] = rx;
		this.rotation[1] = ry;
		this.rotation[2] = rz;
		this.recomputeCache();
		return this;
	}

	setScale(sx, sy, sz) {
		this.scale[0] = sx;
		this.scale[1] = sy;
		this.scale[2] = sz;
		this.recomputeCache();
		return this;
	}

	translate(x, y, z) {
		this.position[0] += x;
		this.position[1] += y;
		this.position[2] += z;
		this.recomputeCache();
		return this;
	}

	recomputeCache() {
		// If we add dirty optimisaiton, consider doing it here.

		// TRS order
		const m = this.localMatrix;
		m.setIdentity();
		m.translate(...this.position);
		m.rotate(this.rotation[0], 1,0,0);
		m.rotate(this.rotation[1], 0,1,0);
		m.rotate(this.rotation[2], 0,0,1);
		m.scale(...this.scale);

		if (this.parent) {
			this.worldMatrix.copy(this.parent.worldMatrix).multiply(m);
		} else {
			this.worldMatrix.copy(m);
		}

		for (const c of this.children) c.recomputeCache();
	}

	addChild(child) {
		if (!this.children.includes(child)) {
			this.children.push(child);
			child.parent = this;
			child.recomputeCache();
		}
		return this;
	}

	removeChild(child) {
		const index = this.children.indexOf(child);
		if (index !== -1) {
			this.children.splice(index, 1);
			child.parent = null;
			child.recomputeCache();
		}
		return this;
	}

	setParent(parent) {
		if (this.parent !== null) {
			this.parent.removeChild(this);
		}
		
		if (parent !== null) {
			parent.addChild(this);
		} else {
			this.parent = null;
			this.recomputeCache();
		}
		return this;
	}

	/**
	 * @returns {Array<number>}
	 */
	getWorldPosition() {
		return [
			this.worldMatrix.elements[12],
			this.worldMatrix.elements[13],
			this.worldMatrix.elements[14]
		];
	}

	/**
	 * @returns {Array<number>} in degs
	 */
	getWorldRotation() {
		if (this.parent === null) {
			return this.rotation.slice();
		}

		const parentRot = this.parent.getWorldRotation();
		return [
			parentRot[0] + this.rotation[0],
			parentRot[1] + this.rotation[1],
			parentRot[2] + this.rotation[2]
		];
	}

	clone() {
		return new Transform(
			this.position.slice(),
			this.rotation.slice(),
			this.scale.slice(),
			this.parent
		);
	}

	static getHierarchyGraph(rootTransform) {
		const nodes = [];
		const edges = [];
		
		function traverse(transform) {
			const pos = transform.getWorldPosition();
			nodes.push({ transform, position: pos });
			
			if (transform.parent) {
				const parentPos = transform.parent.getWorldPosition();
				edges.push({
					from: parentPos,
					to: pos,
					parent: transform.parent,
					child: transform
				});
			}
			
			for (const child of transform.children) {
				traverse(child);
			}
		}
		
		traverse(rootTransform);
		return { nodes, edges };
	}
}
