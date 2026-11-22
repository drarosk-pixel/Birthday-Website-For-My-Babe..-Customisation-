"use strict";

const $ = (selector) => document.querySelector(selector);
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
const scenes = [...document.querySelectorAll(".scene")];
const captions = ["Love, on paper", "Coffee for two", "Between the pages", "Afternoon light", "Cherry sweet", "A quiet sunset", "Make a wish", "Close to my heart"];
const photoPath = (index) => "assets/photos/" + String(index + 1).padStart(2, "0") + ".jpg";
const sounds = {context:null, active:true};
const music = $("#music"), voice = $("#voice"), soundButton = $("#sound");
music.volume = .58;
let current = "opening";
let sceneTimers = [];
let stopTree = null;
let sceneMotion = [];
const settle = "cubic-bezier(.2,.72,.23,1)";

function later(callback, delay) {
  sceneTimers.push(window.setTimeout(callback, delay));
}
function announce(message) { $("#announce").textContent = message; }

function haptic(pattern) {
  if (!reduced.matches && !document.hidden) navigator.vibrate?.(pattern);
}

let lastTouchMove = -Infinity, lastRevealPulse = -Infinity;
document.addEventListener("touchmove", () => { lastTouchMove = performance.now(); }, {passive:true});
const scrollObserver = "IntersectionObserver" in window ? new IntersectionObserver((entries, observer) => {
  let count = 0;
  for (const entry of entries) {
    if (!entry.isIntersecting || entry.intersectionRatio < .12) continue;
    const item = entry.target;
    observer.unobserve(item);
    if (reduced.matches || !window.scrollY || item.closest(".scene")?.id !== current) continue;
    item.animate([
      {opacity:.18, translate:"0 14px"},
      {opacity:1, translate:"0 0"}
    ], {duration:520, delay:Math.min(count, 2)*45, easing:settle, fill:"backwards"});
    count++;
  }
  const now = performance.now();
  if (count && now-lastTouchMove < 1000 && now-lastRevealPulse > 200) {
    haptic(8);
    lastRevealPulse = now;
  }
}, {threshold:.12}) : null;

function watchScrollReveals(container) {
  if (!scrollObserver || reduced.matches) return;
  const items = container.querySelectorAll(".polaroid, #album-title, .album-inner .text-button, .letter-paper p, .voice-note, #checks label, .photo-nav, .pink-button, #birthday-wish > *");
  const fold = document.documentElement.clientHeight;
  for (const item of items) {
    const box = item.getBoundingClientRect();
    // Content already in view keeps its scene entrance. Only the next items are scroll reveals.
    if (box.height && box.top + .12*box.height > fold) scrollObserver.observe(item);
  }
}

// The bow and the dedication expand from a point of light. The doorway fades
// through dusty rose, and the pages within the museum travel in the same direction.
function transitionBetween(outgoing, incoming) {
  const light = $("#scene-light");
  const name = incoming.id;
  const iris = name === "dedication" || name === "tree";
  const doorway = ["gift", "museum", "scratch"].includes(name);
  const gallery = ["puzzle", "letter", "promises"].includes(name);
  const duration = iris ? 1040 : doorway ? 900 : 780;
  const play = (element, frames) => sceneMotion.push(
    element.animate(frames, {duration, easing:"ease-in-out", fill:"both"})
  );
  const incomingOffset = gallery ? "translateX(20px)" : "none";
  play(incoming, [
    {opacity:0, transform:incomingOffset},
    {opacity:0, transform:incomingOffset, offset:iris ? .38 : doorway ? .26 : .06},
    {opacity:1, transform:"none", offset:iris ? .59 : doorway ? .65 : 1},
    {opacity:1, transform:"none"}
  ]);
  const oldContent = outgoing.querySelector(".from-card,.album-inner,.room-wrap,.tree-note");
  if (oldContent) {
    play(oldContent, [
      {opacity:1},
      {opacity:0, offset:.46},
      {opacity:0}
    ]);
  }
  if (gallery) {
    play(outgoing, [{transform:"none"}, {transform:"translateX(-16px)", opacity:.35}]);
  }
  if (iris) {
    light.className = "iris " + name + "-light";
    const diameter = light.offsetWidth;
    const endScale = 3 * Math.hypot(innerWidth, innerHeight) / diameter;
    play(light, [
      {opacity:0, transform:"scale(.04)"},
      {opacity:1, transform:"scale(.32)", offset:.14},
      {opacity:1, transform:"scale(" + endScale + ")", offset:.60},
      {opacity:0, transform:"scale(" + endScale + ")"}
    ]);
  } else if (doorway) {
    light.className = "doorway-light";
    play(light, [{opacity:0}, {opacity:.89, offset:.42}, {opacity:.83, offset:.52}, {opacity:0}]);
  }
  later(() => {
    outgoing.hidden = true;
    outgoing.classList.remove("departing");
    outgoing.style.removeProperty("top");
    sceneMotion.forEach(animation => animation.cancel());
    sceneMotion = [];
  }, duration);
}

