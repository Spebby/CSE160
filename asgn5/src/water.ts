// Port of BinBun's Godot Water Shader
// https://binbun3d.itch.io/godot-water-shader

import * as THREE from 'three';

// compile flags, '' means enabled
export const WATER_DEFINES = {
  USE_CAUSTICS:     '',
  USE_REFRACTION:   '',
  USE_DISPLACEMENT: '',
};

const vertexShader = `
uniform sampler2D uWaveTexture;
uniform vec2      uWaveScale;
uniform vec2      uWaveLayerScale;
uniform vec2      uWaveVelocity;
uniform float     uTime;
uniform float     uDisplacementAmount;

varying vec3 vWorldPos;
varying vec4 vClipPos;

float sampleWaveR(vec2 world_xz) {
  vec2 base = world_xz * uWaveScale;
  float w1  = texture2D(uWaveTexture, base * uWaveLayerScale + uTime * -uWaveVelocity).r;
  return texture2D(uWaveTexture, base + uTime * uWaveVelocity - w1 * 0.1).r;
}

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;

#ifdef USE_DISPLACEMENT
  float wave = sampleWaveR(vWorldPos.xz);
  worldPos.y += wave * uDisplacementAmount;
  vWorldPos    = worldPos.xyz;
#endif

  vClipPos    = projectionMatrix * viewMatrix * worldPos;
  gl_Position = vClipPos;
}
`;

