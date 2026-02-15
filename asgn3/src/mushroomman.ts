import Shape, { Cube } from '../../assets/lib/shapes.js';
import Transform from '../../assets/lib/transform.js';
import GameGrid from './gamegrid.js';

export default class MushroomMan {
	private meshTemplates: Shape[];
	private mushrooms: Mushroom[];
	private grid: GameGrid;
	
	constructor(meshTemplates: Shape[], grid: GameGrid) {
		this.meshTemplates = meshTemplates;
		this.mushrooms = [];
		this.grid = grid;
	}

	/**
	 * @returns Mushroom instance if successful, null if cell occupied
	 */
	placeMushroom(worldX: number, worldZ: number): Mushroom | null {
		const [gridX, gridZ] = this.grid.worldToGrid(worldX, worldZ);
		if (this.grid.isOccupied(gridX, gridZ)) {
			return null;
		}

		// place random mushroom in centre of grid, and mark it occipied.
		const [centerX, centerZ] = this.grid.gridToWorld(gridX, gridZ);
		const template = this.meshTemplates[Math.floor(Math.random() * this.meshTemplates.length)];
		const transform = new Transform([centerX, 0, centerZ]);
		const mushroom = new Mushroom(gridX, gridZ, transform, template);
		this.mushrooms.push(mushroom);
		this.grid.occupy(gridX, gridZ);
		
		return mushroom;
	}
	
	/**
	 * @returns true if mushroom was picked, false if none found
	 */
	pickMushroom(worldX: number, worldZ: number): boolean {
		const [gridX, gridZ] = this.grid.worldToGrid(worldX, worldZ);
		const index = this.mushrooms.findIndex(m => m.gridX === gridX && m.gridZ === gridZ);
		if (index === -1) return false;
		
		const mushroom = this.mushrooms[index];
		if (mushroom.state != GrowState.MATURE) return false;

		mushroom.pick();
		this.mushrooms.splice(index, 1);
		this.grid.free(gridX, gridZ);
		
		return true;
	}
	
	/**
	 * Pick mushroom by reference
	 */
	pickMushroomByRef(mushroom: Mushroom): boolean {
		const index = this.mushrooms.indexOf(mushroom);
		if (index === -1) return false;
		
		mushroom.pick();
		this.mushrooms.splice(index, 1);
		this.grid.free(mushroom.gridX, mushroom.gridZ);
		
		return true;
	}
	
	update(dt: number): void {
		for (const mushroom of this.mushrooms) {
			mushroom.update(dt);
		}
	}
	
	render(): void {
		for (const mushroom of this.mushrooms) {
			mushroom.render();
		}
	}
	
	getMushrooms(): Mushroom[] {
		return this.mushrooms;
	}
}

enum GrowState {
	SEED = 0,
	MATURE = 1,
}

export class Mushroom {
	state: GrowState;
	mesh: Shape;
	gridX: number;
	gridZ: number;
	growthDuration: number;
	growthTimer: number;

	private finalMesh: Shape;
	private finalTransform: Transform;
	
	constructor(gridX: number, gridZ: number, worldPos: Transform, finalMesh: Shape) {
		this.state = GrowState.SEED;
		this.gridX = gridX;
		this.gridZ = gridZ;
		this.growthDuration = 2.0;
		this.growthTimer = this.growthDuration;

		// seed
		this.mesh = new Cube(
			worldPos.clone().setRot(45, 45, 0),
			[0.8, 0.6, 0.4, 1.0], // Brown
			0.0,
			null
		);
		this.mesh.transform.setScale(0.2, 0.2, 0.2);
		
		this.finalMesh = finalMesh;
		this.finalTransform = worldPos;
	}
	
	update(dt: number): void {
		const age = this.growthDuration - this.growthTimer;
		this.growthTimer -= dt;
		
		if (this.state === GrowState.SEED && this.growthTimer <= 0.0) {
			this.state = GrowState.MATURE;
			this.mesh = this.finalMesh.clone(this.finalTransform);
		} else if (this.state === GrowState.SEED) {
			const t = age / this.growthDuration;
			const scale = 0.2 + t * 0.3;
			this.mesh.transform.setScale(scale, scale, scale);
		}
	}
	
	render(): void {
		this.mesh.render();
	}
	
	pick(): void {
		this.mesh.destroy?.();
	}
}
