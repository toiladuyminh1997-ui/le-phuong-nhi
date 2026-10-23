/* Lê Phương Nhi — Immerse. Thế giới dưới nước: người hoá sứa (ảnh trang 4) dựng thành cảnh 2.5D ở giữa;
   5 chương ("sinh vật biển") là 5 tấm kính xếp xoắn ốc quanh nhân vật. Cuộn / kéo / ← → để lặn sâu;
   bấm tấm kính giữa -> trang chương (lưới sản phẩm) -> từng sản phẩm. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';

const D = window.PORT;
const $ = (s, r = document) => r.querySelector(s);
const mobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const body = document.body;

/* ---------- vòng quay: chỉ 5 tấm kính = ảnh bìa 5 chương; bấm chương -> trang chương (lưới sản phẩm) -> từng sản phẩm ---------- */
const ITEMS = D.sections.map((s, si) => ({ type: 'section', s, si }));
const N = ITEMS.length;

/* ---------- bố cục ---------- */
const R = mobile ? 3.0 : 4.6, A_STEP = 1.15, Y_STEP = 2.3;
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

/* ---------- nhân vật chính: trang 6 của quyển — người bước trên mặt nước, đàn sứa bơi quanh — dựng thành cảnh 2.5D ----------
   Lưới phẳng chia nhỏ, đẩy nổi theo bản đồ độ sâu (tools/hero.py) -> rê chuột thấy rõ lớp gần / xa.
   Đàn sứa dập dềnh như đang co bóp bơi lên và trôi chậm theo dòng; mặt nước gợn lăn tăn, lấp lánh;
   người đứng yên; gợn lan theo con trỏ; ảnh hiện ra như mực tan; mép ảnh tan vào nền biển. */
