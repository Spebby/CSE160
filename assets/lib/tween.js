// life would have been a lot easier if i had written this sooner...
export default class Tween {
    constructor(target, property, from, to, duration, onComplete) {
        this.target = target;
        this.property = property;
        this.from = from;
        this.to = to;
        this.duration = duration;
        this.onComplete = onComplete;
        this.elapsed = 0;
    }
    update(dt) {
        this.elapsed += dt;
        const t = Math.min(this.elapsed / this.duration, 1.0);
        // cubic ease
        const eased = 1 - Math.pow(1 - t, 3);
        const value = [
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