const fragmentShader = `
precision highp float;

// Color
uniform vec3  uSurfaceColor;
uniform vec3  uDepthColor;
uniform vec3  uFoamColor;
uniform float uDepthSize;

// Wave
uniform sampler2D uWaveTexture;
uniform sampler2D uWaveNormalTexture;
uniform vec2      uWaveScale;
uniform vec2      uWaveLayerScale;
uniform vec2      uWaveVelocity;
uniform float     uWaveHighlight;
uniform float     uTime;

// Foam
uniform sampler2D uFoamTexture;
uniform float     uEdgeFoamDepthSize;
uniform float     uWaveFoamAmount;
uniform float     uFoamStart;
uniform float     uFoamEnd;
uniform float     uFoamExponent;

// Screen depth, fed WebGLRenderTarget each frame
uniform sampler2D tScreen;
uniform sampler2D tDepth;
uniform mat4      uInvProjection;
uniform mat4      uInvView;

#ifdef USE_CAUSTICS
uniform sampler2D uCausticsTexture;
uniform float     uCausticsStrength;
uniform vec2      uCausticsScale;
#endif

#ifdef USE_REFRACTION
uniform float uRefractionAmount;
uniform float uRefractionExponent;
#endif

varying vec3 vWorldPos;
varying vec4 vClipPos;


// helpers
vec4 sampleWave(vec2 world_xz) {
  vec2 base = world_xz * uWaveScale;
  float w1  = texture2D(uWaveTexture, base * uWaveLayerScale + uTime * -uWaveVelocity).r;
  return texture2D(uWaveTexture, base + uTime * uWaveVelocity - w1 * 0.1);
}

vec4 sampleWaveNormal(vec2 world_xz) {
  vec2 base = world_xz * uWaveScale;
  float w1  = texture2D(uWaveNormalTexture, base * uWaveLayerScale + uTime * -uWaveVelocity).r;
  return texture2D(uWaveNormalTexture, base + uTime * uWaveVelocity - w1 * 0.1);
}

// Reconstruct world-space position from depth buffer
vec4 worldPosFromDepth(vec2 screen_uv) {
  float rawDepth = texture2D(tDepth, screen_uv).r;
  vec4 clipPos   = vec4(screen_uv * 2.0 - 1.0, rawDepth * 2.0 - 1.0, 1.0);
  vec4 viewPos   = uInvProjection * clipPos;
  viewPos       /= viewPos.w;
  return uInvView * viewPos;
}

#ifdef USE_CAUSTICS
vec3 sampleCaustics(vec2 uv) {
  vec2 cuv = uv * uCausticsScale;
  return vec3(
    texture2D(uCausticsTexture, cuv).r,
    texture2D(uCausticsTexture, cuv + vec2(0.02)).r,
    texture2D(uCausticsTexture, cuv + vec2(0.03, 0.01)).r
  );
}
#endif

void main() {
  // NDC → screen UV from interpolated clip position
  vec2 screenUV = (vClipPos.xy / vClipPos.w) * 0.5 + 0.5;

  float wave = sampleWave(vWorldPos.xz).r;
  wave = smoothstep(0.0, 1.0, wave);

  vec2 screen_uv = screenUV;

  // Refraction — offset screen UV by wave, then clamp if sample is above water
#ifdef USE_REFRACTION
  screen_uv += (pow(wave, uRefractionExponent) * 2.0 - 0.5) * 0.01 * uRefractionAmount;
  vec4 refr_dpos  = worldPosFromDepth(screen_uv);
  float pre_depth = pow(clamp((refr_dpos.y - vWorldPos.y + uDepthSize) / uDepthSize, 0.0, 1.0), 4.0);
  screen_uv = mix(screen_uv, screenUV, pre_depth);
  if (refr_dpos.y - vWorldPos.y > 0.0) screen_uv = screenUV;
#endif

  vec4  world_dpos = worldPosFromDepth(screen_uv);
  vec2  surface_uv = world_dpos.xz * 0.2;
  float depth      = pow(clamp((world_dpos.y - vWorldPos.y + uDepthSize) / uDepthSize, 0.0, 1.0), 4.0);

  // Caustics
#ifdef USE_CAUSTICS
  vec3 c1      = sampleCaustics(surface_uv + uTime * -uWaveVelocity);
  vec3 c2      = sampleCaustics(surface_uv + c1.r * 0.05 + uTime * uWaveVelocity * 0.5);
  vec3 caustics = c2 * (1.0 - depth);
#endif

  // Foam
float vert_depth  = vWorldPos.y - world_dpos.y;                  // depth below water
float horiz_dist  = length(world_dpos.xz - vWorldPos.xz);        // horizontal proximity
float edge_dist   = mix(vert_depth, horiz_dist, 
                        clamp(horiz_dist / uEdgeFoamDepthSize, 0.0, 1.0));
float edge_foam   = clamp(1.0 - edge_dist / uEdgeFoamDepthSize, 0.0, 1.0);


  float foam      = max(edge_foam, wave * uWaveFoamAmount);
  float foam_shape = 1.0 - texture2D(uFoamTexture, vWorldPos.xz * 0.5).r;
  foam = clamp((foam - uFoamStart)     / (uFoamEnd - uFoamStart),       0.0, 1.0);
  foam = clamp((foam - foam_shape)     / (1.0 - foam_shape),            0.0, 1.0);
  foam = pow(foam, uFoamExponent);

  // Base colour from screen + depth blend
  vec3 flat_color = mix(uDepthColor, uSurfaceColor, depth);
  vec3 color      = texture2D(tScreen, screen_uv).rgb;

#ifdef USE_CAUSTICS
  color += pow(caustics * uCausticsStrength, vec3(2.0));
#endif

  color = mix(flat_color, color,          0.4 * depth);
  color = mix(color,      uSurfaceColor,  wave * uWaveHighlight);
  color = mix(color,      uFoamColor,     foam);

  // Normal from wave normal texture
  vec3 wn = sampleWaveNormal(vWorldPos.xz).rgb * 2.0 - 1.0;
  vec3 N  = normalize(wn);

  gl_FragColor = vec4(color, 1.0);
}
`;

// ─── Options ──────────────────────────────────────────────────────────────────
export interface WaterMaterialOptions {
  waveTexture:       THREE.Texture;
  waveNormalTexture: THREE.Texture;
  foamTexture:       THREE.Texture;
  causticsTexture?:  THREE.Texture;

  surfaceColor?:     THREE.Color;
  depthColor?:       THREE.Color;
  foamColor?:        THREE.Color;
  depthSize?:        number;

  waveScale?:        THREE.Vector2;
  waveLayerScale?:   THREE.Vector2;
  waveVelocity?:     THREE.Vector2;
  waveHighlight?:    number;