const center = new THREE.Group();
scene.add(center);
const HERO_H = mobile ? 4.6 : 5.0;
const heroU = {
  uTex: { value: null }, uMap: { value: null }, uT: { value: 0 }, uA: { value: 0 }, uReveal: { value: 0 },
  uDepth: { value: .7 }, uMouse: { value: new THREE.Vector2(.5, .5) }, uRip: { value: 0 }, uVel: { value: 0 },
  uB: { value: colB }, uBg: { value: colA },
};
const heroMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, uniforms: heroU,
  vertexShader: `uniform sampler2D uMap; uniform float uT, uDepth, uRip; uniform vec2 uMouse;
    varying vec2 vUv; varying vec4 vM; varying float vRip;
    void main(){
      vUv = uv;
      vec4 m = texture2D(uMap, uv); vM = m;
      vec3 p = position;
      p.z += (m.r - .35) * uDepth;                                       // chiều sâu thật từ ảnh
      float jelly = m.b * (1. - m.a);
      p.z += sin(uT * .8 + uv.x * 9. + uv.y * 5.) * .06 * jelly;         // lớp sứa phồng xẹp nhẹ
      p.z += sin(uv.x * 40. - uT * 1.6) * sin(uv.y * 24. + uT) * .025 * m.a;   // sóng trên mặt nước
      float d = distance(uv, uMouse);
      vRip = sin(d * 38. - uT * 5.) * exp(-d * 7.) * uRip;
      p.z += vRip * .06;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
    }`,
  fragmentShader: `precision highp float; uniform sampler2D uTex; uniform float uT, uA, uReveal, uVel; uniform vec3 uB, uBg; uniform vec2 uMouse;
    varying vec2 vUv; varying vec4 vM; varying float vRip;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
      return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
    float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++){ v += a * n(p); p *= 2.03; a *= .5; } return v; }
    void main(){
      float soft = vM.b, water = vM.a, jelly = soft * (1. - water);
      vec2 uv = vUv;
      // sứa: mỗi vùng một nhịp — co bóp (nhích lên nhanh, hạ xuống chậm) và trôi ngang chậm theo dòng
      float ph = n(vUv * vec2(4., 3.)) * 6.2831;
      float pulse = pow(max(0., sin(uT * 1.1 + ph)), 3.);
      uv.y -= (pulse * .006 - .002) * jelly;
      uv.x += sin(uT * .25 + ph) * .006 * jelly;
      // nhìn qua nước: lay rất nhẹ cả cảnh
      vec2 w = vec2(fbm(vUv * 5. + vec2(uT * .12, -uT * .09)), fbm(vUv * 5. + 7. - vec2(uT * .1, uT * .13))) - .5;
      uv += w * (.002 + .006 * jelly);
      // mặt nước: gợn lăn tăn chạy ngang, càng gần càng lớn
      float near = smoothstep(.0, .3, 1. - vUv.y);
      uv += vec2(sin(vUv.y * 260. + uT * 2.4 + sin(vUv.x * 30. + uT) * 2.) * .0016, sin(vUv.x * 90. - uT * 1.8) * .0012) * water * (.5 + near);
      uv += vRip * .006;
      float ca = (.0012 + abs(uVel) * .025 + abs(vRip) * .004) * smoothstep(.0, .6, soft);   // quanh người không tách màu
      vec2 dir = normalize(vUv - uMouse + 1e-4);
      vec3 c = vec3(texture2D(uTex, uv + dir * ca).r, texture2D(uTex, uv).g, texture2D(uTex, uv - dir * ca).b);
      // sứa phát sáng nhẹ theo nhịp co bóp
      float lum = dot(c, vec3(.299, .587, .114));
      c += uB * smoothstep(.35, .8, lum) * pulse * .18 * jelly;
      // mặt nước lấp lánh
      vec2 cell = floor(vUv * vec2(300., 120.)), cf = fract(vUv * vec2(300., 120.)) - .5;
      float glint = step(.985, h(cell)) * smoothstep(.45, .0, length(cf)) * pow(.5 + .5 * sin(uT * 3. + h(cell + 7.) * 40.), 6.);
      c += vec3(.8, .92, 1.) * glint * water * .9;
      // mép ảnh tan vào nền biển của trang
      float edge = smoothstep(0., .1, vUv.x) * smoothstep(1., .9, vUv.x) * smoothstep(0., .1, vUv.y) * smoothstep(1., .86, vUv.y);
      // hiện ra: tan như mực trong nước, từ người lan ra
      float r = fbm(vUv * 6.) * .5 + distance(vUv * vec2(2., 1.), vec2(.33, .28)) * .55;
      float rv = smoothstep(r - .08, r, uReveal * 1.6);
      c += uB * smoothstep(.0, .08, rv) * (1. - rv) * 2.;
      gl_FragColor = vec4(c, edge * rv * uA);
      #include <colorspace_fragment>
    }`,
});
const hero = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, mobile ? 160 : 280, mobile ? 80 : 140), heroMat);
hero.visible = false;
hero.frustumCulled = false;
center.add(hero);
// quầng sáng phía sau nhân vật
const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uB: { value: colB } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: 'precision highp float; varying vec2 vUv; uniform vec3 uB; void main(){ float d = length((vUv - .5) * vec2(1.6, 1.)); gl_FragColor = vec4(uB * smoothstep(.5, .0, d) * .22, 1.); }',
}));
halo.scale.set(6, 6.5, 1); halo.position.z = -.4; halo.visible = false;   // cảnh trang 6 đã có ánh sáng riêng
center.add(halo);

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
    #include <colorspace_fragment>
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
  if (e.key === 'Escape') { if (!$('#lb').hidden) return closeLb(); if (opened || mode === 'about') return back(); }
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
list.addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(+b.dataset.si); });
$('#prev').addEventListener('click', () => go(Math.round(target) - 1));
$('#next').addEventListener('click', () => go(Math.round(target) + 1));
$('.home-go').addEventListener('click', () => route('#/work'));
let shown = -1, shownSec = -1;
function updateUI() {
  const i = cur();
  if (i === shown) return;
  shown = i;
  const it = ITEMS[i];
  scramble($('#pager-t'), `${it.s.n} · ${it.s.name}`.toUpperCase());
  scramble($('#cap-k'), `${it.s.n} · ${it.s.kind}`.toUpperCase());
  scramble($('#cap-t'), `${it.s.name} — ${it.s.projects.length} projects`.toUpperCase());
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
// ảnh đại diện của sản phẩm: ảnh ngang lớn nhất
const bestImg = p => p.gallery.length ? p.gallery.reduce((a, b) => (b.w * b.h * (b.w >= b.h ? 1 : .35) > a.w * a.h * (a.w >= a.h ? 1 : .35) ? b : a)) : null;
function openItem(i) { route(`#/work/${ITEMS[i].s.id}`); }
// quay lại một cấp: sản phẩm -> chương -> vòng quay
function back() {
  if (opened && opened.p) return route(`#/work/${opened.s.id}`);
  route('#/work');
}
/* trang chương: ảnh bìa chương + câu thơ + lưới các sản phẩm */
function showSection(si) {
  const s = D.sections[si], st = D.story && D.story[Math.min(D.story.length - 1, si + 2)];
  opened = { s, si };
  $('#s-cover').innerHTML = s.cover ? `<img src="${s.cover.full}" alt="${s.name}" width="${s.cover.w}" height="${s.cover.h}">` : '';
  $('#s-k').textContent = `${s.n} · ${s.kind}`;
  $('#s-t').textContent = s.name;
  $('#s-q').textContent = st ? '“' + st.quote + '”' : '';
  $('#s-g').innerHTML = s.projects.map((p, k) => {
    const im = bestImg(p);
    return `<a class="tile" href="#/work/${s.id}/${p.slug}" style="animation-delay:${Math.min(k, 12) * 70}ms">`
      + `<span class="tile-img">${im ? `<img src="${im.thumb}" width="${im.w}" height="${im.h}" alt="" loading="lazy" decoding="async">` : ''}</span>`
      + `<span class="tile-n">${String(k + 1).padStart(2, '0')}</span><b>${p.title}</b><small>${p.sub}</small></a>`;
  }).join('');
  $('#section').hidden = false;
  $('#section').scrollTop = 0;
  go(si);
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
  const ps = it.s.projects, nx = ps[(it.pi + 1) % ps.length];
  $('#d-act').innerHTML = `<a class="btn" href="#/work/${it.s.id}">← ${it.s.name}</a>`
    + (ps.length > 1 ? `<a class="btn" href="#/work/${it.s.id}/${nx.slug}">Next: ${nx.title}</a>` : '');
  const g = $('#d-g');
  g.innerHTML = p.gallery.length ? p.gallery.map((im, k) => `<button data-full="${im.full}" style="animation-delay:${Math.min(k, 12) * 60}ms">`
    + `<img src="${im.thumb}" width="${im.w}" height="${im.h}" alt="${p.title} — ${k + 1}" loading="lazy" decoding="async"></button>`).join('')
    : '<p class="detail-empty">Images coming soon.</p>';
  $('#detail').hidden = false;
  $('#detail').scrollTop = 0;
  go(it.si);
}
$('#d-g').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $('#lb img').src = b.dataset.full; $('#lb').hidden = false;
});
const closeLb = () => { $('#lb').hidden = true; };
$('#lb').addEventListener('click', closeLb);
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', back));
// đường dẫn trong nội dung tạo động (lưới sản phẩm, nút Next): đổi trang không tải lại
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#/"]');
  if (a && !a.matches('[data-nav], .brand')) { e.preventDefault(); route(a.getAttribute('href')); }
});
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

