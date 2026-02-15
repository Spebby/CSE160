import { Mesh } from '../../assets/lib/shapes.js';
import Transform from '../../assets/lib/transform.js';

export default async function LoadOBJ(filepath: string, albedoPath?: string | null, transform?: Transform | null): Promise<Mesh> {
	const positions: number[][] = [];
	const normals: number[][] = [];
	const uvs: number[][] = [];
	const vBuff: number[] = [];
	const nBuff: number[] = [];
	const uvBuff: number[] = [];
	
	const response = await fetch(filepath);
	const obj = await response.text();
	const lines = obj.split('\n');
	
	for (let line of lines) {
		line = line.trim();
		if (!line || line.startsWith('#') || line.startsWith('s ') || line.startsWith('usemtl')) continue;
		
		if (line.startsWith('v ')) {
			const [, x, y, z] = line.split(/\s+/);
			positions.push([parseFloat(x), parseFloat(y), parseFloat(z)]);
			continue;
		}
		
		if (line.startsWith('vn ')) {
			const [, x, y, z] = line.split(/\s+/);
			normals.push([parseFloat(x), parseFloat(y), parseFloat(z)]);
			continue;
		}
		
		if (line.startsWith('vt ')) {
			const [, u, v] = line.split(/\s+/);
			uvs.push([parseFloat(u), 1.0 - parseFloat(v)]); // Flip V
			continue;
		}
		
		if (line.startsWith('f ')) {
			const [, ...verts] = line.split(/\s+/);
			if (verts.length !== 3) {
				throw new Error('Non-triangle face encountered');
			}

			for (const vert of verts) {
				const [viStr, uviStr, niStr] = vert.split('/');
				const vi = parseInt(viStr, 10) - 1;
				const uvi = uviStr ? parseInt(uviStr, 10) - 1 : -1;
				const ni = niStr ? parseInt(niStr, 10) - 1 : -1;
				
				// position
				const [px, py, pz] = positions[vi];
				vBuff.push(px, py, pz);
				
				// normal
				if (ni >= 0 && normals[ni]) {
					const [nx, ny, nz] = normals[ni];
					nBuff.push(nx, ny, nz);
				} else {
					nBuff.push(0, 0, 1);
				}
				
				// uv
				if (uvi >= 0 && uvs[uvi]) {
					const [u, v] = uvs[uvi];
					uvBuff.push(u, v);
				} else {
					uvBuff.push(0, 0);
				}
			}
		}
	}
	
	console.log(`Loaded OBJ: ${positions.length} positions, ${normals.length} normals, ${uvs.length} UVs`);
	console.log(`Generated ${vBuff.length / 3} vertices`);
	
	return new Mesh(
		transform,
		[1, 1, 1, 1],
		0.0,
		vBuff,
		nBuff,
		uvBuff.length ? uvBuff : null,
		albedoPath
	);
}
