import { Mesh } from './shapes.js';
import Transform from './transform.js';

export default function LoadOBJ(
	filepath: string,
	albedoPath?: string | null,
	transform?: Transform | null
): Promise<Mesh>;
