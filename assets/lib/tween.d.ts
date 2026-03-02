import Transform from './transform.js';
export default class Tween {
    target: Transform;
    property: 'scale' | 'position' | 'rotation';
    from: [number, number, number];
    to: [number, number, number];
    duration: number;
    onComplete?: (() => void) | undefined;
    private elapsed;
    constructor(target: Transform, property: 'scale' | 'position' | 'rotation', from: [number, number, number], to: [number, number, number], duration: number, onComplete?: (() => void) | undefined);
    update(dt: number): boolean;
}
//# sourceMappingURL=tween.d.ts.map