/* #/ · #/work · #/work/<chương> · #/work/<chương>/<sản phẩm> · #/about */
function findProject(slug) {
  for (const [si, s] of D.sections.entries()) {
    const pi = s.projects.findIndex(p => p.slug === slug);
    if (pi >= 0) return { s, si, p: s.projects[pi], pi };
  }
  return null;
}
function route(h) {
  if (h != null && location.hash !== h) history.pushState(null, '', h);
  const hash = location.hash || '#/';
  const m = hash.match(/^#\/work(?:\/([\w-]+))?(?:\/([\w-]+))?/);
  $('#detail').hidden = $('#about').hidden = $('#section').hidden = true;
  opened = null;
  if (hash.startsWith('#/about')) { mode = 'about'; modeTo = 1; $('#about').hidden = false; }
  else if (m) {
    mode = 'work'; modeTo = 1;
    const si = D.sections.findIndex(s => s.id === m[1]);
    const it = m[2] ? findProject(m[2]) : (si < 0 && m[1] ? findProject(m[1]) : null);   // link cũ #/work/<sản phẩm> vẫn mở được
    if (it) showDetail(it);
    else if (si >= 0) showSection(si);
    if (opened && modeT < .5) pos = target;
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
const clock = new THREE.Clock(), camT = new THREE.Vector3(), tmpC = new THREE.Color();
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
  wantA.copy(DEEP).lerp(tmpC.copy(secCol[it.si]).multiplyScalar(.28), mt * .6); wantB.copy(GLOW).lerp(secCol[it.si], mt);
  colA.lerp(wantA, 1 - Math.pow(.2, dt)); colB.lerp(wantB, 1 - Math.pow(.2, dt));
  bgMat.uniforms.uT.value = dustMat.uniforms.uT.value = t;
  bgMat.uniforms.uDepth.value = mt * pos / N;
  bgMat.uniforms.uM.value.copy(mouseS);

  // nhân vật: giữa cảnh ở trang đầu; khi xem dự án lùi ra sau vòng kính, mờ đi
  center.position.set(mobile ? 1.5 * (1 - mt) : 0, THREE.MathUtils.lerp(mobile ? .9 : .6, .3, mt) + Math.sin(t * .6) * .04, THREE.MathUtils.lerp(0, -1.6, mt));   // điện thoại: dời cảnh để người bước trên nước nằm trong khung
  center.scale.setScalar(THREE.MathUtils.lerp(1, 1.15, mt));
  center.rotation.y = mouseS.x * .1 + Math.sin(t * .2) * .03;      // xoay nhẹ theo chuột -> thấy rõ chiều sâu
  center.rotation.x = -mouseS.y * .12;
  heroU.uT.value = t;
  heroU.uA.value += (((opened || mode === 'about') ? .22 : 1 - mt * .5) - heroU.uA.value) * .05;
  heroU.uReveal.value = Math.min(1, heroU.uReveal.value + dt * .35);
  heroU.uVel.value += (THREE.MathUtils.clamp(mouse.distanceTo(mouseS), 0, 1) - heroU.uVel.value) * .1;
  // gợn nước theo chuột (chỉ ở trang đầu)
  let rip = 0;
  if (hero.visible && mode === 'home' && !mobile) {
    ray.setFromCamera(mouse, camera);
    const h = ray.intersectObject(hero, false)[0];
    if (h) { heroU.uMouse.value.lerp(h.uv, .12); rip = .6 + Math.min(1, mouse.distanceTo(mouseS) * 6) * .8; }
  }
  heroU.uRip.value += (rip - heroU.uRip.value) * .05;

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
  try {   // nhân vật chính: ảnh màu + bản đồ độ sâu / vùng nhân vật / vùng mềm (tools/hero.py)
    const [im, mp] = await Promise.all([loadImg('img/hero.webp'), loadImg('img/hero-map.webp')]);
    const tx = new THREE.Texture(im); tx.colorSpace = THREE.SRGBColorSpace; tx.needsUpdate = true;
    const tm = new THREE.Texture(mp); tm.needsUpdate = true;
    heroU.uTex.value = tx; heroU.uMap.value = tm;
    hero.scale.set(HERO_H * im.width / im.height, HERO_H, 1);
    hero.visible = true;
  } catch (e) { console.warn('hero', e); }
  let done = 0;
  const n = $('#loader-n');
  // tải trước các tấm đầu tiên rồi mới mở màn; phần còn lại tải dần phía sau
  const first = Math.min(8, N);
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
