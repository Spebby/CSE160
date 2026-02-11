export class AnimMan {
	#rig;
	#anims = {};
	#active = null;
	#lastActive = null;
	#time = 0;
	#queue = [];
	#transition = null;
	#transitionDuration = 0.15;
	#userOverrides = {}; // slider control
	#takeoverLerps = {}; // takeover when anim starts

	constructor(rig, animations) {
		this.#rig = rig;
		this.#queue = new Queue(32);
		this.#anims = animations;
	}
	
	setUserRotation(boneName, rotation) {
		this.#userOverrides[boneName] = rotation.slice();
		delete this.#takeoverLerps[boneName];
	}
	
	clearUserRotation(boneName) {
		delete this.#userOverrides[boneName];
	}

	update(dt) {
		this.#updateTakeovers(dt);
		
		if (this.#transition) {
			this.#updateTransition(dt);
			return;
		}
		
		if (!this.#active) {
			const next = this.#queue.dequeue() || "idle";
			const nextAnim = this.#anims[next];
			
			// if we can seamlessly loop, just restart animation
			if (this.#lastActive === next && nextAnim?.seamlessLoop) {
				this.#active = { key: next, anim: nextAnim };
				this.#time = 0;
			} else {
				this.#startAnim(next);
			}
			return;
		}
		
		const { key, anim } = this.#active;
		this.#time += dt;
		
		if (this.#time > anim.duration) {
			if (anim.loop && this.#queue.length === 0) {
				this.#time %= anim.duration;
			} else {
				this.#lastActive = key;
				this.#active = null;
				return;
			}
		}
		
		this.#applyKeyframes(anim, this.#time);
	}

	#startAnim(key) {
		const anim = this.#anims[key];
		if (!anim) {
			console.warn(`Animation "${key}" not found`);
			return;
		}
		
		// Start a transition to the first keyframe instead of jumping to it
		const currentPose = this.#capturePose();
		const firstFrame = anim.keyframes[0].transforms;
		
		this.#transition = {
			nextKey: key,
			time: 0,
			from: currentPose,
			to: firstFrame
		};
		
		// Don't set #active yet - let the transition complete first
		this.#active = null;
	}
	
	// get bones affected by this animation
	#getAffectedBones(anim) {
		const bones = new Set();
		for (const keyframe of anim.keyframes) {
			for (const boneName in keyframe.transforms) {
				bones.add(boneName);
			}
		}
		return bones;
	}
	
	// update takeover lerps
	#updateTakeovers(dt) {
		const takeoverSpeed = 3.0; // ~0.33s to take over
		for (const boneName in this.#takeoverLerps) {
			this.#takeoverLerps[boneName].progress += dt * takeoverSpeed;
			if (this.#takeoverLerps[boneName].progress >= 1.0) {
				delete this.#takeoverLerps[boneName];
			}
		}
	}
	
	#updateTransition(dt) {
		const tr = this.#transition;
		tr.time += dt;
		const t = Math.min(tr.time / this.#transitionDuration, 1);
		
		for (const boneName in tr.to) {
			// skip if user override active
			if (this.#userOverrides[boneName]) continue;
			
			const bone = this.#rig[boneName];
			if (!bone) continue;
			
			const from = tr.from[boneName]?.rotation || [0, 0, 0];
			const to = tr.to[boneName]?.rotation;
			if (!to) continue;
			
			bone.setRot(...lerpVec3(from, to, t));
		}
		
		// transition end
		if (t === 1) {
			const anim = this.#anims[tr.nextKey];
			this.#active = { key: tr.nextKey, anim };
			this.#time = 0;
			this.#transition = null;
			
			// takeover lerps
			const affectedBones = this.#getAffectedBones(anim);
			for (const boneName of affectedBones) {
				if (this.#userOverrides[boneName]) {
					this.#takeoverLerps[boneName] = {
						from: this.#userOverrides[boneName].slice(),
						progress: 0
					};
					delete this.#userOverrides[boneName];
				}
			}
		}
	}
	
	#applyKeyframes(anim, time) {
		// Find surrounding keyframes
		let prevFrame = anim.keyframes[0];
		let nextFrame = anim.keyframes[anim.keyframes.length - 1];
		
		for (let i = 0; i < anim.keyframes.length - 1; i++) {
			if (anim.keyframes[i].time <= time && anim.keyframes[i + 1].time >= time) {
				prevFrame = anim.keyframes[i];
				nextFrame = anim.keyframes[i + 1];
				break;
			}
		}

		const timeDiff = nextFrame.time - prevFrame.time;
		const t = timeDiff > 0 ? (time - prevFrame.time) / timeDiff : 0;

		// iterate over all bones in the rig
		for (const boneName in this.#rig) {
			const finalRot = this.#getFinalRotation(boneName, prevFrame, nextFrame, t);
			if (finalRot) this.#rig[boneName].setRot(...finalRot);
		}
	}

	
	// get rotation considering overrides and takeovers
	#getFinalRotation(boneName, prevFrame, nextFrame, t) {
		const bone = this.#rig[boneName];
		if (!bone) return null;

		if (this.#userOverrides[boneName]) {
			return this.#userOverrides[boneName];
		}

		const prev = prevFrame.transforms?.[boneName]?.rotation ?? bone.rotation;
		const next = nextFrame.transforms?.[boneName]?.rotation ?? prev;
		let animRot = lerpVec3(prev, next, t);

		if (this.#takeoverLerps[boneName]) {
			const { from, progress } = this.#takeoverLerps[boneName];
			const lerpT = Math.min(1, progress);
			animRot = lerpVec3(from, animRot, lerpT);
		}

		return animRot;
	}


	// used to lerp keyframes
	#capturePose() {
		const pose = {};
		for (const name in this.#rig) {
			pose[name] = {
				rotation: this.#rig[name].rotation.slice()
			};
		}
		return pose;
	}
	
	queueAnim(key) {
		if (!this.#anims[key]) {
			console.warn(`Cannot queue unknown animation: ${key}`);
			return;
		}
		try {
			this.#queue.enqueue(key);
		} catch (err) {
			console.warn('Animation queue full, cannot enqueue:', key);
		}
	}

	// interrupt the active animation queue with a new animation.
	// Most animations are interruptible and will cancel immediately.
	// Some disallow interruptions, and instead the interruptee will
	// be queued and played as the next animation.
	interruptAnimQueue(key) {
		if (!this.#anims[key]) {
			console.warn(`Cannot interrupt with unknown animation: ${key}`);
			return;
		}

		this.clearQueue();
		if (this.#active && this.#active.anim.disallowInterrupt) {
			this.queueAnim(key);
		} else {
			this.#startAnim(key);
		}
	}
	
	clearQueue() {
		while (this.#queue.length > 0) {
			this.#queue.dequeue();
		}
	}
	
	getActiveAnimation() {
		return this.#active?.key || null;
	}
	
	isPlaying(key) {
		return this.#active?.key === key;
	}
	
	getQueueLength() {
		return this.#queue.length;
	}

	// return array of queued animation names
	getQueueInfo() {
		return this.#queue.toList();
	}
}

function lerp(a, b, t) {
	return a + (b - a) * t;
}

function lerpVec3(a, b, t) {
	return [
		lerp(a[0], b[0], t),
		lerp(a[1], b[1], t),
		lerp(a[2], b[2], t)
	];
}
