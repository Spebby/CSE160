import * as THREE from 'three';

const vertexShader = `
	varying vec3 vNormal;
	varying vec3 vViewDir;
	varying vec2 vUv;
	varying vec3 vWorldPos;
	varying vec3 vViewPos;

	void main() {
		vec4 worldPos = modelMatrix * vec4(position, 1.0);
		vec4 viewPos  = viewMatrix * worldPos;

		gl_Position = projectionMatrix * viewPos;

		vNormal   = normalize(normalMatrix * normal);
		vViewDir  = normalize(-viewPos.xyz);
		vUv       = uv;
		vWorldPos = worldPos.xyz;
		vViewPos  = viewPos.xyz;
	}
`;

const fragmentShader = `
	precision highp float;

	uniform sampler2D uAlbedo;
	uniform vec3      uAlbedoTint;

	uniform vec3  uLightDir;
	uniform vec3  uLightColor;
	uniform vec3  uAmbientColor;

	uniform vec3  uShadowColor;
	uniform float uShadowSize;
	uniform vec3  uHighlightColor;
	uniform float uHighlightSize;
	uniform float uSoftness;

	uniform vec3  uRimColor;
	uniform float uRimSize;

	uniform bool      uUsePattern;
	uniform sampler2D uPattern;
	uniform float     uPatternTiling;
	uniform float     uPatternAmount;
	uniform float     uPatternBlend;

	uniform float uPaintStrength;
	uniform int   uPaintCoordMode;   // 0=UV  1=Camera  2=World
	uniform vec3  uPaintRotation;
	uniform vec3  uPaintScaleVec;
	uniform float uPaintScale;
	uniform float uPaintDetail;
	uniform float uPaintDetailScale;
	uniform float uPaintRoughness;
	uniform float uPaintSmoothness;

	varying vec3 vNormal;
	varying vec3 vViewDir;
	varying vec2 vUv;
	varying vec3 vWorldPos;
	varying vec3 vViewPos;

	// Voronoi
	vec2 hash22(vec2 p) {
		p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
		return fract(sin(p) * 43758.5453);
	}

	// 3x3 neighborhood is sufficient for F1 voronoi
	vec3 voronoi_f1(vec2 coord) {
		vec2  cell    = floor(coord);
		vec2  fr      = fract(coord);
		float minDist = 8.0;
		vec3  closest = vec3(0.0);
		for (int y = -1; y <= 1; y++) {
			for (int x = -1; x <= 1; x++) {
				vec2  offset = vec2(float(x), float(y));
				vec2  h      = hash22(cell + offset);
				float dist   = length(offset + h - fr);
				if (dist < minDist) {
					minDist = dist;
					closest = fract(vec3(h.x * 43758.5453, h.y * 12345.6789, (h.x + h.y) * 23456.789));
				}
			}
		}
		return closest;
	}

	// Merge both fractal passes into one, interleaving frequencies
vec3 voronoi_fractal(vec2 coord, float scale, float detail, float roughness, float lacunarity) {
    vec3  colorA    = vec3(0.0);
    vec3  colorB    = vec3(0.0);
    float amplitude = 1.0;
    float frequency = scale;
    for (int i = 0; i < 4; i++) {
        if (float(i) >= detail) break;
        colorA    += voronoi_f1(coord * frequency)       * amplitude;
        colorB    += voronoi_f1(coord * frequency * 0.5) * amplitude;
        frequency *= lacunarity;
        amplitude *= roughness;
    }
    // Blend the two passes directly — no need for overlayNormals here
    return fract(mix(colorA, colorB, 0.3));
}


	// Transform helpers

	mat3 rotationMatrixEuler(vec3 r) {
		float cx = cos(r.x), sx = sin(r.x);
		float cy = cos(r.y), sy = sin(r.y);
		float cz = cos(r.z), sz = sin(r.z);
		mat3 rx = mat3(1.0,  0.0, 0.0,   0.0, cx,  sx,   0.0, -sx, cx );
		mat3 ry = mat3(cy,   0.0, -sy,   0.0, 1.0,  0.0,  sy,  0.0, cy );
		mat3 rz = mat3(cz,   sz,  0.0,  -sz,  cz,  0.0,   0.0, 0.0, 1.0);
		return rz * ry * rx;
	}

	// -------------------------------------------------------------------------
	// Paint normals
	// -------------------------------------------------------------------------
	vec3 generatePaintNormals(vec3 coord) {
		vec3 mapped      = rotationMatrixEuler(uPaintRotation) * (coord * uPaintScaleVec);
		vec3 blended     = voronoi_fractal(mapped.xy, uPaintScale, uPaintDetail, uPaintRoughness, uPaintDetailScale) * 2.0 - 1.0;
		return mix(vec3(0.0, 0.0, 1.0), normalize(blended), uPaintStrength);
	}

	// Derivative-based TBN (no tangent attribute needed)
	mat3 cotangentFrame(vec3 N, vec3 p, vec2 uv) {
		vec3 dp1  = dFdx(p);
		vec3 dp2  = dFdy(p);
		vec2 duv1 = dFdx(uv);
		vec2 duv2 = dFdy(uv);
		vec3 T = dp2 * duv1.x - dp1 * duv2.x;
		vec3 B = dp1 * duv2.y - dp2 * duv1.y;
		float invmax = inversesqrt(max(dot(T, T), dot(B, B)));
		return mat3(T * invmax, B * invmax, N);
	}

	// -------------------------------------------------------------------------
	// Toon shading  (port of toon2rgb.gdshaderinc)
	// -------------------------------------------------------------------------

	vec3 toon2rgb(float lightVal, vec3 baseColor) {
		// Shadow path
		float lowFactor = (lightVal / max(uShadowSize, 0.001)) * 0.5 + 0.1;
		float lowMixA   = lowFactor < 0.222 ? 0.0 : 1.0;
		float lowMixB   = smoothstep(0.065, 1.0, lowFactor);
		float lowMixAB  = 1.0 - mix(lowMixA, lowMixB, uSoftness);
		vec3  shadowed  = mix(baseColor, uShadowColor, lowMixAB);

		// Highlight path
		float hiFactor        = (lightVal * uHighlightSize) * 1.1 - 0.2;
		float hiHard          = hiFactor < 0.731 ? 0.0 : 1.0;
		float hiSmooth        = smoothstep(0.0, 0.8, hiFactor);
		float highlightFactor = mix(hiHard, hiSmooth, uSoftness);

		return mix(shadowed, uHighlightColor, highlightFactor);
	}

	// -------------------------------------------------------------------------
	void main() {
		vec3 Ngeo = normalize(vNormal);

		// Resolve paint normal coordinate space
		vec3 paintCoord;
		if      (uPaintCoordMode == 0) paintCoord = vec3(vUv, 0.0);
		else if (uPaintCoordMode == 1) paintCoord = vViewPos;
		else                           paintCoord = vWorldPos;

		vec3 paintNormalTS = generatePaintNormals(paintCoord);
		mat3 TBN           = cotangentFrame(Ngeo, vViewPos, vUv);
		vec3 N             = normalize(TBN * paintNormalTS);

		vec3 V = normalize(vViewDir);
		vec3 L = normalize(uLightDir);

		vec3  albedo   = texture2D(uAlbedo, vUv).rgb * uAlbedoTint;
		float lightVal = max(dot(N, L), 0.0);

		vec3 colour = toon2rgb(lightVal, albedo);

		// Rim
		if (uRimSize > 0.0) {
			float facing    = abs(dot(N, V));
			float rimFactor = 1.0 - clamp(pow(facing, uRimSize * 5.0), 0.0, 1.0);
			colour = mix(colour, uRimColor, rimFactor * uRimSize);
		}

		// Ambient fill
		colour += albedo * uAmbientColor;

		gl_FragColor = vec4(colour, 1.0);
	}
`;

