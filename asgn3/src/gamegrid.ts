export default class GameGrid {
	cellSize: number;
	occupiedCells: Set<string>;
	blockedCells: Set<string>;
	
	constructor(cellSize: number = 1.0) {
		this.cellSize = cellSize;
		this.occupiedCells = new Set();
		this.blockedCells = new Set();
	}
	
	worldToGrid(x: number, z: number): [number, number] {
		// Cell (0,0) is centered at world origin
		return [
			Math.floor((x + this.cellSize / 2) / this.cellSize),
			Math.floor((z + this.cellSize / 2) / this.cellSize)
		];
	}
	
	gridToWorld(gridX: number, gridZ: number): [number, number] {
		return [
			gridX * this.cellSize,
			gridZ * this.cellSize
		];
	}
	
	getCellKey(gridX: number, gridZ: number): string {
		return `${gridX},${gridZ}`;
	}
	
	isOccupied(gridX: number, gridZ: number): boolean {
		const key = this.getCellKey(gridX, gridZ);
		return this.occupiedCells.has(key) || this.blockedCells.has(key);
	}

	isBlocked(gridX: number, gridZ: number): boolean {
		const key = this.getCellKey(gridX, gridZ);
		return this.blockedCells.has(key);
	}
	
	occupy(gridX: number, gridZ: number): void {
		this.occupiedCells.add(this.getCellKey(gridX, gridZ));
	}
	
	free(gridX: number, gridZ: number): void {
		this.occupiedCells.delete(this.getCellKey(gridX, gridZ));
	}
	
	block(gridX: number, gridZ: number): void {
		this.blockedCells.add(this.getCellKey(gridX, gridZ));
	}
	
	unblock(gridX: number, gridZ: number): void {
		this.blockedCells.delete(this.getCellKey(gridX, gridZ));
	}

		/**
	 * Get a random world position inside a grid cell
	 * @param gridX Grid X coordinate
	 * @param gridZ Grid Z coordinate
	 * @returns [worldX, worldZ] random position within cell bounds
	 */
	getRandomPositionInCell(gridX: number, gridZ: number): [number, number] {
		const halfCell = this.cellSize / 2;
		const centerX = gridX * this.cellSize;
		const centerZ = gridZ * this.cellSize;
		
		return [
			centerX + (Math.random() - 0.5) * this.cellSize,
			centerZ + (Math.random() - 0.5) * this.cellSize
		];
	}
	
	/**
	 * Get a random position in a cell, given world coordinates
	 * @param worldX World X coordinate
	 * @param worldZ World Z coordinate
	 * @returns [worldX, worldZ] random position within the cell containing the input point
	 */
	getRandomPositionNearPoint(worldX: number, worldZ: number): [number, number] {
		const [gridX, gridZ] = this.worldToGrid(worldX, worldZ);
		return this.getRandomPositionInCell(gridX, gridZ);
	}
}
