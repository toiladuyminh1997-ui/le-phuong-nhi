/* Lê Phương Nhi — Immerse. Thế giới dưới nước: nhân vật chính lơ lửng giữa cảnh, đàn sứa thủy tinh
   bơi vòng quanh; các dự án là những tấm kính xếp xoắn ốc quanh nhân vật. Cuộn / kéo / ← → để lặn sâu
   qua năm "sinh vật biển" (5 nhóm dự án); bấm tấm kính giữa để mở dự án. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';

const D = window.PORT;
const $ = (s, r = document) => r.querySelector(s);
const mobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const body = document.body;

/* ---------- danh sách tấm kính: mỗi phần = 1 tấm bìa phần + các dự án ---------- */
const ITEMS = [];
D.sections.forEach((s, si) => {
  ITEMS.push({ type: 'section', s, si });
  s.projects.forEach((p, pi) => ITEMS.push({ type: 'project', s, si, p, pi }));
});
const N = ITEMS.length;
const secStart = D.sections.map((_, si) => ITEMS.findIndex(it => it.si === si));

/* ---------- bố cục ---------- */
const R = mobile ? 3.0 : 4.6, A_STEP = .62, Y_STEP = 1.55;
const CARD_W = mobile ? 1.9 : 3.9, CARD_H = CARD_W / 1.6;
const HOME_Y = -6;

const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, .1, 120);
const envTex = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .03).texture;

const DEEP = new THREE.Color('#06244a'), GLOW = new THREE.Color('#9fd8ff');
const colA = DEEP.clone(), colB = GLOW.clone(), wantA = new THREE.Color(), wantB = new THREE.Color();
const secCol = D.sections.map(s => new THREE.Color(s.color));

/* ---------- nền: nước sâu + tia nắng từ mặt nước + vân sáng ---------- */
const bgMat = new THREE.ShaderMaterial({
  depthTest: false, depthWrite: false,
  uniforms: { uA: { value: colA }, uB: { value: colB }, uT: { value: 0 }, uAsp: { value: 1 }, uDepth: { value: 0 }, uM: { value: new THREE.Vector2() } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1., 1.); }',
  fragmentShader: `precision highp float; varying vec2 vUv; uniform vec3 uA, uB; uniform float uT, uAsp, uDepth; uniform vec2 uM;
    float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
      return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
    void main(){
      vec2 p = vUv - .5; p.x *= uAsp;
      float dark = clamp(uDepth, 0., 1.);
      vec3 c = mix(uA * 1.25, uA * .12, smoothstep(.75, -.6, p.y));                 // sáng phía mặt nước, tối dần xuống đáy
      // tia nắng xiên từ trên xuống, lay động chậm
      float x = p.x + p.y * .35 + uM.x * .03;
      float rays = n(vec2(x * 7., uT * .12)) * n(vec2(x * 13. + 4., uT * .07));
      c += uB * rays * .32 * smoothstep(-.5, .55, p.y) * (1. - dark * .6);
      // vân sáng gợn (caustics) ở phía trên
      float ca = n(p * 9. + vec2(uT * .15, -uT * .1)) * n(p * 14. - vec2(uT * .1, uT * .17));
      c += uB * pow(ca, 2.) * .35 * smoothstep(.0, .5, p.y);
      c += uB * .1 * smoothstep(.6, .0, length(p - vec2(0., .05)));               // quầng sáng quanh nhân vật
      c *= 1. - .5 * smoothstep(.5, 1.25, length(p));
      c += (h(vUv * 900. + uT) - .5) * .014;
      gl_FragColor = vec4(c, 1.);
    }`,
});
const bgQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
bgQuad.frustumCulled = false; bgQuad.renderOrder = -10;
scene.add(bgQuad);

/* ---------- bọt nước + phù du ---------- */
const world = new THREE.Group();
scene.add(world);
const COUNT = mobile ? 7000 : 26000, SPAN = N * Y_STEP + 30;
{
  const pos = new Float32Array(COUNT * 3), rnd = new Float32Array(COUNT * 4);
  for (let i = 0; i < COUNT; i++) {
    const bubble = Math.random() < .22;
    const r = bubble ? 1.2 + Math.random() * 7 : Math.sqrt(Math.random()) * 18;
    const a = Math.random() * Math.PI * 2;
    pos.set([Math.cos(a) * r, 12 - Math.random() * SPAN, Math.sin(a) * r - 2], i * 3);
    rnd.set([Math.random(), Math.random(), Math.random(), bubble ? 1 : 0], i * 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aR', new THREE.BufferAttribute(rnd, 4));
  var dustMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uPx: { value: 1 }, uB: { value: colB }, uSpan: { value: SPAN } },
    vertexShader: `attribute vec4 aR; uniform float uT, uPx, uSpan; varying vec4 vR;
      void main(){
        vec3 p = position; float s = aR.x * 6.2831;
        if (aR.w > .5) {   // bọt: nổi lên, lắc nhẹ, lặp lại theo chiều dọc
          p.y += mod(uT * (.25 + aR.y * .5) + aR.z * uSpan, uSpan) - uSpan * .5;
          p.x += sin(uT * 2. + s) * .06;
        } else {
          p += vec3(sin(uT * .2 + s), sin(uT * .15 + s * 1.7) * .6, cos(uT * .17 + s)) * .3;
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        float size = aR.w > .5 ? mix(2., 7., aR.y * aR.y) : mix(1., 3.2, aR.y * aR.y * aR.y);
        gl_PointSize = max(size * uPx / -mv.z, 1.);
        gl_Position = projectionMatrix * mv; vR = aR;
      }`,
    fragmentShader: `precision highp float; uniform vec3 uB; varying vec4 vR;
      void main(){
        float d = length(gl_PointCoord - .5); if (d > .5) discard;
        float a;
        if (vR.w > .5) a = smoothstep(.5, .42, d) * smoothstep(.25, .45, d) * .9 + smoothstep(.2, .0, length(gl_PointCoord - vec2(.35, .32))) * .8;   // bọt: viền sáng + đốm phản chiếu
        else a = smoothstep(.5, .0, d) * .55;
        gl_FragColor = vec4(mix(uB, vec3(1.), .55) * a, 1.) * (.35 + .65 * vR.z);
      }`,
  });
  const dust = new THREE.Points(g, dustMat);
  dust.frustumCulled = false;
  world.add(dust);
}