  edgeFoamDepthSize?: number;
  waveFoamAmount?:    number;
  foamStart?:         number;
  foamEnd?:           number;
  foamExponent?:      number;

  causticsStrength?:  number;
  causticsScale?:     THREE.Vector2;

  refractionAmount?:  number;
  refractionExponent?: number;

  displacementAmount?: number;
}

const fallbackTex = (() => {
  const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
})();

export function createWaterMaterial(opts: WaterMaterialOptions): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    defines: { ...WATER_DEFINES },
    transparent: true,
    uniforms: {
      uWaveTexture:       { value: opts.waveTexture },
      uWaveNormalTexture: { value: opts.waveNormalTexture },
      uFoamTexture:       { value: opts.foamTexture },
      uCausticsTexture:   { value: opts.causticsTexture  ?? fallbackTex },

      uSurfaceColor:      { value: opts.surfaceColor     ?? new THREE.Color(0.2, 1.0, 0.8) },
      uDepthColor:        { value: opts.depthColor       ?? new THREE.Color(0.08, 0.2, 0.4) },
      uFoamColor:         { value: opts.foamColor        ?? new THREE.Color(1, 1, 1) },
      uDepthSize:         { value: opts.depthSize        ?? 12.0 },

      uWaveScale:         { value: opts.waveScale        ?? new THREE.Vector2(0.2, 0.2) },
      uWaveLayerScale:    { value: opts.waveLayerScale   ?? new THREE.Vector2(1.5, 1.5) },
      uWaveVelocity:      { value: opts.waveVelocity     ?? new THREE.Vector2(0.02, 0.02) },
      uWaveHighlight:     { value: opts.waveHighlight    ?? 0.5 },

      uEdgeFoamDepthSize: { value: opts.edgeFoamDepthSize ?? 1.0 },
      uWaveFoamAmount:    { value: opts.waveFoamAmount   ?? 0.8 },
      uFoamStart:         { value: opts.foamStart        ?? 0.15 },
      uFoamEnd:           { value: opts.foamEnd          ?? 0.30 },
      uFoamExponent:      { value: opts.foamExponent     ?? 2.0 },

      uCausticsStrength:  { value: opts.causticsStrength  ?? 2.0 },
      uCausticsScale:     { value: opts.causticsScale     ?? new THREE.Vector2(0.5, 0.5) },

      uRefractionAmount:  { value: opts.refractionAmount  ?? 0.5 },
      uRefractionExponent:{ value: opts.refractionExponent ?? 0.5 },

      uDisplacementAmount:{ value: opts.displacementAmount ?? 0.3 },

      uTime:              { value: 0 },
      uInvProjection:     { value: new THREE.Matrix4() },
      uInvView:           { value: new THREE.Matrix4() },
      tScreen:            { value: fallbackTex },
      tDepth:             { value: fallbackTex },
    },
  });
}


export function createWaterRenderer(
  renderer: THREE.WebGLRenderer,
  waterMesh: THREE.Mesh,
) {
  const rt = new THREE.WebGLRenderTarget(
    window.innerWidth,
    window.innerHeight,
    {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      depthTexture: new THREE.DepthTexture(window.innerWidth, window.innerHeight),
    },
  );

  const mat = waterMesh.material as THREE.ShaderMaterial;

  function update(scene: THREE.Scene, camera: THREE.Camera, time: number) {
    // hide water, render everything else to the RT
    waterMesh.visible = false;
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    waterMesh.visible = true;

    // 2. feed RT textures
    mat.uniforms.tScreen.value       = rt.texture;
    mat.uniforms.tDepth.value        = rt.depthTexture;
    mat.uniforms.uInvProjection.value.copy((camera as THREE.PerspectiveCamera).projectionMatrixInverse);
    mat.uniforms.uInvView.value.copy(camera.matrixWorld);
    mat.uniforms.uTime.value         = time;
  }

  function resize(w: number, h: number) {
    rt.setSize(w, h);
  }

  return { update, resize, renderTarget: rt };
}
