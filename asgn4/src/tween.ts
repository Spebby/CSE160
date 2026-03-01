import Transform from '../../assets/lib/transform.js';
// life would have been a lot easier if i had written this sooner...

export default class Tween {
	private elapsed = 0;

	constructor(
		public target: Transform,
		public property: 'scale' | 'position' | 'rotation',
		public from: [number, number, number],
		public to: [number, number, number],
		public duration: number,
		public onComplete?: () => void
	) {}

	update(dt: number): boolean {
		this.elapsed += dt;

		const t = Math.min(this.elapsed / this.duration, 1.0);

		// cubic ease
		const eased = 1 - Math.pow(1 - t, 3);
		const value: [number, number, number] = [
			this.from[0] + (this.to[0] - this.from[0]) * eased,
			this.from[1] + (this.to[1] - this.from[1]) * eased,
			this.from[2] + (this.to[2] - this.from[2]) * eased
		];

		switch (this.property) {
			case 'scale':
				this.target.setScale(...value);
				break;
			case 'position':
				this.target.setPos(...value);
				break;
			case 'rotation':
				this.target.setRot(...value);
				break;
		}

		if (t >= 1.0) {
			this.onComplete?.();
			return true;
		}

		return false;
	}
}