/* ---------- nhân vật chính: cột xương sống thủy tinh lơ lửng giữa cảnh ----------
   24 đốt sống theo đường cong chữ S tự nhiên (cổ - ngực - thắt lưng), mỗi đốt = thân đốt + gai sau + hai mỏm ngang,
   thêm xương cùng và vài đôi xương sườn mảnh. Vật liệu kính trong, khúc xạ, ánh cầu vồng; cả cột uốn lượn chậm như đang trôi. */
const center = new THREE.Group();
scene.add(center);
// kính: trong suốt ở giữa, sáng ở viền (fresnel), ánh cầu vồng đổi theo góc nhìn, có đốm phản chiếu
const glass = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  uniforms: { uC: { value: colB }, uA: { value: 1 }, uT: { value: 0 } },
  vertexShader: `varying vec3 vN, vV, vW;
    void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vec4 mv = viewMatrix * w;
      vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `precision highp float; uniform vec3 uC; uniform float uA, uT; varying vec3 vN, vV, vW;
    vec3 hue(float h){ return clamp(abs(fract(h + vec3(0., .333, .667)) * 6. - 3.) - 1., 0., 1.); }
    void main(){
      vec3 n = normalize(vN), v = normalize(vV);
      float ndv = abs(dot(n, v)), f = pow(1. - ndv, 2.6);
      vec3 irid = hue(ndv * 1.4 + vW.y * .15 + uT * .03);                          // ánh cầu vồng mỏng như màng xà phòng
      vec3 l = normalize(vec3(.4, .8, .6));
      float spec = pow(max(dot(reflect(-l, n), v), 0.), 60.);                      // đốm phản chiếu
      vec3 c = uC * (.05 + f * 1.25) + mix(uC, irid, .55) * f * .55 + vec3(1.) * spec * .9;
      gl_FragColor = vec4(c * uA, 1.);
    }`,
});
const glowMat = new THREE.MeshBasicMaterial({ color: colB, transparent: true, opacity: .16, blending: THREE.AdditiveBlending, depthWrite: false });
const spine = new THREE.Group();
center.add(spine);
const VERT = 24, SP_LEN = mobile ? 3.4 : 4.2;
const spinePt = (t, time) => new THREE.Vector3(                 // t: 0 = cổ (trên) -> 1 = thắt lưng (dưới)
  Math.sin(t * Math.PI * 2.1 + time * .5) * .06,
  SP_LEN * (.5 - t),
  -Math.sin(t * Math.PI * 1.6 + .4) * .32 + Math.sin(time * .4 + t * 3) * .05);
{
  const bodyG = new THREE.CylinderGeometry(1, 1, 1, 28, 1);
  bodyG.translate(0, 0, 0);
  const discG = new THREE.TorusGeometry(1, .18, 10, 32);
  const procG = new THREE.ConeGeometry(.5, 1, 10);
  for (let i = 0; i < VERT; i++) {
    const t = i / (VERT - 1);
    const s = .1 + t * .1;                                       // đốt to dần từ cổ xuống thắt lưng
    const v = new THREE.Group();
    const bodyM = new THREE.Mesh(bodyG, glass);
    bodyM.scale.set(s, s * .75, s * .85);
    const disc = new THREE.Mesh(discG, glowMat);                 // đĩa đệm phát sáng nhẹ
    disc.rotation.x = Math.PI / 2; disc.scale.setScalar(s * .9); disc.position.y = -s * .5;
    const spinous = new THREE.Mesh(procG, glass);                // gai sau: chĩa ra sau, hơi chúc xuống
    spinous.scale.set(s * .45, s * (1.6 + (t > .3 && t < .7 ? .8 : 0)), s * .35);
    spinous.rotation.x = -Math.PI / 2 - .5; spinous.position.set(0, -s * .2, -s * 1.3);
    v.add(bodyM, disc, spinous);
    for (const side of [-1, 1]) {                                // mỏm ngang hai bên
      const tr = new THREE.Mesh(procG, glass);
      tr.scale.set(s * .3, s * 1.3, s * .3);
      tr.rotation.z = side * Math.PI / 2; tr.rotation.x = -.25;
      tr.position.set(side * s * 1.25, 0, -s * .6);
      v.add(tr);
    }
    v.userData.t = t;
    spine.add(v);
  }
  // xương sườn mảnh ở đoạn ngực
  const ribMat = glass;
  for (let k = 0; k < 9; k++) {
    const t = .22 + k * .045, w = .55 + Math.sin(k / 8 * Math.PI) * .45;
    for (const side of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * .12, 0, -.1), new THREE.Vector3(side * w * .9, -.08, -.05),
        new THREE.Vector3(side * w, -.2, .45), new THREE.Vector3(side * w * .5, -.32, .85)]);
      const rib = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, .022, 6), ribMat);
      rib.userData = { t, rib: true };
      spine.add(rib);
    }
  }
  // xương cùng (khối tam giác thuôn)
  const sac = new THREE.Mesh(new THREE.ConeGeometry(.17, .38, 5), glass);
  sac.rotation.x = Math.PI; sac.userData = { t: 1.06 };
  spine.add(sac);
}
// dây sáng chạy dọc ống sống
const cordGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 60 }, (_, i) => spinePt(i / 59, 0)));
const cord = new THREE.Line(cordGeo, new THREE.LineBasicMaterial({ color: colB, transparent: true, opacity: .55, blending: THREE.AdditiveBlending }));
center.add(cord);
const spineLight = new THREE.PointLight(0x9fd8ff, 18, 8); spineLight.position.set(1.5, 1, 2.5);
const spineLight2 = new THREE.PointLight(0xc6a8ff, 12, 8); spineLight2.position.set(-2, -1.2, 1.5);
center.add(spineLight, spineLight2);
function poseSpine(time) {
  const up = new THREE.Vector3(0, 1, 0);
  spine.children.forEach(v => {
    const t = v.userData.t, p = spinePt(Math.min(t, 1), time);
    if (v.userData.rib) { p.z += .05; }
    v.position.copy(p);
    const a = spinePt(Math.max(0, Math.min(1, t) - .02), time), b = spinePt(Math.min(1, Math.min(t, 1) + .02), time);
    v.quaternion.setFromUnitVectors(up, a.sub(b).normalize());
    if (t > 1) v.position.y -= .25;
  });
  const pos = cordGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const p = spinePt(i / (pos.count - 1), time); pos.setXYZ(i, p.x, p.y, p.z - .12); }
  pos.needsUpdate = true;
}
const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uB: { value: colB } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: 'precision highp float; varying vec2 vUv; uniform vec3 uB; void main(){ float d = length((vUv - .5) * vec2(1.6, 1.)); gl_FragColor = vec4(uB * smoothstep(.5, .0, d) * .22, 1.); }',
}));
halo.scale.set(6, 6.5, 1); halo.position.z = -.4;
center.add(halo);

/* ---------- đàn sứa thủy tinh bơi quanh nhân vật ---------- */
const bellVS = `uniform float uPulse; varying vec3 vN, vV; varying vec2 vUv;
  void main(){
    vUv = uv; vec3 p = position;
    float rim = smoothstep(.2, 1., uv.y);                    // uv.y: 0 đỉnh chuông -> 1 mép
    p.xz *= 1. - uPulse * .28 * rim;                         // co bóp mép chuông
    p.y += uPulse * .12 * rim;
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    vN = normalize(normalMatrix * normal); vV = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }`;
const bellFS = `precision highp float; uniform vec3 uC; uniform float uA, uT; varying vec3 vN, vV; varying vec2 vUv;
  void main(){
    float f = pow(1. - abs(dot(normalize(vN), normalize(vV))), 2.2);
    float stripes = smoothstep(.6, 1., sin(vUv.x * 6.2831 * 8.)) * smoothstep(.1, .8, vUv.y) * .35;   // gân toả từ đỉnh
    float dots = step(.94, fract(sin(dot(floor(vUv * vec2(40., 14.)), vec2(12.9, 78.2))) * 43758.5)) * .6;
    float rim = smoothstep(.85, 1., vUv.y) * .8;
    vec3 c = uC * (f * 1.3 + stripes + rim + .08) + vec3(1.) * dots * f;
    gl_FragColor = vec4(c, 1.) * uA;
  }`;
const tentVS = `attribute vec2 aT; uniform float uT, uPulse, uLen; uniform vec3 uTrail; varying float vS;
  void main(){
    float ang = aT.x, s = aT.y;                              // góc quanh mép chuông, vị trí dọc xúc tu (0..1)
    float r = .62 * (1. - uPulse * .28) * (1. - s * .55);
    vec3 p = vec3(cos(ang) * r, -s * uLen, sin(ang) * r);
    p.x += sin(uT * 1.6 - s * 7. + ang * 3.) * .12 * s;      // sóng lan dọc xúc tu
    p.z += cos(uT * 1.3 - s * 6. + ang * 2.) * .12 * s;
    p += uTrail * s * s;                                     // xúc tu kéo theo phía sau khi bơi
    vS = s;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
  }`;
const tentFS = 'precision highp float; uniform vec3 uC; uniform float uA; varying float vS; void main(){ gl_FragColor = vec4(uC * (1. - vS * .8), 1.) * uA * .8; }';
function bellGeo() {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, a = t * Math.PI * .52;
    pts.push(new THREE.Vector2(Math.sin(a) * .62 * (1 + .1 * Math.sin(t * Math.PI)), Math.cos(a) * .5 - .08 * t * t));
  }
  return new THREE.LatheGeometry(pts, 48);
}
function tentGeo(nT, nS) {
  const pos = [], at = [];
  for (let k = 0; k < nT; k++) {
    const ang = k / nT * Math.PI * 2;
    for (let i = 0; i < nS; i++) for (const s of [i / nS, (i + 1) / nS]) { pos.push(0, 0, 0); at.push(ang, s); }
  }
  // tua miệng ở giữa: ngắn, dày hơn (vài sợi gần tâm)
  for (let k = 0; k < 6; k++) for (let i = 0; i < nS; i++) for (const s of [i / nS * .7, (i + 1) / nS * .7]) { pos.push(0, 0, 0); at.push(k / 6 * Math.PI * 2 + .3, s * .5 + .25); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(at, 2));
  return g;
}
const BELL = bellGeo(), TENT = tentGeo(14, 18);
const jellies = [];
const JN = mobile ? 6 : 10;
for (let j = 0; j < JN; j++) {
  const big = j === 0;
  const u = { uPulse: { value: 0 }, uC: { value: new THREE.Color().setHSL(.55 + Math.random() * .1, .7, .7) }, uA: { value: 0 }, uT: { value: 0 },
              uLen: { value: (big ? 2.6 : 1.4 + Math.random() * 1.4) }, uTrail: { value: new THREE.Vector3() } };
  const common = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: u };
  const g = new THREE.Group();
  g.add(new THREE.Mesh(BELL, new THREE.ShaderMaterial({ ...common, side: THREE.DoubleSide, vertexShader: bellVS, fragmentShader: bellFS })));
  g.add(new THREE.LineSegments(TENT, new THREE.ShaderMaterial({ ...common, vertexShader: tentVS, fragmentShader: tentFS })));
  g.children.forEach(m => { m.frustumCulled = false; });
  // bơi thành vòng sát quanh cột sống (bán kính 0,9–2,1), dàn đều theo chiều cao của cột
  const s = big ? .62 : .2 + Math.random() * .24;
  g.scale.setScalar(s);
  g.userData = {
    u, r: big ? 1.55 : .9 + Math.random() * 1.2, a0: j / JN * Math.PI * 2 + Math.random() * .4,
    sp: (.16 + Math.random() * .14) * (j % 3 === 2 ? -1 : 1),
    y0: SP_LEN * (.42 - (j + .5) / JN * .84), tilt: (Math.random() - .5) * .5, ph: Math.random() * 10, rate: .55 + Math.random() * .4, prev: new THREE.Vector3(),
  };
  center.add(g);
  jellies.push(g);
}

/* ---------- tấm kính dự án ---------- */
const cardVS = `uniform float uT, uHover, uVel; uniform vec2 uHit; varying vec2 vUv; varying float vB;
  void main(){
    vUv = uv; vec3 p = position;
    float bow = (uv.x - .5) * (uv.x - .5);
    p.z += -bow * .45 + bow * uVel * 12.;
    float d = distance(uv, uHit);
    p.z += sin(d * 22. - uT * 5.) * .03 * uHover * smoothstep(.6, .0, d);
    p.y += sin(uT * .7 + position.x * .7) * .04;               // trôi bồng bềnh
    vB = bow;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
  }`;
const cardFS = `precision highp float; uniform sampler2D uTex; uniform float uT, uAct, uHover, uVel, uAlpha; uniform vec3 uC; uniform vec2 uHit;
  varying vec2 vUv; varying float vB;
  float box(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
  void main(){
    vec2 p = vUv - .5; p.x *= 1.6;
    // khung bo góc: nhỏ ở 3 góc, lớn ở góc dưới phải — như khung ảnh trong quyển
    float r = (p.x > 0. && p.y < 0.) ? .14 : .05;
    float sd = box(p, vec2(.8, .5), r);
    float shape = smoothstep(.003, -.003, sd);
    if (shape < .01) discard;
    vec2 dir = normalize(p + 1e-4);
    float edge = smoothstep(-.09, 0., sd);
    vec2 uv = vUv - dir * edge * .012 + vec2(sin(vUv.y * 20. + uT * 1.5), cos(vUv.x * 16. + uT)) * .0012;
    float ca = .0006 + abs(uVel) * .1 + uHover * .0015;
    vec3 c = vec3(texture2D(uTex, uv + dir * ca).r, texture2D(uTex, uv).g, texture2D(uTex, uv - dir * ca).b);
    float g = dot(c, vec3(.299, .587, .114));
    c = mix(mix(vec3(g), uC * g * 1.3, .45) * .45, c, .3 + .7 * uAct);
    float band = smoothstep(.09, .0, abs(vUv.x + vUv.y * .6 - fract(uT * .05) * 2.2 + .3));
    c += band * .06 * (.4 + uAct);
    c += uC * smoothstep(.022, .0, abs(sd + .006)) * (.5 + .6 * uAct) + vec3(.85, .95, 1.) * smoothstep(.006, .0, abs(sd + .002)) * .35;
    c += uC * .22 * uHover * smoothstep(.4, .0, distance(vUv, uHit));
    c *= 1. - vB * .45;
    gl_FragColor = vec4(c, shape * uAlpha * (.82 + .18 * uAct));
  }`;
const cards = ITEMS.map((it, i) => {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTex: { value: new THREE.Texture() }, uT: { value: 0 }, uAct: { value: 0 }, uHover: { value: 0 }, uVel: { value: 0 },
                uAlpha: { value: 0 }, uC: { value: secCol[it.si] }, uHit: { value: new THREE.Vector2(.5, .5) } },
    vertexShader: cardVS, fragmentShader: cardFS,
  });
  const w = it.type === 'section' ? CARD_W * 1.15 : CARD_W;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 1.6, 36, 22), mat);
  const a = i * A_STEP;
  m.position.set(Math.sin(a) * R, -i * Y_STEP, Math.cos(a) * R);
  m.rotation.y = a;
  m.userData.i = i;
  world.add(m);
  return m;
});

/* ảnh tấm kính: ảnh dự án + tên vẽ bằng canvas 2D */
const loadImg = src => new Promise((ok, no) => { const im = new Image(); im.decoding = 'async'; im.onload = () => ok(im); im.onerror = no; im.src = src; });
function wrap(ctx, text, maxW) {
  const lines = []; let cur = '';
  for (const w of text.split(' ')) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  return lines;
}
async function cardTexture(it) {
  const W = 1280, H = 800, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const g0 = ctx.createLinearGradient(0, 0, W, H);
  g0.addColorStop(0, '#0b2f5c'); g0.addColorStop(1, '#020a18');
  ctx.fillStyle = g0; ctx.fillRect(0, 0, W, H);
  // bìa tấm kính: ảnh ngang lớn nhất của dự án (ảnh dọc bị cắt nhiều trên khung ngang)
  const best = it.type === 'project' && it.p.gallery.length
    ? it.p.gallery.reduce((a, b) => (b.w * b.h * (b.w >= b.h ? 1 : .35) > a.w * a.h * (a.w >= a.h ? 1 : .35) ? b : a)) : null;
  const src = it.type === 'section' ? it.s.cover && it.s.cover.full : best && best.full;
  if (src) {
    try {
      // bìa phần là trang đôi (2:1) có tên phần ở mép: vừa khít chiều ngang để không cắt mất chữ
      const im = await loadImg(src), s = it.type === 'section' ? W / im.width : Math.max(W / im.width, H / im.height);
      ctx.drawImage(im, (W - im.width * s) / 2, (H - im.height * s) / 2, im.width * s, im.height * s);
    } catch (e) { /* để nền chuyển màu */ }
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(0,10,30,.7)'; ctx.shadowBlur = 34; ctx.fillStyle = '#fff';
  if (it.type === 'section') {
    const v = ctx.createLinearGradient(0, 0, 0, H); v.addColorStop(0, 'rgba(2,10,24,.1)'); v.addColorStop(1, 'rgba(2,10,24,.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff';
    // ảnh bìa phần trong quyển đã có sẵn tên phần -> chỉ ghi dòng nhỏ ở đầu và chân tấm kính
    ctx.font = '400 30px "Exo 2"'; ctx.letterSpacing = '12px'; ctx.globalAlpha = .9;
    ctx.fillText(`${it.s.n} · ${it.s.kind}`.toUpperCase(), W / 2, H * .12);
    ctx.font = 'italic 300 44px "Noto Serif Display"'; ctx.letterSpacing = '1px';
    ctx.fillText(`${it.s.projects.length} projects  →`, W / 2, H * .88);
    ctx.globalAlpha = 1;
  } else {
    const v = ctx.createLinearGradient(0, 0, 0, H); v.addColorStop(0, 'rgba(2,10,24,.2)'); v.addColorStop(.55, 'rgba(2,10,24,.45)'); v.addColorStop(1, 'rgba(2,10,24,.25)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff';
    ctx.font = '400 28px "Exo 2"'; ctx.letterSpacing = '9px'; ctx.globalAlpha = .85;
    ctx.fillText(`${it.s.kind} · ${String(it.pi + 1).padStart(2, '0')}`.toUpperCase(), W / 2, H * .3);
    ctx.globalAlpha = 1; ctx.letterSpacing = '1px'; ctx.font = 'italic 400 104px "Noto Serif Display"';
    const lines = wrap(ctx, it.p.title, W * .84), lh = 100, y0 = H * .52 - (lines.length - 1) * lh / 2;
    lines.forEach((l, k) => ctx.fillText(l, W / 2, y0 + k * lh));
    ctx.font = '300 26px "Exo 2"'; ctx.letterSpacing = '6px'; ctx.globalAlpha = .75;
    ctx.fillText(it.p.sub.toUpperCase(), W / 2, y0 + (lines.length - 1) * lh + 86);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}

/* ---------------- trạng thái + điều khiển ---------------- */
let mode = 'home', modeT = 0, modeTo = 0, pos = 0, target = 0, vel = 0, lastWheel = 0, opened = null;
const mouse = new THREE.Vector2(), mouseS = new THREE.Vector2();
const clamp = v => Math.max(0, Math.min(N - 1, v));
const cur = () => Math.round(clamp(pos));
const go = i => { target = clamp(i); };

addEventListener('wheel', e => {
  if (mode === 'home') { if (e.deltaY > 20) route('#/work'); return; }
  if (mode !== 'work' || opened) return;
  e.preventDefault();
  target = clamp(target + e.deltaY * .0016);
  lastWheel = performance.now();
}, { passive: false });
addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('#lb').hidden) return closeLb(); if (opened || mode === 'about') return route('#/work'); }
  if (mode === 'home' && ['ArrowDown', 'Enter', ' '].includes(e.key)) return route('#/work');
  if (mode !== 'work' || opened) return;
  if (['ArrowRight', 'ArrowDown', 'PageDown'].includes(e.key)) go(Math.round(target) + 1);
  if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) go(Math.round(target) - 1);
  if (e.key === 'Enter') openItem(cur());
});
let drag = null;
canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, t: target, moved: 0 }; });
addEventListener('pointermove', e => {
  mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
  if (mode === 'home' && dy < -50) { drag = null; return route('#/work'); }
  if (mode !== 'work' || opened) return;
  target = clamp(drag.t - (Math.abs(dx) > Math.abs(dy) ? dx : dy) * (mobile ? .008 : .004));
});
addEventListener('pointerup', e => {
  const d = drag; drag = null;
  if (!d || mode !== 'work' || opened) return;
  if (d.moved > 8) { target = clamp(Math.round(target + (target - d.t) * .15)); return; }
  const hit = pick(e.clientX, e.clientY);
  if (hit != null) hit === cur() ? openItem(hit) : go(hit);
});
const ray = new THREE.Raycaster();
function pick(x, y) {
  ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
  const h = ray.intersectObjects(cards.filter(c => c.visible), false)[0];
  return h ? h.object.userData.i : null;
}

/* ---------------- chữ giao diện ---------------- */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789~*+<>✦';
function scramble(el, text) {
  if (reduce) { el.textContent = text; return; }
  const len = Math.max(el.textContent.length, text.length), start = performance.now();
  cancelAnimationFrame(el._raf);
  const step = () => {
    const k = Math.min(1, (performance.now() - start) / 650);
    let s = '';
    for (let i = 0; i < len; i++) s += i / len < k * 1.15 ? (text[i] || '') : (text[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0]);
    el.textContent = s;
    if (k < 1) el._raf = requestAnimationFrame(step);
  };
  step();
}
$('#yr').textContent = D.year;
$('#home-k').textContent = `${D.name} · Portfolio ${D.year}`;
$('#home-t').textContent = D.title;
$('#home-s').textContent = D.tagline;
const list = $('#index-list');
D.sections.forEach((s, si) => {
  const li = document.createElement('li');
  li.innerHTML = `<button data-si="${si}"><span>${s.n}.</span><span>${s.name}</span><small>${s.kind} · ${s.projects.length}</small></button>`;
  list.append(li);
});
list.addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(secStart[+b.dataset.si]); });
$('#prev').addEventListener('click', () => go(Math.round(target) - 1));
$('#next').addEventListener('click', () => go(Math.round(target) + 1));
$('.home-go').addEventListener('click', () => route('#/work'));
let shown = -1, shownSec = -1;
function updateUI() {
  const i = cur();
  if (i === shown) return;
  shown = i;
  const it = ITEMS[i];
  scramble($('#pager-t'), (it.type === 'section' ? `${it.s.n} · ${it.s.name}` : it.p.title).toUpperCase());
  scramble($('#cap-k'), `${it.s.n} · ${it.s.name}`.toUpperCase());
  scramble($('#cap-t'), (it.type === 'section' ? it.s.kind : it.p.sub).toUpperCase());
  list.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.si === it.si));
  document.documentElement.style.setProperty('--accent', it.s.color);
  if (it.si !== shownSec) {     // câu trích của chương biển này
    shownSec = it.si;
    const q = $('#quote'), st = D.story && D.story[Math.min(D.story.length - 1, it.si + 2)];
    q.classList.remove('on');
    setTimeout(() => { q.textContent = st ? '“' + st.quote + '”' : ''; q.classList.add('on'); }, 500);
  }
}

/* ---------------- chi tiết / giới thiệu ---------------- */
const slugOf = it => it.type === 'section' ? it.s.id : it.p.slug;
function openItem(i) {
  const it = ITEMS[i];
  if (it.type === 'section') return go(i + 1);   // bấm bìa phần: sang dự án đầu tiên của phần
  history.pushState(null, '', '#/work/' + slugOf(it));
  showDetail(it);
}
function showDetail(it) {
  opened = it;
  const p = it.p;
  $('#d-k').textContent = `${it.s.n} · ${it.s.name} · ${it.s.kind}`;
  $('#d-t').textContent = p.title;
  $('#d-s').textContent = p.sub;
  $('#d-p').textContent = p.desc;
  $('#d-meta').innerHTML = (p.time ? `<dt>Duration</dt><dd>${p.time}</dd>` : '') + `<dt>Category</dt><dd>${it.s.kind}</dd>`
    + (p.tools.length ? `<dt>Tools</dt><dd>${p.tools.join(' · ')}</dd>` : '');
  const i = ITEMS.indexOf(it);
  const nx = ITEMS.slice(i + 1).find(x => x.type === 'project') || ITEMS[1];
  $('#d-act').innerHTML = `<a class="btn" href="#/work/${nx.p.slug}">Next: ${nx.p.title}</a>`;
  const g = $('#d-g');
  g.innerHTML = p.gallery.length ? p.gallery.map((im, k) => `<button data-full="${im.full}" style="animation-delay:${Math.min(k, 12) * 60}ms">`
    + `<img src="${im.thumb}" width="${im.w}" height="${im.h}" alt="${p.title} — ${k + 1}" loading="lazy" decoding="async"></button>`).join('')
    : '<p class="detail-empty">Images coming soon.</p>';
  $('#detail').hidden = false;
  $('#detail').scrollTop = 0;
  go(i);
}
$('#d-g').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $('#lb img').src = b.dataset.full; $('#lb').hidden = false;
});
const closeLb = () => { $('#lb').hidden = true; };
$('#lb').addEventListener('click', closeLb);
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => route('#/work')));
function fillAbout() {
  $('#a-img').innerHTML = D.portrait ? `<img src="${D.portrait.full}" alt="${D.name}" width="${D.portrait.w}" height="${D.portrait.h}">` : '';
  $('#a-k').textContent = `Portfolio ${D.year} · ${D.alias}`;
  $('#a-t').textContent = D.name;
  $('#a-r').textContent = D.role;
  const li = r => `<li><b>${r[0]}</b><span>${r[1]}</span>${r[2] ? `<small>${r[2]}</small>` : ''}</li>`;
  $('#a-exp').innerHTML = D.experience.map(li).join('');
  $('#a-edu').innerHTML = D.education.map(li).join('');
  $('#a-tools').textContent = D.tools.join(' · ');
  $('#a-c').innerHTML = `<li><a href="mailto:${D.contact.email}">${D.contact.email}</a></li>`
    + `<li><a href="${D.contact.behance}" target="_blank" rel="noopener">behance.net/${D.contact.behance.split('/').pop()}</a></li>`;
}
fillAbout();

/* #/ · #/work · #/work/<dự án> · #/about */
function route(h) {
  if (h != null && location.hash !== h) history.pushState(null, '', h);
  const hash = location.hash || '#/';
  const m = hash.match(/^#\/work(?:\/([\w-]+))?/);
  $('#detail').hidden = $('#about').hidden = true;
  opened = null;
  if (hash.startsWith('#/about')) { mode = 'about'; modeTo = 1; $('#about').hidden = false; }
  else if (m) {
    mode = 'work'; modeTo = 1;
    const it = m[1] && ITEMS.find(x => x.type === 'project' && x.p.slug === m[1]);
    if (it) { showDetail(it); if (modeT < .5) pos = target; }
  } else { mode = 'home'; modeTo = 0; }
  ['home', 'work', 'about'].forEach(k => body.classList.toggle('mode-' + k, mode === k));
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === mode));
  $('#pager').hidden = $('#index').hidden = $('#cap').hidden = mode !== 'work';
  if (mode === 'home') document.documentElement.style.removeProperty('--accent');
  else { shown = -1; updateUI(); }
}
addEventListener('popstate', () => route());
addEventListener('hashchange', () => route());
document.querySelectorAll('a[href^="#/"]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); route(a.getAttribute('href')); }));

/* ---------------- khung hình ---------------- */
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = innerWidth < innerHeight ? 50 : 36;
  camera.updateProjectionMatrix();
  bgMat.uniforms.uAsp.value = innerWidth / innerHeight;
  dustMat.uniforms.uPx.value = innerHeight * renderer.getPixelRatio() * .014;
}
resize();
addEventListener('resize', resize);

const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clock = new THREE.Clock(), camT = new THREE.Vector3(), tmp = new THREE.Vector3();
function frame() {
  requestAnimationFrame(frame);
  if (document.hidden) return;
  const dt = Math.min(clock.getDelta(), .05), t = reduce ? 0 : clock.elapsedTime;
  modeT += (modeTo - modeT) * (1 - Math.pow(.02, dt));
  const mt = ease(Math.min(1, Math.max(0, modeT)));
  if (!drag && performance.now() - lastWheel > 160) target += (Math.round(target) - target) * (1 - Math.pow(.004, dt));
  const prev = pos;
  pos += (target - pos) * (1 - Math.pow(.006, dt));
  vel += ((pos - prev) - vel) * .3;
  mouseS.lerp(mouse, 1 - Math.pow(.05, dt));

  world.rotation.y = -pos * A_STEP + mouseS.x * .04;
  world.position.y = THREE.MathUtils.lerp(HOME_Y, pos * Y_STEP, mt);
  camera.position.set(mouseS.x * .35, .15 + mouseS.y * .22, THREE.MathUtils.lerp(9.5, R + (mobile ? 6.4 : 6.8), mt));
  camT.set(0, 0, THREE.MathUtils.lerp(0, R - 1.6, mt));
  camera.lookAt(camT);

  const it = ITEMS[cur()];
  wantA.copy(DEEP).lerp(tmp.set(it.s.color).multiplyScalar(.28), mt * .6); wantB.copy(GLOW).lerp(secCol[it.si], mt);
  colA.lerp(wantA, 1 - Math.pow(.2, dt)); colB.lerp(wantB, 1 - Math.pow(.2, dt));
  bgMat.uniforms.uT.value = dustMat.uniforms.uT.value = t;
  bgMat.uniforms.uDepth.value = mt * pos / N;
  bgMat.uniforms.uM.value.copy(mouseS);

  // nhân vật: giữa cảnh ở trang đầu; khi xem dự án lùi ra sau vòng kính, mờ đi
  center.position.set(0, THREE.MathUtils.lerp(mobile ? 1.1 : 1.08, .2, mt) + Math.sin(t * .6) * .08, THREE.MathUtils.lerp(0, -1.2, mt));   // trang đầu: đẩy lên trên chữ tiêu đề
  center.scale.setScalar(THREE.MathUtils.lerp(.78, 1, mt));       // trang đầu: vừa khoảng trống phía trên chữ tiêu đề
  center.rotation.y = mouseS.x * .35 + Math.sin(t * .15) * .4;   // cột sống xoay chậm, nghiêng theo chuột
  center.rotation.x = -mouseS.y * .12;
  poseSpine(t);
  const fade = (opened || mode === 'about') ? .25 : 1 - mt * .35;
  const ga = glass.uniforms.uA;
  ga.value += (fade - ga.value) * .05;
  glass.uniforms.uT.value = t;
  glowMat.opacity = .16 * ga.value;
  cord.material.opacity = .55 * ga.value;

  // sứa: bơi vòng quanh nhân vật, co bóp chuông đẩy mình đi, xúc tu kéo phía sau
  for (const j of jellies) {
    const d = j.userData, ph = t * d.rate + d.ph;
    const pulse = Math.pow(Math.max(0, Math.sin(ph * Math.PI)), 3);       // co nhanh, giãn chậm
    d.ang = (d.ang ?? d.a0) + d.sp * dt * (.5 + pulse * 1.6);
    const y = d.y0 + Math.sin(t * .3 + d.ph) * .25;
    d.prev.copy(j.position);
    j.position.set(Math.cos(d.ang) * d.r, y + Math.sin(d.ang * 2) * d.tilt, Math.sin(d.ang) * d.r);
    tmp.subVectors(j.position, d.prev);
    if (tmp.lengthSq() > 1e-8) {            // đỉnh chuông hướng theo đường bơi (chếch lên)
      const dir = tmp.normalize().add(new THREE.Vector3(0, 1.4, 0)).normalize();
      j.quaternion.slerp(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), .05);
    }
    d.u.uPulse.value = pulse; d.u.uT.value = t;
    d.u.uTrail.value.set(-tmp.x, -.2, -tmp.z).multiplyScalar(.6);
    d.u.uA.value += ((1 - mt * .45) * (opened || mode === 'about' ? .3 : 1) - d.u.uA.value) * .05;
  }

  let hover = null;
  const ci = cur();
  if (mode === 'work' && !opened && !drag && !mobile) {
    ray.setFromCamera(mouse, camera);
    const h = ray.intersectObject(cards[ci], false)[0];
    if (h) { hover = h; cards[ci].material.uniforms.uHit.value.lerp(h.uv, .2); }
  }
  canvas.style.cursor = hover ? 'pointer' : (mode === 'work' ? 'grab' : '');
  cards.forEach((c, i) => {
    const u = c.material.uniforms, d = Math.abs(i - pos);
    u.uT.value = t;
    u.uAct.value += ((d < .5 ? 1 : 0) - u.uAct.value) * (1 - Math.pow(.02, dt));
    u.uHover.value += ((hover && i === ci ? 1 : 0) - u.uHover.value) * .08;
    u.uVel.value = THREE.MathUtils.clamp(vel, -.06, .06);
    u.uAlpha.value = mt * THREE.MathUtils.clamp(1.7 - d * .4, 0, 1) * (opened || mode === 'about' ? .3 : 1);
    c.visible = u.uAlpha.value > .005;
  });
  if (mode === 'work') updateUI();
  renderer.render(scene, camera);
}

/* ---------------- tải ---------------- */
(async () => {
  await Promise.race([Promise.all([document.fonts.load('italic 300 104px "Noto Serif Display"'), document.fonts.load('300 30px "Exo 2"')]),
                      new Promise(r => setTimeout(r, 2500))]);
  let done = 0;
  const n = $('#loader-n');
  // tải trước các tấm đầu tiên rồi mới mở màn; phần còn lại tải dần phía sau
  const first = 8;
  await Promise.all(cards.slice(0, first).map(async (c, i) => {
    c.material.uniforms.uTex.value = await cardTexture(ITEMS[i]);
    n.textContent = String(Math.round(++done / first * 100)).padStart(3, '0');
  }));
  route();
  if (mode === 'work' && !opened) modeT = 0;
  body.classList.remove('is-loading');
  for (let i = first; i < N; i++) cards[i].material.uniforms.uTex.value = await cardTexture(ITEMS[i]);
})();
frame();