function show(name) {
  scrollObserver?.disconnect();
  lastTouchMove = -Infinity;
  sceneTimers.forEach(clearTimeout);
  sceneTimers = [];
  sceneMotion.forEach(animation => animation.cancel());
  sceneMotion = [];
  if (stopTree) { stopTree(); stopTree = null; }
  clearInterval(puzzleClock);
  if (current === "letter") $("#voice").pause();
  const previous = document.getElementById(current);
  const scene = document.getElementById(name);
  const outgoing = reduced.matches ? null : previous;
  const previousScroll = window.scrollY;
  current = name;
  for (const scene of scenes) {
    const active = scene.id === name;
    if (scene !== outgoing) scene.style.removeProperty("top");
    scene.hidden = !active && scene !== outgoing;
    scene.inert = !active;
    scene.classList.toggle("enter", active);
    scene.classList.toggle("departing", scene === outgoing);
  }
  if (outgoing) {
    outgoing.style.top = -previousScroll + "px";
    transitionBetween(outgoing, scene);
  }
  window.scrollTo(0, 0);
  const heading = scene.querySelector("h1,h2,button") || scene;
  if (!heading.matches("button")) heading.tabIndex = -1;
  heading.focus({preventScroll:true});
  if (name === "dedication") later(() => show("tree"), reduced.matches ? 1800 : 3600);
  if (name === "tree") {
    stopTree = bloomTree($("#tree-art"), reduced);
    later(() => show("gift"), reduced.matches ? 2000 : 4900);
  }
  if (name === "from") later(() => show("album"), reduced.matches ? 3200 : 4200);
  if (name === "scratch") renderScratch();
  if (name === "puzzle") startPuzzle();
  if (name === "promises") updatePromises();
  watchScrollReveals(scene);
}
document.querySelectorAll("[data-next]").forEach((button) => button.addEventListener("click", () => show(button.dataset.next)));
["scratch","puzzle","letter","promises"].forEach((name, index) => {
  const progress = document.querySelector("#" + name + " .room-progress");
  progress.setAttribute("aria-label", "Museum room " + (index + 1) + " of 4");
  for (let n=0; n<4; n++) {
    const dot = document.createElement("i");
    dot.classList.toggle("filled", n <= index);
    progress.append(dot);
  }
});

function tone(frequency, duration=.52, volume=.08, offset=0) {
  const ctx = sounds.context;
  if (!sounds.active || !ctx) return;
  const start = ctx.currentTime + offset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(.0001,start);
  gain.gain.exponentialRampToValueAtTime(volume,start+.025);
  gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(start); osc.stop(start+duration+.04);
}
// Keep the visitor's choice separate from a browser waiting for a first gesture.
let needsMusicGesture = true;
let musicRequest = 0;
const musicHint = $("#music-hint");
function updateSoundButton() {
  const enabled = sounds.active && !needsMusicGesture;
  const label = enabled ? "Turn music off" : "Turn music on";
  musicHint.hidden = !sounds.active || !needsMusicGesture || document.hidden || !voice.paused;
  soundButton.setAttribute("aria-pressed", String(enabled));
  soundButton.setAttribute("aria-label", musicHint.hidden ? label : musicHint.textContent);
  soundButton.title = label;
}
function syncMusic() {
  const request = ++musicRequest;
  if (!sounds.active || document.hidden || !voice.paused) {
    music.pause();
    updateSoundButton();
    soundButton.classList.remove("is-playing");
    return;
  }
  music.play().catch(error => {
    if (request !== musicRequest || error.name === "AbortError") return;
    soundButton.classList.remove("is-playing");
    needsMusicGesture = error.name === "NotAllowedError";
    if (!needsMusicGesture) {
      sounds.active = false;
      announce("Music could not start. Tap the music button to try again.");
    }
    updateSoundButton();
  });
}
music.addEventListener("playing", () => {
  if (music.paused || !sounds.active || document.hidden || !voice.paused) return;
  needsMusicGesture = false;
  updateSoundButton();
  soundButton.classList.add("is-playing");
});
for (const event of ["pause", "waiting", "ended", "emptied", "error"]) {
  music.addEventListener(event, () => soundButton.classList.remove("is-playing"));
}

function enableTouchSounds() {
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!AudioEngine) return;
  sounds.context ||= new AudioEngine();
  if (sounds.context.state !== "running") sounds.context.resume().catch(() => {});
}
soundButton.addEventListener("click", () => {
  sounds.active = !sounds.active || needsMusicGesture;
  needsMusicGesture = false;
  updateSoundButton();
  syncMusic();
  if (sounds.active) enableTouchSounds();
});
function tryMusicOnGesture(event) {
  if (!event.isTrusted || !sounds.active || soundButton.contains(event.target)) return;
  if (event.type === "keydown" && (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.key === "Escape")) return;
  if (needsMusicGesture && music.paused) syncMusic();
  enableTouchSounds();
}
for (const event of ["touchend", "click", "keydown"]) {
  document.addEventListener(event, tryMusicOnGesture, {capture:true, passive:true});
}
for (const event of ["play", "pause", "ended"]) voice.addEventListener(event, syncMusic);
document.addEventListener("visibilitychange", syncMusic);
syncMusic();

function particles(x,y,confetti=false) {
  if (reduced.matches) return;
  const colors=["#993d64","#ed95b8","#dcabc7","#fad2df","#a375a0"];
  const layer=$("#particles");
  for (let i=0;i<(confetti?65:21);i++) {
    const p=document.createElement("span");
    p.className="particle"+(confetti?" confetti":"");
    p.style.left=(confetti?Math.random()*100+"%":x+"px");
    p.style.top=confetti?"-18px":y+"px";
    const color=colors[i%colors.length];
    if (confetti) p.style.background=color;
    else {p.textContent=i%3?"♥":"✦";p.style.color=color;p.style.fontSize=8+Math.random()*13+"px";}
    p.style.setProperty("--x",(Math.random()-.5)*(confetti?230:180)+"px");
    p.style.setProperty("--y",(-28-Math.random()*130)+"px");
    p.style.setProperty("--spin",(Math.random()-.5)*520+"deg");
    p.style.setProperty("--duration",(confetti?2+Math.random()*1.3:.75+Math.random()*.6)+"s");
    if (confetti) p.style.animationDelay=Math.random()*.5+"s";
    layer.append(p);setTimeout(()=>p.remove(),4000);
  }
}