// factory
export interface PainterlyMaterialOptions {
	albedo?:           THREE.Texture;
	albedoTint?:       THREE.Color;
	lightDir?:         THREE.Vector3;
	lightColor?:       THREE.Color;
	ambientColor?:     THREE.Color;
	shadowColor?:      THREE.Color;
	shadowSize?:       number;
	highlightColor?:   THREE.Color;
	highlightSize?:    number;
	softness?:         number;
	rimColor?:         THREE.Color;
	rimSize?:          number;
	paintStrength?:    number;
	paintCoordMode?:   0 | 1 | 2;   // 0=UV  1=Camera  2=World
	paintRotation?:    THREE.Vector3;
	paintScaleVec?:    THREE.Vector3;
	paintScale?:       number;
	paintDetail?:      number;
	paintDetailScale?: number;
	paintRoughness?:   number;
	paintSmoothness?:  number;
}

const fallbackTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
fallbackTex.needsUpdate = true;

export function createPainterlyMaterial(opts: PainterlyMaterialOptions = {}): THREE.ShaderMaterial {
	return new THREE.ShaderMaterial({
		vertexShader,
		fragmentShader,
		uniforms: {
			uAlbedo:           { value: opts.albedo           ?? fallbackTex },
			uAlbedoTint:       { value: opts.albedoTint       ?? new THREE.Color(1, 1, 1) },

			uLightDir:         { value: opts.lightDir         ?? new THREE.Vector3(1, 1, 1).normalize() },
			uLightColor:       { value: opts.lightColor       ?? new THREE.Color(1, 1, 1) },
			uAmbientColor:     { value: opts.ambientColor     ?? new THREE.Color(0.15, 0.15, 0.15) },

			uShadowColor:      { value: opts.shadowColor      ?? new THREE.Color(0.2, 0.1, 0.05) },
			uShadowSize:       { value: opts.shadowSize       ?? 0.5 },
			uHighlightColor:   { value: opts.highlightColor   ?? new THREE.Color(1.0, 0.95, 0.9) },
			uHighlightSize:    { value: opts.highlightSize    ?? 0.8 },
			uSoftness:         { value: opts.softness         ?? 0.01 },

			uRimColor:         { value: opts.rimColor         ?? new THREE.Color(1, 1, 1) },
			uRimSize:          { value: opts.rimSize          ?? 0.0 },

			uPaintStrength:    { value: opts.paintStrength    ?? 0.15 },
			uPaintCoordMode:   { value: opts.paintCoordMode   ?? 1 },
			uPaintRotation:    { value: opts.paintRotation    ?? new THREE.Vector3(0, 0, 0) },
			uPaintScaleVec:    { value: opts.paintScaleVec    ?? new THREE.Vector3(1, 1, 1) },
			uPaintScale:       { value: opts.paintScale       ?? 4.0 },
			uPaintDetail:      { value: opts.paintDetail      ?? 5.0 },
			uPaintDetailScale: { value: opts.paintDetailScale ?? 2.0 },
			uPaintRoughness:   { value: opts.paintRoughness   ?? 0.5 },
			uPaintSmoothness:  { value: opts.paintSmoothness  ?? 0.1 },
		},
	});
}
