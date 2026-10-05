/*!
 * AK Motion 1.1
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
  function mkProgram(gl, vs, fs) {
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader compile');
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'program link');
    return p;
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
      root.classList.remove('is-ww');
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

    var modules = [grain, cursor, fxLayer, magnets, hud, heroGL, hero, heads, about, portrait, dds, results, proofs, marquee, flight, stack, certs, writing, book, beyond, contact];
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
        W.dying = true;   // lets modules ignore the callbacks a revert fires on its way out
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
    // The palette follows the world the pointer is in: acid for the work, ember inside the book.
    var cols = ['#d4ff3f', '#eceae4', '#39d8ff', '#d4ff3f'], warm = ['#ff8a2b', '#f3ece2', '#ffc85a', '#ff8a2b'];
    W.ripple = function (x, y) { items.push({ k: 0, x: x, y: y, t: 0, life: 0.75, c: W.theme === 'ember' ? warm[0] : cols[0] }); };
    W.burst = function (x, y, n) {
      n = n || 36;
      var seed = x * 0.13 + y * 0.29, pal = W.theme === 'ember' ? warm : cols;
      for (var i = 0; i < n; i++) {
        var a = -Math.PI / 2 + (hash(seed + i * 5.1) * 2 - 1) * 1.3;
        var s = 360 + hash(seed + i * 7.3) * 640;
        items.push({ k: 1, x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: 1.1 + hash(seed + i * 3.3) * 0.7, sz: 4 + hash(seed + i * 9.1) * 8, spin: (hash(seed + i * 11.7) * 2 - 1) * 10, c: pal[i % pal.length] });
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
          g.globalAlpha = (1 - k) * 0.9; g.strokeStyle = it.c; g.lineWidth = 1.5;
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

  /* ---------- 08 OFFLINE · THE WAKING WORLDS ----------
   * The book gets a world of its own, apart from the work. Rules adapted here, none of them
   * used anywhere else on the page: theme-crossfade-morph, 3d-page-scroll, avatar-cloud-network,
   * card-morph-anchor, physics-press-reaction, multi-phase-camera, asr-keyword-glow,
   * coordinate-target-zoom, dynamic-content-sequencing, reactive-displacement,
   * scale-swap-transition, cursor-drag, sine-wave-loop, center-outward-expansion,
   * split-tilt-cards, spring-pop-entrance, nudge-curve.
   * Outside the rule library: a real CSS 3D hardcover, two fragment shaders (nebula and a
   * living cover) and a Canvas 2D ember field.
   */
  var QUAD_VS = 'attribute vec2 p;varying vec2 vUv;void main(){vUv=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';
  var GLSL_NOISE = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float vn(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}'
  ].join('\n');
  // FBM with domain warping. Cold and asleep until uWake, then an ember core blooms around the fire on the cover.
  var NEB_FS = [
    GLSL_NOISE,
    'uniform vec2 uRes;', 'uniform float uT;', 'uniform float uWake;', 'uniform vec2 uOrb;',
    'float fbm(vec2 p){float a=.5;float s=0.;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+vec2(11.7,5.3);a*=.5;}return s;}',
    'void main(){',
    '  vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;',
    '  float t=uT*.025;',
    '  vec2 q=vec2(fbm(p*1.5+vec2(0.,t)),fbm(p*1.5+vec2(5.2,1.3)-vec2(t*.7,0.)));',
    '  vec2 r=vec2(fbm(p*1.5+3.2*q+vec2(1.7,9.2)+t*.5),fbm(p*1.5+3.2*q+vec2(8.3,2.8)-t*.35));',
    '  float f=fbm(p*1.5+2.6*r);',
    '  vec3 col=vec3(.012,.016,.040);',
    '  col=mix(col,vec3(.045,.09,.24),smoothstep(.28,.82,f));',
    '  col=mix(col,vec3(.19,.10,.31),smoothstep(.5,1.05,length(q))*.6);',
    '  col+=vec3(.06,.11,.20)*r.y*r.y*r.y;',
    '  vec2 o=(uOrb-.5)*vec2(uRes.x/uRes.y,1.);',
    '  float d=length(p-o);',
    '  float core=exp(-d*d*2.6);',
    '  float cloud=smoothstep(.25,.9,f+.25*r.x);',
    '  col+=vec3(1.,.40,.10)*uWake*cloud*(.10+.75*core);',
    '  col+=vec3(1.,.72,.42)*uWake*core*core*.16;',
    '  col=mix(col,col*vec3(1.12,.96,.9),uWake*.5);',
    '  vec2 g=gl_FragCoord.xy/(uRes.y/170.);',
    '  vec2 id=floor(g);',
    '  float rnd=h21(id);',
    '  vec2 off=(vec2(h21(id+7.1),h21(id+3.7))-.5)*.7;',
    '  float sd=length(fract(g)-.5-off);',
    '  float tw=.55+.45*sin(uT*(1.2+rnd*3.)+rnd*40.);',
    '  col+=vec3(.85,.9,1.)*step(.965,rnd)*(1.-smoothstep(0.,.3,sd))*tw*(.35+.65*uWake)*(1.-.8*cloud*uWake);',
    '  col*=1.-.55*smoothstep(.45,1.15,length(p*vec2(.8,1.)));',
    '  gl_FragColor=vec4(col,1.);',
    '}'
  ].join('\n');
  // The cover as a living painting: asleep in cold grey until a wave of colour leaves the fire,
  // then heat haze, a flickering flame and slow starlight.
  var COVER_FS = [
    GLSL_NOISE,
    'uniform sampler2D uTex;', 'uniform float uT;', 'uniform float uWake;', 'uniform vec2 uPar;', 'uniform float uLit;',
    'varying vec2 vUv;',
    'float fbm(vec2 p){float a=.5;float s=0.;for(int i=0;i<3;i++){s+=a*vn(p);p=p*2.03+vec2(11.7,5.3);a*=.5;}return s;}',
    'void main(){',
    '  vec2 uv=vUv;',
    '  vec2 dv=(uv-vec2(.635,.825))*vec2(.6709,1.);',
    '  float d=length(dv);',
    '  float on=step(.0005,uWake);',
    '  float R=uWake*1.3;',
    '  float m=(1.-smoothstep(R-.24,R,d))*on;',
    '  float hz=exp(-d*d*30.)*m;',
    '  uv+=(vec2(vn(uv*vec2(14.,20.)+vec2(0.,-uT*1.7)),vn(uv*vec2(14.,20.)+vec2(7.3,-uT*1.4)))-.5)*.012*hz;',
    '  uv+=uPar*.01;',
    '  vec3 base=texture2D(uTex,uv).rgb;',
    '  float l=dot(base,vec3(.299,.587,.114));',
    '  vec3 asleep=vec3(l*.40,l*.44,l*.56)*.8;',
    '  vec3 col=mix(asleep,base,m);',
    '  float e=(d-R)*6.5;',
    '  float front=exp(-e*e)*on*(1.-smoothstep(.72,1.,uWake));',
    '  col+=vec3(1.,.52,.16)*front*(.55+.5*l);',
    '  float fl=fbm(vec2(dv.x*11.,dv.y*11.-uT*1.5));',
    '  col+=vec3(1.,.5,.12)*exp(-d*d*42.)*(.2+.6*fl)*m;',
    '  col+=base*vec3(1.,.62,.3)*exp(-d*d*5.)*.16*m*(.7+.3*sin(uT*2.3)+.4*(fl-.5));',
    '  float sky=1.-smoothstep(.15,.5,uv.y);',
    '  float tw=vn(uv*vec2(150.,224.)+uT*.7);',
    '  col+=base*smoothstep(.6,.92,l)*sky*(tw-.45)*.9*m;',
    '  col*=uLit;',
    '  gl_FragColor=vec4(col,1.);',
    '}'
  ].join('\n');

  function book(W) {
    var ww = W.$('.ww');
    if (!ww) return;
    var track = W.$('.ww-track', ww), pin = W.$('.ww-pin', ww);
    if (!track || !pin || !W.$('.ww-book', pin) || !W.$('.ww-zoom', pin) || !W.$('.ww-pan', pin)) return;
    // The motion layout only switches on once this module runs, so a failure leaves the readable static version.
    ww.classList.add('is-fx');
    W.cleanup(function () { ww.classList.remove('is-fx'); pin.style.clipPath = ''; track.style.height = ''; });
    try { bookWorld(W, ww, track, pin); }
    catch (err) { ww.classList.remove('is-fx'); pin.style.clipPath = ''; track.style.height = ''; throw err; }
  }

  function bookWorld(W, ww, track, pin) {
    var gsap = W.gsap, ST = W.ST, win = W.win, doc = W.doc;
    var q = function (s) { return W.$(s, pin); }, qa = function (s) { return W.$$(s, pin); };
    var zoomEl = q('.ww-zoom'), panEl = q('.ww-pan'), bookEl = q('.ww-book'), aura = q('.bk-aura'), leftCol = q('.ww-left');
    var shell = q('.bk-shell'), shellFaces = qa('.bk-shell > *'), lid = q('.bk-lid'), lidFaces = qa('.bk-lid > .bk-face');
    var front = q('.bk-front'), frontImg = q('.bk-front img'), glc = q('.bk-gl'), orbEl = q('.bk-orb'), sheen = q('.bk-sheen');
    var page = q('.bk-page'), roll = q('.pg-roll'), feed = q('.pg-feed'), sheetsWrap = q('.bk-sheets'), sheets = qa('.bk-sheets i');
    var neb = q('.ww-neb'), emb = q('.ww-emb'), shade2 = q('.ww-shade2');
    var chaps = qa('.ww-ch'), hint = q('.ww-hint'), hintLab = q('.ww-hint .rd');
    var lock = q('.ww-lock'), buy = q('.ww-buy'), grpA = q('.ww-grp-a'), grpB = q('.ww-grp-b'), lines = qa('.ww-lines li');
    var letters = qa('.ww-title .wl'), kick = q('.ww-kick'), by = q('.ww-by'), tag = q('.ww-tag');
    var fmts = qa('.ww-fmt'), facts = qa('.ww-facts li'), factsWrap = q('.ww-facts');
    var site = q('.ww-site'), siteMask = q('.ww-site-mask'), siteGlow = q('.ww-site-glow'), siteSweep = q('.ww-site-sweep');
    var moons = qa('.si-moon'), siWorld = q('.si-world');
    var moonRest = moons.map(function (m) { return m.getAttribute('transform'); });
    var bookwrap = q('.ww-bookwrap'), spineEl = q('.bk-spine'), edgeREl = q('.bk-edge-r'), hudEl = W.$('.hud');
    var netHubs = qa('.nt-h, .nt-t'), netNodes = qa('.nt-n'), netLines = qa('.nt-lf'), netHubLine = q('.nt-hub');
    if (!shell || !lid || !page) throw new Error('book markup incomplete');
    var DEG = Math.PI / 180;

    /* theme-crossfade-morph: the accent of the whole site re-skins while the HUD holds still.
       Registering the tokens as colours lets one CSS transition blend every accent at once. */
    [['--acid', '#d4ff3f'], ['--acid-hi', '#e6ff86']].forEach(function (d) {
      try { if (win.CSS && win.CSS.registerProperty) win.CSS.registerProperty({ name: d[0], syntax: '<color>', inherits: true, initialValue: d[1] }); } catch (e) {}
    });
    function setTheme(on) { W.root.classList.toggle('is-ww', on); W.theme = on ? 'ember' : ''; }
    ST.create({ trigger: ww, start: 'top 55%', end: 'bottom 88%', onToggle: function (s) { setTheme(s.isActive); } });
    W.cleanup(function () { setTheme(false); });

    /* dynamic-content-sequencing: each back-cover line earns scroll time from its own length */
    var UNIT = 72, cum = 4.05;
    var SEQ = lines.map(function (li) {
      var dur = 0.34 + (li.textContent || '').length * 0.0024, w = { start: cum, end: cum + dur };
      cum += dur; return w;
    });
    var T = { b: 0.95, c: 2.2, spin0: 2.6, spin1: 3.7, d: 4.0, e: cum, e2: cum + 0.28, buy: cum + 0.5, end: cum + 1.45 };
    track.style.height = Math.round(100 + T.end * UNIT) + 'vh';

    // One state object; the scrubbed timeline and the triggered beats write it, one loop reads it.
    var S = { ry: -14, rx: 4, pb: 0, cam: 0, lidA: -128, lidO: 0, sheet: 0, shell: 0, morph: 0, roll: 0,
      wake: 0, sq: 0, imp: 0, shake: 0, lift: 0, dragY: 0, dragX: 0, idle: 0 };
    var vw = 1, vh = 1, bw = 1, bh = 1, mob = false, K = [], rollD = 0, lockH = 0, buyH = 0, poseB = { ry: -20, rx: -17 };
    var endUp = 0, endDn = 0, colS = 1, siteH = 0, persp = 1700, EPS = 7, G = { ht: 1, hw: 1, hh: 1, bi: 0 }, sized = { w: -1, h: -1, r: 0 };
    var active = false, clock = 0, flatNow = 0, frame = 0, armed = false, lastT = 0, Q = 1, slow = 0, lastNow = 0;
    var C = { z: 1, fu: 0.5, fv: 0.5, ax: 0, ay: 0 }, last = {};
    var dragging = false, dragged = false, releasing = false, buyOn = false;

    /* ---- which faces point at the camera: worked out here, every frame, and written as opacity.
            The picture must not depend on the browser culling back faces. Some phone engines keep a
            canvas (or any child with its own layer) on screen after its parent has turned away, and
            the cover then shows through the book mirrored, turning against it. ---- */
    var faces = [
      { el: front, lid: 1 }, { el: q('.bk-inner'), lid: -1 },
      { el: q('.bk-back'), n: [0, 0, -1] }, { el: q('.bk-in2'), n: [0, 0, 1] },
      { el: spineEl, n: [-1, 0, 0] }, { el: edgeREl, n: [1, 0, 0] },
      { el: q('.bk-edge-t'), n: [0, -1, 0] }, { el: q('.bk-edge-b'), n: [0, 1, 0] }
    ].filter(function (f) { return !!f.el; });
    faces.forEach(function (f) { f.o = -1; f.d = 0; });
    var fcy = 1, fsy = 0, fcx = 1, fsx = 0, ftx = 0, fty = 0, fsq = 1, frontF = 1;
    // Positive when the printed side of a plane faces the camera. (nx, ny, nz) is its normal in book
    // space and d its distance from the book's centre; the pose comes from the loop below.
    function facing(nx, ny, nz, d) {
      var ax = nx * fcy + nz * fsy, az = nz * fcy - nx * fsy;      // rotateY
      var wy = ny * fcx - az * fsx, wz = ny * fsx + az * fcx;      // rotateX
      return persp * wz - ax * ftx - wy * fty - fsq * d;
    }

    /* ---- text panels: reactive-displacement. One driver per swap, the leaving panel is gone at 45% ---- */
    var panels = [], drivers = [];
    function addPanel(el, on, plain) {
      if (!el) return null;
      var p = { el: el, on: on, vis: false, y: 0, o: 0, r: 0, base: 0, gen: 0, cy: true, plain: !!plain };
      panels.push(p); return p;
    }
    // Hidden panels stay in the accessibility tree (opacity, never visibility), so a screen reader
    // gets the whole story in document order without having to scroll through the animation.
    function drawPanel(p) {
      var y = p.y + p.base;
      p.el.style.transform = 'translate3d(0,' + (p.cy ? 'calc(-50% + ' + y.toFixed(1) + 'px)' : y.toFixed(1) + 'px') + ',0)' + (p.r ? ' rotate(' + p.r.toFixed(2) + 'deg)' : '');
      p.el.style.opacity = p.o.toFixed(3);
      p.el.style.pointerEvents = p.o < 0.5 ? 'none' : 'auto';
    }
    addPanel(grpA, function (t) { return t < T.b; });
    addPanel(grpB, function (t) { return t >= T.b && t < T.c; });
    var pLock = addPanel(lock, function (t) { return (t >= T.c && t < T.d) || t >= T.e2; });
    lines.forEach(function (li, i) {
      var w = SEQ[i], lastOne = i === lines.length - 1;
      addPanel(li, function (t) { return t >= w.start && t < (lastOne ? T.e : w.end); });
    });
    var pBuy = addPanel(buy, function (t) { return t >= T.buy; }, true);
    var GAP = 26, GAPM = 18;
    // A wide screen centres lockup and editions as one group (a little lower, endDn, if the nav is in the way).
    // A phone stacks them under the book, and when the stack is taller than its column the lockup moves up by
    // the difference (endUp) and the book gives way.
    function lockUp() { return mob ? -endUp : endDn - (buyH + GAP) / 2; }
    function placeBases() {
      if (pBuy) pBuy.base = mob ? lockH + GAPM - endUp : endDn + (lockH + GAP) / 2;
      if (pLock) { gsap.killTweensOf(pLock, 'base'); pLock.base = buyOn ? lockUp() : 0; }
      drawHint();
    }
    function syncPanels(t, dir, instant) {
      var ins = [], outs = [];
      panels.forEach(function (p) {
        var want = p.on(t);
        if (want !== p.vis) { p.vis = want; p.gen++; (want ? ins : outs).push(p); }
      });
      if (!ins.length && !outs.length) return;
      var sign = dir < 0 ? -1 : 1, dist = mob ? 44 : 84;
      var gi = ins.map(function (p) { return p.gen; }), go = outs.map(function (p) { return p.gen; });
      var o0 = outs.map(function (p) { return p.o; }), y0 = outs.map(function (p) { return p.y; });
      function step(k) {
        var kc = Math.max(0, k), vk = Math.min(1, kc / 0.45), i, p;
        for (i = 0; i < ins.length; i++) {
          p = ins[i]; if (p.gen !== gi[i]) continue;
          if (p.plain) { p.y = 0; p.o = 1; p.r = 0; }
          else { p.y = sign * dist * (1 - k); p.o = Math.min(1, kc * 4); p.r = mob ? 0 : -sign * 1.4 * (1 - k); }
          drawPanel(p);
        }
        for (i = 0; i < outs.length; i++) {
          p = outs[i]; if (p.gen !== go[i]) continue;
          p.y = y0[i] + (-sign * dist * 0.8 - y0[i]) * vk; p.o = o0[i] * (1 - vk); p.r = mob ? 0 : sign * 1.8 * vk;
          drawPanel(p);
        }
      }
      step(instant ? 1 : 0);
      if (!instant) {
        var d = { k: 0 };
        drivers.push(d);
        gsap.to(d, { k: 1, duration: 0.85, ease: 'back.out(1.5)', onUpdate: function () { step(d.k); }, onComplete: function () { var i = drivers.indexOf(d); if (i >= 0) drivers.splice(i, 1); } });
      }
      if (pBuy && ins.indexOf(pBuy) >= 0) buyIn(instant);
      if (pBuy && outs.indexOf(pBuy) >= 0) buyOut(instant);
    }

    /* ---- sequential reveals inside a panel (the origin story arrives one sentence at a time) ---- */
    var reveals = [];
    function addReveal(el, at) { reveals.push({ el: el, at: at, on: false }); el.style.opacity = '0'; }
    if (grpA) W.$$('p', grpA).forEach(function (p, i) { addReveal(p, [-1, 0.3, 0.6][i] || 0); });
    if (grpB) W.$$('p', grpB).forEach(function (p, i) { addReveal(p, T.b + ([0, 0.38, 0.8][i] || 0)); });
    gsap.set(reveals.map(function (r) { return r.el; }), { y: 16 });
    function syncReveals(t, instant) {
      reveals.forEach(function (r) {
        var want = t >= r.at; if (want === r.on) return; r.on = want;
        gsap.to(r.el, { opacity: want ? 1 : 0, y: want ? 0 : 16, duration: instant ? 0 : (want ? 0.7 : 0.25), ease: 'power3.out', overwrite: true });
      });
    }

    /* ---- chapter label: scale-swap-transition (shrink out fast, pop in with weight) ---- */
    var chapNow = -1;
    function setChap(k, instant) {
      if (k === chapNow) return;
      var prev = chaps[chapNow], next = chaps[k]; chapNow = k;
      if (prev) gsap.to(prev, { scale: 0.7, opacity: 0, duration: instant ? 0 : 0.3, ease: 'power2.in', overwrite: true });
      if (next) gsap.fromTo(next, { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: instant ? 0 : 0.55, delay: instant ? 0 : 0.18, ease: 'back.out(1.8)', overwrite: true });
    }

    /* ---- the wake: asr-keyword-glow. One linear driver, an attack / sustain / release envelope per letter ---- */
    var WAKE = 2.4, ATTACK = 0.06, RELEASE = 0.5, REST = 0.2;
    var LT = letters.map(function (el, i) { var s = 0.2 + i * 0.085; return { el: el, start: s, end: s + 0.075 }; });
    var subs = [{ el: kick, at: 0.05 }, { el: by, at: 1.62 }, { el: tag, at: 2.0 }].filter(function (s) { return !!s.el; });
    subs.forEach(function (s) { s.on = false; });
    gsap.set(subs.map(function (s) { return s.el; }), { opacity: 0, y: 14 });
    function env(time, s, e) {
      if (time < s) return 0;
      if (time < e) return Math.min((time - s) / ATTACK, 1);
      if (time < e + RELEASE) return 1 - ((time - e) / RELEASE) * (1 - REST);
      return REST;
    }
    function applyWake() {
      var time = S.wake * WAKE;
      for (var i = 0; i < LT.length; i++) {
        var L = LT[i], e = env(time, L.start, L.end), lit = time >= L.start;
        // karaoke style: dim before its beat, flame at the peak, warm silver at rest
        L.el.style.color = lit ? 'rgb(' + Math.round(lerp(229, 255, e)) + ',' + Math.round(lerp(224, 212, e)) + ',' + Math.round(lerp(214, 150, e)) + ')' : 'rgb(58,63,74)';
        L.el.style.textShadow = e > 0.001 ? '0 0 ' + (36 * e).toFixed(1) + 'px rgba(255,138,43,' + (0.18 + 0.72 * e).toFixed(2) + ')' : 'none';
        L.el.style.transform = 'scale(' + (1 + 0.2 * Math.max(0, e - REST) / (1 - REST)).toFixed(3) + ')';
      }
      subs.forEach(function (s) {
        var want = time >= s.at; if (want === s.on) return; s.on = want;
        gsap.to(s.el, { opacity: want ? 1 : 0, y: want ? 0 : 14, duration: want ? 0.7 : 0.2, ease: 'power3.out', overwrite: true });
      });
      bookEl.style.setProperty('--wk', S.wake.toFixed(3));
      // once it is fully awake the cover images need no filter at all (one less layer per face for a phone to juggle)
      var awake = S.wake > 0.999;
      if (awake !== awakeNow) { awakeNow = awake; bookEl.classList.toggle('is-awake', awake); }
    }
    var wakeOn = false, wakeTw = null, awakeNow = false;
    function setWake(on, instant) {
      if (on === wakeOn) return; wakeOn = on;
      if (wakeTw) wakeTw.kill();
      var dur = instant ? 0 : (on ? WAKE * (1 - S.wake) : 0.45 * S.wake + 0.05);
      wakeTw = gsap.to(S, { wake: on ? 1 : 0, duration: dur, ease: 'none', onUpdate: applyWake, onComplete: applyWake });
      gsap.to(S, { idle: on ? 1 : 0, duration: instant ? 0 : 1.4, ease: 'power2.out', overwrite: 'auto' });
    }

    /* ---- the thud: physics-press-reaction. Cover and block compress together, then spring back ---- */
    function thud() {
      gsap.killTweensOf(S, 'sq,imp,shake');
      gsap.timeline().to(S, { sq: 1, duration: 0.09, ease: 'power1.in' }).to(S, { sq: 0, duration: 0.6, ease: 'back.out(2)' });
      gsap.fromTo(S, { imp: 1 }, { imp: 0, duration: 0.9, ease: 'power2.out' });
      gsap.fromTo(S, { shake: 1 }, { shake: 0, duration: 0.5, ease: 'power2.out' });
      sparks(W.coarse ? 28 : 46);
    }

    /* ---- the editions: center-outward-expansion out of the book, landing as split-tilt-cards;
            the lockup makes room with a nudge-curve, the facts arrive as spring-pop-entrance ---- */
    var FM = fmts.map(function (el, i) { return { el: el, k: 0, hov: 0, dx: 0, dy: 0, tilt: fmts.length === 3 ? (1 - i) * 13 : 0 }; });
    var buyD = { p: 0 };
    function drawFmt(f) {
      var bob = buyD.p * Math.sin(clock * 1.4 + (f.tilt ? 0 : Math.PI)) * 3 * (1 - f.hov), k = f.k;
      f.el.style.transform = 'translate3d(' + (f.dx * (1 - k)).toFixed(1) + 'px,' + (f.dy * (1 - k) + bob).toFixed(1) + 'px,0) rotateY(' + (f.tilt * k * (1 - f.hov)).toFixed(2) + 'deg) scale(' + (0.3 + 0.7 * k + 0.04 * f.hov).toFixed(3) + ')';
      f.el.style.opacity = Math.min(1, k * 2.5).toFixed(3);
    }
    function nudge(on, instant) {
      if (!pLock) return;
      var to = on ? lockUp() : 0, from = pLock.base, d = to - from;
      var draw = function () { drawPanel(pLock); drawHint(); };
      gsap.killTweensOf(pLock, 'base');
      if (instant || Math.abs(d) < 1) { pLock.base = to; draw(); return; }
      if (!on) { gsap.to(pLock, { base: to, duration: 0.45, ease: 'power3.out', onUpdate: draw }); return; }
      // slow, fast, slow: 10 / 65 / 25 of the distance over 20 / 18 / 62 of the time
      var D = 0.9;
      gsap.timeline({ onUpdate: draw })
        .to(pLock, { base: from + d * 0.10, duration: D * 0.20, ease: 'power3.in' })
        .to(pLock, { base: from + d * 0.75, duration: D * 0.18, ease: 'none' })
        .to(pLock, { base: to, duration: D * 0.62, ease: 'power4.out' });
    }
    function buyIn(instant) {
      buyOn = true;
      // the cards fly out of the book where it rests in this scene (the column may be scaled to fit a short screen)
      var end = K[K.length - 1], pr = pin.getBoundingClientRect(), cx = pr.left + vw / 2 + end.ax * vw, cy = pr.top + vh / 2 + end.ay * vh;
      FM.forEach(function (f) {
        f.el.style.transform = 'none';
        var r = f.el.getBoundingClientRect();
        f.dx = (cx - (r.left + r.width / 2)) / colS; f.dy = (cy - (r.top + r.height / 2)) / colS; f.k = 0;
      });
      gsap.killTweensOf(buyD); buyD.p = 0;
      gsap.to(buyD, { p: 1, duration: instant ? 0 : 1.15, ease: 'power3.out', onUpdate: function () {
        FM.forEach(function (f, i) { f.k = clamp((buyD.p - i * 0.05) / 0.9, 0, 1); });
      } });
      gsap.fromTo(facts, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: instant ? 0 : 0.55, ease: 'power3.out', stagger: instant ? 0 : 0.06, delay: instant ? 0 : 0.5, overwrite: true });
      siteIn(instant);
      nudge(true, instant);
    }
    function buyOut(instant) {
      buyOn = false; gsap.killTweensOf(buyD);
      gsap.killTweensOf([siteD, glowD, sweepD]);
      nudge(false, instant);
    }

    /* ---- the book's own site. anchored-layout-expand: the row of editions is the pinned header, the
            button is the sheet that slides out from under it, and the facts below ride the same proxy, so
            the seam between them never opens. ambient-glow-bloom lands on the same beat (one bloom, a slow
            breathe, one sweep of light across the surface), and svg-icon-enrichment keeps its small world
            turning: a moon on a tilted orbit, passing behind the planet and in front of it. ---- */
    var GLOW = 0.3, siteD = { g: 1 }, glowD = { o: 0, s: 0.86 }, sweepD = { p: 0 }, orbD = { v: 1 }, orbA = 0.6;
    function drawSite() {
      var y = (-(1 - siteD.g) * siteH).toFixed(1);
      if (site) site.style.transform = 'translate3d(0,' + y + 'px,0)';
      if (factsWrap) factsWrap.style.transform = 'translate3d(0,' + y + 'px,0)';
    }
    function drawSweep() {
      if (!siteSweep) return;
      siteSweep.style.transform = 'translate3d(' + (-120 + sweepD.p * 540).toFixed(1) + '%,0,0)';
      siteSweep.style.opacity = (Math.sin(Math.PI * sweepD.p) * 0.9).toFixed(3);
    }
    function sweep(delay) {   // one pass, constant glide, never a loop
      if (!siteSweep) return;
      gsap.killTweensOf(sweepD); sweepD.p = 0;
      gsap.to(sweepD, { p: 1, duration: 0.95, delay: delay || 0, ease: 'none', onUpdate: drawSweep, onComplete: drawSweep });
    }
    function siteIn(instant) {
      if (!site) return;
      gsap.killTweensOf([siteD, glowD, sweepD]);
      sweepD.p = 0; drawSweep();
      if (instant) { siteD.g = 1; glowD.o = GLOW; glowD.s = 1; drawSite(); return; }
      siteD.g = 0; glowD.o = 0; glowD.s = 0.86; drawSite();
      // the cause of the growth is the last card landing; the glow resolves with the button, as one beat
      gsap.to(siteD, { g: 1, duration: 0.55, delay: 0.8, ease: 'power3.out', onUpdate: drawSite, onComplete: drawSite });
      gsap.to(glowD, { o: GLOW, s: 1, duration: 0.62, delay: 0.8, ease: 'power2.out' });
      sweep(1.3);
    }
    if (site && !W.coarse) {
      W.on(site, 'pointerenter', function () { gsap.to(orbD, { v: 3, duration: 0.4, ease: 'power2.out', overwrite: true }); if (siteD.g > 0.99) sweep(0); });
      W.on(site, 'pointerleave', function () { gsap.to(orbD, { v: 1, duration: 1.1, ease: 'power2.out', overwrite: true }); });
    }
    function runSite(dt) {   // called from the loop while the editions are on stage
      if (siteGlow) {
        var b = Math.sin(clock * 1.85);   // one breath in about 3.4 s, a hair around the peak
        siteGlow.style.opacity = (glowD.o * (1 + 0.12 * b)).toFixed(3);
        siteGlow.style.transform = 'scale(' + (glowD.s * (1 + 0.018 * b)).toFixed(4) + ')';
      }
      if (!moons.length) return;
      orbA += dt * 1.9 * orbD.v;
      var mx = (21 * Math.cos(orbA)).toFixed(2), my = (7.5 * Math.sin(orbA)).toFixed(2), frontHalf = Math.sin(orbA) >= 0;
      for (var i = 0; i < moons.length; i++) {
        // two moons, one drawn before the planet and one after it: only the one on the right side of the planet shows
        var isFront = moons[i].classList.contains('si-moon-f');
        moons[i].setAttribute('transform', 'translate(' + mx + ' ' + my + ')');
        moons[i].style.opacity = isFront === frontHalf ? '1' : '0';
      }
      // pulse: the planet breathes, slower than its moon turns (an attribute transform, so the centre is explicit)
      if (siWorld) siWorld.setAttribute('transform', 'translate(24 24) scale(' + (1 + Math.sin(clock * 1.3) * 0.045).toFixed(4) + ') translate(-24 -24)');
    }
    FM.forEach(function (f) {
      W.on(f.el, 'pointerenter', function () { gsap.to(f, { hov: 1, duration: 0.35, ease: 'power3.out', overwrite: true }); });
      W.on(f.el, 'pointerleave', function () { gsap.to(f, { hov: 0, duration: 0.6, ease: 'power3.out', overwrite: true }); });
    });
    // Keyboard: tabbing onto an edition link while it is still off stage brings its scene to the reader.
    if (buy) W.on(buy, 'focusin', function () {
      if (pBuy && pBuy.vis) return;
      var r = track.getBoundingClientRect(), y = r.top + (win.scrollY || 0) + (r.height - vh) * Math.min(1, (T.buy + 0.7) / T.end);
      win.scrollTo(0, y);
    });

    /* ---- hint ---- */
    var hintOn = false;
    if (hintLab && W.coarse) hintLab.setAttribute('data-v', 'Swipe the book to turn it');
    function setHint(on) {
      if (!hint || on === hintOn) return; hintOn = on;
      gsap.to(hint, { opacity: on ? 1 : 0, duration: 0.5, overwrite: true });
    }
    // on a phone the hint sits between the book and the lockup, so it travels with the lockup
    function drawHint() {
      if (hint) hint.style.transform = (mob && pLock && pLock.base) ? 'translate3d(0,' + pLock.base.toFixed(1) + 'px,0)' : '';
    }

    /* ---- the server: avatar-cloud-network. Two members; one of them played everybody, the other played one ---- */
    var netEls = netHubs.concat(netNodes), netIned = false;
    gsap.set(netEls, { scale: 0, opacity: 0, transformOrigin: '50% 50%' });
    netLines.concat(netHubLine ? [netHubLine] : []).forEach(function (l) {
      var len = Math.hypot(l.x2.baseVal.value - l.x1.baseVal.value, l.y2.baseVal.value - l.y1.baseVal.value);
      l.style.strokeDasharray = len.toFixed(1) + ' ' + len.toFixed(1); l.style.strokeDashoffset = len.toFixed(1);
    });
    function netIn() {
      if (netIned) return; netIned = true;
      var tl = gsap.timeline();
      tl.to(netHubs, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.6)', stagger: 0.04 }, 0);
      if (netHubLine) tl.to(netHubLine, { strokeDashoffset: 0, duration: 0.5, ease: 'power2.out' }, 0.25);
      tl.to(netNodes, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.7)', stagger: 0.08 }, 0.4);
      tl.to(netLines, { strokeDashoffset: 0, duration: 0.5, ease: 'power2.out', stagger: 0.035 }, 0.4 + Math.max(0, netNodes.length - 1) * 0.08 - 0.15);
    }
    ST.create({ trigger: ww, start: 'top 40%', once: true, onEnter: netIn });

    /* ---- layout: everything the camera needs is measured here, never per frame ---- */
    // the largest book that sits between two heights of the pin, centred between them (a tilted book is a touch taller than its box)
    function fitBook(top, bot) {
      return { z: clamp((bot - top) / (bh * 1.06), 0.4, 1), fu: 0.5, fv: 0.5, ax: 0, ay: ((top + bot) / 2) / vh - 0.5 };
    }
    function layout() {
      vw = pin.clientWidth || win.innerWidth; vh = pin.clientHeight || win.innerHeight;
      bw = bookEl.offsetWidth || 1; bh = bookEl.offsetHeight || 1;
      mob = (win.getComputedStyle(ww).getPropertyValue('--mob') || '').trim() === '1';
      // classes rather than media queries: the pin keeps its height while a phone's toolbar comes and goes, a media query does not
      var short = vh < 700;
      ww.classList.toggle('is-short', short);
      ww.classList.remove('is-tight');
      if (leftCol) leftCol.style.transform = '';
      var gut = leftCol ? leftCol.offsetLeft : 24, colW = leftCol ? leftCol.offsetWidth : 0;
      var hx = mob ? 0 : clamp(((gut + colW + 40 + vw - gut) / 2) / vw - 0.5, 0.15, 0.26);
      lockH = lock ? lock.offsetHeight : 0; buyH = buy ? buy.offsetHeight : 0;
      siteH = siteMask ? siteMask.offsetHeight : 0;
      var hA = grpA ? grpA.offsetHeight : 0, hB = grpB ? grpB.offsetHeight : 0;
      var home, home5;
      var hudB = hudEl ? hudEl.offsetHeight - (parseFloat(win.getComputedStyle(hudEl).paddingBottom) || 0) : 60;   // where the nav ends
      endUp = 0; endDn = 0; colS = 1;
      if (mob) {
        // Phone column, measured rather than assumed. The words start where their longest scene still fits,
        // the book takes what is left under the nav, and in the last scene, where editions and the site button
        // join the lockup, whatever does not fit moves the lockup up while the book makes room.
        var PADB = 14, topY = short ? hudB + 8 : 92;
        var ct = Math.round(Math.max(0.34 * vh, Math.min(0.53 * vh, vh - PADB - Math.max(hA, hB, lockH))));
        ww.style.setProperty('--ct', ct + 'px');
        var colH = vh - PADB - ct;
        home = fitBook(topY, ct - 28);
        endUp = Math.max(0, lockH + GAPM + buyH - colH);
        home5 = fitBook(topY, ct - endUp - 28);
        if (home5.z < 0.8 && factsWrap) {
          // no room left for the book: the three facts step aside (screen readers still get them)
          ww.classList.add('is-tight');
          buyH = buy ? buy.offsetHeight : 0;
          endUp = Math.max(0, lockH + GAPM + buyH - colH);
          home5 = fitBook(topY, ct - endUp - 28);
        }
      } else {
        ww.style.removeProperty('--ct');
        home = { z: 1, fu: 0.5, fv: 0.5, ax: hx, ay: 0.005 };
        home5 = home;
        // The last scene is the tall one: lockup, editions, site button, facts. It has to clear the nav above
        // and the edge below. On a short screen the group first lets the three facts go, then sits lower than
        // centre, and only then does the whole column scale down (a phone on its side).
        var fitS = function () {
          return clamp(Math.min((vh - hudB - 24) / Math.max(1, lockH + GAP + buyH), (vh - 2 * hudB - 16) / Math.max(1, hA, hB)), 0.5, 1);
        };
        colS = fitS();
        if (colS < 0.86 && factsWrap) { ww.classList.add('is-tight'); buyH = buy ? buy.offsetHeight : 0; colS = fitS(); }
        if (leftCol && colS < 0.999) leftCol.style.transform = 'scale(' + colS.toFixed(4) + ')';
        endDn = Math.max(0, (hudB + 10 - vh / 2) / colS + (lockH + GAP + buyH) / 2);
      }
      var zf = (mob ? Math.min(0.9 * vw / 0.6709, 0.6 * vh) : 0.84 * vh) / bh;
      var full = { z: zf, fu: 0.5, fv: 0.5, ax: mob ? 0 : Math.max(0.13, hx - 0.04), ay: mob ? -0.085 : 0.03 };
      var zd = (mob ? 1.2 : 1.75) * vh / bh, wc = zd * bw;
      // inside the cover the painting should run off the right edge of the screen, whatever the aspect ratio
      var edge = function (fu) { return clamp((vw + 24 - (1 - fu) * wc) / vw - 0.5, 0.14, 0.3); };
      var woman = { z: zd, fu: 0.57, fv: mob ? 0.43 : 0.42, ax: mob ? 0 : edge(0.57), ay: mob ? -0.2 : -0.04 };
      var orb = { z: zd, fu: mob ? 0.62 : 0.635, fv: 0.825, ax: mob ? 0 : edge(0.635), ay: mob ? -0.14 : 0.2 };
      K = [home, full, woman, orb, full, home5];
      // While the book is assembled its pages swing in from the left. If they would cross the text,
      // the book turns the other way and they arrive from the front instead.
      var textR = gut + (grpB ? grpB.offsetWidth : colW) * colS + 16;
      poseB = (mob || vw / 2 + hx * vw - 1.4 * bw >= textR) ? { ry: -20, rx: -17 } : { ry: 36, rx: -16 };
      rollD = Math.max(0, (roll ? roll.scrollHeight : 0) - (feed ? feed.clientHeight : 0));
      // the solid the face test works on: half thickness, half width, half height, and the inset of the page block
      G.ht = (spineEl ? spineEl.offsetWidth : bh * 0.1112) / 2; G.hw = bw / 2; G.hh = bh / 2; G.bi = edgeREl ? edgeREl.offsetTop : bh * 0.012;
      persp = parseFloat(win.getComputedStyle(bookwrap || pin).perspective) || 1700; EPS = persp * 0.004;
      faces.forEach(function (f) {
        f.o = -1;
        if (f.n) f.d = f.n[2] < 0 ? G.ht : f.n[2] > 0 ? 1 - G.ht : f.n[0] < 0 ? G.hw : f.n[0] > 0 ? G.hw - G.bi : G.hh - G.bi;
      });
      panels.forEach(function (p) { p.cy = !mob; });
      placeBases();
      panels.forEach(drawPanel);
      drawSite();
      last = {};
    }
    function camAt(c) {
      var i = clamp(Math.floor(c), 0, K.length - 2), f = clamp(c - i, 0, 1), a = K[i], b = K[i + 1];
      C.z = a.z * Math.pow(b.z / a.z, f); C.fu = lerp(a.fu, b.fu, f); C.fv = lerp(a.fv, b.fv, f); C.ax = lerp(a.ax, b.ax, f); C.ay = lerp(a.ay, b.ay, f);
    }
    // 0 while the book is an object in space, 1 while the camera is inside the painting
    function flatness(c) { return c < 2 ? smooth(1.05, 1.6, c) : 1 - smooth(3.4, 3.95, c); }

    /* ---- nebula: fragment shader behind everything ---- */
    var nebGL = null, nebU = {}, nebOK = false;
    function fullQuad(gl, prog) {
      var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.useProgram(prog);
    }
    function lose(gl) { try { var x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (e) {} }
    function sizeNeb() {
      if (!nebGL) return;
      var s = (W.coarse ? 0.42 : 0.5) * Math.min(win.devicePixelRatio || 1, 1.25) * Q;
      neb.width = Math.max(2, Math.round(vw * s)); neb.height = Math.max(2, Math.round(vh * s));
      nebGL.viewport(0, 0, neb.width, neb.height);
    }
    function setupNeb(gl) {
      var prog = mkProgram(gl, QUAD_VS, NEB_FS);
      fullQuad(gl, prog);
      ['uRes', 'uT', 'uWake', 'uOrb'].forEach(function (n) { nebU[n] = gl.getUniformLocation(prog, n); });
    }
    function initNeb() {
      if (!neb) return;
      var gl = null;
      try { gl = neb.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' }); } catch (e) { gl = null; }
      if (!gl) return;
      try { setupNeb(gl); } catch (err) { if (win.console) console.warn('[ak] nebula shader', err); return; }
      nebGL = gl; nebOK = true;
      // a phone can drop the context in the background; rebuild it when it comes back
      W.on(neb, 'webglcontextlost', function (e) { e.preventDefault(); nebOK = false; });
      W.on(neb, 'webglcontextrestored', function () { try { setupNeb(gl); sizeNeb(); nebOK = true; } catch (err) { nebOK = false; } });
      W.cleanup(function () { lose(gl); });
      sizeNeb();
    }
    function renderNeb(ox, oy) {
      // half rate is plenty for slow clouds; skipped while the painting covers the screen
      if (!nebOK || (frame & 1) || (S.cam > 1.6 && S.cam < 3.4)) return;
      var gl = nebGL;
      gl.uniform2f(nebU.uRes, neb.width, neb.height);
      gl.uniform1f(nebU.uT, clock);
      gl.uniform1f(nebU.uWake, S.wake);
      gl.uniform2f(nebU.uOrb, ox, oy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    /* ---- living cover: the front cover runs through a fragment shader ---- */
    var cvGL = null, cvU = {}, cvOK = false, cvW = 0, parX = 0, parY = 0;
    function setupCover(gl) {
      var prog = mkProgram(gl, QUAD_VS, COVER_FS);
      // Power-of-two copy so the texture can carry mipmaps: sharp inside the painting, calm when small.
      var maxT = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 1024, big = maxT >= 2048;
      var oc = doc.createElement('canvas'); oc.width = (big && !W.coarse) ? 2048 : 1024; oc.height = big ? 2048 : 1024;
      oc.getContext('2d').drawImage(frontImg, 0, 0, oc.width, oc.height);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, oc);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      fullQuad(gl, prog);
      ['uTex', 'uT', 'uWake', 'uPar', 'uLit'].forEach(function (n) { cvU[n] = gl.getUniformLocation(prog, n); });
      gl.uniform1i(cvU.uTex, 0);
    }
    function initCover() {
      if (!glc || !frontImg || !front) return;
      function go() {
        if (cvGL) return;
        var gl = null;
        try { gl = glc.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false }); } catch (e) { gl = null; }
        if (!gl) return;
        // any failure here (no WebGL, a tainted image, a bad driver) leaves the plain cover image in place
        try { setupCover(gl); } catch (err) { if (win.console) console.warn('[ak] cover shader', err); lose(gl); return; }
        cvGL = gl; cvOK = true; cvW = 0;
        front.classList.add('is-gl');
        W.on(glc, 'webglcontextlost', function (e) { e.preventDefault(); cvOK = false; front.classList.remove('is-gl'); });
        W.on(glc, 'webglcontextrestored', function () { try { setupCover(gl); cvW = 0; cvOK = true; front.classList.add('is-gl'); } catch (err) { cvOK = false; } });
        W.cleanup(function () { front.classList.remove('is-gl'); lose(gl); });
      }
      if (frontImg.complete && frontImg.naturalWidth) go(); else W.on(frontImg, 'load', go);
    }
    function renderCover(a) {
      // nothing to draw while the cover points away (it starts again a few degrees before it turns back into view)
      if (!cvOK || frontF < -0.06 * persp || S.lidO < 0.01) return;
      // the backing store follows the size on screen (never past the artwork), with a little supersampling
      var gl = cvGL, cap = Math.round(1536 * Q), need = clamp(bw * Math.min(win.devicePixelRatio || 1, 2) * C.z * 1.35, 320, cap), resized = false;
      if (need > cvW * 1.02 || need < cvW * 0.5) {
        cvW = Math.min(cap, Math.ceil(need * 1.15));
        glc.width = cvW; glc.height = Math.round(cvW / 0.6709);
        gl.viewport(0, 0, glc.width, glc.height);
        resized = true;
      }
      // a large canvas only redraws on the frames the nebula skips
      if (!resized && cvW > 900 && !(frame & 1)) return;
      gl.uniform1f(cvU.uT, clock);
      gl.uniform1f(cvU.uWake, S.wake);
      gl.uniform2f(cvU.uPar, parX, parY);
      gl.uniform1f(cvU.uLit, 0.82 + 0.18 * Math.cos(a * Math.PI / 180) + 0.5 * S.imp);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    /* ---- embers: Canvas 2D, additive. They rise from the fire on the cover, and burst at the thud ---- */
    var eg = null, edpr = 1, parts = [], seedN = 1, emitAcc = 0, embDirty = false;
    try { eg = emb ? emb.getContext('2d') : null; } catch (e) { eg = null; }
    function rnd() { seedN += 1; return hash(seedN * 1.618); }
    function sizeEmb() {
      if (!eg) return;
      edpr = Math.min(win.devicePixelRatio || 1, 2);
      emb.width = Math.max(2, Math.round(vw * edpr)); emb.height = Math.max(2, Math.round(vh * edpr));
    }
    function sparks(n) {
      if (!eg) return;
      var br = bookEl.getBoundingClientRect(), pr = pin.getBoundingClientRect();
      var cx = br.left + br.width / 2 - pr.left, cy = br.top + br.height / 2 - pr.top;
      for (var i = 0; i < n; i++) {
        var ang = rnd() * 6.2832, ex = Math.cos(ang), ey = Math.sin(ang);
        var k = Math.min(br.width / 2 / Math.max(0.001, Math.abs(ex)), br.height / 2 / Math.max(0.001, Math.abs(ey))) * 0.9;
        var sp = 140 + rnd() * 420;
        parts.push({ x: cx + ex * k, y: cy + ey * k, vx: ex * sp, vy: ey * sp - 60, t: 0, life: 0.5 + rnd() * 0.7, sz: 1.2 + rnd() * 2.2, g: 380, drag: 2.2, w: -1 });
      }
    }
    function emit(dt, a, ox, oy) {
      if (S.wake < 0.2 || frontF < 0.2 * persp || S.lidO < 0.5) return;
      if (ox < -40 || ox > vw + 40 || oy < -40 || oy > vh + 40) return;
      emitAcc += (W.coarse ? 16 : 30) * Q * S.wake * (0.6 + 0.4 * flatNow) * dt;
      var zs = Math.sqrt(C.z), R = bh * 0.045 * C.z, cap = W.coarse ? 80 : 160;
      while (emitAcc >= 1) {
        emitAcc -= 1;
        if (parts.length > cap) continue;
        var ang = rnd() * 6.2832, rr = Math.sqrt(rnd()) * R;
        parts.push({ x: ox + Math.cos(ang) * rr, y: oy + Math.sin(ang) * rr * 0.8, vx: (rnd() - 0.4) * 46 * zs, vy: -(40 + rnd() * 90) * zs, t: 0, life: 1.1 + rnd() * 1.6, sz: (0.9 + rnd() * 1.9) * zs, g: -26, drag: 0.5, w: rnd() * 6.2832 });
      }
    }
    function renderEmbers(dt, a, ox, oy) {
      if (!eg) return;
      emit(dt, a, ox, oy);
      if (!parts.length) {
        if (embDirty) { eg.setTransform(1, 0, 0, 1, 0, 0); eg.clearRect(0, 0, emb.width, emb.height); embDirty = false; }
        return;
      }
      embDirty = true;
      eg.setTransform(1, 0, 0, 1, 0, 0); eg.clearRect(0, 0, emb.width, emb.height);
      eg.setTransform(edpr, 0, 0, edpr, 0, 0);
      eg.globalCompositeOperation = 'lighter';
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i]; p.t += dt;
        var k = p.t / p.life;
        if (k >= 1) { parts.splice(i, 1); continue; }
        if (p.w >= 0) p.vx += Math.sin(p.w + p.t * 3.1) * 40 * dt;
        var dr = Math.max(0, 1 - p.drag * dt);
        p.vx *= dr; p.vy = p.vy * dr + p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        var al = k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88, s = p.sz * (1 - 0.5 * k);
        eg.fillStyle = 'rgba(255,120,30,' + (al * 0.13).toFixed(3) + ')';
        eg.beginPath(); eg.arc(p.x, p.y, s * 3.2, 0, 6.2832); eg.fill();
        eg.fillStyle = 'rgba(255,' + Math.round(lerp(214, 72, k)) + ',' + Math.round(lerp(128, 12, k)) + ',' + (al * 0.92).toFixed(3) + ')';
        eg.beginPath(); eg.arc(p.x, p.y, s, 0, 6.2832); eg.fill();
      }
      eg.globalCompositeOperation = 'source-over';
    }

    /* ---- cursor-drag, with a real pointer: grab (press dip, then lift), carry, drop-snap onto a face.
            A finger has to show it means it first: only a sideways move takes hold of the book. A scroll that
            happens to start on the cover stays a scroll, and the book does not twitch under it. ---- */
    var pid = -1, dsx = 0, dsy = 0, dY0 = 0, dX0 = 0, vyaw = 0, lmx = 0, lmt = 0, pending = false, dragTo = 0;
    function canDrag() { return flatNow < 0.2 && S.lidO > 0.99 && S.lidA > -1; }
    function takeBook(e) {
      dragging = true; dragged = true; releasing = false; pending = false;
      dsx = lmx = e.clientX; dsy = e.clientY; dY0 = S.dragY; dX0 = S.dragX; vyaw = 0; lmt = win.performance.now();
      try { bookEl.setPointerCapture(pid); } catch (err) {}
      bookEl.classList.add('is-grab');
      gsap.killTweensOf(S, 'dragY,dragX,lift');
      gsap.timeline().to(S, { lift: -0.6, duration: 0.07, ease: 'power1.in' }).to(S, { lift: 1, duration: 0.3, ease: 'back.out(2)' });
      setHint(false);
    }
    W.on(bookEl, 'pointerdown', function (e) {
      if (pending) { pending = false; return; }                   // a second finger: that is a pinch, not a turn
      if (dragging || !canDrag() || (e.button !== undefined && e.button > 0)) return;
      pid = e.pointerId;
      if (e.pointerType === 'touch') { pending = true; dsx = e.clientX; dsy = e.clientY; return; }
      takeBook(e);
    });
    W.on(bookEl, 'pointermove', function (e) {
      if (e.pointerId !== pid) return;
      if (pending) {
        var mx = Math.abs(e.clientX - dsx), my = Math.abs(e.clientY - dsy);
        if (my > 10 && my >= mx) { pending = false; return; }     // going up or down: that is the page scrolling
        if (mx >= 10 && mx > my * 1.5 && canDrag()) takeBook(e);    // clearly sideways: the book is in hand, from here
        return;
      }
      if (!dragging) return;
      var now = win.performance.now();
      S.dragY = dY0 + (e.clientX - dsx) * 0.42;
      S.dragX = clamp(dX0 - (e.clientY - dsy) * 0.12, -16, 16);
      vyaw = lerp(vyaw, (e.clientX - lmx) * 0.42 / Math.max(1, now - lmt) * 1000, 0.5);
      lmx = e.clientX; lmt = now;
    });
    function endDrag(e) {
      if (e && e.pointerId !== undefined && e.pointerId !== pid) return;
      pending = false;
      if (!dragging) return;
      dragging = false; bookEl.classList.remove('is-grab');
      try { bookEl.releasePointerCapture(pid); } catch (err) {}
      gsap.killTweensOf(S, 'dragY,dragX,lift');
      // a finger that stopped before it lifted throws nothing
      var still = win.performance.now() - lmt;
      if (still > 90) vyaw *= Math.max(0, 1 - (still - 90) / 160);
      // if the browser took the gesture back (it turned into a scroll), nothing is thrown: the book settles where it was
      var taken = !!e && e.type !== 'pointerup';
      dragTo = Math.round((taken ? dY0 : S.dragY + clamp(vyaw, -900, 900) * 0.22) / 180) * 180;
      gsap.to(S, { dragY: dragTo, dragX: 0, duration: taken ? 0.5 : 1.1, ease: taken ? 'power3.out' : 'elastic.out(1, 0.7)' });
      gsap.to(S, { lift: 0, duration: 0.5, ease: 'power3.out' });
    }
    W.on(bookEl, 'pointerup', endDrag);
    W.on(bookEl, 'pointercancel', endDrag);
    // only when the book itself loses the pointer: taking hold moves a finger's capture off the face it
    // landed on, and that face announces its own loss on the way
    W.on(bookEl, 'lostpointercapture', function (e) { if (e.target === bookEl) endDrag(e); });
    // Scrolling takes the book back to its scripted pose. It finishes the turn it was on rather than swinging
    // back against it: a book shown from behind carries on round, in the direction it was turned.
    function releaseDrag() {
      if (dragging || releasing) return;
      releasing = true;
      gsap.killTweensOf(S, 'dragY,dragX');
      var to = (dragTo < 0 ? -1 : 1) * Math.ceil(Math.abs(dragTo) / 360 - 1e-6) * 360;
      gsap.to(S, { dragY: to, dragX: 0, duration: clamp(0.45 + Math.abs(to - S.dragY) / 360 * 0.6, 0.5, 1), ease: 'power3.out', onComplete: function () { S.dragY = 0; dragTo = 0; releasing = false; } });
    }

    /* ---- iris: the section opens like a planet rising, a circle that grows as it arrives ---- */
    function iris(p) { if (neb) neb.style.clipPath = p >= 0.999 ? 'none' : 'circle(' + (Math.pow(p, 1.25) * 76).toFixed(2) + '% at 50% 50%)'; }
    var irisST = ST.create({ trigger: ww, start: 'top bottom', end: 'top top', onUpdate: function (s) { iris(s.progress); }, onRefresh: function (s) { iris(s.progress); } });
    iris(irisST.progress || 0);
    W.cleanup(function () { if (neb) neb.style.clipPath = ''; });

    /* ---- the scrubbed timeline: pose and camera only. Words and beats are triggered from onUpdate ---- */
    layout();
    sized.w = pin.clientWidth; sized.h = pin.clientHeight; sized.r = win.devicePixelRatio || 1;
    function onTL() {
      if (!tl || W.dying) return;
      var t = tl.time(), dir = t >= lastT ? 1 : -1, instant = !armed;
      syncPanels(t, dir, instant);
      syncReveals(t, instant);
      setChap(t < T.b ? 0 : t < T.c ? 1 : t < T.d ? 2 : t < T.e ? 3 : 4, instant);
      setWake(t >= T.c, instant);
      if (armed && lastT < T.c && t >= T.c) thud();
      var st = tl.scrollTrigger, pinned = !st || st.isActive;
      setHint(pinned && !dragged && ((t >= T.spin1 - 0.15 && t < T.d - 0.05) || t >= T.buy + 0.25));
      if (Math.abs(t - lastT) > 0.004 && (S.dragY !== 0 || S.dragX !== 0)) releaseDrag();
      lastT = t;
    }
    var tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' }, onUpdate: onTL,
      scrollTrigger: { trigger: track, start: 'top top', end: 'bottom bottom', scrub: 0.8, onLeave: function () { setHint(false); } }
    });
    // A · 3d-page-scroll: the tilt holds while the feed scrolls inside the card, two steps, one ease
    tl.to(S, { roll: 0.5, duration: 0.34, ease: 'power3.out' }, 0.08);
    tl.to(S, { roll: 1, duration: 0.36, ease: 'power3.out' }, 0.5);
    // B · card-morph-anchor: the chat card becomes a manuscript page and the book forms around it
    tl.to(S, { morph: 1, duration: 0.5 }, T.b);
    tl.to(S, { pb: 1, duration: 0.6 }, T.b);
    tl.to(S, { shell: 1, duration: 0.5, ease: 'power3.out' }, T.b + 0.3);
    tl.to(S, { sheet: 1, duration: 0.5, ease: 'none' }, T.b + 0.6);
    tl.to(S, { lidO: 1, duration: 0.08, ease: 'none' }, T.b + 0.83);
    tl.to(S, { lidA: 0, duration: T.c - (T.b + 0.89), ease: 'power2.in' }, T.b + 0.89);
    // C · the book settles, then turns once so the spine and the back get their moment
    tl.to(S, { pb: 0, ry: -24, rx: -8, duration: 0.3, ease: 'power2.out' }, T.c);
    tl.to(S, { ry: -384, duration: T.spin1 - T.spin0 }, T.spin0);
    // D · coordinate-target-zoom, in phases: pull to the full cover, push to her face, travel to the fire, pull back
    tl.to(S, { cam: 1, ry: -370, rx: -4, duration: 0.5, ease: 'power3.inOut' }, T.d);
    SEQ.forEach(function (w, i) {
      if (i < 1) return;
      var k = Math.min(i + 1, 4), inside = k > 1 && k < 4;   // flat while inside the painting, an object again at the full view
      tl.to(S, { cam: k, ry: inside ? -360 : -370, rx: inside ? 0 : -4, duration: 0.42, ease: 'power3.inOut' }, w.start - 0.16);
    });
    // E · back out to the object
    tl.to(S, { cam: 5, ry: -384, rx: -8, duration: 0.6, ease: 'power3.inOut' }, T.e);
    tl.to({}, { duration: 0.01 }, T.end - 0.01);
    applyWake();
    onTL();
    W.on(win, 'scroll', function () { armed = true; }, { passive: true });

    /* ---- one loop writes the whole pose: camera, book, lid, pages, shaders, embers ---- */
    W.loop(function (dt) {
      if (!active) return;
      clock += dt; frame++;
      // if frames stay slow, trade shader resolution for smoothness (never below half).
      // Wall-clock time, because GSAP smooths its own delta after a long frame.
      var now = win.performance.now(), real = now - lastNow; lastNow = now;
      if (!win.__akFixedQuality && Q > 0.5 && real < 2000) {
        slow = real > 34 ? slow + 1 : Math.max(0, slow - 2);
        if (slow > 80) { Q = Math.max(0.5, Q * 0.75); slow = 0; sizeNeb(); cvW = 0; }
      }
      camAt(S.cam);
      flatNow = flatness(S.cam);
      // sine-wave-loop: low, slow, and added to the pose (never replacing it); off inside the cover
      var idle = S.idle * (1 - flatNow) * (dragging ? 0.2 : 1);
      var iy = Math.sin(clock * 0.9) * 5 * idle, iry = Math.sin(clock * 0.62 + 1.1) * 1.3 * idle, irx = Math.sin(clock * 0.8 + 0.4) * 0.7 * idle;
      // multi-phase-camera: micro drift on two near-coprime frequencies while inside the cover, a short shake at the thud
      var dx = Math.sin(clock * 0.33) * 7 * flatNow, dy = Math.sin(clock * 0.33 * 1.3) * 4 * flatNow + iy;
      if (S.shake > 0.001) { dx += Math.sin(clock * 96) * 9 * S.shake; dy += Math.cos(clock * 81) * 6 * S.shake; }
      // coordinate-target-zoom: the outer wrapper scales, the inner one counter-translates
      var z = C.z * (1 + 0.04 * S.lift);
      zoomEl.style.transform = 'scale(' + z.toFixed(4) + ')';
      ftx = (C.ax * vw + dx) / z - (C.fu - 0.5) * bw; fty = (C.ay * vh + dy) / z - (C.fv - 0.5) * bh;
      panEl.style.transform = 'translate3d(' + ftx.toFixed(2) + 'px,' + fty.toFixed(2) + 'px,0)';
      var ry = S.ry + S.pb * poseB.ry + iry + S.dragY, rx = S.rx + S.pb * poseB.rx + irx + S.dragX + 5 * S.sq, sqv = 1 - 0.07 * S.sq, sq = sqv.toFixed(4);
      bookEl.style.transform = 'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) scale3d(' + sq + ',' + sq + ',' + sq + ')';
      var a = ((ry % 360) + 540) % 360 - 180;
      if (sheen) { sheen.style.setProperty('--sx', clamp(50 - a * 1.5, -40, 140).toFixed(1) + '%'); sheen.style.opacity = (1 - flatNow).toFixed(3); }
      if (S.lidA !== last.lidA) { lid.style.setProperty('--lid', S.lidA.toFixed(2) + 'deg'); last.lidA = S.lidA; }
      // faces: drawn only while their printed side points at the camera (the lid is a plane through its hinge)
      fcy = Math.cos(ry * DEG); fsy = Math.sin(ry * DEG); fcx = Math.cos(rx * DEG); fsx = Math.sin(rx * DEG); fsq = sqv;
      var lidR = S.lidA * DEG, lsn = Math.sin(lidR), lcs = Math.cos(lidR), lidD = lcs * G.ht - lsn * G.hw;
      var shO = Math.min(1, S.shell * 2.2), shZ = -(1 - S.shell) * 150;
      frontF = facing(lsn, 0, lcs, lidD);
      for (var fi = 0; fi < faces.length; fi++) {
        var fc = faces[fi];
        var fF = fc.lid ? (fc.lid > 0 ? frontF : facing(-lsn, 0, -lcs, 1 - lidD)) : facing(fc.n[0], fc.n[1], fc.n[2], fc.d + fc.n[2] * shZ);
        var fo = fF > EPS ? (fc.lid ? S.lidO : shO) : 0;
        if (fo !== fc.o) { fc.el.style.opacity = fo.toFixed(3); fc.o = fo; }
      }
      if (S.sheet !== last.sheet) {
        sheets.forEach(function (el, i) {
          var k = clamp((S.sheet - i * 0.11) / 0.42, 0, 1);
          el.style.setProperty('--a', (-128 * (1 - k * k)).toFixed(2) + 'deg');
          el.style.opacity = Math.min(1, k * 8).toFixed(3);
        });
        last.sheet = S.sheet;
      }
      if (S.shell !== last.shell) { shell.style.transform = 'translateZ(' + shZ.toFixed(1) + 'px)'; last.shell = S.shell; }
      var shellVis = S.shell > 0.002 && flatNow < 0.985, pageVis = S.lidA < -0.4, grab = canDrag();
      if (shellVis !== last.shellVis) { shell.style.visibility = shellVis ? 'visible' : 'hidden'; last.shellVis = shellVis; }
      if (pageVis !== last.pageVis) { page.style.visibility = pageVis ? 'visible' : 'hidden'; if (sheetsWrap) sheetsWrap.style.visibility = pageVis ? 'visible' : 'hidden'; last.pageVis = pageVis; }
      if (grab !== last.grab) { bookEl.style.pointerEvents = grab ? 'auto' : 'none'; last.grab = grab; }
      if (S.morph !== last.morph) { page.style.setProperty('--mo', S.morph.toFixed(4)); last.morph = S.morph; }
      if (S.roll !== last.roll && roll) { roll.style.transform = 'translate3d(0,' + (-S.roll * rollD).toFixed(1) + 'px,0)'; last.roll = S.roll; }
      // the reading shade is only at full strength while the painting sits under the words
      if (flatNow !== last.flat && shade2) { shade2.style.opacity = (0.5 + 0.5 * flatNow).toFixed(3); last.flat = flatNow; }
      if (aura) aura.style.opacity = Math.max(0.75 * S.wake * (1 - flatNow), 0.9 * S.imp).toFixed(3);
      // the network breathes while the server is on screen (radius only, so it never fights the entrance)
      if (netIned && S.morph < 0.4) {
        for (var n = 0; n < netNodes.length; n++) netNodes[n].setAttribute('r', (6 * (1 + Math.sin(clock * 1.5 + n / netNodes.length * 6.2832) * 0.08)).toFixed(2));
      }
      if (pBuy && pBuy.o > 0.01) { FM.forEach(drawFmt); runSite(dt); }
      // one layout read per frame, after every write
      var pr = pin.getBoundingClientRect(), ob = orbEl ? orbEl.getBoundingClientRect() : pr;
      var ox = ob.left - pr.left, oy = ob.top - pr.top, pt = W.pointer;
      var k = damp(dt, 0.01);
      parX = lerp(parX, pt.active ? clamp((pt.x - pr.left) / vw - 0.5, -0.5, 0.5) * flatNow : 0, k);
      parY = lerp(parY, pt.active ? clamp((pt.y - pr.top) / vh - 0.5, -0.5, 0.5) * flatNow : 0, k);
      renderCover(a);
      renderNeb(ox / vw, 1 - oy / vh);
      renderEmbers(dt, a, ox, oy);
    });

    var inited = false;
    ST.create({
      trigger: ww, start: 'top 150%', end: 'bottom -30%',
      onToggle: function (s) {
        active = s.isActive;
        if (active && !inited) { inited = true; initNeb(); initCover(); sizeEmb(); }
      }
    });

    // A phone fires resize every time its toolbar slides in or out. The pin keeps its size through that,
    // so nothing is measured again and no canvas is thrown away in the middle of a scroll.
    var rz = 0;
    function relayout(force) {
      var w = pin.clientWidth, h = pin.clientHeight, r = win.devicePixelRatio || 1;
      if (force !== true && w === sized.w && h === sized.h && r === sized.r) return;
      sized.w = w; sized.h = h; sized.r = r;
      layout(); sizeNeb(); sizeEmb(); cvW = 0;
    }
    W.on(win, 'resize', function () { win.cancelAnimationFrame(rz); rz = win.requestAnimationFrame(relayout); });
    var prevMeasure = W.measure;
    W.measure = function () { relayout(true); if (prevMeasure) prevMeasure(); };

    W.cleanup(function () {
      // stop everything this module started outside the GSAP context, then hand back clean elements
      gsap.killTweensOf(drivers.concat([S, buyD, siteD, glowD, sweepD, orbD], FM, panels));
      gsap.killTweensOf(reveals.map(function (r) { return r.el; }).concat(subs.map(function (s) { return s.el; }), chaps, facts, netEls, netLines, hint ? [hint] : []));
      var clear = function (el, props) { if (el) props.forEach(function (p) { el.style[p] = ''; }); };
      [zoomEl, panEl, bookEl, shell, roll, shade2, aura, page, sheetsWrap, hint, leftCol, site, factsWrap, siteGlow, siteSweep].forEach(function (el) { clear(el, ['transform', 'opacity', 'visibility', 'pointerEvents']); });
      moons.forEach(function (m, i) { if (moonRest[i]) m.setAttribute('transform', moonRest[i]); else m.removeAttribute('transform'); m.style.opacity = ''; });
      if (siWorld) siWorld.removeAttribute('transform');
      ww.classList.remove('is-short', 'is-tight'); ww.style.removeProperty('--ct');
      panels.forEach(function (p) { clear(p.el, ['transform', 'opacity', 'pointerEvents']); });
      reveals.forEach(function (r) { clear(r.el, ['transform', 'opacity']); });
      subs.forEach(function (s) { clear(s.el, ['transform', 'opacity']); });
      letters.forEach(function (el) { clear(el, ['color', 'textShadow', 'transform']); });
      fmts.concat(facts, chaps, shellFaces, lidFaces, sheets).forEach(function (el) { clear(el, ['transform', 'opacity']); });
      bookEl.classList.remove('is-grab', 'is-awake');
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

  global.AKMotion = { mount: mount, version: '1.1.0' };
})(typeof window !== 'undefined' ? window : this);