const bowCanvas=$("#bow-art"), bowButton=$("#bow"), heartTarget=$("#target");
let bowStart=null, fired=false;
function line(ctx,points,color,width) {
  ctx.beginPath();ctx.moveTo(points[0],points[1]);ctx.lineTo(points[2],points[3]);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
function drawBow(tension=0, arrow=true) {
  const ctx=bowCanvas.getContext("2d");
  ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,180,180);
  ctx.lineJoin="round";ctx.lineCap="round";
  const x=89-tension*39,y=88+tension*38;
  ctx.beginPath();ctx.moveTo(31,25);ctx.lineTo(x,y);ctx.lineTo(150,142);ctx.strokeStyle="#ae8292";ctx.lineWidth=1.2;ctx.stroke();
  const roseGold=ctx.createLinearGradient(26,15,149,150);
  [[0,"#dea4b6"],[.22,"#a3617e"],[.49,"#743d59"],[.53,"#ce8ea4"],[.72,"#92536e"],[1,"#e1a8b5"]].forEach(([n,c])=>roseGold.addColorStop(n,c));
  ctx.beginPath();ctx.moveTo(32,27);ctx.bezierCurveTo(27,15,22,26,24,39);ctx.bezierCurveTo(26,63,18,105,37,128);ctx.bezierCurveTo(55,148,100,141,136,148);ctx.bezierCurveTo(146,150,153,147,149,141);ctx.strokeStyle=roseGold;ctx.lineWidth=4.9;ctx.stroke();
  line(ctx,[31,135,45,121],"#743f58",9);
  for(let i=0;i<5;i++) line(ctx,[30+i*2.6,132-i*2.6,34+i*2.6,136-i*2.6],"#e6aec1",1.5);
  for(const [ax,ay] of [[32,27],[149,142]]) {ctx.fillStyle="#f6c4d3";ctx.beginPath();ctx.arc(ax,ay,2.8,0,2*Math.PI);ctx.fill();}
  if (!arrow) return;
  ctx.save();ctx.translate(x-7,y+8);ctx.rotate(-Math.PI/4);
  line(ctx,[-13,0,82,0],"#8e5672",2.4);line(ctx,[-10,-.6,81,-.6],"#ecc2cf",.85);
  ctx.fillStyle="#c14a69";ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(-21,-8);ctx.quadraticCurveTo(-7,-11,2,-3);ctx.lineTo(6,0);ctx.closePath();ctx.fill();
  ctx.fillStyle="#e7889f";ctx.beginPath();ctx.moveTo(-10,1);ctx.lineTo(-19,8);ctx.quadraticCurveTo(-4,9,5,1);ctx.fill();
  for(let i=-11;i<1;i+=3)line(ctx,[i,-1,i-5,-6],"#e6a0aa",.7);
  ctx.fillStyle="#bd759b";ctx.beginPath();ctx.moveTo(86,0);ctx.lineTo(74,-5);ctx.quadraticCurveTo(68,-2,73,0);ctx.quadraticCurveTo(68,3,74,5);ctx.closePath();ctx.fill();
  ctx.restore();
}
drawBow();
for (const handle of [bowButton, heartTarget]) {
  handle.addEventListener("pointerdown", e => {
    if (fired || bowStart || !e.isPrimary || e.button !== 0) return;
    tryMusicOnGesture(e);
    bowStart = {id:e.pointerId, x:e.clientX, y:e.clientY, band:0};
    handle.setPointerCapture(e.pointerId);
    drawBow(.18);
  });
  handle.addEventListener("pointermove", e => {
    if (bowStart?.id !== e.pointerId) return;
    const pull = Math.min(1, Math.hypot(e.clientX-bowStart.x, e.clientY-bowStart.y)/65);
    drawBow(.18 + pull*.82);
    heartTarget.style.setProperty("--pull-scale", 1 + pull*.075);
    const band = Math.floor(pull*3);
    if (e.pointerType === "touch" && band > bowStart.band) {
      bowStart.band = band;
      haptic(5 + 3*band);
    }
  });
  handle.addEventListener("pointerup", e => {
    if (bowStart?.id !== e.pointerId || e.button !== 0) return;
    // Some touch browsers grant audio and vibration permission on release.
    tryMusicOnGesture(e);
    if (e.pointerType === "touch") haptic([14, 40, 20]);
    bowStart = null;
    heartTarget.style.removeProperty("--pull-scale");
    fire();
  });
  function cancelPull(e) {
    if (bowStart?.id !== e.pointerId) return;
    bowStart = null;
    heartTarget.style.removeProperty("--pull-scale");
    if (!fired) drawBow();
  }
  handle.addEventListener("pointercancel", cancelPull);
  handle.addEventListener("lostpointercapture", cancelPull);
  handle.addEventListener("click", fire);
}
$("#shoot").addEventListener("click",fire);
function fire() {
  if(fired || current!=="opening")return;
  fired=true;drawBow(0,false);
  const from=bowButton.getBoundingClientRect(),to=$("#target").getBoundingClientRect();
  const x=from.left+from.width*.53,y=from.top+from.height*.48,tx=to.left+to.width*.5,ty=to.top+to.height*.54;
  const arrow=document.createElement("span");
  arrow.setAttribute("aria-hidden","true");arrow.textContent="➳";
  Object.assign(arrow.style,{position:"fixed",left:x+"px",top:y+"px",zIndex:4,color:"#a45778",font:"40px/1 Georgia",pointerEvents:"none"});
  $("#opening").append(arrow);
  const angle=Math.atan2(ty-y,tx-x)*180/Math.PI;
  arrow.animate([{transform:"translate(-50%,-50%) rotate("+angle+"deg)"},{transform:"translate("+(tx-x)+"px,"+(ty-y)+"px) rotate("+angle+"deg)"}],{duration:reduced.matches?1:360,easing:"ease-in",fill:"forwards"});
  later(()=>{arrow.remove();$("#opening").classList.add("shot");particles(tx,ty);tone(784);tone(1046,.6,.08,.12);},370);
  later(()=>{$("#always").hidden=false;announce("Still you. Always you. For Gunjan.");},850);
  later(()=>show("dedication"),2650);
}

