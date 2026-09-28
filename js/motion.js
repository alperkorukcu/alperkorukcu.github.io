/*!
 * AK Motion 1.0
 * Motion system for the portfolio of Yunus Alper Körükcü.
 * Runtime: GSAP 3 (ScrollTrigger, MotionPathPlugin) plus raw WebGL and Canvas 2D.
 * Each module is named after the motion rule it adapts from the hyperframes
 * motion library (rules/*.md), translated from a video timeline to scroll and pointer.
 */
(function (global) {
  'use strict';

  var GOLDEN = Math.PI * (3 - Math.sqrt(5));
  var GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=/<>';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function smooth(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  function damp(dt, k) { return 1 - Math.pow(k, dt); }
  function scramble(str, seed) {
    var out = '';
    for (var i = 0; i < str.length; i++) {
      var c = str.charAt(i);
      out += (c === ' ' || c === '·' || c === '/' || c === '.') ? c : GLYPHS.charAt(Math.floor(hash(seed + i * 13.7) * GLYPHS.length));
    }
    return out;
  }

  function mount(doc, opts) {
    opts = opts || {};
    var win = doc.defaultView || global;
    var root = doc.querySelector('.ak');
    if (!root || root.__akMounted) return { destroy: function () {} };
    root.__akMounted = true;

    var html = doc.documentElement;
    var gsap = win.gsap, ST = win.ScrollTrigger, MPP = win.MotionPathPlugin;
    var mm = function (q) { return !!(win.matchMedia && win.matchMedia(q).matches); };
    var reduce = mm('(prefers-reduced-motion: reduce)');
    var coarse = mm('(hover: none), (pointer: coarse)');
    var framed = false;
    try { framed = win.self !== win.top; } catch (e) { framed = true; }

    var cleanups = [];
    var loops = [];
    var dead = false;
    function on(el, type, fn, o) {
      if (!el) return;
      el.addEventListener(type, fn, o || false);
      cleanups.push(function () { el.removeEventListener(type, fn, o || false); });
    }
    function $(sel, ctx) { return (ctx || root).querySelector(sel); }
    function $$(sel, ctx) { return Array.prototype.slice.call((ctx || root).querySelectorAll(sel)); }

    var W = {
      doc: doc, win: win, root: root, html: html, gsap: gsap, ST: ST,
      reduce: reduce, coarse: coarse, framed: framed, opts: opts,
      on: on, $: $, $$: $$,
      cleanup: function (fn) { cleanups.push(fn); },
      loop: function (fn) { loops.push(fn); },
      pointer: { x: -9999, y: -9999, active: false },
      vel: 0,
      isMobile: function () { return win.innerWidth < 900; }
    };

    staticBits(W);

    function teardown() {
      dead = true;
      loops.length = 0;
      cleanups.forEach(function (f) { try { f(); } catch (e) {} });
      cleanups.length = 0;
      html.classList.remove('ak-fx', 'ak-static', 'ak-cur', 'ak-cur-hide');
      html.style.overflow = '';
      root.__akMounted = false;
    }

    if (!gsap || !ST || reduce) {
      html.classList.remove('ak-fx');
      html.classList.add('ak-static');
      return { destroy: teardown };
    }

    gsap.registerPlugin(ST);
    if (MPP) gsap.registerPlugin(MPP);
    html.classList.add('ak-fx');

    var ctx = gsap.context(function () {}, root);
    W.ctx = ctx;

    var lastY = win.scrollY || 0;
    function tick(time, deltaTime) {
      if (dead) return;
      var dt = Math.min((deltaTime || 16) / 1000, 0.05);
      var y = win.scrollY || 0;
      var v = dt > 0 ? (y - lastY) / dt : 0;
      lastY = y;
      W.vel = lerp(W.vel, v, 0.2);
      if (Math.abs(W.vel) < 0.5) W.vel = 0;
      for (var i = 0; i < loops.length; i++) {
        try { loops[i](dt, time); } catch (err) { if (win.console) console.warn('[ak] loop removed', err); loops.splice(i--, 1); }
      }
    }
    gsap.ticker.add(tick);
    cleanups.push(function () { gsap.ticker.remove(tick); });

    var modules = [grain, cursor, fxLayer, magnets, hud, heroGL, hero, heads, about, portrait, dds, results, proofs, marquee, flight, stack, certs, writing, beyond, contact];
    ctx.add(function () {
      modules.forEach(function (m) {
        try { m(W); } catch (err) { if (win.console) console.warn('[ak] module failed:', m.name, err); }
      });
    });
    ctx.add(function () {
      try {
        boot(W, function () { if (W.heroIntro) W.heroIntro(); });
      } catch (err) {
        var b = $('.boot'); if (b) b.style.display = 'none';
        html.style.overflow = '';
        if (W.heroIntro) W.heroIntro();
      }
    });

    var fontsReady = (doc.fonts && doc.fonts.ready) ? doc.fonts.ready : Promise.resolve();
    Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 2500); })]).then(function () {
      if (!dead) { ST.refresh(); if (W.measure) W.measure(); }
    });
    on(win, 'load', function () { if (!dead) ST.refresh(); });

    return {
      destroy: function () {
        try { ctx.revert(); } catch (e) {}
        teardown();
      }
    };
  }

  /* ---------- Works without GSAP: Berlin clock, copy email ---------- */
  function staticBits(W) {
    var clock = W.$('.clock .rd');
    var fmt = null;
    try { fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); } catch (e) {}
    function tickClock() { if (clock && fmt) clock.setAttribute('data-v', fmt.format(new Date())); }
    tickClock();
    var iv = setInterval(tickClock, 1000);
    W.cleanup(function () { clearInterval(iv); });

    W.$$('[data-copy]').forEach(function (b) {
      W.on(b, 'click', function (e) {
        var v = b.getAttribute('data-copy');
        var lab = b.querySelector('.rd');
        var x = e.clientX, y = e.clientY;
        function done(ok) {
          if (lab) {
            lab.setAttribute('data-v', ok ? 'Copied' : v);
            setTimeout(function () { lab.setAttribute('data-v', 'Copy email'); }, 2200);
          }
          if (ok && W.burst) W.burst(x, y, 42);
        }
        function legacy() {
          try {
            var ta = W.doc.createElement('textarea');
            ta.value = v; ta.setAttribute('readonly', '');
            ta.style.position = 'fixed'; ta.style.opacity = '0';
            W.doc.body.appendChild(ta); ta.select();
            var ok = W.doc.execCommand('copy');
            W.doc.body.removeChild(ta);
            return ok;
          } catch (err) { return false; }
        }
        var nav = W.win.navigator;
        if (nav.clipboard && nav.clipboard.writeText) {
          nav.clipboard.writeText(v).then(function () { done(true); }, function () { done(legacy()); });
        } else { done(legacy()); }
      });
    });
  }

  /* ---------- Film grain: procedural noise tile, stepped jitter ---------- */
  function grain(W) {
    var el = W.$('.grain'); if (!el) return;
    var c = W.doc.createElement('canvas'); c.width = c.height = 150;
    var g = c.getContext('2d'); if (!g) return;
    var img = g.createImageData(150, 150);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = Math.floor(hash(i * 0.0173 + 3.7) * 255);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    el.style.backgroundImage = 'url(' + c.toDataURL('image/png') + ')';
    el.style.backgroundSize = '150px 150px';
    var acc = 0, step = 0;
    W.loop(function (dt) {
      acc += dt; if (acc < 0.07) return; acc = 0; step++;
      el.style.transform = 'translate(' + ((hash(step * 3.1) - 0.5) * 12).toFixed(1) + '%,' + ((hash(step * 7.7) - 0.5) * 12).toFixed(1) + '%)';
    });
  }

  /* ---------- context-sensitive-cursor + cursor-click-ripple ---------- */
  function cursor(W) {
    if (W.coarse) return;
    var cur = W.$('.cur'), ring = W.$('.cur-ring'), dot = W.$('.cur-dot'), lab = W.$('.cur-lab');
    if (!cur || !ring || !dot) return;
    W.html.classList.add('ak-cur');
    if (!W.framed) W.html.classList.add('ak-cur-hide');
    var p = W.pointer, rx = -200, ry = -200, seen = false;
    cur.style.opacity = '0';
    W.on(W.doc, 'pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      p.x = e.clientX; p.y = e.clientY; p.active = true;
      if (!seen) { seen = true; rx = p.x; ry = p.y; cur.style.opacity = '1'; }
    }, { passive: true });
    W.on(W.doc, 'mouseout', function (e) { if (!e.relatedTarget) { p.active = false; cur.style.opacity = '0'; seen = false; } });
    W.on(W.doc, 'pointerover', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-cursor],a,button') : null;
      ring.classList.remove('is-hover', 'is-lens', 'is-dark');
      if (!t || !W.root.contains(t)) return;
      if (t.classList.contains('portrait')) { ring.classList.add('is-lens'); return; }
      var l = t.getAttribute('data-cursor') || 'Open';
      if (lab) lab.setAttribute('data-v', l);
      ring.classList.add('is-hover');
      if (t.matches && t.matches('.post,.mail,.btn--solid,.hud-cta')) ring.classList.add('is-dark');
    });
    W.on(W.doc, 'pointerdown', function (e) {
      if (e.pointerType === 'touch') return;
      if (W.ripple) W.ripple(e.clientX, e.clientY);
      W.gsap.fromTo(dot, { scale: 3 }, { scale: 1, duration: 0.5, ease: 'power3.out' });
    });
    W.loop(function (dt) {
      if (!seen) return;
      var k = damp(dt, 0.0005);
      rx = lerp(rx, p.x, k); ry = lerp(ry, p.y, k);
      dot.style.transform = 'translate3d(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px,0)';
      ring.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0)';
    });
  }

  /* ---------- FX canvas: particle-burst (ballistic) + click ripples ---------- */
  function fxLayer(W) {
    var cv = W.$('.fxc'); if (!cv) return;
    var g = cv.getContext('2d'); if (!g) return;
    var dpr = Math.min(W.win.devicePixelRatio || 1, 2), items = [], dirty = false;
    function size() { cv.width = Math.round(W.win.innerWidth * dpr); cv.height = Math.round(W.win.innerHeight * dpr); }
    size(); W.on(W.win, 'resize', size);
    var cols = ['#d4ff3f', '#eceae4', '#39d8ff', '#d4ff3f'];
    W.ripple = function (x, y) { items.push({ k: 0, x: x, y: y, t: 0, life: 0.75 }); };
    W.burst = function (x, y, n) {
      n = n || 36;
      var seed = x * 0.13 + y * 0.29;
      for (var i = 0; i < n; i++) {
        var a = -Math.PI / 2 + (hash(seed + i * 5.1) * 2 - 1) * 1.3;
        var s = 360 + hash(seed + i * 7.3) * 640;
        items.push({ k: 1, x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: 1.1 + hash(seed + i * 3.3) * 0.7, sz: 4 + hash(seed + i * 9.1) * 8, spin: (hash(seed + i * 11.7) * 2 - 1) * 10, c: cols[i % cols.length] });
      }
    };
    W.loop(function (dt) {
      if (!items.length) { if (dirty) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); dirty = false; } return; }
      dirty = true;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (var i = items.length - 1; i >= 0; i--) {
        var it = items[i]; it.t += dt;
        var k = it.t / it.life;
        if (k >= 1) { items.splice(i, 1); continue; }
        if (it.k === 0) {
          g.globalAlpha = (1 - k) * 0.9; g.strokeStyle = '#d4ff3f'; g.lineWidth = 1.5;
          g.beginPath(); g.arc(it.x, it.y, 6 + (1 - Math.pow(1 - k, 3)) * 64, 0, 6.2832); g.stroke();
        } else {
          var t = it.t;
          var x = it.x + it.vx * t, y = it.y + it.vy * t + 0.5 * 1500 * t * t;
          g.save(); g.translate(x, y); g.rotate(it.spin * t);
          g.globalAlpha = Math.min(1, (1 - k) * 3); g.fillStyle = it.c;
          g.fillRect(-it.sz / 2, -it.sz * 0.35, it.sz, it.sz * 0.7); g.restore();
        }
      }
      g.globalAlpha = 1;
    });
  }

  /* ---------- press-release-spring + magnetic pull ---------- */
  function magnets(W) {
    if (W.coarse) return;
    var gsap = W.gsap;
    W.$$('.mag').forEach(function (el) {
      var qx = gsap.quickTo(el, 'x', { duration: 0.55, ease: 'power3.out' });
      var qy = gsap.quickTo(el, 'y', { duration: 0.55, ease: 'power3.out' });
      W.on(el, 'pointermove', function (e) {
        var r = el.getBoundingClientRect();
        qx((e.clientX - (r.left + r.width / 2)) * 0.28);
        qy((e.clientY - (r.top + r.height / 2)) * 0.36);
      });
      W.on(el, 'pointerleave', function () { qx(0); qy(0); });
      W.on(el, 'pointerdown', function (e) {
        gsap.to(el, { scale: 0.92, duration: 0.12, ease: 'power2.out', overwrite: 'auto' });
        if (el.classList.contains('mail') && W.burst) W.burst(e.clientX, e.clientY, 30);
      });
      W.on(el, 'pointerup', function () { gsap.to(el, { scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' }); });
      W.on(el, 'pointercancel', function () { gsap.to(el, { scale: 1, duration: 0.3, overwrite: 'auto' }); });
    });
  }

  /* ---------- HUD: progress, consumer offset, active nav, smooth anchors ---------- */
  function hud(W) {
    var prog = W.$('.prog'), off = W.$('.meter .rd');
    W.ST.create({
      start: 0, end: 'max',
      onUpdate: function (s) {
        if (prog) prog.style.transform = 'scaleX(' + s.progress.toFixed(4) + ')';
        if (off) off.setAttribute('data-v', pad(Math.round(W.win.scrollY || 0), 8));
      }
    });
    W.$$('.hud-nav a[data-nav]').forEach(function (a) {
      var sec = W.doc.getElementById(a.getAttribute('data-nav'));
      if (!sec) return;
      W.ST.create({ trigger: sec, start: 'top 55%', end: 'bottom 55%', onToggle: function (s) { a.classList.toggle('is-on', s.isActive); } });
    });
    W.on(W.root, 'click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a) return;
      var id = a.getAttribute('href').slice(1);
      var t = id ? W.doc.getElementById(id) : null;
      if (!t) return;
      e.preventDefault();
      var y = id === 'top' ? 0 : t.getBoundingClientRect().top + (W.win.scrollY || 0);
      try { W.win.scrollTo({ top: y, behavior: 'smooth' }); } catch (err) { W.win.scrollTo(0, y); }
    });
  }

  /* ---------- 00 BOOT: discrete-text-sequence + chromatic-glitch + slice exit ---------- */
  function boot(W, done) {
    var el = W.$('.boot');
    var called = false;
    function fin() { if (called) return; called = true; W.html.style.overflow = ''; if (done) done(); }
    if (!el || W.win.getComputedStyle(el).display === 'none') { fin(); return; }
    var gsap = W.gsap;
    var lines = W.$$('.boot-l', el), num = W.$('.boot-num', el), bar = W.$('.boot-bar i', el);
    var slices = W.$$('.boot-sl i', el), inner = W.$('.boot-in', el);
    var chrome = [W.$('.hud'), W.$('.meter'), W.$('.clock')].filter(Boolean);
    W.html.style.overflow = 'hidden';
    gsap.set(chrome, { autoAlpha: 0 });
    gsap.set(lines, { clipPath: 'inset(0% 100% 0% 0%)' });
    var st = { v: 0 }, per = 0.22;
    var tl = gsap.timeline({ delay: 0.15 });
    lines.forEach(function (l, i) {
      var steps = Math.max(6, Math.round(l.textContent.length / 2.4));
      tl.to(l, { clipPath: 'inset(0% 0% 0% 0%)', duration: per * 1.15, ease: 'steps(' + steps + ')' }, i * per);
    });
    tl.to(st, {
      v: 100, duration: lines.length * per + 0.2, ease: 'power1.inOut',
      onUpdate: function () {
        if (num) num.setAttribute('data-v', pad(Math.round(st.v), 3));
        if (bar) bar.style.transform = 'scaleX(' + (st.v / 100).toFixed(3) + ')';
      }
    }, 0);
    var gl = { a: 0 };
    tl.set(gl, { a: 1 }, '>');
    tl.to(gl, {
      a: 0, duration: 0.34, ease: 'power3.in',
      onUpdate: function () {
        var q = Math.floor(gsap.ticker.time * 40);
        var jx = (hash(q * 13) * 2 - 1) * 16 * gl.a, jy = (hash(q * 7) * 2 - 1) * 5 * gl.a;
        inner.style.textShadow = jx.toFixed(1) + 'px ' + jy.toFixed(1) + 'px 0 rgba(255,77,109,.85),' + (-jx).toFixed(1) + 'px ' + (-jy).toFixed(1) + 'px 0 rgba(57,216,255,.85)';
      },
      onComplete: function () { inner.style.textShadow = 'none'; }
    });
    tl.to(inner, { autoAlpha: 0, duration: 0.14 }, '>-0.04');
    tl.add(fin, '<');
    tl.to(slices, { xPercent: function (i) { return i % 2 ? 101 : -101; }, duration: 0.95, ease: 'expo.inOut', stagger: { each: 0.045, from: 'center' } }, '<');
    tl.to(chrome, { autoAlpha: 1, duration: 0.6, stagger: 0.08 }, '<+0.55');
    tl.set(el, { display: 'none' });
    var skip = function () { if (tl.progress() < 0.9) tl.timeScale(4); };
    W.on(el, 'pointerdown', skip);
    W.on(W.win, 'wheel', skip, { passive: true });
    W.on(W.win, 'touchstart', skip, { passive: true });
  }

  /* ---------- 01 SOURCE: WebGL event stream (raw -> transform -> clean lanes) ---------- */
  function heroGL(W) {
    var sec = W.$('.hero'), cv = W.$('.hero-gl');
    if (!sec || !cv) return;
    var gl = null;
    try {
      gl = cv.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    } catch (e) { gl = null; }
    if (!gl) return;

    function shader(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    function program(vs, fs) {
      var p = gl.createProgram();
      gl.attachShader(p, shader(gl.VERTEX_SHADER, vs)); gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      return p;
    }

    var VS = [
      'precision highp float;',
      'attribute vec4 a;',
      'uniform vec2 uRes;', 'uniform vec2 uMouse;',
      'uniform float uT;', 'uniform float uDpr;', 'uniform float uIntro;', 'uniform float uOn;',
      'varying float vA;', 'varying float vO;', 'varying float vH;',
      'float h1(float p){p=fract(p*.1031);p*=p+33.33;p*=p+p;return fract(p);}',
      'float h2(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}',
      'float vn(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1.,0.)),f.x),mix(h2(i+vec2(0.,1.)),h2(i+vec2(1.,1.)),f.x),f.y);}',
      'void main(){',
      '  float lanes=24.;',
      '  float lane=floor(a.x*lanes);',
      '  float laneY=.2+(lane+.5)/lanes*.62;',
      '  float spd=mix(.02,.07,a.z);',
      '  float x=fract(a.y+uT*spd);',
      '  float t=uT*.08;',
      '  float n1=vn(vec2(x*2.3+a.w*9.1,t+a.w*4.7));',
      '  float n2=vn(vec2(x*5.2-t*1.6,a.w*13.3+t*.4));',
      '  float cy=a.w+(n1-.5)*.7+(n2-.5)*.25;',
      '  cy=abs(fract(cy*.5+.5)*2.-1.);',
      '  cy=.06+cy*.88;',
      '  float ord=smoothstep(.40,.64,x);',
      '  float y=mix(cy,laneY+(h1(a.y*917.3)-.5)*.007,ord);',
      '  y=mix(.5,y,uIntro);',
      '  vec2 px=vec2(x*1.1-.05,y)*uRes;',
      '  vec2 d=px-uMouse;',
      '  float dist=length(d);',
      '  float R=200.*uDpr;',
      '  float f=uOn*(1.-smoothstep(0.,R,dist));',
      '  px+=d/(dist+.001)*f*f*90.*uDpr;',
      '  vec2 c=px/uRes*2.-1.;',
      '  gl_Position=vec4(c.x,-c.y,0.,1.);',
      '  float hot=step(.78,h1(lane*7.77+1.3));',
      '  gl_PointSize=(1.2+a.z*1.6+ord*.6)*uDpr;',
      '  vO=ord; vH=hot;',
      '  float edge=smoothstep(0.,.05,x)*(1.-smoothstep(.95,1.,x));',
      '  vA=edge*(.22+a.z*.7)*uIntro;',
      '}'
    ].join('\n');
    var FS = [
      'precision mediump float;',
      'uniform vec3 uA;', 'uniform vec3 uB;',
      'varying float vA;', 'varying float vO;', 'varying float vH;',
      'void main(){',
      '  vec2 p=gl_PointCoord-.5;',
      '  float m=smoothstep(.5,.12,length(p));',
      '  vec3 col=mix(uA*.5,uA,vO);',
      '  col=mix(col,uB,vO*vH);',
      '  gl_FragColor=vec4(col,m*vA);',
      '}'
    ].join('\n');
    var FVS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    var FFS = 'precision mediump float;uniform vec4 uC;void main(){gl_FragColor=uC;}';

    var pp, fp;
    try { pp = program(VS, FS); fp = program(FVS, FFS); } catch (err) { if (W.win.console) console.warn('[ak] shader', err); return; }

    var N = W.coarse ? 9000 : 22000;
    var seeds = new Float32Array(N * 4);
    for (var i = 0; i < N; i++) {
      seeds[i * 4] = hash(i * 1.13 + 0.5);
      seeds[i * 4 + 1] = hash(i * 2.71 + 1.7);
      seeds[i * 4 + 2] = Math.pow(hash(i * 3.97 + 2.9), 1.6);
      seeds[i * 4 + 3] = hash(i * 5.31 + 4.1);
    }
    var pbuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pbuf); gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    var fbuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, fbuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var aLoc = gl.getAttribLocation(pp, 'a'), pLoc = gl.getAttribLocation(fp, 'p');
    var U = {};
    ['uRes', 'uMouse', 'uT', 'uDpr', 'uIntro', 'uOn', 'uA', 'uB'].forEach(function (n) { U[n] = gl.getUniformLocation(pp, n); });
    var uC = gl.getUniformLocation(fp, 'uC');

    var state = { intro: 0, t: 0, boost: 0, on: 0, visible: true, lost: false, dpr: 1, w: 1, h: 1 };
    W.hero = state;

    function resize() {
      var dpr = Math.min(W.win.devicePixelRatio || 1, W.coarse ? 1.5 : 1.75);
      var r = sec.getBoundingClientRect();
      state.dpr = dpr;
      state.w = cv.width = Math.max(2, Math.round(r.width * dpr));
      state.h = cv.height = Math.max(2, Math.round(r.height * dpr));
      gl.viewport(0, 0, state.w, state.h);
      gl.clearColor(0.027, 0.031, 0.039, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    resize();
    var rz = 0;
    W.on(W.win, 'resize', function () { cancelAnimationFrame(rz); rz = requestAnimationFrame(resize); });
    W.on(cv, 'webglcontextlost', function (e) { e.preventDefault(); state.lost = true; });

    if ('IntersectionObserver' in W.win) {
      var io = new W.win.IntersectionObserver(function (en) { state.visible = en[0].isIntersecting; }, { threshold: 0 });
      io.observe(sec);
      W.cleanup(function () { io.disconnect(); });
    }

    W.loop(function (dt) {
      if (!state.visible || state.lost) return;
      var p = W.pointer, r = sec.getBoundingClientRect();
      var inside = p.active && p.y >= r.top && p.y <= r.bottom;
      state.on = lerp(state.on, inside ? 1 : 0, damp(dt, 0.05));
      var target = Math.min(3.2, Math.abs(W.vel) / 700);
      state.boost = lerp(state.boost, target, damp(dt, 0.08));
      state.t += dt * (1 + state.boost);

      gl.enable(gl.BLEND);
      gl.useProgram(fp);
      gl.bindBuffer(gl.ARRAY_BUFFER, fbuf);
      gl.enableVertexAttribArray(pLoc);
      gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform4f(uC, 0.027, 0.031, 0.039, 0.13);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disableVertexAttribArray(pLoc);

      gl.useProgram(pp);
      gl.bindBuffer(gl.ARRAY_BUFFER, pbuf);
      gl.enableVertexAttribArray(aLoc);
      gl.vertexAttribPointer(aLoc, 4, gl.FLOAT, false, 0, 0);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.uniform2f(U.uRes, state.w, state.h);
      gl.uniform2f(U.uMouse, (p.x - r.left) * state.dpr, (p.y - r.top) * state.dpr);
      gl.uniform1f(U.uT, state.t);
      gl.uniform1f(U.uDpr, state.dpr);
      gl.uniform1f(U.uIntro, state.intro);
      gl.uniform1f(U.uOn, state.on);
      gl.uniform3f(U.uA, 0.925, 0.918, 0.894);
      gl.uniform3f(U.uB, 0.831, 1.0, 0.247);
      gl.drawArrays(gl.POINTS, 0, N);
      gl.disableVertexAttribArray(aLoc);
    });
    W.cleanup(function () { try { var ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } catch (e) {} });
  }

  /* ---------- 01 SOURCE: hacker-flip-3d name + variable-font axis + kinetic-beat-slam ---------- */
  function hero(W) {
    var sec = W.$('.hero'); if (!sec) return;
    var gsap = W.gsap;
    var outers = W.$$('.hero-name .ch'), inners = W.$$('.hero-name .ch-i');
    var first = W.$('.hero-first'), kickUl = W.$('.hero-kick'), kick = W.$$('.hero-kick li');
    var beats = W.$$('.beat'), sub = W.$('.hero-sub'), btns = W.$$('.hero .btns .btn');
    var legend = W.$$('.hero-legend span'), tline = W.$('.hero-t'), cue = W.$('.hero-scroll'), row = W.$('.hero-row'), glc = W.$('.hero-gl');

    inners.forEach(function (el) {
      el.setAttribute('data-c', el.textContent);
      el.style.opacity = '0';
      el.style.transform = 'perspective(900px) rotateX(90deg)';
    });
    gsap.set([first, cue].concat(kick, beats, legend, btns, [sub]).filter(Boolean), { autoAlpha: 0 });
    if (tline) gsap.set(tline, { scaleY: 0 });

    var introDone = false;
    W.heroIntro = function () {
      var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      if (glc) tl.to(glc, { opacity: 1, duration: 1.2, ease: 'power2.out' }, 0);
      if (W.hero) tl.to(W.hero, { intro: 1, duration: 2.4, ease: 'power2.out' }, 0);
      if (tline) tl.to(tline, { scaleY: 1, duration: 1.2, ease: 'expo.inOut' }, 0.1);
      tl.to(legend, { autoAlpha: 1, duration: 0.6, stagger: 0.12 }, 0.6);
      inners.forEach(function (el, i) {
        var st = { p: 0 };
        tl.to(st, {
          p: 1, duration: 0.74, ease: 'power3.out',
          onUpdate: function () {
            if (st.p < 0.62) {
              el.setAttribute('data-s', GLYPHS.charAt(Math.floor(hash(i * 31 + Math.floor(st.p * 22)) * GLYPHS.length)));
              if (!el.classList.contains('is-scr')) el.classList.add('is-scr');
            } else if (el.classList.contains('is-scr')) { el.classList.remove('is-scr'); }
            el.style.transform = 'perspective(900px) rotateX(' + (90 - st.p * 90).toFixed(2) + 'deg)';
            el.style.opacity = Math.min(1, st.p * 2.4).toFixed(3);
          },
          onComplete: function () { el.classList.remove('is-scr'); el.style.transform = 'none'; el.style.opacity = '1'; }
        }, 0.12 + i * 0.05);
      });
      if (first) tl.fromTo(first, { autoAlpha: 0, x: -24 }, { autoAlpha: 1, x: 0, duration: 0.6 }, 0.15);
      tl.fromTo(kick, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08 }, 0.3);
      var B = 0.12 + inners.length * 0.05 + 0.45, P = 0.34;
      if (beats[0]) tl.fromTo(beats[0], { autoAlpha: 0, scale: 1.7, filter: 'blur(14px)' }, { autoAlpha: 1, scale: 1, filter: 'blur(0px)', duration: 0.5, ease: 'power4.out' }, B);
      if (beats[1]) tl.fromTo(beats[1], { autoAlpha: 0, x: -260 }, { autoAlpha: 1, x: 0, duration: 0.45, ease: 'expo.out' }, B + P);
      if (beats[2]) tl.fromTo(beats[2], { autoAlpha: 0, y: 70, rotation: 7 }, { autoAlpha: 1, y: 0, rotation: 0, duration: 0.55, ease: 'circ.out' }, B + P * 2);
      if (sub) tl.fromTo(sub, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.7 }, B + P * 2.4);
      tl.fromTo(btns, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08 }, B + P * 2.6);
      if (cue) tl.fromTo(cue, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, B + P * 3);
      tl.add(function () { introDone = true; }, B);
    };

    // Scroll exit: glyph scatter with per-character depth, velocity-matched blur.
    var out = gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom top', scrub: 0.6 } });
    outers.forEach(function (c, i) {
      out.fromTo(c, { yPercent: 0, rotation: 0, opacity: 1 }, { yPercent: -(70 + hash(i * 3.1) * 150), rotation: (hash(i * 7.7) - 0.5) * 26, opacity: 0, ease: 'none', immediateRender: false }, 0);
    });
    if (row) out.fromTo(row, { y: 0, opacity: 1, filter: 'blur(0px)' }, { y: -60, opacity: 0, filter: 'blur(8px)', ease: 'none', immediateRender: false }, 0);
    if (kickUl) out.fromTo(kickUl, { y: 0, opacity: 1 }, { y: -40, opacity: 0, ease: 'none', immediateRender: false }, 0);
    if (glc) out.fromTo(glc, { scale: 1 }, { scale: 1.14, ease: 'none', immediateRender: false }, 0);

    // Variable font axis: width and weight swell under the pointer, idle wave otherwise.
    var inView = true;
    W.ST.create({ trigger: sec, start: 'top bottom', end: 'bottom top', onToggle: function (s) { inView = s.isActive; } });
    var wd = inners.map(function () { return { w: 96, g: 800 }; });
    var on = 0;
    W.loop(function (dt, time) {
      if (!inView || !introDone) return;
      var p = W.pointer, r = sec.getBoundingClientRect();
      var active = p.active && p.y > r.top && p.y < r.bottom;
      on = lerp(on, active ? 1 : 0, damp(dt, 0.04));
      var cx = [];
      for (var i = 0; i < inners.length; i++) { var b = inners[i].getBoundingClientRect(); cx.push(b.left + b.width / 2, b.top + b.height / 2); }
      for (var j = 0; j < inners.length; j++) {
        var idle = 96 + 9 * Math.sin(time * 1.25 + j * 0.62);
        var dx = p.x - cx[j * 2], dy = (p.y - cx[j * 2 + 1]) * 0.6;
        var k = 1 - smooth(0, 340, Math.sqrt(dx * dx + dy * dy));
        var tw = lerp(idle, 90 + 42 * k, on), tg = lerp(800, 760 + 140 * k, on);
        var s = wd[j], a = damp(dt, 0.002);
        s.w = lerp(s.w, tw, a); s.g = lerp(s.g, tg, a);
        inners[j].style.fontStretch = s.w.toFixed(1) + '%';
        inners[j].style.fontWeight = String(Math.round(s.g));
      }
    });
  }

  /* ---------- Section heads: hacker decode + rule draw + clip-path mask titles ---------- */
  function decode(W, el, dur, delay) {
    var txt = el.textContent, st = { p: 0 }, seed = Math.floor(hash(txt.length * 3.3 + txt.charCodeAt(0)) * 1000);
    W.gsap.to(st, {
      p: 1, duration: dur, delay: delay || 0, ease: 'none',
      onStart: function () { el.classList.add('is-scr'); },
      onUpdate: function () {
        var n = Math.floor(st.p * txt.length), q = Math.floor(st.p * 18);
        el.setAttribute('data-s', txt.slice(0, n) + scramble(txt.slice(n), seed + q * 7));
      },
      onComplete: function () { el.classList.remove('is-scr'); }
    });
  }
  function heads(W) {
    var gsap = W.gsap;
    W.$$('.sec-head').forEach(function (h) {
      var scr = W.$$('[data-scr]', h), rule = W.$('.sec-rule', h);
      if (rule) gsap.set(rule, { scaleX: 0 });
      W.ST.create({
        trigger: h, start: 'top 90%', once: true,
        onEnter: function () {
          if (rule) gsap.to(rule, { scaleX: 1, duration: 1.3, ease: 'expo.inOut' });
          scr.forEach(function (el, k) { decode(W, el, 0.75, k * 0.14); });
        }
      });
    });
    W.$$('.sec-title, .dds-title').forEach(function (t) {
      var lines = W.$$('.mask-i', t);
      if (!lines.length) return;
      gsap.set(lines, { yPercent: 112, rotation: 5 });
      W.ST.create({ trigger: t, start: 'top 88%', once: true, onEnter: function () { gsap.to(lines, { yPercent: 0, rotation: 0, duration: 1.15, ease: 'expo.out', stagger: 0.09 }); } });
    });
    W.$$('.rv, .dds-kick').forEach(function (el) {
      gsap.set(el, { autoAlpha: 0, y: 36 });
      W.ST.create({ trigger: el, start: 'top 90%', once: true, onEnter: function () { gsap.to(el, { autoAlpha: 1, y: 0, duration: 0.95, ease: 'power3.out' }); } });
    });
  }

  /* ---------- 02 INGEST: gradient-text-sweep (word by word) + css-marker-patterns ---------- */
  function about(W) {
    var gsap = W.gsap, m = W.$('.manifesto');
    if (m) {
      var words = W.$$('.w', m), hls = W.$$('.hl', m);
      gsap.set(words, { opacity: 0.14 });
      gsap.set(hls, { '--m': 0 });
      var tl = gsap.timeline({ scrollTrigger: { trigger: m, start: 'top 80%', end: 'bottom 48%', scrub: 0.5 } });
      tl.to(words, { opacity: 1, stagger: 0.1, duration: 0.3, ease: 'none' }, 0);
      hls.forEach(function (h) {
        var idx = words.indexOf(W.$('.w', h));
        tl.to(h, { '--m': 1, color: '#d4ff3f', duration: 0.45, ease: 'power2.out' }, Math.max(0, idx) * 0.1 + 0.15);
      });
    }
    var facts = W.$('.facts');
    if (facts) {
      var cells = W.$$('dt, dd', facts);
      gsap.set(cells, { autoAlpha: 0, y: 44 });
      W.ST.create({
        trigger: facts, start: 'top 88%', once: true,
        onEnter: function () {
          cells.forEach(function (c, i) {
            gsap.set(c, { autoAlpha: 1, delay: i * 0.04 });
            gsap.to(c, { y: 0, duration: 0.8, delay: i * 0.04, ease: 'power4.out' });
          });
        }
      });
    }
  }

  /* ---------- 02 INGEST: portrait as data (Canvas 2D ASCII resolve + wipe + lens) ---------- */
  function portrait(W) {
    var fig = W.$('.portrait'); if (!fig) return;
    var img = W.$('img', fig), cv = W.$('canvas', fig);
    if (!img || !cv) return;
    var g = cv.getContext('2d'); if (!g) return;
    var gsap = W.gsap;
    var RAMP = ' .·:-=+*#%@';
    var COLS = W.coarse ? 56 : 76, ROWS = COLS;
    var lum = null, ready = false, cw = 1, dpr = Math.min(W.win.devicePixelRatio || 1, 2);
    var st = { resolve: 0, wipe: 0, lens: 0 }, lx = -999, ly = -999, R = 88, clock = 0, animating = false;
    var FILLS = [];
    for (var f = 0; f < 10; f++) FILLS.push('rgba(236,234,228,' + (0.22 + f * 0.078).toFixed(2) + ')');

    function sample() {
      try {
        var oc = W.doc.createElement('canvas'); oc.width = COLS; oc.height = ROWS;
        var og = oc.getContext('2d'); og.drawImage(img, 0, 0, COLS, ROWS);
        var d = og.getImageData(0, 0, COLS, ROWS).data;
        lum = new Float32Array(COLS * ROWS);
        var mn = 1, mx = 0, i;
        for (i = 0; i < COLS * ROWS; i++) {
          var v = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
          lum[i] = v; if (v < mn) mn = v; if (v > mx) mx = v;
        }
        for (i = 0; i < lum.length; i++) lum[i] = Math.pow((lum[i] - mn) / Math.max(0.001, mx - mn), 1.1);
        ready = true;
      } catch (e) { ready = false; }
    }
    function size() {
      var r = fig.getBoundingClientRect();
      cv.width = Math.max(2, Math.round(r.width * dpr)); cv.height = Math.max(2, Math.round(r.height * dpr));
      cw = r.width / COLS;
      draw();
    }
    function cells(y0, y1, x0, x1) {
      var r0 = Math.max(0, Math.floor(y0 / cw)), r1 = Math.min(ROWS, Math.ceil(y1 / cw));
      var c0 = Math.max(0, Math.floor(x0 / cw)), c1 = Math.min(COLS, Math.ceil(x1 / cw));
      var q = Math.floor(clock * 14);
      for (var r = r0; r < r1; r++) {
        for (var c = c0; c < c1; c++) {
          var i = r * COLS + c, v = lum[i], ch;
          if (hash(i * 0.731 + 1.1) > st.resolve) ch = GLYPHS.charAt(Math.floor(hash(i * 1.37 + q * 0.61) * GLYPHS.length));
          else ch = RAMP.charAt(Math.min(RAMP.length - 1, Math.floor(v * RAMP.length)));
          if (ch === ' ') continue;
          g.fillStyle = v > 0.86 ? '#d4ff3f' : FILLS[Math.min(9, Math.floor(v * 10))];
          g.fillText(ch, c * cw + cw / 2, r * cw + cw / 2);
        }
      }
    }
    function draw() {
      var w = cv.width / dpr, h = cv.height / dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      if (!ready) return;
      g.font = '600 ' + (cw * 1.2).toFixed(1) + 'px "AK Mono", ui-monospace, monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      var cut = (1 - st.wipe) * h;
      if (cut > 0.5) { g.fillStyle = '#07080a'; g.fillRect(0, 0, w, cut); cells(0, cut, 0, w); }
      if (st.lens > 0.01 && lx > -500) {
        var rr = R * st.lens;
        g.save(); g.beginPath(); g.arc(lx, ly, rr, 0, 6.2832); g.clip();
        g.fillStyle = 'rgba(7,8,10,.93)'; g.fillRect(lx - rr, ly - rr, rr * 2, rr * 2);
        cells(ly - rr, ly + rr, lx - rr, lx + rr);
        g.restore();
      }
      if (st.wipe > 0.001 && st.wipe < 0.999) { g.fillStyle = '#d4ff3f'; g.fillRect(0, cut - 1, w, 2); }
    }
    function init() {
      sample(); size();
      if (!ready) return;
      gsap.set(img, { clipPath: 'inset(100% 0% 0% 0%)' });
      W.ST.create({
        trigger: fig, start: 'top 72%', once: true,
        onEnter: function () {
          animating = true;
          var tl = gsap.timeline({ onUpdate: draw, onComplete: function () { animating = false; draw(); } });
          tl.to(st, { resolve: 1, duration: 1.5, ease: 'power2.inOut' }, 0);
          tl.to(st, { wipe: 1, duration: 1.2, ease: 'power3.inOut' }, 1.9);
          tl.to(img, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'power3.inOut' }, 1.9);
        }
      });
      W.on(W.win, 'resize', size);
      if (!W.coarse) {
        W.on(fig, 'pointermove', function (e) {
          var r = fig.getBoundingClientRect(); lx = e.clientX - r.left; ly = e.clientY - r.top;
          if (st.lens < 1 && !fig.__lensIn) { fig.__lensIn = true; gsap.to(st, { lens: 1, duration: 0.45, ease: 'power3.out', onUpdate: draw }); }
          draw();
        });
        W.on(fig, 'pointerleave', function () { fig.__lensIn = false; gsap.to(st, { lens: 0, duration: 0.35, ease: 'power2.in', onUpdate: draw }); });
      } else {
        W.on(fig, 'click', function () { gsap.to(st, { wipe: st.wipe > 0.5 ? 0 : 1, duration: 0.9, ease: 'power3.inOut', onUpdate: draw }); gsap.to(img, { clipPath: st.wipe > 0.5 ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'power3.inOut' }); });
      }
      W.loop(function (dt) { clock += dt; });
    }
    if (img.complete && img.naturalWidth) init(); else W.on(img, 'load', init);
  }

  /* ---------- 03 TRANSFORM: svg-path-draw + MotionPath packets + viewport-change camera ---------- */
  function dds(W) {
    var track = W.$('.dds-track'), pin = W.$('.dds-pin'), svg = W.$('.dds-svg');
    if (!track || !pin || !svg) return;
    var gsap = W.gsap;
    var nodes = [];
    W.$$('.nd', svg).forEach(function (n) { nodes[parseInt(n.getAttribute('data-n'), 10)] = n; });
    var steps = W.$$('.dds-step', pin), meta = W.$('.dds-meta .rd', pin);
    var bus = W.$('.dds-bus', svg), branch = W.$('.dds-branch', svg), sched = W.$('.dds-sched', svg);
    var rail = W.$('.dds-rail', svg), railDots = W.$$('.rail-dot', svg), railT = W.$('.dds-railt', svg);
    var pkBus = W.$$('.pk-bus', svg), pkBr = W.$$('.pk-br', svg);
    var vb0 = svg.getAttribute('viewBox');
    W.cleanup(function () { svg.setAttribute('viewBox', vb0); });

    var BUS = 1140, BR = branch ? branch.getTotalLength() : 1;
    var rv = { bus: 0, br: 0 };
    function applyReveal() {
      if (bus) bus.style.strokeDashoffset = (BUS - rv.bus).toFixed(1);
      if (branch) branch.style.strokeDashoffset = (BR - rv.br).toFixed(1);
    }
    if (bus) { bus.style.strokeDasharray = BUS + ' ' + BUS; }
    if (branch) { branch.style.strokeDasharray = BR + ' ' + BR; }
    applyReveal();
    nodes.forEach(function (n) { gsap.set(n, { opacity: 0.14, scale: 0.9, transformOrigin: '50% 50%' }); });
    gsap.set([sched, rail, railT].filter(Boolean).concat(railDots), { opacity: 0 });

    // Packets travel continuously; each shows only on the part of the path already drawn.
    var loopsTw = [];
    pkBus.forEach(function (p, i) {
      p.style.opacity = '0';
      var tw = gsap.to(p, {
        motionPath: { path: bus, align: bus, alignOrigin: [0.5, 0.5] }, duration: 5.4, ease: 'none', repeat: -1, paused: true,
        onUpdate: function () { var x = this.progress() * BUS; p.style.opacity = x < rv.bus - 6 ? '1' : '0'; }
      });
      tw.totalTime(i * 5.4 / pkBus.length);
      loopsTw.push(tw);
    });
    pkBr.forEach(function (p, i) {
      p.style.opacity = '0';
      var tw = gsap.to(p, {
        motionPath: { path: branch, align: branch, alignOrigin: [0.5, 0.5] }, duration: 3.2, ease: 'none', repeat: -1, paused: true,
        onUpdate: function () { var x = this.progress() * BR; p.style.opacity = x < rv.br - 6 ? '1' : '0'; }
      });
      tw.totalTime(i * 3.2 / pkBr.length);
      loopsTw.push(tw);
    });

    // Camera focus per stage, in SVG units. zd = desktop zoom, zm = mobile zoom.
    // ax/ay = where the focus point sits on screen (desktop). Mobile always centres horizontally.
    var S = [
      { f: [100, 340], zd: 1.3, zm: 2.9, ax: 0.58, ay: 0.46 },
      { f: [290, 340], zd: 1.3, zm: 2.9, ax: 0.58, ay: 0.46 },
      { f: [480, 340], zd: 1.3, zm: 2.9, ax: 0.58, ay: 0.46 },
      { f: [670, 340], zd: 1.3, zm: 2.9, ax: 0.58, ay: 0.46 },
      { f: [860, 340], zd: 1.3, zm: 2.9, ax: 0.58, ay: 0.46 },
      { f: [860, 520], zd: 1.25, zm: 2.6, ax: 0.58, ay: 0.46 },
      { f: [1050, 340], zd: 1.3, zm: 2.9, ax: 0.58, ay: 0.46 },
      { f: [1240, 340], zd: 1.3, zm: 2.9, ax: 0.55, ay: 0.46 },
      { f: [700, 398], zd: 0.94, zm: 1.3, ax: 0.5, ay: 0.44 },
      { f: [700, 398], zd: 0.88, zm: 1.02, ax: 0.5, ay: 0.44 }
    ];
    var cam = { x: S[0].f[0], y: S[0].f[1], zd: S[0].zd, zm: S[0].zm, ax: S[0].ax, ay: S[0].ay };
    function applyCam() {
      var cw = pin.clientWidth || 1, ch = pin.clientHeight || 1, mob = W.isMobile();
      var z = mob ? cam.zm : cam.zd;
      var vw = 1400 / z, vh = vw * ch / cw;
      var ax = mob ? 0.5 : cam.ax, ay = mob ? 0.36 : cam.ay;
      svg.setAttribute('viewBox', (cam.x - vw * ax).toFixed(1) + ' ' + (cam.y - vh * ay).toFixed(1) + ' ' + vw.toFixed(1) + ' ' + vh.toFixed(1));
    }
    applyCam();
    W.on(W.win, 'resize', applyCam);

    var active = -1;
    function setStep(k) {
      if (k === active) return;
      var prev = steps[active];
      active = k;
      if (prev) gsap.to(prev, { autoAlpha: 0, y: -18, duration: 0.3, ease: 'power2.in', overwrite: true });
      if (steps[k]) gsap.fromTo(steps[k], { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out', overwrite: true, delay: prev ? 0.12 : 0 });
      if (meta) meta.setAttribute('data-v', pad(k + 1, 2) + ' / ' + pad(S.length, 2));
      var focus = k <= 7 ? k : -1;
      nodes.forEach(function (n, i) { n.classList.toggle('is-on', i === focus || k === 9 || (k === 8 && i === 8)); });
    }

    var tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      onUpdate: function () { applyCam(); applyReveal(); setStep(clamp(Math.floor(tl.time() + 0.3), 0, S.length - 1)); },
      scrollTrigger: {
        trigger: track, start: 'top top', end: 'bottom bottom', scrub: 0.8,
        onToggle: function (s) { loopsTw.forEach(function (t) { if (s.isActive) t.play(); else t.pause(); }); }
      }
    });
    var pop = function (n, at) { if (n) tl.to(n, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.7)' }, at); };
    pop(nodes[0], 0.05);
    var busTo = [0, 190, 380, 570, 760, 760, 950, 1140, 1140, 1140];
    for (var k = 1; k < S.length; k++) {
      var at = k - 0.55;
      tl.to(cam, { x: S[k].f[0], y: S[k].f[1], zd: S[k].zd, zm: S[k].zm, ax: S[k].ax, ay: S[k].ay, duration: 0.5 }, at);
      if (busTo[k] !== busTo[k - 1]) tl.to(rv, { bus: busTo[k], duration: 0.5, ease: 'none' }, at);
      if (k <= 7) pop(nodes[k === 5 ? 5 : k], at + 0.32);
    }
    tl.to(rv, { br: BR * 0.52, duration: 0.5, ease: 'none' }, 5 - 0.55);
    tl.to(rv, { br: BR, duration: 0.5, ease: 'none' }, 6 - 0.55);
    pop(nodes[8], 8 - 0.2);
    if (sched) tl.to(sched, { opacity: 1, duration: 0.3 }, 8 - 0.3);
    tl.to([rail, railT].filter(Boolean), { opacity: 1, duration: 0.3 }, 8 - 0.25);
    tl.to(railDots, { opacity: 1, duration: 0.2, stagger: 0.04 }, 8 - 0.2);
    tl.to({}, { duration: 0.7 }, S.length - 0.9);
    setStep(0);
  }

  /* ---------- Results: counting-dynamic-scale + stat-bars-and-fills ---------- */
  function results(W) {
    var gsap = W.gsap;
    W.$$('.res li').forEach(function (li) {
      var n = W.$('.res-n', li), c = W.$('.cnt', li), suf = W.$('.res-suf', li), lab = W.$('.res-l', li);
      var bar = W.$('.res-bar i', li), seg = W.$$('.res-seg i', li);
      if (!n || !c) return;
      var to = parseFloat(c.getAttribute('data-to')) || 0, dec = parseInt(c.getAttribute('data-dec') || '0', 10);
      var f = bar ? parseFloat(bar.style.getPropertyValue('--f')) || 1 : 1;
      gsap.set(suf, { autoAlpha: 0, y: 22 });
      gsap.set(n, { scale: 0.52 });
      gsap.set(lab, { autoAlpha: 0, x: 34 });
      if (bar) gsap.set(bar, { scaleX: 0 });
      if (seg.length) gsap.set(seg, { scaleY: 0, transformOrigin: '50% 100%' });
      c.classList.add('is-cnt'); c.setAttribute('data-v', (0).toFixed(dec));
      W.ST.create({
        trigger: li, start: 'top 84%', once: true,
        onEnter: function () {
          var st = { v: 0 }, D = 1.7, tl = gsap.timeline();
          tl.to(st, { v: to, duration: D, ease: 'power3.out', onUpdate: function () { c.setAttribute('data-v', st.v.toFixed(dec)); }, onComplete: function () { c.classList.remove('is-cnt'); } }, 0);
          tl.to(n, { scale: 1, duration: D, ease: 'power3.out' }, 0);
          tl.to(lab, { autoAlpha: 1, x: 0, duration: 0.8 }, 0.2);
          tl.to(suf, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'back.out(1.8)' }, D - 0.1);
          if (bar) tl.to(bar, { scaleX: f, duration: D, ease: 'power3.out' }, 0);
          if (seg.length) tl.to(seg, { scaleY: 1, duration: 0.25, stagger: (D - 0.3) / seg.length, ease: 'power2.out' }, 0.05);
        }
      });
    });
  }

  /* ---------- Proof cards: consolidation, cluster wave, side-by-side switch, team network ---------- */
  function proofs(W) {
    var gsap = W.gsap;

    var merge = W.$('.merge');
    if (merge) {
      var cells = W.$$('i', merge);
      gsap.set(cells, { scale: 0 });
      W.ST.create({
        trigger: merge, start: 'top 80%', once: true,
        onEnter: function () {
          var pitch = cells.length > 15 ? cells[15].getBoundingClientRect().top - cells[0].getBoundingClientRect().top : 0;
          var tl = gsap.timeline({ delay: 0.1 });
          tl.to(cells, { scale: 1, duration: 0.45, ease: 'back.out(2)', stagger: { grid: [4, 15], from: 'start', amount: 0.6 } }, 0);
          cells.forEach(function (c, i) {
            var r = Math.floor(i / 15), col = i % 15;
            tl.to(c, { y: (1.5 - r) * pitch, duration: 0.75, ease: 'expo.inOut' }, 1.1 + col * 0.045);
            if (r !== 1) tl.to(c, { opacity: 0, scale: 0.4, duration: 0.25 }, 1.62 + col * 0.045);
            else tl.to(c, { scaleX: 1.12, scaleY: 2.4, y: (1.5 - r) * pitch, backgroundColor: '#d4ff3f', duration: 0.55, ease: 'back.out(2.2)' }, 1.62 + col * 0.045);
          });
        }
      });
    }

    var cl = W.$('.cluster');
    if (cl) {
      var nodesC = W.$$('i', cl), us = W.$$('u', cl);
      gsap.set(nodesC, { opacity: 0, scale: 0.3 });
      gsap.set(us, { opacity: 0, scale: 0.2 });
      W.ST.create({
        trigger: cl, start: 'top 80%', once: true,
        onEnter: function () {
          var tl = gsap.timeline();
          tl.to(nodesC, { opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out', stagger: { grid: [9, 11], from: 'edges', amount: 0.7 } }, 0);
          tl.to(us, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)', stagger: { grid: [9, 11], from: 'center', amount: 1.1 } }, 0.8);
        }
      });
    }

    var sw = W.$('.sw');
    if (sw) {
      var oldL = W.$('[data-lane="old"]', sw), newL = W.$('[data-lane="new"]', sw);
      var oldS = W.$('.sw-st', oldL), newS = W.$('.sw-st', newL), rd = W.$('.sw-read .rd', sw);
      var cyc = gsap.timeline({ repeat: -1, repeatDelay: 1.4, paused: true });
      cyc.call(function () {
        oldL.classList.add('is-live'); oldL.classList.remove('is-idle');
        newL.classList.remove('is-live', 'is-fast');
        oldS.setAttribute('data-v', 'serving'); newS.setAttribute('data-v', 'shadow');
      }, null, 0);
      cyc.call(function () { newS.setAttribute('data-v', 'validated'); }, null, 2.2);
      cyc.call(function () {
        newL.classList.add('is-live', 'is-fast');
        oldL.classList.remove('is-live'); oldL.classList.add('is-idle');
        newS.setAttribute('data-v', 'serving'); oldS.setAttribute('data-v', 'drained');
        if (rd) {
          var s = { p: 0 };
          gsap.to(s, { p: 1, duration: 0.6, ease: 'none', onUpdate: function () { rd.setAttribute('data-v', s.p < 0.95 ? scramble('0.000', Math.floor(s.p * 20) * 7) + ' s' : '0.000 s'); } });
        }
      }, null, 3.6);
      cyc.to({}, { duration: 3.6 }, 3.6);
      W.ST.create({ trigger: sw, start: 'top bottom', end: 'bottom top', onToggle: function (s) { if (s.isActive) cyc.play(); else cyc.pause(); } });
    }

    var team = W.$('.team');
    if (team) {
      var lines = W.$$('.tm-l', team), ns = W.$$('.tm-n', team), ups = W.$$('.tm-up', team), lv = W.$$('.tm-lv', team);
      lines.forEach(function (l) { var L = l.getTotalLength(); l.style.strokeDasharray = L + ' ' + L; l.style.strokeDashoffset = String(L); });
      gsap.set(ns, { scale: 0, transformOrigin: '50% 50%' });
      gsap.set(ups, { scale: 0.5, opacity: 0, transformOrigin: '50% 50%' });
      gsap.set(lv, { opacity: 0 });
      W.ST.create({
        trigger: team, start: 'top 82%', once: true,
        onEnter: function () {
          var tl = gsap.timeline();
          tl.to(ns[0], { scale: 1, duration: 0.5, ease: 'back.out(2)' }, 0);
          tl.to(lines, { strokeDashoffset: 0, duration: 0.6, stagger: 0.12, ease: 'power2.inOut' }, 0.2);
          tl.to(ns.slice(1), { scale: 1, duration: 0.5, stagger: 0.12, ease: 'back.out(2)' }, 0.55);
          tl.to(ups, { scale: 1, opacity: 1, duration: 0.9, stagger: 0.15, ease: 'expo.out' }, 1.25);
          tl.to(lv, { opacity: 1, duration: 0.4, stagger: 0.15 }, 1.35);
        }
      });
    }
  }

  /* ---------- Marquee: ticker-takeover driven by scroll velocity (motion-blur-streak skew) ---------- */
  function marquee(W) {
    var sec = W.$('.mq'), rows = W.$$('.mq-row');
    if (!sec || !rows.length) return;
    var visible = false, pos = rows.map(function () { return 0; }), half = [], skew = 0, dirSign = 1;
    function measure() { half = rows.map(function (r) { return r.scrollWidth / 2; }); }
    measure();
    W.on(W.win, 'resize', measure);
    var prevMeasure = W.measure;
    W.measure = function () { measure(); if (prevMeasure) prevMeasure(); };
    W.ST.create({ trigger: sec, start: 'top bottom', end: 'bottom top', onToggle: function (s) { visible = s.isActive; } });
    W.loop(function (dt) {
      if (!visible) return;
      var v = W.vel;
      if (v > 4) dirSign = 1; else if (v < -4) dirSign = -1;
      var speed = 70 + Math.min(1600, Math.abs(v) * 0.7);
      skew = lerp(skew, clamp(v / 160, -16, 16), damp(dt, 0.02));
      rows.forEach(function (r, i) {
        var d = parseFloat(r.getAttribute('data-dir')) || -1, hw = half[i] || 1;
        pos[i] += d * dirSign * speed * dt;
        while (pos[i] <= -hw) pos[i] += hw;
        while (pos[i] > 0) pos[i] -= hw;
        r.style.transform = 'translate3d(' + pos[i].toFixed(1) + 'px,0,0) skewX(' + (-skew * d).toFixed(2) + 'deg)';
      });
    });
  }

  /* ---------- 04 LINEAGE: 3d-camera-flight + depth-of-field-blur + vertical-spring-ticker ---------- */
  function flight(W) {
    var track = W.$('.flight'), view = W.$('.flight-view'), world = W.$('.flight-world');
    if (!track || !view || !world) return;
    var gsap = W.gsap;
    var roles = W.$$('.role', world), years = W.$$('.fy', world), floor = W.$('.flight-floor');
    var bar = W.$('.flight-bar i'), num = W.$('.flight-n'), cols = W.$$('.tick-c');
    var D = 1500;
    var P = [];
    function layout() {
      var vw = W.win.innerWidth, mob = W.isMobile(), off = Math.min(vw * 0.16, 240);
      P = roles.map(function (r, i) { return { x: mob ? 0 : (i === roles.length - 1 ? 0 : (i % 2 === 0 ? -off : off)), z: -i * D }; });
    }
    layout();
    var YZ = [-900, -D - 900, -2 * D - 900, -2 * D - 2900], YX = [0.3, -0.32, 0.3, 0], YV = [2019, 2021, 2022, 2026];
    var cam = { z: -950, x: 0 }, lastBlur = roles.map(function () { return -1; }), yearNow = -1;

    function setYear(y) {
      if (y === yearNow) return; yearNow = y;
      var s = String(y);
      cols.forEach(function (c, i) { gsap.to(c, { yPercent: -parseInt(s.charAt(i), 10) * 10, duration: 0.9, ease: 'expo.out', delay: i * 0.04 }); });
    }
    function render() {
      var vw = W.win.innerWidth, mob = W.isMobile();
      roles.forEach(function (r, i) {
        var p = P[i], ez = p.z + cam.z;
        var op = ez < -3300 ? 0 : ez < -1700 ? (ez + 3300) / 1600 : ez < 160 ? 1 : ez < 620 ? 1 - (ez - 160) / 460 : 0;
        var bl = 0;
        if (!mob) { if (ez < -140) bl = Math.min(7, (-ez - 140) / 230); else if (ez > 140) bl = Math.min(9, (ez - 140) / 50); }
        bl = Math.round(bl * 2) / 2;
        r.style.transform = 'translate(-50%,-50%) translate3d(' + (p.x - cam.x).toFixed(1) + 'px,0px,' + ez.toFixed(1) + 'px)';
        r.style.opacity = op.toFixed(3);
        r.style.visibility = op < 0.002 ? 'hidden' : 'visible';
        r.style.pointerEvents = op > 0.9 && Math.abs(ez) < 200 ? 'auto' : 'none';
        if (bl !== lastBlur[i]) { r.style.filter = bl > 0 ? 'blur(' + bl + 'px)' : 'none'; lastBlur[i] = bl; }
      });
      years.forEach(function (y, i) {
        var ez = YZ[i] + cam.z;
        var op = ez < -5200 ? 0 : ez < -2600 ? (ez + 5200) / 2600 : ez < -100 ? 1 : ez < 500 ? 1 - (ez + 100) / 600 : 0;
        y.style.transform = 'translate(-50%,-50%) translate3d(' + (YX[i] * vw - cam.x).toFixed(1) + 'px,-8vh,' + ez.toFixed(1) + 'px)';
        y.style.opacity = (op * 0.9).toFixed(3);
      });
      if (floor) floor.style.backgroundPosition = '0px ' + (cam.z * 0.3).toFixed(1) + 'px';
      var idx = clamp(Math.round(cam.z / D), 0, roles.length - 1);
      setYear(cam.z > (roles.length - 1) * D + 1000 ? YV[3] : YV[idx]);
      if (num) num.setAttribute('data-v', pad(idx + 1, 2) + ' / ' + pad(roles.length, 2));
    }
    var tl = gsap.timeline({
      onUpdate: render,
      scrollTrigger: { trigger: track, start: 'top top', end: 'bottom bottom', scrub: 1, onUpdate: function (s) { if (bar) bar.style.transform = 'scaleX(' + s.progress.toFixed(4) + ')'; } }
    });
    roles.forEach(function (r, i) {
      tl.to(cam, { z: i * D - 60, x: P[i].x, duration: 1, ease: 'power3.inOut' });
      tl.to(cam, { z: i * D + 60, duration: 0.9, ease: 'none' });
    });
    tl.to(cam, { z: (roles.length - 1) * D + 2600, x: 0, duration: 1.1, ease: 'power2.in' });
    W.on(W.win, 'resize', function () { layout(); render(); });
    setYear(YV[0]);
    render();
  }

  /* ---------- 05 SCHEMA: depth-scatter-assemble (golden-angle 3D cloud) ---------- */
  function stack(W) {
    var grid = W.$('.stack-grid'); if (!grid) return;
    var gsap = W.gsap, tags = W.$$('.tag', grid), btn = W.$('[data-rescatter]');
    if (!tags.length) return;
    function cloud() {
      var gr = grid.getBoundingClientRect(), n = tags.length;
      var cx = gr.left + gr.width / 2, cy = gr.top + Math.min(gr.height, W.win.innerHeight * 0.9) / 2;
      var R = Math.min(W.win.innerWidth * 0.3, 400);
      return tags.map(function (t, i) {
        var r = t.getBoundingClientRect(), a = i * GOLDEN, rad = R * (0.3 + 0.7 * Math.sqrt((i + 0.5) / n));
        return {
          x: cx + Math.cos(a) * rad - (r.left + r.width / 2),
          y: cy + Math.sin(a) * rad * 0.6 - (r.top + r.height / 2),
          z: 420 - (i / Math.max(1, n - 1)) * 980,
          rotationX: Math.sin(a) * 75, rotationY: Math.cos(a) * 75, opacity: 0
        };
      });
    }
    var busy = false;
    function assemble() {
      gsap.set(tags, { clearProps: 'transform' });
      var C = cloud();
      tags.forEach(function (t, i) { gsap.set(t, C[i]); });
      tags.forEach(function (t, i) {
        gsap.to(t, { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, opacity: 1, duration: 1.25, ease: 'power3.out', delay: 0.05 + i * 0.018, onComplete: i === tags.length - 1 ? function () { busy = false; } : null });
      });
    }
    gsap.set(tags, { opacity: 0 });
    W.ST.create({ trigger: grid, start: 'top 75%', once: true, onEnter: function () { busy = true; assemble(); } });
    if (btn) {
      W.on(btn, 'click', function () {
        if (busy) return; busy = true;
        var C = cloud();
        tags.forEach(function (t, i) {
          gsap.to(t, { x: C[i].x, y: C[i].y, z: C[i].z, rotationX: C[i].rotationX, rotationY: C[i].rotationY, opacity: 0, duration: 0.65, ease: 'power3.in', delay: (tags.length - i) * 0.006, onComplete: i === 0 ? assemble : null });
        });
      });
    }
  }

  /* ---------- 06 CHECKPOINT: CSS 3D tilt + holographic foil + ambient sheen ---------- */
  function certs(W) {
    var gsap = W.gsap, card = W.$('.cert-card');
    if (card) {
      var sheen = W.$('.cert-sheen', card);
      gsap.set(card, { rotationY: -55, rotationX: 18, autoAlpha: 0, y: 70 });
      var entered = false;
      W.ST.create({
        trigger: card, start: 'top 86%', once: true,
        onEnter: function () {
          var tl = gsap.timeline({ onComplete: function () { entered = true; } });
          tl.to(card, { rotationY: 0, rotationX: 0, autoAlpha: 1, y: 0, duration: 1.5, ease: 'expo.out' });
          if (sheen) tl.fromTo(sheen, { xPercent: 0 }, { xPercent: 560, duration: 1.3, ease: 'power2.inOut' }, 0.45);
        }
      });
      if (sheen) {
        var idle = gsap.timeline({ repeat: -1, repeatDelay: 4.5, paused: true });
        idle.fromTo(sheen, { xPercent: 0 }, { xPercent: 560, duration: 1.4, ease: 'power2.inOut' });
        W.ST.create({ trigger: card, start: 'top bottom', end: 'bottom top', onToggle: function (s) { if (s.isActive) idle.play(); else idle.pause(); } });
      }
      var rx = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3.out' });
      var ry = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3.out' });
      W.on(card, 'pointermove', function (e) {
        if (!entered) return;
        var r = card.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        rx((0.5 - py) * 18); ry((px - 0.5) * 24);
        card.style.setProperty('--hx', (px * 100).toFixed(1) + '%'); card.style.setProperty('--hy', (py * 100).toFixed(1) + '%');
        card.style.setProperty('--gx', (px * 100).toFixed(1) + '%'); card.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
      });
      W.on(card, 'pointerleave', function () { if (entered) { rx(0); ry(0); } });
      if (W.coarse) {
        W.loop(function (dt, time) {
          if (!entered) return;
          card.style.setProperty('--hx', (50 + Math.sin(time * 0.8) * 40).toFixed(1) + '%');
          card.style.setProperty('--hy', (50 + Math.cos(time * 0.6) * 40).toFixed(1) + '%');
        });
      }
    }
    var list = W.$('.cert-list');
    if (list) {
      var items = W.$$('li', list);
      gsap.set(items, { autoAlpha: 0, y: 34 });
      W.ST.create({ trigger: list, start: 'top 88%', once: true, onEnter: function () { gsap.to(items, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.08, ease: 'power4.out' }); } });
    }
  }

  /* ---------- 07 PUBLISH: waterfall-entry + chromatic-glitch emphasis burst ---------- */
  function writing(W) {
    var gsap = W.gsap, list = W.$('.posts'), posts = W.$$('.post');
    if (!list || !posts.length) return;
    gsap.set(posts, { autoAlpha: 0, yPercent: 120 });
    W.ST.create({
      trigger: list, start: 'top 84%', once: true,
      onEnter: function () {
        posts.forEach(function (p, i) {
          gsap.set(p, { autoAlpha: 1, delay: i * 0.06 });
          gsap.to(p, { yPercent: 0, duration: 0.85, delay: i * 0.06, ease: 'power4.out' });
        });
      }
    });
    posts.forEach(function (p) {
      var t = W.$('.post-t', p); if (!t) return;
      W.on(p, 'pointerenter', function () {
        var st = { a: 1 };
        gsap.to(st, {
          a: 0, duration: 0.34, ease: 'power3.in',
          onUpdate: function () {
            var q = Math.floor(gsap.ticker.time * 32), jx = (hash(q * 13) * 2 - 1) * 7 * st.a, jy = (hash(q * 29) * 2 - 1) * 2.5 * st.a;
            t.style.textShadow = jx.toFixed(1) + 'px ' + jy.toFixed(1) + 'px 0 rgba(255,77,109,.85),' + (-jx).toFixed(1) + 'px ' + (-jy).toFixed(1) + 'px 0 rgba(57,216,255,.85)';
          },
          onComplete: function () { t.style.textShadow = 'none'; }
        });
      });
    });
  }

  /* ---------- 08 OFFLINE: orbit-3d-entry + control-target-sync with the list ---------- */
  function beyond(W) {
    var orbit = W.$('.orbit'); if (!orbit) return;
    var gsap = W.gsap, sats = W.$$('.orb-sat', orbit), core = W.$('.orb-core', orbit), rings = W.$$('.orb-ring', orbit), likes = W.$$('.like');
    var st = { a: -Math.PI / 2, entry: 0 }, visible = false, entered = false, hold = -1;
    gsap.set(core, { scale: 0 });
    gsap.set(rings, { scale: 0.3, opacity: 0 });
    sats.forEach(function (s) { s.style.opacity = '0'; });
    W.ST.create({ trigger: orbit, start: 'top bottom', end: 'bottom top', onToggle: function (s) { visible = s.isActive; } });
    W.ST.create({
      trigger: orbit, start: 'top 78%', once: true,
      onEnter: function () {
        entered = true;
        var tl = gsap.timeline();
        tl.to(core, { scale: 1, duration: 1.1, ease: 'expo.out' }, 0);
        tl.to(rings, { scale: 1, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.12 }, 0.1);
        tl.to(st, { entry: 1, duration: 1.4, ease: 'power3.out' }, 0.3);
      }
    });
    W.loop(function (dt) {
      if (!visible || !entered) return;
      if (hold < 0) st.a += dt * 0.28;
      else {
        var target = Math.PI / 2 - hold * (Math.PI * 2 / sats.length);
        var diff = Math.atan2(Math.sin(target - st.a), Math.cos(target - st.a));
        st.a += diff * damp(dt, 0.02);
      }
      var r = orbit.clientWidth * 0.4, n = sats.length;
      sats.forEach(function (s, i) {
        var ang = st.a + i * (Math.PI * 2 / n), depth = Math.sin(ang);
        var x = Math.cos(ang) * r, y = depth * r * 0.36, sc = (0.72 + (depth + 1) * 0.2) * (0.4 + 0.6 * st.entry);
        s.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + sc.toFixed(3) + ') rotateY(' + ((1 - st.entry) * 90).toFixed(1) + 'deg)';
        s.style.opacity = (st.entry * (0.55 + (depth + 1) * 0.225)).toFixed(3);
        s.style.zIndex = depth > 0 ? '3' : '1';
      });
    });
    likes.forEach(function (l, i) {
      W.on(l, 'pointerenter', function () { hold = i; if (sats[i]) sats[i].classList.add('is-on'); });
      W.on(l, 'pointerleave', function () { hold = -1; if (sats[i]) sats[i].classList.remove('is-on'); });
    });
    gsap.set(likes, { autoAlpha: 0, x: -40 });
    W.ST.create({ trigger: W.$('.likes'), start: 'top 86%', once: true, onEnter: function () { gsap.to(likes, { autoAlpha: 1, x: 0, duration: 0.9, stagger: 0.1, ease: 'expo.out' }); } });
  }

  /* ---------- 09 SINK: 3d-text-depth-layers, light follows the pointer ---------- */
  function contact(W) {
    var gsap = W.gsap, d = W.$('.depth');
    if (d) {
      var layers = W.$$('.depth-l', d), front = W.$('.depth-f', d);
      var st = { p: 0, dx: 3, dy: 4, grow: 1 };
      var apply = function () {
        d.style.setProperty('--dx', (st.dx * st.p * st.grow).toFixed(2) + 'px');
        d.style.setProperty('--dy', (st.dy * st.p * st.grow).toFixed(2) + 'px');
      };
      gsap.set(layers, { opacity: 0 });
      gsap.set(front, { opacity: 0, y: 50 });
      apply();
      var inView = false;
      W.ST.create({ trigger: d, start: 'top bottom', end: 'bottom top', onToggle: function (s) { inView = s.isActive; } });
      W.ST.create({
        trigger: d, start: 'top 82%', once: true,
        onEnter: function () {
          var tl = gsap.timeline();
          tl.to(front, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, 0);
          tl.to(layers, { opacity: 1, duration: 0.45, stagger: 0.06, ease: 'power2.out' }, 0.1);
          tl.to(st, { p: 1, duration: 1, ease: 'power2.out', onUpdate: apply }, 0.1);
        }
      });
      W.ST.create({ trigger: d, start: 'top 90%', end: 'bottom 20%', scrub: 0.6, onUpdate: function (s) { st.grow = 0.7 + s.progress * 0.9; apply(); } });
      W.on(W.doc, 'pointermove', function (e) {
        if (!inView || e.pointerType === 'touch') return;
        var r = d.getBoundingClientRect();
        var nx = (e.clientX - (r.left + r.width / 2)) / Math.max(1, r.width), ny = (e.clientY - (r.top + r.height / 2)) / Math.max(1, r.height);
        gsap.to(st, { dx: clamp(-nx * 10, -5, 5), dy: clamp(-ny * 10 + 2, -5, 5), duration: 0.7, ease: 'power3.out', overwrite: 'auto', onUpdate: apply });
      }, { passive: true });
    }
    var chips = W.$$('.avail li'), reach = W.$('.reach'), line = W.$('.contact-line');
    var group = [line].concat(chips, [reach]).filter(Boolean);
    gsap.set(group, { autoAlpha: 0, y: 30 });
    W.ST.create({ trigger: W.$('.contact-grid'), start: 'top 90%', once: true, onEnter: function () { gsap.to(group, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.07, ease: 'power4.out' }); } });
  }

  global.AKMotion = { mount: mount, version: '1.0.0' };
})(typeof window !== 'undefined' ? window : this);
