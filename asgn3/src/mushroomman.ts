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
	 * @returns true if mushroom was picked, false if none found
	 */
	placeMushroom(worldX: number, worldZ: number): Mushroom | boolean {
		const [gridX, gridZ] = this.grid.worldToGrid(worldX, worldZ);
		
		// Check if mushroom already exists here
		const existing = this.mushrooms.find(m => m.gridX === gridX && m.gridZ === gridZ);
		if (existing) {
			return existing.startGrowing();
		}
		
		// Check if cell occupied by something else
		if (this.grid.isOccupied(gridX, gridZ)) {
			return false;
		}
		
		// place mushroom
		const [centerX, centerZ] = this.grid.gridToWorld(gridX, gridZ);
		const template = this.meshTemplates[Math.floor(Math.random() * this.meshTemplates.length)];
		const transform = new Transform([centerX, 0, centerZ]); // I considered making it worldX/Z, but it became too confusing trying to grow one if you happened to place it at the edge of a cell.
		const mushroom = new Mushroom(gridX, gridZ, transform, template);
		
		this.mushrooms.push(mushroom);
		this.grid.occupy(gridX, gridZ);
		
		return mushroom;
	}

	/**
	 * @returns points gained (0 if none or can't be picked)
	 */
	pickMushroom(worldX: number, worldZ: number): number {
		const [gridX, gridZ] = this.grid.worldToGrid(worldX, worldZ);
		const index = this.mushrooms.findIndex(m => m.gridX === gridX && m.gridZ === gridZ);
		if (index === -1) return 0;
		
		const mushroom = this.mushrooms[index];
		
		// Can only pick mature mushrooms (not seed or growing)
		if (mushroom.state !== GrowState.MATURE) return 0;
		
		const [scale, ,] = mushroom.mesh.transform.scale;
		const points = Math.round(scale * 10);
		mushroom.pick();
		
		this.mushrooms.splice(index, 1);
		this.grid.free(gridX, gridZ);
		
		return points;
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
	GROWING = 2,
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
	private baseScale: number;
	
	constructor(gridX: number, gridZ: number, worldPos: Transform, finalMesh: Shape) {
		this.state = GrowState.SEED;
		this.gridX = gridX;
		this.gridZ = gridZ;
		this.growthDuration = 2.0;
		this.growthTimer = this.growthDuration;
		this.baseScale = 1.0;
		
		this.mesh = new Cube(
			worldPos.clone().setRot(45, 45, 0),
			[0.8, 0.6, 0.4, 1.0],
			0.0,
			null
		);
		this.mesh.transform.setScale(0.2, 0.2, 0.2);
		this.finalMesh = finalMesh;
		this.finalTransform = worldPos;
	}
	
	startGrowing(): boolean {
		if (this.state !== GrowState.MATURE) return false;
		
		this.state = GrowState.GROWING;
		this.growthTimer = 5.0;
		const [currentScale, ,] = this.mesh.transform.scale;
		this.baseScale = currentScale;
		return true;
	}
	
	update(dt: number): void {
		this.growthTimer -= dt;
		
		if (this.state === GrowState.SEED) {
			if (this.growthTimer <= 0.0) {
				this.state = GrowState.MATURE;
				this.mesh = this.finalMesh.clone(this.finalTransform);
				const scale = (1.25 * Math.random()) + 0.75;
				this.baseScale = scale;
				this.mesh.transform.setScale(scale, scale, scale);
			} else {
				const t = 1 - (this.growthTimer / this.growthDuration);
				const scale = 0.2 + t * 0.2;
				this.mesh.transform.setScale(scale, scale, scale);
			}
		} else if (this.state === GrowState.GROWING) {
			if (this.growthTimer <= 0.0) {
				this.state = GrowState.MATURE;

				// anti compound growth
				const maxBoost = 0.1;
				const damp = Math.log2(1 + this.baseScale); 
				const growthFactor = 1 + (maxBoost / damp);

				// Apply final scale
				const finalScale = this.baseScale * growthFactor;
				this.mesh.transform.setScale(finalScale, finalScale, finalScale);
				this.baseScale = finalScale;
			} else {
				const t = 1 - (this.growthTimer / 5.0);
				const maxBoost = 0.1;
				const damp = Math.log2(1 + this.baseScale);
				const growthFactor = 1 + (maxBoost / damp);

				const scale = this.baseScale * (1 + t * (growthFactor - 1));
				this.mesh.transform.setScale(scale, scale, scale);
			}
		}
	}
	
	render(): void {
		this.mesh.render();
	}
	
	pick(): void {
		this.mesh.destroy?.();
	}
}