// One shaded sprite per colour keeps leaf painting cheap during the bloom.
function heartLeafSprite([light, middle, dark]) {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 64;
  const brush = sprite.getContext("2d");
  brush.beginPath();
  brush.moveTo(32, 58);
  brush.bezierCurveTo(24, 51, 2, 36, 3, 20);
  brush.bezierCurveTo(4, 3, 22, 1, 32, 15);
  brush.bezierCurveTo(44, -1, 62, 6, 61, 22);
  brush.bezierCurveTo(61, 37, 41, 53, 32, 58);
  brush.closePath();
  brush.clip();

  const colour = brush.createRadialGradient(20, 14, 1, 36, 31, 40);
  colour.addColorStop(0, light);
  colour.addColorStop(.52, middle);
  colour.addColorStop(1, dark);
  brush.fillStyle = colour;
  brush.fillRect(0, 0, 64, 64);
  const gleam = brush.createRadialGradient(18, 14, 1, 18, 14, 9);
  gleam.addColorStop(0, "rgba(255,255,255,.91)");
  gleam.addColorStop(1, "rgba(255,255,255,0)");
  brush.fillStyle = gleam;
  brush.fillRect(6, 3, 26, 25);
  return sprite;
}

function bloomTree(canvas, motion) {
  const ctx = canvas.getContext("2d");
  const sprites = [
    ["#ffd7e8", "#f77eaa", "#bb3471"], ["#ffcee2", "#ef639a", "#a72565"],
    ["#fff0f7", "#eca4c4", "#d1709c"], ["#f7d6e9", "#d592bd", "#a36290"],
    ["#fff0f5", "#f2bdd5", "#c47e9f"], ["#fff6f9", "#efd0e1", "#bc8fab"]
  ].map(heartLeafSprite);
  let seed = 27;
  function random() {
    seed = seed * 16807 % 2147483647;
    return (seed - 1) / 2147483646;
  }
  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = value => value * value * (3 - 2 * value);

  // The same crown coordinates guide the curved limbs and the staggered rows of leaves.
  const crown = new Path2D();
  crown.moveTo(180, 49);
  crown.bezierCurveTo(127, -22, 31, -6, 17, 70);
  crown.bezierCurveTo(2, 139, 88, 193, 180, 254);
  crown.bezierCurveTo(267, 194, 355, 141, 344, 75);
  crown.bezierCurveTo(331, -5, 237, -23, 180, 49);
  crown.closePath();

  const fork = {x:180, y:246, radius:6.5, arrival:.82};
  const limbs = [];
  function branch(parent, x, y, radius, bend) {
    x += (random() - .5) * 7;
    y += (random() - .5) * 8;
    const dx = x - parent.x, dy = y - parent.y;
    const length = Math.hypot(dx, dy);
    const controlX = (parent.x + x) / 2 - dy / length * bend;
    const controlY = (parent.y + y) / 2 + dx / length * bend;
    const tip = {x, y, radius, arrival:parent.arrival + length / 285};
    limbs.push({base:parent, tip, controlX, controlY});
    return tip;
  }
  for (const side of [-1, 1]) {
    const x = offset => 180 + side * offset;
    const arm = branch(fork, x(62), 166, 4.5, -7 * side);
    const outer = branch(arm, x(111), 107, 2.9, 5 * side);
    const high = branch(outer, x(116), 62, 1.5, -4 * side);
    branch(high, x(99), 28, .6, -3 * side);
    branch(high, x(140), 48, .6, 2 * side);
    branch(outer, x(153), 86, .7, 4 * side);
    const low = branch(arm, x(103), 147, 2, 5 * side);
    branch(low, x(134), 122, .7, 3 * side);
    const inner = branch(arm, x(51), 99, 2.7, 6 * side);
    const upper = branch(inner, x(69), 53, 1.6, -4 * side);
    branch(upper, x(77), 20, .6, 2 * side);
    branch(upper, x(44), 33, .6, 2 * side);
    branch(inner, x(33), 60, .8, 4 * side);
  }
  const middle = branch(fork, 178, 157, 4, 9);
  const centre = branch(middle, 184, 102, 2.2, -4);
  branch(centre, 166, 65, .7, 1);
  branch(centre, 202, 57, .7, -3);

  function pointOnLimb(limb, t) {
    const u = 1 - t;
    return {
      x:u*u*limb.base.x + 2*u*t*limb.controlX + t*t*limb.tip.x,
      y:u*u*limb.base.y + 2*u*t*limb.controlY + t*t*limb.tip.y
    };
  }
  // Buds start on nearby wood. The slight jitter breaks up rows without leaving bald patches.
  const anchors = limbs.flatMap(limb => [.25, .5, .75, 1].map(t => pointOnLimb(limb, t)));
  const backLeaves = [], frontLeaves = [];
  const palette = [0, 0, 1, 1, 2, 3, 4, 4, 5];
  for (let row = 0; row < 21; row++) {
    for (let col = 0; col < 23; col++) {
      const x = col * 15.5 + (row % 2) * 7.75 + (random() - .5) * 8;
      const y = 5 + row * 12.7 + (random() - .5) * 6;
      if (!ctx.isPointInPath(crown, x, y)) continue;
      let anchor = fork, nearest = Infinity;
      for (const point of anchors) {
        const distance = (point.x - x)**2 + (point.y - y)**2;
        if (distance < nearest) { nearest = distance; anchor = point; }
      }
      const layer = random() < .35 ? backLeaves : frontLeaves;
      layer.push({x, y, anchor, size:15 + random()*10, angle:(random()-.5)*1.05,
        sprite:sprites[palette[Math.floor(random()*palette.length)]],
        delay:1.12 + Math.hypot(x-fork.x, y-fork.y)*.0058 + random()*.19});
    }
  }

  // Paint a curved, tapered segment up to its growing tip.
  function wood(x, y, cx, cy, endX, endY, startRadius, endRadius, t) {
    if (t <= 0) return;
    const ax = x + (cx-x)*t, ay = y + (cy-y)*t;
    const bx = cx + (endX-cx)*t, by = cy + (endY-cy)*t;
    const tipX = ax + (bx-ax)*t, tipY = ay + (by-ay)*t;
    const distance = Math.hypot(tipX-x, tipY-y) || 1;
    const nx = (y-tipY)/distance, ny = (tipX-x)/distance;
    const radius = startRadius + (endRadius-startRadius)*t;
    const midRadius = (startRadius+radius)/2;
    ctx.beginPath();
    ctx.moveTo(x+nx*startRadius, y+ny*startRadius);
    ctx.quadraticCurveTo(ax+nx*midRadius, ay+ny*midRadius, tipX+nx*radius, tipY+ny*radius);
    ctx.lineTo(tipX-nx*radius, tipY-ny*radius);
    ctx.quadraticCurveTo(ax-nx*midRadius, ay-ny*midRadius, x-nx*startRadius, y-ny*startRadius);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(tipX, tipY, radius, 0, Math.PI*2);
    ctx.fill();
  }

  function paintLeaves(leaves, t) {
    for (const leaf of leaves) {
      const growth = ease(clamp((t-leaf.delay)/.58));
      if (!growth) continue;
      const x = leaf.anchor.x + (leaf.x-leaf.anchor.x)*growth;
      const y = leaf.anchor.y + (leaf.y-leaf.anchor.y)*growth;
      const size = leaf.size*growth;
      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(leaf.angle - .16*(1-growth));
      ctx.drawImage(leaf.sprite, -size/2, -size/2, size, size);
      ctx.restore();
    }
  }

  // Let the trunk emerge as the warm circle clears the bottom of the screen.
  const start = performance.now() + 510;
  let frame = 0, width = 0, height = 0, ratio = 1;
  function render(now) {
    cancelAnimationFrame(frame);
    const t = motion.matches ? 5 : Math.max(0, (now-start)/1000);
    const portrait = width < height;
    const scale = Math.min(width*(portrait ? .96 : .71), height*.93)/360;
    if (!scale) return;
    const top = portrait ? (height-scale*260)*.33 : height*.048;
    const centreX = width*(portrait ? .5 : .57);
    const rootY = (height-top)/scale + 7;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    for (let i=0; i<8; i++) {
      const size = scale*(12+i%3*3);
      const x = width*((.07+i*.379)%1) + Math.sin(t*.4+i)*scale*5;
      const y = height*((.16+i*.237)%1) - Math.sin(t*.5+i*2)*scale*6;
      ctx.globalAlpha = .09 + (i%3)*.035;
      ctx.drawImage(sprites[i%sprites.length], x, y, size, size);
    }
    ctx.globalAlpha = 1;
    ctx.translate(centreX-180*scale, top);
    ctx.scale(scale, scale);
    paintLeaves(backLeaves, t);
    ctx.fillStyle = "#704658";
    wood(177, rootY, 194, (rootY+fork.y)/2, fork.x, fork.y, 9, fork.radius, ease(clamp(t/.85)));
    for (const limb of limbs) {
      const {base, tip, controlX, controlY} = limb;
      const growth = clamp((t-base.arrival)/(tip.arrival-base.arrival));
      wood(base.x, base.y, controlX, controlY, tip.x, tip.y, base.radius*.85, tip.radius, growth);
    }
    paintLeaves(frontLeaves, t);
    if (!motion.matches && t<5) frame=requestAnimationFrame(render);
  }

  function resize() {
    width=canvas.clientWidth; height=canvas.clientHeight;
    ratio=Math.min(window.devicePixelRatio || 1, 2);
    canvas.width=Math.round(width*ratio); canvas.height=Math.round(height*ratio);
    render(performance.now());
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  motion.addEventListener("change", resize);
  resize();
  return () => {
    observer.disconnect();
    motion.removeEventListener("change", resize);
    cancelAnimationFrame(frame);
  };
}

$("#open-gift").addEventListener("click",()=>{
  const gift=$("#open-gift");if(gift.disabled)return;gift.disabled=true;
  tone(659);tone(880,.7,.07,.18);
  if (reduced.matches) { show("from"); return; }
  gift.classList.add("unwrapped");
  const rain=$(".rose-rain");
  const columns = Math.min(13, Math.max(5, Math.ceil(innerWidth / 110)));
  const cell = innerWidth / columns;
  const rows = Math.max(3, Math.min(14, Math.ceil(innerHeight / (cell * .88))));
  rain.style.setProperty("--rose-size", Math.max(cell, innerHeight / rows) * 1.32 + "px");
  const bouquet = document.createDocumentFragment();
  for(let i=0;i<(columns+1)*rows;i++){
    const rose=document.createElement("img");rose.src="assets/rose.webp";rose.alt="";
    const row = Math.floor(i / (columns+1));
    const col = i % (columns+1);
    const y = (row + .25 + Math.random() * .48) * 100 / rows;
    rose.style.left = ((col - (row % 2) * .5 + .05 + Math.random() * .55) * 100 / columns) + "%";
    rose.style.top = y + "%";
    rose.style.scale = (.76 + Math.random() * .39).toFixed(2);
    rose.style.setProperty("--fall-from", -(y + 23) + "vh");
    rose.style.setProperty("--fall-to", (120 - y) + "vh");
    rose.style.setProperty("--spin", (Math.random() - .5) * 88 + "deg");
    rose.style.animationDelay = ((1 - row / rows) * 270 + Math.random() * 180) + "ms";
    bouquet.append(rose);
  }
  rain.append(bouquet);
  // Change the scene under the roses, then let the same petals fall off it.
  later(()=>show("from"), 1250);
  window.setTimeout(()=>rain.replaceChildren(), 2880);
});
const albumPhotos = [
  {src:"assets/album/waterfront.jpg", alt:"Gunjan in a cream dress by the water", focus:"55% 65%", zoom:1.04, angle:-5},
  {src:"assets/album/floral-dress.jpg", alt:"Gunjan looking over her shoulder in a floral dress", focus:"44% 77%", zoom:1.13, angle:3},
  {src:"assets/album/cafe.jpg", alt:"Gunjan smiling at a café table", focus:"55% 10%", zoom:1.09, angle:-4},
  {src:"assets/album/mirror.jpg", alt:"Gunjan taking a selfie in a round mirror", focus:"2% 53%", zoom:1.42, angle:-5},
  {src:"assets/album/sunlit-portrait.jpg", alt:"Gunjan in a red top, smiling in the sunlight", focus:"52% 58%", zoom:1.16, angle:5},
  {src:"assets/album/garden.jpg", alt:"Gunjan standing beneath a garden pergola", focus:"55% 71%", zoom:1.55, angle:7},
  {src:"assets/album/evening-smile.jpg", alt:"Gunjan smiling against a dark background", focus:"78% 30%", zoom:1, angle:4},
  {src:"assets/album/terrace.jpg", alt:"Gunjan resting her chin on her hand on the terrace at night", focus:"52% 57%", zoom:1.08, angle:6}
];
albumPhotos.forEach((photo, i) => {
  const frame = document.createElement("div");
  frame.className = "polaroid";
  frame.style.setProperty("--angle", photo.angle + "deg");
  frame.style.setProperty("--delay", (.18 + i*.105) + "s");
  const crop = document.createElement("div");
  crop.className = "photo-window";
  crop.style.setProperty("--photo-focus", photo.focus);
  crop.style.setProperty("--photo-zoom", photo.zoom);
  const img = new Image();
  img.alt = photo.alt;
  img.src = photo.src;
  crop.append(img);
  frame.append(crop);
  $("#polaroids").append(frame);
});
const door = $("#door"), knocker = $(".knocker");
let knocks = 0;
let doorRecoil;
door.addEventListener("click", event => {
  if (knocks === 3) return;
  knocks++;
  const bounds = door.getBoundingClientRect();
  const ring = knocker.getBoundingClientRect();
  const tapX = event.detail ? event.clientX : ring.left + ring.width / 2;
  const tapY = event.detail ? event.clientY : ring.top + ring.height / 2;
  const impact = document.createElement("span");
  impact.className = "knock-impact";
  impact.setAttribute("aria-hidden", "true");
  impact.style.left = ((tapX - bounds.left) / bounds.width * door.offsetWidth - door.clientLeft) + "px";
  impact.style.top = ((tapY - bounds.top) / bounds.height * door.offsetHeight - door.clientTop) + "px";
  door.append(impact);
  window.setTimeout(() => impact.remove(), reduced.matches ? 260 : 620);
  if (!reduced.matches) {
    doorRecoil?.cancel();
    doorRecoil = door.animate([
      {translate:"0 0"}, {translate:"0 3px", offset:.13}, {translate:"0 -2px", offset:.32},
      {translate:"0 1px", offset:.56}, {translate:"0 0"}
    ], {duration:330, easing:"ease-out"});
    knocker.classList.remove("hit");
    void knocker.offsetWidth;
    knocker.classList.add("hit");
  }
  tone(142, .11, .18); tone(405, .055, .09);
  $("#knocks").textContent = "● ".repeat(knocks) + "○ ".repeat(3-knocks);
  if (knocks < 3) { announce(knocks + " of 3 knocks."); return; }
  announce("Come in, Gunjan.");
  later(() => {
    door.classList.add("open");
    $(".door-frame").classList.add("welcoming");
    later(() => show("scratch"), reduced.matches ? 650 : 1730);
  }, reduced.matches ? 0 : 185);
});

const foil=$("#foil"), ink=foil.getContext("2d",{willReadFrequently:true});
let exhibitIndex=0, previousPoint=null, activeScratch=null;
const uncovered=new Set();
let foilPrint;
function renderScratch() {
  previousPoint=null;activeScratch=null;
  $("#scratch-photo").src=photoPath(exhibitIndex);$("#scratch-photo").alt=captions[exhibitIndex];
  $("#exhibit").textContent=captions[exhibitIndex];$("#photo-count").textContent=(exhibitIndex+1)+" / "+captions.length;
  foil.classList.toggle("revealed",uncovered.has(exhibitIndex));foil.tabIndex=uncovered.has(exhibitIndex)?-1:0;
  ink.globalCompositeOperation="source-over";const w=foil.width;
  if (foilPrint) { ink.drawImage(foilPrint, 0, 0); return; }
  const roseFoil=ink.createLinearGradient(0,0,w,w);
  [[0,"#ce96b0"],[.25,"#f3d2e1"],[.55,"#e8abc6"],[.85,"#d79eb8"],[1,"#f6d8e7"]].forEach(([k,c])=>roseFoil.addColorStop(k,c));
  ink.fillStyle=roseFoil;ink.fillRect(0,0,w,w);
  for(let i=0;i<6000;i++){ink.fillStyle=i%2?"#fff6fa38":"#95536f20";ink.fillRect(Math.random()*w,Math.random()*w,1.6,1.6);}
  ink.textAlign="center";ink.fillStyle="#5b2c44";ink.font="23px Georgia";ink.fillText("✦",w/2,w*.44);
  ink.font="bold 34px Georgia";ink.fillText("Scratch to see it",w/2,w*.54);
  ink.font="italic 20px Georgia";ink.fillText("move your finger here",w/2,w*.61);
  foilPrint = document.createElement("canvas");
  foilPrint.width = w; foilPrint.height = foil.height;
  foilPrint.getContext("2d").drawImage(foil, 0, 0);
}
function revealPhoto() {
  if(uncovered.has(exhibitIndex))return;
  uncovered.add(exhibitIndex);foil.classList.add("revealed");foil.tabIndex=-1;
  announce("Revealed "+captions[exhibitIndex]);tone(830,.48,.05);
}
function scratchPoint(e){
  const r=foil.getBoundingClientRect(),x=(e.clientX-r.left)*foil.width/r.width,y=(e.clientY-r.top)*foil.height/r.height;
  ink.globalCompositeOperation="destination-out";ink.strokeStyle="#000";ink.lineWidth=66;ink.lineCap="round";ink.lineJoin="round";
  ink.beginPath();ink.moveTo(previousPoint?.x??x-.1,previousPoint?.y??y);ink.lineTo(x,y);ink.stroke();previousPoint={x,y};
}
function checkCoverage(){
  const pixels=ink.getImageData(0,0,foil.width,foil.height).data;
  let clear=0,total=0;
  for(let y=8;y<foil.height;y+=16)for(let x=8;x<foil.width;x+=16){total++;if(pixels[(y*foil.width+x)*4+3]<100)clear++;}
  if(clear/total>.42)revealPhoto();
}
foil.addEventListener("pointerdown",e=>{
  if(activeScratch!==null||uncovered.has(exhibitIndex)||e.button!==0)return;
  activeScratch=e.pointerId;foil.setPointerCapture(e.pointerId);previousPoint=null;scratchPoint(e);
});
foil.addEventListener("pointermove",e=>{if(e.pointerId===activeScratch)scratchPoint(e);});
function finishScratch(e){if(e.pointerId!==activeScratch)return;previousPoint=null;activeScratch=null;checkCoverage();}
foil.addEventListener("pointerup",finishScratch);foil.addEventListener("pointercancel",finishScratch);
foil.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();revealPhoto();}});
function changePhoto(delta) {
  const picture = $(".scratch-picture");
  picture.querySelector(".previous-print")?.remove();
  if (!reduced.matches) {
    // Preserve even a partly scratched print while the next exhibit slides in.
    const print = document.createElement("canvas");
    print.width = foil.width;
    print.height = foil.height;
    print.className = "previous-print";
    print.setAttribute("aria-hidden", "true");
    const ctx = print.getContext("2d");
    const image = $("#scratch-photo");
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    if (side) ctx.drawImage(image, (image.naturalWidth-side)/2, (image.naturalHeight-side)/2, side, side, 0, 0, print.width, print.height);
    ctx.globalAlpha = Number(getComputedStyle(foil).opacity);
    ctx.drawImage(foil, 0, 0);
    picture.append(print);
    const slide = print.animate([
      {transform:"translateX(0)"},
      {transform:"translateX(" + (-delta * 108) + "%)"}
    ], {duration:510, easing:settle});
    slide.onfinish = () => print.remove();
    $("#exhibit").animate([{opacity:.15, transform:"translateY(4px)"}, {opacity:1, transform:"none"}], {duration:460, easing:settle});
  }
  exhibitIndex=(exhibitIndex+delta+captions.length)%captions.length;
  renderScratch();
  foil.getAnimations().forEach(animation => animation.finish());
}
$("#prev-photo").addEventListener("click",()=>changePhoto(-1));$("#next-photo").addEventListener("click",()=>changePhoto(1));

