/* ==========================================================================
   DRIVEMATE — app.js
   Scroll reveals · mechanical cursor trail · magnetic buttons · header state
   ========================================================================== */
(function(){
  "use strict";

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------------- Header scroll state ---------------- */
  const header = document.querySelector('header');
  if(header){
    const onScroll = ()=> header.classList.toggle('scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive:true });
    onScroll();
  }

  /* ---------------- Scroll reveals ---------------- */
  const revealTargets = document.querySelectorAll('.reveal, .reveal-stagger');
  if('IntersectionObserver' in window && revealTargets.length){
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold:0.12, rootMargin:'0px 0px -60px 0px' });
    revealTargets.forEach(el=>io.observe(el));
  } else {
    revealTargets.forEach(el=>el.classList.add('is-in'));
  }

  // stagger children transition-delay
  document.querySelectorAll('.reveal-stagger').forEach(group=>{
    Array.from(group.children).forEach((child,i)=>{
      child.style.transitionDelay = (i*70)+'ms';
    });
  });

  /* ---------------- Magnetic buttons ---------------- */
  if(hasHover && !reduceMotion){
    document.querySelectorAll('[data-magnetic], .hero-btn, .icon-btn, .avatar-link, .cat-item, .svc-card').forEach(el=>{
      const strength = el.classList.contains('hero-btn') ? 0.35 : 0.18;
      el.addEventListener('mousemove', (e)=>{
        const r = el.getBoundingClientRect();
        const mx = e.clientX - (r.left + r.width/2);
        const my = e.clientY - (r.top + r.height/2);
        el.style.transform = `translate(${mx*strength}px, ${my*strength}px)`;
      });
      el.addEventListener('mouseleave', ()=>{ el.style.transform = ''; });
    });
  }

  /* ==========================================================================
     MECHANICAL CURSOR TRAIL
     A canvas-based particle system: small wrenches, bolts, gears and
     screwdrivers spin off the cursor as it moves, drift briefly, then fade.
     ========================================================================== */
  if(!hasHover || reduceMotion) return; // skip entirely on touch / reduced-motion

  const canvas = document.createElement('canvas');
  canvas.id = 'tool-trail-canvas';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth+'px';
    canvas.style.height = innerHeight+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();
  window.addEventListener('resize', resize);

  const COLORS = ['#FF5B1E', '#D63A0F', '#FFB238', '#1B1712'];
  const TOOLS = ['wrench','gear','bolt','screwdriver'];

  function drawWrench(c, s, col){
    c.strokeStyle = col; c.lineWidth = s*0.16; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-s*0.55, s*0.55); c.lineTo(s*0.35, -s*0.35); c.stroke();
    c.beginPath(); c.arc(-s*0.62, s*0.62, s*0.28, 0.6, 4.2); c.stroke();
    c.beginPath(); c.arc(s*0.5, -s*0.5, s*0.22, -2.4, 1.2); c.stroke();
  }
  function drawBolt(c, s, col){
    c.fillStyle = col;
    c.beginPath();
    for(let i=0;i<6;i++){
      const a = (Math.PI/3)*i - Math.PI/6;
      const x = Math.cos(a)*s*0.6, y = Math.sin(a)*s*0.6;
      i===0 ? c.moveTo(x,y) : c.lineTo(x,y);
    }
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath(); c.arc(0,0,s*0.22,0,Math.PI*2); c.fill();
  }
  function drawGear(c, s, col){
    c.fillStyle = col;
    const teeth = 8, rOuter = s*0.6, rInner = s*0.42;
    c.beginPath();
    for(let i=0;i<teeth*2;i++){
      const a = (Math.PI/teeth)*i;
      const r = i%2===0 ? rOuter : rInner;
      const x = Math.cos(a)*r, y = Math.sin(a)*r;
      i===0 ? c.moveTo(x,y) : c.lineTo(x,y);
    }
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.4)';
    c.beginPath(); c.arc(0,0,s*0.18,0,Math.PI*2); c.fill();
  }
  function drawScrewdriver(c, s, col){
    c.fillStyle = col;
    c.fillRect(-s*0.08, -s*0.6, s*0.16, s*0.85);
    c.fillStyle = 'rgba(0,0,0,0.4)';
    c.fillRect(-s*0.08, -s*0.6, s*0.16, s*0.18);
    c.fillStyle = col;
    c.beginPath(); c.arc(0, s*0.42, s*0.22, 0, Math.PI*2); c.fill();
  }
  const RENDER = { wrench:drawWrench, gear:drawGear, bolt:drawBolt, screwdriver:drawScrewdriver };

  const POOL_SIZE = 140;
  const pool = [];
  for(let i=0;i<POOL_SIZE;i++){
    pool.push({ active:false, x:0,y:0, vx:0,vy:0, rot:0, vrot:0, size:0, life:0, maxLife:1, tool:'bolt', color:'#fff' });
  }
  let poolCursor = 0;

  function spawn(x, y, burst){
    const n = burst ? 10 : 1;
    for(let k=0;k<n;k++){
      const p = pool[poolCursor];
      poolCursor = (poolCursor+1) % POOL_SIZE;
      p.active = true;
      p.x = x + (Math.random()-0.5)*(burst?60:6);
      p.y = y + (Math.random()-0.5)*(burst?60:6);
      const ang = Math.random()*Math.PI*2;
      const speed = burst ? (1.4+Math.random()*3.2) : (0.3+Math.random()*0.9);
      p.vx = Math.cos(ang)*speed;
      p.vy = Math.sin(ang)*speed - (burst?0.6:0.15);
      p.rot = Math.random()*Math.PI*2;
      p.vrot = (Math.random()-0.5)*0.22;
      p.size = burst ? (9+Math.random()*10) : (6+Math.random()*7);
      p.life = 0;
      p.maxLife = burst ? (55+Math.random()*25) : (40+Math.random()*24);
      p.tool = TOOLS[(Math.random()*TOOLS.length)|0];
      p.color = COLORS[(Math.random()*COLORS.length)|0];
    }
  }

  let lastX=null, lastY=null, moveAccum=0;
  window.addEventListener('mousemove', (e)=>{
    if(lastX!==null){
      moveAccum += Math.hypot(e.clientX-lastX, e.clientY-lastY);
      if(moveAccum > 14){
        spawn(e.clientX, e.clientY, false);
        moveAccum = 0;
      }
    }
    lastX = e.clientX; lastY = e.clientY;
  }, { passive:true });

  window.addEventListener('click', (e)=>{
    spawn(e.clientX, e.clientY, true);
  });

  function tick(){
    ctx.clearRect(0,0,innerWidth,innerHeight);
    for(let i=0;i<POOL_SIZE;i++){
      const p = pool[i];
      if(!p.active) continue;
      p.life++;
      if(p.life >= p.maxLife){ p.active=false; continue; }
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.028; // gentle gravity
      p.vx *= 0.985; p.vy *= 0.99;
      p.rot += p.vrot;

      const t = p.life / p.maxLife;
      const alpha = t < 0.15 ? (t/0.15) : (1 - (t-0.15)/0.85);

      ctx.save();
      ctx.globalAlpha = Math.max(alpha,0) * 0.85;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      RENDER[p.tool](ctx, p.size, p.color);
      ctx.restore();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

})();