let order=[],selected=null,moves=0,puzzleClock=0,started=0,solved=false,drag=null,swallowedClick=false;
const tiles=$("#tiles"), puzzlePhoto="assets/puzzle-hug.jpg";
const formatTime=s=>Math.floor(s/60)+":"+String(Math.floor(s)%60).padStart(2,"0");
function startPuzzle(){
  selected=null;moves=0;solved=false;started=Date.now();drag=null;swallowedClick=false;
  order=[2,1,0,3,4,5,6,8,7];$("#solved").hidden=true;$("#peek-image").src=puzzlePhoto;$("#peek-image").hidden=true;
  $("#timer").textContent="0:00";$("#moves").textContent="Moves 0";tiles.replaceChildren();
  order.forEach((_,i)=>{
    const tile=document.createElement("button");tile.className="tile";tile.dataset.slot=i;
    const face=document.createElement("span");face.className="tile-face";face.setAttribute("aria-hidden","true");
    const image = new Image();
    image.alt = "";
    image.src = puzzlePhoto;
    face.append(image);tile.append(face);tiles.append(tile);
  });
  paintTiles();
  puzzleClock=setInterval(()=>{$("#timer").textContent=formatTime((Date.now()-started)/1000);},500);
}
function paintTiles(){
  [...tiles.children].forEach((tile,slot)=>{
    const part=order[slot], image=tile.querySelector("img");
    image.style.left = -(part % 3) * 100 + "%";
    image.style.top = -Math.floor(part / 3) * 100 + "%";
    tile.classList.toggle("selected",selected===slot);tile.setAttribute("aria-pressed",String(selected===slot));
    tile.setAttribute("aria-label","Position "+(slot+1)+", picture piece "+(part+1));tile.disabled=solved;
  });
}
function swapTiles(a,b){
  if(a===b||solved)return;
  const faces = [tiles.children[a].firstElementChild, tiles.children[b].firstElementChild];
  const origins = faces.map(face => face.getBoundingClientRect());
  const room = $("#puzzle .room-wrap");
  const top = room.getBoundingClientRect().top;
  [order[a],order[b]]=[order[b],order[a]];selected=null;moves++;
  $("#moves").textContent="Moves "+moves;solved=order.every((v,i)=>v===i);paintTiles();tone(523,.16,.06);
  if(solved){clearInterval(puzzleClock);$("#solved").hidden=false;watchScrollReveals($("#solved"));particles(0,0,true);announce("Photo restored! The next room is open.");}
  if (reduced.matches) return;
  if (solved) {
    const shift = top - room.getBoundingClientRect().top;
    room.animate([{transform:"translateY(" + shift + "px)"}, {transform:"none"}], {duration:540, easing:settle});
  }
  faces.forEach((face, index) => {
    face.getAnimations().forEach(animation => animation.cancel());
    const end = face.getBoundingClientRect();
    const start = origins[1-index];
    face.animate([
      {transform:"translate(" + (start.left-end.left) + "px," + (start.top-end.top) + "px)", zIndex:2},
      {transform:"none", zIndex:2}
    ], {duration:390, easing:settle});
  });
}
tiles.addEventListener("click",e=>{
  const tile=e.target.closest(".tile");if(!tile||solved)return;
  if(swallowedClick && e.detail){swallowedClick=false;return;}
  const slot=Number(tile.dataset.slot);
  if(selected===null||selected===slot){selected=selected===slot?null:slot;paintTiles();}else swapTiles(selected,slot);
});
tiles.addEventListener("pointerdown",e=>{
  const tile=e.target.closest(".tile");if(!tile||solved||!e.isPrimary||e.button!==0)return;
  swallowedClick=false;drag={id:e.pointerId,slot:Number(tile.dataset.slot)};tile.setPointerCapture(e.pointerId);
});
tiles.addEventListener("pointerup",e=>{
  if(!drag||drag.id!==e.pointerId)return;
  const target=document.elementFromPoint(e.clientX,e.clientY)?.closest(".tile");
  if(target && Number(target.dataset.slot)!==drag.slot){swapTiles(drag.slot,Number(target.dataset.slot));swallowedClick=true;}
  drag=null;
});
tiles.addEventListener("pointercancel",()=>{drag=null;});
const peek=$("#peek"),peekImage=$("#peek-image");
peek.addEventListener("pointerdown",e=>{peek.setPointerCapture(e.pointerId);peekImage.hidden=false;});
["pointerup","pointercancel","lostpointercapture","blur"].forEach(event=>peek.addEventListener(event,()=>{peekImage.hidden=true;}));
peek.addEventListener("keydown",e=>{if(e.key===" "||e.key==="Enter"){e.preventDefault();peekImage.hidden=false;}});
peek.addEventListener("keyup",()=>{peekImage.hidden=true;});
const envelopeButton = $("#envelope");
envelopeButton.addEventListener("click", () => {
  if (envelopeButton.disabled) return;
  envelopeButton.disabled = true;
  tone(659, .65, .07);
  const wrap = $("#envelope-wrap"), content = $("#letter-content"), heading = $("#letter-heading");
  const room = wrap.parentElement;
  const paper = content.querySelector(".letter-paper");
  if (reduced.matches) {
    wrap.hidden = true;
    content.hidden = false;
    announce("Your letter is open.");
    heading.focus({preventScroll:true});
    return;
  }

  const pocket = wrap.querySelector(".envelope");
  const insert = wrap.querySelector(".paper-peek");
  const closed = insert.getBoundingClientRect();
  const readingWidth = Math.min(room.clientWidth, 365);
  insert.style.setProperty("--reading-width", readingWidth + "px");
  insert.style.setProperty("--insert-scale", insert.clientWidth / readingWidth);
  pocket.style.setProperty("--sleeve-drop", Math.max(18, 12 - closed.top + closed.height * 1.16) + "px");
  insert.append(paper);
  room.classList.add("unsealing");
  pocket.classList.add("open");

  later(() => {
    const start = insert.getBoundingClientRect();
    const shell = wrap.getBoundingClientRect();
    const scene = $("#letter").getBoundingClientRect();
    // Leave the empty sleeve where it was as the same sheet unfolds in front of it.
    wrap.style.left = (shell.left - scene.left) + "px";
    wrap.style.top = (shell.top - scene.top) + "px";
    wrap.style.width = shell.width + "px";
    wrap.classList.add("released");
    content.prepend(paper);
    content.hidden = false;
    paper.style.transform = "none";
    const end = paper.getBoundingClientRect();
    watchScrollReveals(content);
    paper.style.removeProperty("transform");
    const scale = start.width / end.width;
    const fold = Math.max(0, end.height - start.height / scale);
    paper.animate([
      {transform:"translate(" + (start.left-end.left) + "px," + (start.top-end.top) + "px) scale(" + scale + ")", clipPath:"inset(0 0 " + fold + "px)"},
      {transform:"rotate(-.55deg)", clipPath:"inset(0 0 0px)"}
    ], {duration:820, easing:settle});
    room.classList.remove("unsealing");
    later(() => { wrap.hidden = true; }, 490);
    announce("Your letter is open.");
    heading.focus({preventScroll:true});
  }, 1300);
});
const play=$("#voice-play");
function voiceState(){
  const playing=!voice.paused&&!voice.ended;
  play.textContent=playing?"Ⅱ":"▶";play.setAttribute("aria-label",(playing?"Pause":"Play")+" birthday voice note");
  $("#voice-time").textContent=formatTime(playing?voice.currentTime:Number.isFinite(voice.duration)?voice.duration:0);
}
["loadedmetadata","timeupdate","play","pause","ended"].forEach(event=>voice.addEventListener(event,voiceState));
play.addEventListener("click",async()=>{
  if(!voice.paused){voice.pause();return;}
  try{await voice.play();}catch{announce("The voice note could not play. The birthday message is in the letter above.");}
});
const promises=["Never go to bed angry.","Say the hard thing, gently.","Always share the last bite.","Choose you again, every ordinary morning.","Pick you first. Every time."];
promises.forEach(p=>{
  const label=document.createElement("label"),input=document.createElement("input");input.type="checkbox";input.addEventListener("change",updatePromises);
  label.append(input,document.createTextNode(p));$("#checks").append(label);
});
function updatePromises(){
  const count=document.querySelectorAll("#checks input:checked").length;
  $("#sign").disabled=count!==promises.length;
  $("#sign").textContent=count===promises.length?"Make it official":"Tick every promise ("+count+"/"+promises.length+")";
}
$("#sign").addEventListener("click",()=>{
  if($("#sign").disabled)return;
  $("#checks").querySelectorAll("input").forEach(input=>input.disabled=true);
  $("#sign").hidden=true;$("#stamp").hidden=false;$("#birthday-wish").hidden=false;
  watchScrollReveals($("#birthday-wish"));
  particles(0,0,true);tone(523);tone(659,.7,.08,.15);tone(784,.9,.08,.3);
  announce("Sealed with love. Happy birthday, Gunjan!");
  $("#restart").focus({preventScroll:true});
});
$("#restart").addEventListener("click",()=>window.location.reload());
