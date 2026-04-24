// ================================================================
// hexBattle.js — Mode Combat Hexagonal (Étape 1 : Grille + Rendu)
// ================================================================
// Dépendances globales lues depuis le jeu principal :
//   META, P, getH, spPwr, gainXP, fmt, escapeHtml, saveMeta,
//   navigate, updateTop
// Aucune modification des autres fichiers JS côté logique.
// ================================================================

// ── ÉTAT GLOBAL ─────────────────────────────────────────────────
var HB = null;  // état du combat hexagonal (null = pas de combat)

// Fallback local si ui.js n'est pas encore chargé
function hbEscape(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
// ── CONFIGURATION ────────────────────────────────────────────────
var HB_CFG = {
  MAP_RADIUS  : 3,     // rayon de la carte en hexs (rayon 3 = 37 cases)
 WEAPON_RANGE : 2,
  PM_PLAYER   : 3,     // points de mouvement joueur par tour
  PA_PLAYER   : 6,     // points d'action joueur par tour
  PM_ENEMY    : 2,
  PA_ENEMY    : 6,
  PA_BASIC_ATK: 4,     // coût PA attaque de base
  AI_DELAY    : 500,   // ms entre chaque action IA
  REWARD_CR_BASE  : 120,
  REWARD_XP_BASE  : 40,
};

// ── COORDONNÉES HEXAGONALES (système cube) ────────────────────────
// Layout isométrique vue 3/4 (flat-top compressé sur y)
// Conversion cube (q,r,s) ↔ pixel
var HB_HEX = (function() {
  var SIZE  = 36;    // rayon d'un hex
  var ISO   = 0.54;  // compression verticale (vue 3/4)
  var DEPTH = 10;    // hauteur du mur isométrique en px

  var DIRS = [
    {q:1,r:0,s:-1},{q:1,r:-1,s:0},{q:0,r:-1,s:1},
    {q:-1,r:0,s:1},{q:-1,r:1,s:0},{q:0,r:1,s:-1}
  ];

  // cube → pixel isométrique
  function toPixel(q, r, ox, oy) {
    var x = SIZE * (3/2 * q);
    var y = SIZE * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r);
    return { x: Math.round(x + ox), y: Math.round(y * ISO + oy) };
  }

  // pixel → cube (annule le squish ISO avant calcul)
  function fromPixel(px, py, ox, oy) {
    var x = px - ox;
    var y = (py - oy) / ISO;
    var q = (2/3 * x) / SIZE;
    var r = (-1/3 * x + Math.sqrt(3)/3 * y) / SIZE;
    var s = -q - r;
    var rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
    var dq = Math.abs(rq-q), dr = Math.abs(rr-r), ds = Math.abs(rs-s);
    if (dq > dr && dq > ds) rq = -rr-rs;
    else if (dr > ds) rr = -rq-rs;
    return { q: rq, r: rr, s: -rq-rr };
  }

  function dist(a, b) {
    return (Math.abs(a.q-b.q) + Math.abs(a.r-b.r) + Math.abs(a.s-b.s)) / 2;
  }

  function neighbors(h) {
    return DIRS.map(function(d){ return {q:h.q+d.q, r:h.r+d.r, s:h.s+d.s}; });
  }

  function hexesInRadius(R) {
    var result = [];
    for (var q = -R; q <= R; q++) {
      var r1 = Math.max(-R, -q-R), r2 = Math.min(R, -q+R);
      for (var r = r1; r <= r2; r++) {
        result.push({ q: q, r: r, s: -q-r });
      }
    }
    return result;
  }

  // Coins avec compression ISO sur y
  function corners(cx, cy) {
    var pts = [];
    for (var i = 0; i < 6; i++) {
      var angle = Math.PI / 180 * (60 * i);
      pts.push({ x: cx + SIZE * Math.cos(angle),
                 y: cy + SIZE * Math.sin(angle) * ISO });
    }
    return pts;
  }

  return { SIZE: SIZE, ISO: ISO, DEPTH: DEPTH, DIRS: DIRS,
           toPixel: toPixel, fromPixel: fromPixel,
           dist: dist, neighbors: neighbors, hexesInRadius: hexesInRadius,
           corners: corners };
}());

// ── CLÉ HEX ─────────────────────────────────────────────────────
function hKey(h) { return h.q + ',' + h.r; }
function hEq(a, b) { return a.q === b.q && a.r === b.r; }

// ── PATHFINDING BFS ──────────────────────────────────────────────
// Retourne les hexs atteignables en ≤ maxPM pas depuis `from`
// en évitant les hexs bloqués ou occupés (sauf exclure une unité)
function hbReachable(from, maxPM, excludeUnit) {
  var result = [], visited = {}, queue = [{ h: from, dist: 0 }];
  visited[hKey(from)] = true;
  while (queue.length) {
    var cur = queue.shift();
    if (cur.dist > 0) result.push(cur.h);
    if (cur.dist >= maxPM) continue;
    HB_HEX.neighbors(cur.h).forEach(function(nb) {
      var k = hKey(nb);
      if (visited[k]) return;
      if (!hbIsWalkable(nb, excludeUnit)) return;
      visited[k] = true;
      queue.push({ h: nb, dist: cur.dist + 1 });
    });
  }
  return result;
}

// BFS chemin complet de src à dst
function hbPath(src, dst, excludeUnit) {
  if (hEq(src, dst)) return [];
  var visited = {}, prev = {}, queue = [src];
  visited[hKey(src)] = true;
  while (queue.length) {
    var cur = queue.shift();
    if (hEq(cur, dst)) {
      // Reconstruit le chemin
      var path = [], k = hKey(dst);
      while (k && k !== hKey(src)) {
        var parts = k.split(',');
        var h = { q: +parts[0], r: +parts[1], s: -parts[0]-parts[1] };
        path.unshift(h);
        k = prev[k];
      }
      return path;
    }
    HB_HEX.neighbors(cur).forEach(function(nb) {
      var k = hKey(nb);
      if (visited[k]) return;
      if (!hbIsWalkable(nb, excludeUnit) && !hEq(nb, dst)) return;
      visited[k] = true;
      prev[k] = hKey(cur);
      queue.push(nb);
    });
  }
  return [];
}

// ── HELPERS ÉTAT ─────────────────────────────────────────────────
function hbIsWalkable(h, excludeUnit) {
  if (!HB) return false;
  // Doit être une case valide de la carte
  if (!HB.hexMap[hKey(h)]) return false;
  // Obstacle
  if (HB.hexMap[hKey(h)].obstacle) return false;
  // Occupé par une unité vivante
  return !HB.units.some(function(u) {
    return u.alive && u !== excludeUnit && hEq(u.pos, h);
  });
}

function hbUnitAt(h) {
  if (!HB) return null;
  return HB.units.find(function(u){ return u.alive && hEq(u.pos, h); }) || null;
}

// ── LIGNE DE VUE (raycast cube lerp) ─────────────────────────────
// Retourne true si le chemin from→to est dégagé.
// blockUnits=true : les unités vivantes intermédiaires bloquent aussi.
function hbHasLOS(from, to, blockUnits) {
  var N = HB_HEX.dist(from, to);
  if (N === 0) return true;
  for (var i = 1; i < N; i++) {
    var t  = i / N;
    // Nudge epsilon pour éviter les cas d'arête ambigus
    var q  = from.q*(1-t) + to.q*t + 1e-6;
    var r  = from.r*(1-t) + to.r*t + 1e-6;
    var s  = from.s*(1-t) + to.s*t - 2e-6;
    var rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
    var dq = Math.abs(rq-q), dr = Math.abs(rr-r), ds = Math.abs(rs-s);
    if (dq>dr&&dq>ds) rq=-rr-rs; else if (dr>ds) rr=-rq-rs; else rs=-rq-rr;
    var cell = HB.hexMap[hKey({q:rq,r:rr,s:rs})];
    if (!cell || cell.obstacle) return false;
    if (blockUnits) {
      var occ = hbUnitAt({q:rq,r:rr,s:rs});
      if (occ) return false;
    }
  }
  return true;
}

function hbLog(msg) {
  if (!HB) return;
  HB.log.unshift(msg);
  if (HB.log.length > 30) HB.log.pop();
}
function hbToggleInfo(id){
  var u=HB&&HB.enemies.find(function(x){return x.id===id;});
  HB.infoUnit=(HB.infoUnit===u?null:u);
  renderHexHUD();
}
function hbRenderInfoPanel() {
  var el = document.getElementById('hb-info-panel');
  if (!el) return;
  if (!HB || !HB.infoUnit || !HB.infoUnit.alive) {
    el.style.display = 'none';
    return;
  }
  var u = HB.infoUnit;
  el.style.display = 'block';
  el.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">'
    +'<span style="font-size:1.6rem">'+u.icon+'</span>'
    +'<div style="flex:1">'
    +'<div style="font-weight:700;font-size:.8rem;color:var(--text)">'+hbEscape(u.name)+'</div>'
    +'<div style="font-size:.65rem;color:'+u.col+'">'+u.id.split('_')[0]+'</div>'
    +'</div>'
    +'<span onclick="HB.infoUnit=null;hbRenderInfoPanel()" style="cursor:pointer;color:var(--text4);font-size:1.2rem;line-height:1">✕</span>'
    +'</div>'
    +'<div style="font-size:.68rem;color:var(--text3);display:flex;flex-direction:column;gap:3px">'
    +'<div>♥ PV : '+Math.round(u.hp)+' / '+Math.round(u.mHp)+'</div>'
    +(u.mSh?'<div>◈ Boucl. : '+Math.round(u.sh)+' / '+Math.round(u.mSh)+'</div>':'')
    +'<div>⚔ ATQ : '+u.atk+' · PM : '+u.pmMax+' · PA : '+u.paMax+'</div>'
    +(u.effs&&u.effs.length?'<div style="color:var(--gold)">Effets : '+u.effs.map(function(e){return(e.label||e.type)+'('+e.turns+'t)';}).join(' · ')+'</div>':'')
    +'</div>';
}
function hbCurrentUnit() {
  if (!HB) return null;
  return HB.units[HB.turnIdx % HB.units.length];
}

// ── CONSTRUCTION DE LA CARTE ──────────────────────────────────────
// ── DÉFINITIONS DES MAPS ──────────────────────────────────────────
var HB_MAP_DEFS = {

  // MAP 1 — Couloir industriel : mur vertical central, deux voies
  'corridor': {
    radius: 3,
    bgImage: 'assets/hexmaps/corridor.png',
    obstacles: [
      {q:0,r:-2},{q:0,r:-1},{q:0,r:0},{q:0,r:1},
      {q:1,r:-3},{q:-1,r:3}
    ],
    terrain: function(h, dist0, radius) {
      if (dist0 === radius) return 'edge';
      if (h.q === 0) return 'energy';
      return 'metal';
    }
  },

  // MAP 2 — Place ouverte : radius 4, piliers en croix
  'plaza': {
    radius: 4,
    bgImage: 'assets/hexmaps/plaza.png',
    obstacles: [
      {q:2,r:-2},{q:-2,r:2},
      {q:2,r:0},{q:-2,r:0},
      {q:0,r:2},{q:0,r:-2}
    ],
    terrain: function(h, dist0, radius) {
      if (dist0 === radius) return 'edge';
      if (dist0 <= 1) return 'energy';
      return 'metal';
    }
  },

  // MAP 3 — Toits cyberpunk : îlots brisés, caisses
  'rooftops': {
    radius: 3,
    bgImage: 'assets/hexmaps/rooftops.png',
    obstacles: [
      {q:1,r:-2},{q:2,r:-1},
      {q:-1,r:2},{q:-2,r:1},
      {q:1,r:1}
    ],
    terrain: function(h, dist0, radius) {
      if (dist0 === radius) return 'edge';
      if (Math.random() < 0.07) return 'energy';
      return 'metal';
    }
  }
};

function hbBuildMap(mapDef) {
  var def     = (typeof mapDef === 'string') ? HB_MAP_DEFS[mapDef] : mapDef;
  if (!def) def = HB_MAP_DEFS['corridor'];
  var radius  = def.radius || HB_CFG.MAP_RADIUS;
  var hexes   = HB_HEX.hexesInRadius(radius);
  var map     = {};
  var obsSet  = {};
  (def.obstacles||[]).forEach(function(o){ obsSet[o.q+','+o.r] = true; });
  hexes.forEach(function(h) {
    var dist0   = Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.s));
    var terrain = def.terrain ? def.terrain(h, dist0, radius) : (dist0===radius?'edge':'metal');
    map[hKey(h)] = { q:h.q, r:h.r, s:h.s, obstacle:!!obsSet[h.q+','+h.r], terrain:terrain };
  });
  return map;
}

// ── CONSTRUCTION DES UNITÉS ───────────────────────────────────────
function hbMakePlayer() {
  return {
    id       : 'player',
    isPlayer : true,
    name     : META.hero.name || getH(META.heroId).name,
    icon     : '⚔️',
    col      : '#00d4ff',
    hp       : P.mHp, mHp: P.mHp,
    sh       : P.mSh, mSh: P.mSh,
    atk      : P.atk,
    pm: HB_CFG.PM_PLAYER, pmMax: HB_CFG.PM_PLAYER,
    pa: HB_CFG.PA_PLAYER, paMax: HB_CFG.PA_PLAYER,
    effs     : [],
    alive    : true,
    pos      : { q: -2, r: 2, s: 0 },  // spawn bas-gauche
    // Sorts actifs réutilisés depuis le héros
    spells   : hbGetActiveSpells(),
  };
}

function hbGetActiveSpells() {
  var hero = getH(META.heroId || 'berserker');
  var result = [];
  hero.spells.forEach(function(sp) {
    if (sp.passive) return;
    if (META.hero.lv < sp.ulv) return;
    if (META.activeSp.indexOf(sp.id) === -1) return;
    result.push({
      id      : sp.id,
      name    : sp.name,
      type    : sp.type,
      pwr     : sp.pwr,
      energy  : sp.energy,
      dur     : sp.dur || 0,
      hits    : sp.hits || 1,
      range   : sp.hbRange    || 3,
      minRange: sp.hbMinRange || 1,
      aoe     : sp.hbAoe      || 'single',
      cd      : 0,  // cooldown restant en tours
      cdMax   : sp.energy,
    });
  });
  return result;
}

var HB_ENEMY_TEMPLATES = [
  { id:'scout',  name:'Drone Scout',    icon:'🤖', col:'#ff6b35',
    hp:0.6, sh:0.1, atk:0.7, pm:2, pa:6,
    spells:[{id:'bolt', name:'Décharge',type:'burst',pwr:0.8,energy:4,range:3,minRange:1,aoe:'single',cd:0,cdMax:2}]},
  { id:'heavy',  name:'Garde Lourd',    icon:'👾', col:'#c084fc',
    hp:1.1, sh:0.3, atk:0.9, pm:1, pa:6,
    spells:[{id:'slam',name:'Écrasement',type:'burst',pwr:1.3,energy:4,range:1,minRange:1,aoe:'single',cd:0,cdMax:3}]},
  { id:'sniper', name:'Cyber Sniper',   icon:'💀', col:'#fbbf24',
    hp:0.5, sh:0.0, atk:0.6, pm:2, pa:6,
    spells:[{id:'shot',name:'Tir Longue Portée',type:'burst',pwr:1.5,energy:4,range:5,minRange:3,aoe:'single',cd:0,cdMax:2}]},
];

function hbMakeEnemy(templateId, pos) {
  var tpl = HB_ENEMY_TEMPLATES.find(function(t){ return t.id===templateId; }) || HB_ENEMY_TEMPLATES[0];
  var lv  = META.hero.lv || 1;
  var sc  = 1 + lv * 0.04;
  return {
    id       : templateId + '_' + hKey(pos),
    isPlayer : false,
    name     : tpl.name,
    icon     : tpl.icon,
    col      : tpl.col,
    hp       : Math.floor(P.mHp * tpl.hp * sc),
    mHp      : Math.floor(P.mHp * tpl.hp * sc),
    sh       : Math.floor(P.mSh * tpl.sh * sc),
    mSh      : Math.floor(P.mSh * tpl.sh * sc),
    atk      : Math.floor(P.atk * tpl.atk * sc),
    pm: tpl.pm, pmMax: tpl.pm,
    pa: tpl.pa, paMax: tpl.pa,
    effs     : [],
    alive    : true,
    pos      : { q: pos.q, r: pos.r, s: -pos.q-pos.r },
    spells   : tpl.spells.map(function(s){ return Object.assign({},s); }),
  };
}

// ── SCÉNARIOS ────────────────────────────────────────────────────
var HB_SCENARIOS = [
  { id:'patrouille', name:'Patrouille', desc:'Deux drones. Bonne mise en jambe.', diff:'e', icon:'🤖', rewardMult:1.0,
    mapId:'corridor',
    enemies:[{tpl:'scout',q:2,r:-2},{tpl:'scout',q:-1,r:-2}],
    spawns:[{q:-2,r:2},{q:0,r:3},{q:-3,r:1}] },
  { id:'bastion', name:'Bastion', desc:'Un garde lourd et un sniper. Gérez les angles.', diff:'m', icon:'👾', rewardMult:1.6,
    mapId:'plaza',
    enemies:[{tpl:'heavy',q:1,r:-3},{tpl:'sniper',q:-2,r:-1}],
    spawns:[{q:-2,r:2},{q:0,r:3},{q:-3,r:1}] },
  { id:'assaut', name:'Assaut Total', desc:'Trois ennemis coordonnés. Positionnez-vous bien.', diff:'h', icon:'💀', rewardMult:2.5,
    mapId:'rooftops',
    enemies:[{tpl:'scout',q:2,r:-2},{tpl:'heavy',q:0,r:-3},{tpl:'sniper',q:-2,r:-1}],
    spawns:[{q:-2,r:2},{q:0,r:3},{q:-3,r:1}] },
];

// ── CRÉATION D'UN COMBAT ──────────────────────────────────────────
var HB_MIN_LV = 10;

function startHexBattle(scenarioId) {
  if (!META.heroId) { navigate('hero'); return; }
  if (META.hero.lv < HB_MIN_LV) {
    alert('Mode Hex débloqué au niveau ' + HB_MIN_LV + ' ! (Actuel : ' + META.hero.lv + ')');
    navigate('hexbattle');
    return;
  }
  var sc = (HB_SCENARIOS||[]).find(function(s){ return s.id===scenarioId; }) || HB_SCENARIOS[0];
  hbStartWithSpawn(scenarioId, -2, 2);
}

function hbShowSpawnChoice(sc, scenarioId) {
  var bot = document.getElementById('bot');
  if (bot) bot.style.display = 'none';
  navigate('hexbattle');
  var el = document.getElementById('hb-sel');
  if (!el) return;
  document.getElementById('hb-active').style.display = 'none';
  document.getElementById('hb-result').style.display = 'none';
  el.style.display = '';
  var labels = ['Position Nord','Position Centre','Position Sud'];
  var icons  = ['⬆️','⏺️','⬇️'];
  el.innerHTML = '<div class="sec-hdr">⬡ ' + sc.name + ' — Position de départ</div>'
    + '<div style="padding:12px;display:flex;flex-direction:column;gap:10px">'
    + sc.spawns.map(function(sp, i) {
      return '<div style="background:var(--bg1);border:1px solid var(--border);border-left:3px solid var(--cyan);border-radius:12px;padding:12px 14px;cursor:pointer" '
        +'onclick="hbStartWithSpawn(\''+scenarioId+'\','+sp.q+','+sp.r+')">'
        +'<span style="font-size:1.3rem">'+icons[i]+'</span> '
        +'<b style="color:var(--text)">'+labels[i]+'</b>'
        +'</div>';
    }).join('')
    + '</div>';
}

function hbStartWithSpawn(scenarioId, q, r) {
  var sc      = HB_SCENARIOS.find(function(s){ return s.id===scenarioId; }) || HB_SCENARIOS[0];
  var mapDef  = HB_MAP_DEFS[sc.mapId] || HB_MAP_DEFS['corridor'];
  var hexMap  = hbBuildMap(mapDef);
  var player  = hbMakePlayer();
  player.pos  = { q:q, r:r, s:-q-r };
  var enemies = sc.enemies.map(function(e){ return hbMakeEnemy(e.tpl, {q:e.q, r:e.r}); });
  var order   = [player].concat(enemies.sort(function(){ return Math.random()-0.5; }));
  HB = {
    scenario:sc, hexMap:hexMap, units:order, player:player, enemies:enemies,
    turnIdx:0, round:1, phase:'positioning', selected:player, hovered:null,
    actionMode:'move', pendingSpell:null, hlMove:[], hlSpell:[], hlAoe:[],
    camX:0, camY:0, zoom:1, canvasW:0, canvasH:0,
    hexOpacity: true,
    log:['⚔ '+sc.name+' — '+player.name+' joue !'],
    over:false, won:false, rewardCr:0, rewardXP:0, infoUnit:null,
  };
  // Reset complet pour une nouvelle partie propre
  hbStopRAF && hbStopRAF();
  HB_ANIMS = [];
  if (HB_RAF) { cancelAnimationFrame(HB_RAF); HB_RAF = null; }
  // Reset dimensions → force resize() à recalculer la vraie taille du wrapper
  // (sinon clearRect laisse les px hors-bounds de l'ancienne partie visibles)
  HB.canvasW = 0; HB.canvasH = 0;
  // Cache tous les panneaux DOM
  var _sel = document.getElementById('hb-sel');
  var _act = document.getElementById('hb-active');
  var _res = document.getElementById('hb-result');
  var _inf = document.getElementById('hb-info-panel');
  var _ban = document.getElementById('hb-banner');
  var _tip = document.getElementById('hb-tooltip');
  if (_sel) _sel.style.display = '';
  if (_act) _act.style.display = 'none';
  if (_res) _res.style.display = 'none';
  if (_inf) _inf.style.display = 'none';
  if (_ban) _ban.remove();
  if (_tip) _tip.style.display = 'none';
  hbInitPositioning();
  var bot = document.getElementById('bot');
  if (bot) bot.style.display = 'none';
  navigate('hexbattle');
  renderHexBattle(); // un seul appel
}
// ── HIGHLIGHTS ────────────────────────────────────────────────────
function hbInitPositioning() {
  if (!HB) return;
  var spawns = HB.scenario.spawns || [{q:-2,r:2},{q:0,r:3},{q:-3,r:1}];
  HB.hlMove  = spawns.map(function(s){ return {q:s.q,r:s.r,s:-s.q-s.r}; });
  HB.hlSpell = [];
  HB.hlAoe   = [];
}
function hbReadyUp() {
  if (!HB || (HB.phase !== 'positioning' && HB.phase !== 'positioning_done')) return;
  HB.phase = 'player';
  HB.hlMove = [];
  hbLog('— Tour 1 — ' + HB.player.name + ' joue —');
  hbStartTurnTimer && hbStartTurnTimer(60);
  hbRefreshHighlights();
  renderHexBattle();
}
function hbRefreshHighlights() {
  if (!HB || HB.phase !== 'player') { HB.hlMove=[]; HB.hlSpell=[]; HB.hlAoe=[]; return; }
  var p = HB.player;
  HB.hlAoe = [];

  if (HB.actionMode === 'move') {
    HB.hlMove  = p.pm > 0 ? hbReachable(p.pos, p.pm, p) : [];
    HB.hlSpell = [];
  } else if (HB.actionMode === 'spell' && HB.pendingSpell) {
    HB.hlMove  = [];
    HB.hlSpell = hbSpellRange(p.pos, HB.pendingSpell);
  } else if (HB.actionMode === 'weapon') {
    HB.hlMove  = [];
    var wRange = HB.weaponRange || HB_CFG.WEAPON_RANGE;
    HB.hlSpell = [];
    Object.keys(HB.hexMap).forEach(function(k) {
      var h = HB.hexMap[k];
      var d = HB_HEX.dist(p.pos, h);
      if (d >= 1 && d <= wRange && hbHasLOS(p.pos, h, true))
        HB.hlSpell.push({q:h.q, r:h.r, s:h.s});
    });
  } else {
    HB.hlMove = []; HB.hlSpell = [];
  }
}

function hbSpellRange(from, sp) {
  if (sp.hbSelfTarget) return [from];
  if (sp.range === 0) return [from];
  var result = [];
  Object.keys(HB.hexMap).forEach(function(k) {
    var h = HB.hexMap[k];
    var d = HB_HEX.dist(from, h);
    if (d < (sp.minRange||0) || d > sp.range) return;
    if (!hbHasLOS(from, h, true)) return;
    result.push({ q: h.q, r: h.r, s: h.s });
  });
  return result;
}

// ── ACTIONS JOUEUR ────────────────────────────────────────────────
function hbHandleCanvasClick(px, py) {
  if (!HB || HB.over) return;
  if (HB.phase === 'positioning' || HB.phase === 'positioning_done') {
    var zoomLevels = [0.65,1.0,1.35];
    var z  = zoomLevels[HB.zoom||1];
    var cx = HB.canvasW/2, cy = HB.canvasH/2;
    var worldX = (px-cx)/z+cx - HB.camX/z;
    var worldY = (py-cy)/z+cy - HB.camY/z;
    var h = HB_HEX.fromPixel(worldX, worldY, HB.canvasW/2, HB.canvasH/2);
    var isSpawn = HB.hlMove.some(function(c){ return hEq(c,h); });
    if (isSpawn) {
      HB.player.pos = {q:h.q, r:h.r, s:-h.q-h.r};
      HB.phase = 'positioning_done';
      // On garde hlMove pour que les autres cases restent visibles et re-cliquables
      HB_CVS.draw();
      renderHexActionBar();
    } else if (HB.phase === 'positioning_done') {
      // Clic sur une case non-spawn → ignore
    }
    return;
  }
  if (HB.phase !== 'player') return;
  var zoomLevels = [0.65, 1.0, 1.35];
  var z  = zoomLevels[HB.zoom||1];
  var cx = HB.canvasW/2, cy = HB.canvasH/2;
  // Convertit le clic écran → coordonnées monde (annule zoom + caméra)
  var worldX = (px - cx) / z + cx - HB.camX / z;
  var worldY = (py - cy) / z + cy - HB.camY / z;
  var ox = HB.canvasW/2;
  var oy = HB.canvasH/2;
  var h  = HB_HEX.fromPixel(worldX, worldY, ox, oy);
  var p  = HB.player;
  var mode = HB.actionMode;

  if (mode === 'move') {
    var inRange = HB.hlMove.some(function(c){ return hEq(c,h); });
    if (inRange && !hbUnitAt(h)) {
      hbPlayerMove(h);
      return;
    }
  }

  if (mode === 'weapon') {
    // Cherche l'ennemi sur la case cliquée ou sur les cases voisines immédiates
    var wRange = HB.weaponRange || HB_CFG.WEAPON_RANGE;
    var clickedEnemy = hbUnitAt(h);
    if (!clickedEnemy || clickedEnemy.isPlayer) {
      // Pas d'ennemi exact → cherche le plus proche dans les voisins
      var nb = HB_HEX.neighbors(h);
      nb.forEach(function(n) {
        var u = hbUnitAt(n);
        if (u && !u.isPlayer) clickedEnemy = u;
      });
    }
    if (clickedEnemy && !clickedEnemy.isPlayer) {
      var d = HB_HEX.dist(HB.player.pos, clickedEnemy.pos);
      if (d <= wRange) {
        hbWeaponAttack(clickedEnemy);
        return;
      }
    }
    // Clic hors portée → désélectionne
    HB.actionMode = 'move';
    HB.hlSpell = [];
    hbRefreshHighlights();
    renderHexBattle();
    return;
  }

  if (mode === 'spell' && HB.pendingSpell) {
    var inSpell = HB.hlSpell.some(function(c){ return hEq(c,h); });
    if (inSpell) {
      hbPlayerCastSpell(HB.pendingSpell, h);
      return;
    }
  }

  // Clic sur un ennemi → affiche ses stats (sauf si sort en cours)
  var clickedUnit = hbUnitAt(h);
  if (clickedUnit && !clickedUnit.isPlayer && mode !== 'spell') {
    HB.infoUnit = (HB.infoUnit && HB.infoUnit.id === clickedUnit.id) ? null : clickedUnit;
    renderHexHUD();
    return;
  }

  // Clic sur une case vide en dehors des highlights : annule la sélection
  HB.infoUnit = null;
var clickedUnit = hbUnitAt(h);
  if (clickedUnit && !clickedUnit.isPlayer && mode !== 'spell') {
    HB.infoUnit = (HB.infoUnit && HB.infoUnit.id === clickedUnit.id) ? null : clickedUnit;
    renderHexHUD();
    hbRenderInfoPanel && hbRenderInfoPanel();
    return;
  }
  HB.infoUnit = null;
  HB.actionMode = 'move';
  HB.pendingSpell = null;
  hbRefreshHighlights();
  renderHexBattle();
}

function hbHandleCanvasHover(px, py) {
  if (!HB) return;
  var zoomLevels = [0.65, 1.0, 1.35];
  var z  = zoomLevels[HB.zoom||1];
  var cx = HB.canvasW/2, cy = HB.canvasH/2;
  var worldX = (px - cx) / z + cx - HB.camX / z;
  var worldY = (py - cy) / z + cy - HB.camY / z;
  var ox = HB.canvasW/2;
  var oy = HB.canvasH/2;
  var h  = HB_HEX.fromPixel(worldX, worldY, ox, oy);
  HB.hovered = HB.hexMap[hKey(h)] ? h : null;

  // Preview AOE du sort
  HB.hlAoe = [];
  if (HB.actionMode === 'spell' && HB.pendingSpell && HB.hovered) {
    var inSpell = HB.hlSpell.some(function(c){ return hEq(c, HB.hovered); });
    if (inSpell) {
      HB.hlAoe = hbAoeCells(HB.hovered, HB.pendingSpell.aoe);
    }
  }
  renderHexBattle();
}

function hbAoeCells(center, shape, origin) {
  if (shape === 'single') return [center];
  if (shape === 'burst') {
    return [center].concat(HB_HEX.neighbors(center).filter(function(nb){
      return !!HB.hexMap[hKey(nb)];
    }));
  }
  if (shape === 'cross') {
    var cells = [center];
    HB_HEX.DIRS.forEach(function(d){
      for (var i=1; i<=2; i++){
        var h={q:center.q+d.q*i, r:center.r+d.r*i, s:center.s+d.s*i};
        if (HB.hexMap[hKey(h)]) cells.push(h);
      }
    });
    return cells;
  }
  if (shape === 'line' && origin) {
    var dq=center.q-origin.q, dr=center.r-origin.r;
    var len=Math.max(Math.abs(dq),Math.abs(dr),Math.abs(-dq-dr));
    if (len===0) return [center];
    var cells=[];
    for (var i=1; i<=3; i++){
      var h={q:Math.round(origin.q+dq/len*i), r:Math.round(origin.r+dr/len*i)};
      h.s=-h.q-h.r;
      if (HB.hexMap[hKey(h)]) cells.push(h);
    }
    return cells;
  }
  return [center];
}

// ── ANIMATION DÉPLACEMENT (partagée joueur + IA) ─────────────────
function hbAnimateUnit(unit, pathToWalk, onDone) {
  var stepIdx = 0, STEP_MS = 160;
  function animStep() {
    if (!HB || stepIdx >= pathToWalk.length) {
      delete unit._animPos;
      if (onDone) onDone();
      return;
    }
    var from = { q:unit.pos.q, r:unit.pos.r, s:unit.pos.s };
    var to   = pathToWalk[stepIdx++];
    unit.pos = to;
    var t0   = Date.now();
    (function interp() {
      if (!HB) return;
      var frac = Math.min(1, (Date.now()-t0)/STEP_MS);
      frac = 1-(1-frac)*(1-frac);
      unit._animPos = {
        q: from.q+(to.q-from.q)*frac,
        r: from.r+(to.r-from.r)*frac,
        s: from.s+(to.s-from.s)*frac
      };
      HB_CVS.draw();
      if (frac < 1) requestAnimationFrame(interp);
      else { delete unit._animPos; animStep(); }
    })();
  }
  animStep();
}

function hbPlayerMove(dest) {
  var p    = HB.player;
  var path = hbPath(p.pos, dest, p);
  var steps = Math.min(p.pm, path.length);
  if (!steps) return;
  HB.actionMode = 'none';
  HB.hlMove = []; HB.hlSpell = []; HB.hlAoe = [];
  var pathToWalk = path.slice(0, steps);
  hbAnimateUnit(p, pathToWalk, function() {
    p.pm = Math.max(0, p.pm - steps);
    if (typeof hbSpawnFloating === 'function') hbSpawnFloating(p.pos, '-'+steps+' PM', '#818cf8');
    HB.actionMode = p.pm > 0 ? 'move' : 'none';
    hbRefreshHighlights();
    renderHexBattle();
  });
}

function hbSelectWeapon() {
  if (!HB || HB.phase !== 'player' || HB.over) return;
  var p = HB.player;
  if (p.pa < HB_CFG.PA_BASIC_ATK) { hbLog('⚠ PA insuffisants'); return; }
  // Toggle : si déjà en mode weapon, désélectionne
  if (HB.actionMode === 'weapon') {
    HB.actionMode = 'move';
    HB.hlSpell = [];
    hbRefreshHighlights();
    renderHexBattle();
    return;
  }
  // Calcule la portée de l'arme équipée
  var weapUid = typeof META!=='undefined' && META.eq && META.eq.arme;
  var weap    = weapUid && typeof byUid==='function' ? byUid(weapUid) : null;
  var wRange  = HB_CFG.WEAPON_RANGE;
  if (weap) {
    if (weap.hbRange) { wRange = weap.hbRange; }
    else if (weap.nm && /arc|fusil|canon|sniper|rifle|gun|bow/i.test(weap.nm)) { wRange = 3; }
    else if (weap.st && weap.st.aspd && weap.st.aspd > 0.4) { wRange = 2; }
  }
  HB.actionMode  = 'weapon';
  HB.weaponRange = wRange;
  HB.pendingSpell = null;
  // Highlight : cases à portée occupées par un ennemi vivant
  HB.hlSpell = [];
  HB.enemies.forEach(function(e) {
    if (!e.alive) return;
    if (HB_HEX.dist(p.pos, e.pos) <= wRange) HB.hlSpell.push(e.pos);
  });
  hbRefreshHighlights();
  renderHexBattle();
}

function hbSelectSpell(idx) {
  if (!HB || HB.phase !== 'player' || HB.over) return;
  var sp = HB.player.spells[idx];
  if (!sp) return;
  var cost = sp.energy * 2;
  if (HB.player.pa < cost) { hbLog('⚠ PA insuffisants'); return; }
  if (sp.cd > 0) { hbLog('⚠ Sort en recharge (' + sp.cd + ' tour(s))'); return; }
  if (HB.pendingSpell && HB.pendingSpell.id === sp.id) {
    HB.actionMode  = 'move';
    HB.pendingSpell = null;
  } else {
    HB.actionMode  = 'spell';
    HB.pendingSpell = sp;
  }
  hbRefreshHighlights();
  renderHexBattle();
}

function hbPlayerCastSpell(sp, targetHex) {
  var p    = HB.player;
  var cost = sp.energy * 2;
  if (p.pa < cost) return;
  p.pa  -= cost;
  hbSpawnFloating && hbSpawnFloating(HB.player.pos, '-'+cost+' PA', '#f97316');
  sp.cd  = sp.cdMax;
  var cells = hbAoeCells(targetHex, sp.aoe, p.pos);
  cells.forEach(function(c) { hbApplySpell(p, sp, c); });
  HB.actionMode  = 'move';
  HB.pendingSpell = null;
  HB.hlSpell = []; HB.hlAoe = [];
  if (hbCheckEnd()) return;
  hbRefreshHighlights();
  renderHexBattle();
}

// ── MOTEUR DE SORTS ───────────────────────────────────────────────
// Traduit les types existants en effets hexagonaux
function hbApplySpell(caster, sp, targetHex) {
  var target = hbUnitAt(targetHex);
  var pw     = caster.isPlayer ? spPwr(sp) : sp.pwr;
  var isEnemy = function(u) { return u.isPlayer !== caster.isPlayer; };

  switch (sp.type) {
    case 'burst':
    case 'dpsBurst':
      if (target && isEnemy(target)) {
        var dmg = Math.floor(caster.atk * pw);
        var col = caster.isPlayer ? '#00d4ff' : '#ff6b35';
        hbAnimAttack(caster.pos, target.pos, col, function(){
          hbDamage(target, dmg);
          hbLog('⚡ ' + sp.name + ' → ' + target.name + ' -' + dmg + ' PV');
          hbCheckDeath(target);
        });
      }
      break;
    case 'multiBurst':
      if (target && isEnemy(target)) {
        var total = 0;
        for (var i = 0; i < (sp.hits||3); i++) {
          var hd = Math.floor(caster.atk * pw);
          hbDamage(target, hd); total += hd;
        }
        hbLog('⚡ ' + sp.name + ' → ' + target.name + ' -' + total + ' PV');
        hbCheckDeath(target);
      }
      break;
    case 'dot':
      if (target && isEnemy(target)) {
        hbAddEffect(target, { type:'dot', val: Math.floor(caster.atk * pw * 0.5), turns: 3, label:'DOT' });
        hbLog('☣ ' + sp.name + ' → ' + target.name + ' : DOT 3 tours');
      }
      break;
    case 'pctKill':
      if (target && isEnemy(target)) {
        var pk = Math.floor(target.hp * pw);
        hbDamage(target, pk);
        hbLog('☠ ' + sp.name + ' -' + pk + ' PV');
        hbCheckDeath(target);
      }
      break;
    case 'heal':
      var healTarget = (target && !isEnemy(target)) ? target : caster;
      var hl = Math.floor(healTarget.mHp * pw * 0.6);
      healTarget.hp = Math.min(healTarget.hp + hl, healTarget.mHp);
      hbLog('💚 ' + sp.name + ' +' + hl + ' PV → ' + healTarget.name);
      break;
    case 'shFull':
      caster.sh = caster.mSh;
      hbLog('🛡 ' + sp.name + ' : bouclier plein');
      break;
    case 'shBoost':
      caster.sh = Math.min(caster.sh + Math.floor(pw), caster.mSh);
      hbLog('🛡 ' + sp.name + ' : +bouclier');
      break;
    case 'dmgBlk':
    case 'fortress':
      hbAddEffect(caster, { type:'defBuf', val: pw, turns: 2, label:'DEF+' });
      hbLog('🧱 ' + sp.name + ' : -' + Math.round(pw*100) + '% dégâts 2 tours');
      break;
    case 'invuln':
    case 'titan':
      hbAddEffect(caster, { type:'invuln', val:1, turns:1, label:'INVULN' });
      if (sp.type === 'titan') { var th=Math.floor(caster.mHp*0.4); caster.hp=Math.min(caster.hp+th,caster.mHp); }
      hbLog('✨ ' + sp.name + ' : invulnérable 1 tour');
      break;
    case 'rgnBurst':
      hbAddEffect(caster, { type:'rgn', val: Math.floor(caster.mHp * 0.08), turns: 3, label:'RGN' });
      hbLog('⟳ ' + sp.name + ' : regen 3 tours');
      break;
    case 'reflect':
      hbAddEffect(caster, { type:'reflect', val: pw, turns: 2, label:'RFLCT' });
      hbLog('🔄 ' + sp.name + ' : réflexion 2 tours');
      break;
    case 'sacrifice':
      caster.hp = Math.max(1, caster.hp - Math.floor(caster.mHp * 0.2));
      hbAddEffect(caster, { type:'atkBuf', val: pw-1, turns: 2, label:'×ATQ' });
      hbLog('💀 ' + sp.name + ' : -20% PV, ATQ ×' + pw.toFixed(1));
      break;
    default:
      hbLog('Sort ' + sp.name + ' lancé');
  }
}

function hbDamage(target, rawDmg, caster) {
  if (!target || !target.alive) return;
  if (hbHasEff(target, 'invuln')) {
    hbSpawnFloating && hbSpawnFloating(target.pos, 'INVULN', '#a78bfa');
    return;
  }
  if (target.isPlayer && P.dodge > 0 && Math.random() < P.dodge) {
    hbLog('◌ Esquive !');
    hbSpawnFloating && hbSpawnFloating(target.pos, 'ESQUIVE!', '#60a5fa');
    return;
  }
  var isCrit = caster && caster.isPlayer && P.crit > 0 && Math.random() < P.crit;
  if (isCrit) rawDmg = Math.floor(rawDmg * 1.8);
  var def = hbGetEff(target, 'defBuf');
  var dmg = Math.max(0, Math.floor(rawDmg * (1 - Math.min(def, 0.9))));
  if (target.sh > 0) {
    var ab = Math.min(target.sh, dmg);
    target.sh -= ab; dmg -= ab;
  }
  target.hp = Math.max(0, target.hp - dmg);
  if (isCrit) hbLog('✦ CRITIQUE !');
  return isCrit;
}

function hbAddEffect(unit, eff) {
  if (!unit.effs) unit.effs = [];
  unit.effs.push(eff);
}
function hbHasEff(unit, type) { return unit.effs && unit.effs.some(function(e){ return e.type===type; }); }
function hbGetEff(unit, type) {
  var v = 0;
  if (unit.effs) unit.effs.forEach(function(e){ if(e.type===type) v+=e.val; });
  return v;
}

function hbTickEffects(unit) {
  if (!unit.effs || !unit.effs.length) return;
  for (var i = unit.effs.length-1; i >= 0; i--) {
    var e = unit.effs[i];
    if (e.type === 'dot') { hbDamage(unit, e.val); hbLog('☣ DOT → ' + unit.name + ' -' + e.val); }
    if (e.type === 'rgn') { unit.hp = Math.min(unit.hp + e.val, unit.mHp); }
    e.turns--;
    if (e.turns <= 0) unit.effs.splice(i, 1);
  }
}

function hbCheckDeath(unit) {
  if (!unit || unit.hp > 0 || !unit.alive) return;
  unit.alive = false;
  hbLog('💀 ' + unit.name + ' éliminé');
}

var HB_TIMER_INTERVAL = null;
function hbStartTurnTimer(seconds) {
  hbClearTurnTimer();
  HB.turnTimeLeft = seconds;
  HB_TIMER_INTERVAL = setInterval(function() {
    if (!HB || HB.phase !== 'player') { hbClearTurnTimer(); return; }
    HB.turnTimeLeft--;
    renderHexHUD();
    if (HB.turnTimeLeft <= 0) {
      hbClearTurnTimer();
      hbLog('⏱ Temps écoulé — fin de tour automatique');
      hbEndPlayerTurn();
    }
  }, 1000);
}
function hbClearTurnTimer() {
  if (HB_TIMER_INTERVAL) { clearInterval(HB_TIMER_INTERVAL); HB_TIMER_INTERVAL = null; }
  if (HB) HB.turnTimeLeft = null;
}

// ── FIN DE TOUR (joueur) ──────────────────────────────────────────
function hbEndPlayerTurn() {
hbClearTurnTimer()
  if (!HB || HB.phase !== 'player' || HB.over) return;
  // Tick effets joueur
  hbTickEffects(HB.player);
  hbCheckDeath(HB.player);
  if (hbCheckEnd()) return;
  // Décrémente cooldowns sorts
  HB.player.spells.forEach(function(sp){ if(sp.cd>0)sp.cd--; });
  HB.actionMode  = 'none';
  HB.pendingSpell = null;
  HB.hlMove = []; HB.hlSpell = []; HB.hlAoe = [];
  HB.turnIdx++;
  // Filtre les unités mortes de l'ordre de jeu
  HB.units = HB.units.filter(function(u){ return u.alive; });
  hbNextTurn();
}

function hbNextTurn() {
  if (!HB || HB.over) return;
  if (HB.units.length === 0) { hbCheckEnd(); return; }
  HB.turnIdx = HB.turnIdx % HB.units.length;
  var cur = HB.units[HB.turnIdx];
  // Reset PM/PA
  cur.pm = cur.pmMax; cur.pa = cur.paMax;
  hbTickEffects(cur);
  hbCheckDeath(cur);
  if (!cur.alive) {
    HB.units.splice(HB.turnIdx, 1);
    hbNextTurn(); return;
  }
  if (hbCheckEnd()) return;

 if (cur.isPlayer) {
    HB.phase  = 'player';
    HB.round++;
    hbLog('— Tour ' + HB.round + ' — ' + cur.name + ' joue —');
    HB.actionMode = 'move';
    hbStartTurnTimer(60);
    hbRefreshHighlights();
    renderHexBattle();
  } else {
    HB.phase = 'enemy';
    hbShowTurnBanner(cur.name + ' joue', cur.col);
    renderHexBattle();
    setTimeout(function(){ hbAITurn(cur); }, HB_CFG.AI_DELAY + 500);
  }
}

// ── IA ─────────────────────────────────────────────────────────
function hbAITurn(enemy) {
  if (!HB || HB.over || !enemy.alive) { hbNextTurn(); return; }
  var player = HB.player;

  // Cherche le meilleur sort disponible à portée
  var bestSp = null, bestPwr = 0;
  if (enemy.spells) {
    enemy.spells.forEach(function(sp) {
      if (sp.cd > 0 || enemy.pa < sp.energy*2) return;
      var d = HB_HEX.dist(enemy.pos, player.pos);
      if (d < (sp.minRange||1) || d > sp.range) return;
      if (!hbHasLOS(enemy.pos, player.pos, false)) return;
      var pwr = sp.pwr * (sp.hits||1);
      if (pwr > bestPwr) { bestPwr = pwr; bestSp = sp; }
    });
  }

  if (bestSp) {
    enemy.pa -= bestSp.energy * 2;
    bestSp.cd = bestSp.cdMax;
    hbApplySpell(enemy, bestSp, player.pos);
    hbCheckDeath(player);
    renderHexBattle();
    if (hbCheckEnd()) return;
  }

  // Attaque de base si adjacent et PA restants
  var dist = HB_HEX.dist(enemy.pos, player.pos);
  if (dist <= 1 && enemy.pa >= HB_CFG.PA_BASIC_ATK && player.alive) {
    enemy.pa -= HB_CFG.PA_BASIC_ATK;
    var dmg = Math.floor(enemy.atk * (1 + hbGetEff(enemy, 'atkBuf')));
    hbDamage(player, dmg);
    hbLog('👾 ' + enemy.name + ' frappe -' + dmg + ' PV');
    hbCheckDeath(player);
    renderHexBattle();
    if (hbCheckEnd()) return;
  }

  // Déplacement : s'arrête à portée de sort si disponible, sinon adjacent
  var stopDist = (bestSp && bestSp.range > 1) ? bestSp.range : 1;
  setTimeout(function() {
    if (!HB || HB.over || !enemy.alive) { hbNextTurn(); return; }
    if (enemy.pm > 0 && player.alive) {
      var path = hbPath(enemy.pos, player.pos, enemy);
      var steps = Math.min(enemy.pm, Math.max(0, path.length - stopDist));
      if (steps > 0) {
        var pathToWalk = path.slice(0, steps);
        enemy.pm -= steps;
        hbAnimateUnit(enemy, pathToWalk, function() {
          if (enemy.spells) enemy.spells.forEach(function(sp){ if(sp.cd>0)sp.cd--; });
          renderHexBattle();
          setTimeout(function(){ HB.turnIdx++; hbNextTurn(); }, HB_CFG.AI_DELAY);
        });
        return;
      }
    }
    if (enemy.spells) enemy.spells.forEach(function(sp){ if(sp.cd>0)sp.cd--; });
    renderHexBattle();
    setTimeout(function(){ HB.turnIdx++; hbNextTurn(); }, HB_CFG.AI_DELAY);
  }, HB_CFG.AI_DELAY);
}

// ── FIN DE COMBAT ─────────────────────────────────────────────────
function hbCheckEnd() {
  if (!HB || HB.over) return false;
  var playerDead = !HB.player.alive || HB.player.hp <= 0;
  var allDead    = HB.enemies.every(function(e){ return !e.alive; });
  if (!playerDead && !allDead) return false;

  HB.over = true;
  HB.won  = allDead && !playerDead;
  HB.phase = 'result';

  if (HB.won) {
var lv = META.hero.lv || 1;
    var scMult = (HB.scenario && HB.scenario.rewardMult) || 1;
    HB.rewardCr  = Math.floor((HB_CFG.REWARD_CR_BASE + lv * 12) * HB.enemies.length * scMult);
    HB.rewardXP  = Math.floor((HB_CFG.REWARD_XP_BASE + lv * 5) * HB.enemies.length * scMult);
    META.cr += HB.rewardCr;
    gainXP(HB.rewardXP);
    saveMeta(); updateTop();
    hbLog('🏆 VICTOIRE ! +' + HB.rewardCr + '₵ +' + HB.rewardXP + ' XP');
  } else {
    hbLog('💀 DÉFAITE…');
  }
  renderHexBattle();
  return true;
}

function hbToggleHexOpacity() {
  if (!HB) return;
  HB.hexOpacity = !HB.hexOpacity;
  HB_CVS.draw();
  renderHexActionBar();
}

function hbQuit() {
hbClearTurnTimer()
  HB = null;
  navigate('home');
}

// ── RENDU CANVAS ─────────────────────────────────────────────────
// ── CACHE IMAGES SPRITES ─────────────────────────────────────────
var HB_IMG = {};
function hbImg(src) {
  if (!src) return null;
  if (!HB_IMG[src]) {
    var img = new Image();
    img.src = src;
    img.onload = function(){ if(HB && !HB.over) HB_CVS.draw(); };
    HB_IMG[src] = img;
  }
  return HB_IMG[src];
}

var HB_CVS = (function() {
  var _canvas = null, _ctx = null, _dpr = 1, _bound = false;
  var _drag   = { on:false, sx:0, sy:0, cx:0, cy:0, moved:false };

  function init() {
    var el = document.getElementById('hb-canvas');
    if (!el) return;
    var firstInit = (_canvas !== el);
    if (firstInit) { _canvas = el; _ctx = el.getContext('2d'); _bound = false; }
    resize();   // toujours recalculer — sans ça canvasW/H peut rester à 390/300
                // alors que la hauteur réelle est différente (→ clearRect incomplet)
    if (!_bound) { bindEvents(); _bound = true; }
  }

  function resize() {
    if (!_canvas) return;
    var wrap = document.getElementById('hb-canvas-wrap');
    var W = wrap ? Math.round(wrap.clientWidth)  : 390;
    var H = wrap ? Math.round(wrap.clientHeight) : 300;
    if (H < 200) H = 300;
    _dpr = window.devicePixelRatio || 1;
    var newW = Math.round(W * _dpr);
    var newH = Math.round(H * _dpr);
    // Ne réassigne les dimensions que si elles changent vraiment
    // (assigner canvas.width/height efface le canvas et cause un saut visuel)
    if (_canvas.width !== newW || _canvas.height !== newH) {
      _canvas.width  = newW;
      _canvas.height = newH;
      _canvas.style.width  = W + 'px';
      _canvas.style.height = H + 'px';
    }
    _ctx.setTransform(1,0,0,1,0,0);
    _ctx.scale(_dpr, _dpr);
    if (HB) { HB.canvasW = W; HB.canvasH = H; }
  }

  function bindEvents() {
_canvas.addEventListener('mousedown',  onDown);
    _canvas.addEventListener('mousemove',  onMove);
    // mouseup sur document : évite que le drag reste bloqué si on relâche hors canvas
    document.addEventListener('mouseup', function(e){
      if (!_drag.on) return;
      var p = cxy(e);
      if (!_drag.moved) hbHandleCanvasClick(p.x, p.y);
      _drag.on = false; _drag.moved = false;
    });
  _canvas.addEventListener('touchstart', function(e){
      var p=txy(e); if(!p) return;
      _drag = { on:true, sx:p.x, sy:p.y, cx:HB?HB.camX:0, cy:HB?HB.camY:0, moved:false };
    }, {passive:true});
    _canvas.addEventListener('touchmove', function(e){
      var p=txy(e); if(!p||!_drag.on) return;
      var dx=p.x-_drag.sx, dy=p.y-_drag.sy;
      if (Math.abs(dx)>8||Math.abs(dy)>8) _drag.moved=true;  // seuil plus grand sur mobile
      if (_drag.moved && HB) { HB.camX=Math.round(_drag.cx+dx); HB.camY=Math.round(_drag.cy+dy); HB_CVS.draw(); }
    }, {passive:true});
    _canvas.addEventListener('touchend', function(e){
      var t=e.changedTouches&&e.changedTouches[0]; if(!t) return;
      var r=_canvas.getBoundingClientRect();
      var px=t.clientX-r.left, py=t.clientY-r.top;
      if (!_drag.moved) hbHandleCanvasClick(px, py);
      _drag.on=false; _drag.moved=false;
    });
    window.addEventListener('resize', resize);
// ── ZOOM scroll (PC) ─────────────────────────────────────────
_canvas.addEventListener('wheel', function(e) {
  e.preventDefault();
  if (!HB) return;
  var delta = e.deltaY > 0 ? -1 : 1;
  HB.zoom = Math.max(0, Math.min(2, (HB.zoom||1) + delta));
  HB_CVS.draw();
}, {passive: false});

// ── ZOOM pinch (mobile) ───────────────────────────────────────
var _pinchDist = null;
_canvas.addEventListener('touchstart', function(e) {
  if (e.touches.length === 2) {
    var dx = e.touches[0].clientX - e.touches[1].clientX;
    var dy = e.touches[0].clientY - e.touches[1].clientY;
    _pinchDist = Math.sqrt(dx*dx + dy*dy);
  }
}, {passive: true});
_canvas.addEventListener('touchmove', function(e) {
  if (e.touches.length === 2 && _pinchDist && HB) {
    var dx = e.touches[0].clientX - e.touches[1].clientX;
    var dy = e.touches[0].clientY - e.touches[1].clientY;
    var d  = Math.sqrt(dx*dx + dy*dy);
    if (d > _pinchDist + 30)      { HB.zoom = Math.min(2, (HB.zoom||1)+1); _pinchDist = d; HB_CVS.draw(); }
    else if (d < _pinchDist - 30) { HB.zoom = Math.max(0, (HB.zoom||1)-1); _pinchDist = d; HB_CVS.draw(); }
  }
}, {passive: true});
_canvas.addEventListener('touchend', function(e) {
  if (e.touches.length < 2) _pinchDist = null;
});
  }

  function txy(e) {
    if (!e.touches || !e.touches.length) return null;
    var r = _canvas.getBoundingClientRect();
    return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
  }
  function cxy(e) {
    var r = _canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onDown(e) {
    if (e.button !== 0) return;
    var p = cxy(e);
    _drag = { on:true, sx:p.x, sy:p.y, cx:HB?HB.camX:0, cy:HB?HB.camY:0, moved:false };
  }
  function onMove(e) {
    if (!HB) return;
    var p = cxy(e);
    if (_drag.on) {
      var dx = p.x-_drag.sx, dy = p.y-_drag.sy;
      if (Math.abs(dx)>4||Math.abs(dy)>4) _drag.moved = true;
      if (_drag.moved) { HB.camX = Math.round(_drag.cx+dx); HB.camY = Math.round(_drag.cy+dy); }
    }
    hbHandleCanvasHover(p.x, p.y);
  }
  function onUp(e) {
    if (!HB) { _drag.on=false; return; }
    var p = cxy(e);
    if (!_drag.moved) hbHandleCanvasClick(p.x, p.y);
    _drag.on = false; _drag.moved = false;
  }

  // ── DRAW ────────────────────────────────────────────────────────
  function draw() {
    if (!_canvas || !_ctx || !HB) return;
    var W = HB.canvasW || _canvas.clientWidth;
    var H = HB.canvasH || _canvas.clientHeight;
    _ctx.clearRect(0, 0, W, H);

    // Fond dégradé de base
    var bg = _ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0, '#06080f'); bg.addColorStop(1, '#0c1020');
    _ctx.fillStyle = bg; _ctx.fillRect(0,0,W,H);

    var zoomLevels = [0.65, 1.0, 1.35];
    var z  = zoomLevels[HB.zoom||1];
    _ctx.save();
    _ctx.translate(W/2, H/2);
    _ctx.scale(z, z);
    _ctx.translate(-W/2, -H/2);

    // Image de fond de la map (dans le transform : suit zoom + cam)
    var _mapDef = HB.scenario && HB_MAP_DEFS[HB.scenario.mapId];
    if (_mapDef && _mapDef.bgImage) {
      var _bgImg = hbImg(_mapDef.bgImage);
      if (_bgImg && _bgImg.complete && _bgImg.naturalWidth) {
        _ctx.save();
        _ctx.globalAlpha = 0.52;
        var bw = _bgImg.naturalWidth, bh = _bgImg.naturalHeight;
        var scale = Math.max(W/bw, H/bh);
        var dw = bw*scale, dh = bh*scale;
        _ctx.drawImage(_bgImg, (W-dw)/2 + HB.camX*(1-z)/z,
                               (H-dh)/2 + HB.camY*(1-z)/z, dw, dh);
        _ctx.restore();
      }
    }

    var ox = W/2 + HB.camX, oy = H/2 + HB.camY;
    // Tuiles (triées par y pour Painter's algo)
    var tiles = Object.values(HB.hexMap).sort(function(a,b){
      var pa = HB_HEX.toPixel(a.q,a.r,ox,oy);
      var pb = HB_HEX.toPixel(b.q,b.r,ox,oy);
      return pa.y - pb.y;
    });

    tiles.forEach(function(h){ drawHex(h, ox, oy); });

    // Unités (triées par y)
    HB.units.filter(function(u){ return u.alive; })
      .sort(function(a,b){
        return HB_HEX.toPixel(a.pos.q,a.pos.r,ox,oy).y - HB_HEX.toPixel(b.pos.q,b.pos.r,ox,oy).y;
      })
      .forEach(function(u){ drawUnit(u, ox, oy); });

    // Overlay IA
    if (HB.phase === 'enemy') {
      _ctx.fillStyle = 'rgba(255,80,30,0.12)';
      _ctx.fillRect(0,0,W,H);
    }
    _ctx.restore();
  }

  function drawHex(h, ox, oy) {
    var p  = HB_HEX.toPixel(h.q, h.r, ox, oy);
    var cn = HB_HEX.corners(p.x, p.y);
    var D  = HB_HEX.DEPTH;

    var isHlMove  = HB.hlMove.some(function(c){ return hEq(c,h); });
    var isHlSpell = HB.hlSpell.some(function(c){ return hEq(c,h); });
    var isHlAoe   = HB.hlAoe.some(function(c){ return hEq(c,h); });
    var isHover   = HB.hovered && hEq(HB.hovered, h);
    var isObs     = h.obstacle;
    var isEdge    = (h.terrain === 'edge');
    // Toggle opacite : true (defaut) = cases visibles, false = invisible (juste bordures)
    var op = (HB.hexOpacity !== false) ? 1.0 : 0.0;

    // Priorite : highlights > obstacle > edge > normal
    // Les highlights sont testes EN PREMIER pour que les cases de bord
    // (spawn points) s affichent correctement quand elles sont en hlMove.
    var wallL, wallR, faceFill, borderCol, borderW;

    if (isHlMove) {
      wallL = 'rgba(0,60,180,0.60)'; wallR = 'rgba(0,80,200,0.55)';
      faceFill  = 'rgba(0,140,255,0.28)';
      borderCol = 'rgba(0,200,255,1.0)'; borderW = 2.2;
    } else if (isHlSpell) {
      wallL = 'rgba(140,10,40,0.60)'; wallR = 'rgba(160,20,50,0.55)';
      faceFill  = 'rgba(255,40,80,0.28)';
      borderCol = 'rgba(255,51,85,1.0)'; borderW = 2.2;
    } else if (isHlAoe) {
      wallL = 'rgba(130,90,0,0.60)'; wallR = 'rgba(150,110,0,0.55)';
      faceFill  = 'rgba(251,191,36,0.32)';
      borderCol = 'rgba(251,191,36,1.0)'; borderW = 2.2;
    } else if (isHover) {
      wallL = 'rgba(0,30,80,0.20)'; wallR = 'rgba(0,30,80,0.15)';
      faceFill  = 'rgba(0,212,255,0.10)';
      borderCol = 'rgba(0,212,255,0.75)'; borderW = 1.4;
    } else if (isObs) {
      wallL = 'rgba(10,18,40,0.95)'; wallR = 'rgba(8,14,34,0.95)';
      faceFill  = 'rgba(15,24,48,0.92)';
      borderCol = 'rgba(80,130,220,0.65)'; borderW = 1.5;
    } else if (isEdge) {
      var ea = 0.50 * op + 0.04;
      wallL = 'rgba(0,10,28,' + (0.60*op+0.03) + ')';
      wallR = 'rgba(0,8,22,'  + (0.55*op+0.03) + ')';
      faceFill  = 'rgba(4,10,22,' + ea + ')';
      borderCol = 'rgba(0,160,255,0.22)'; borderW = 0.9;
    } else {
      // Case jouable normale : uniforme, opacite par op
      wallL = 'rgba(0,15,40,' + (0.14*op) + ')';
      wallR = 'rgba(0,22,55,' + (0.14*op) + ')';
      faceFill  = 'rgba(6,14,30,' + (0.09*op) + ')';
      borderCol = 'rgba(0,212,255,' + (0.30 + 0.06*op) + ')';
      borderW   = 1.1;
    }

    // Mur gauche
    _ctx.beginPath();
    _ctx.moveTo(cn[3].x, cn[3].y);
    _ctx.lineTo(cn[3].x, cn[3].y + D);
    _ctx.lineTo(cn[4].x, cn[4].y + D);
    _ctx.lineTo(cn[4].x, cn[4].y);
    _ctx.closePath();
    _ctx.fillStyle = wallL; _ctx.fill();

    // Mur droit
    _ctx.beginPath();
    _ctx.moveTo(cn[4].x, cn[4].y);
    _ctx.lineTo(cn[4].x, cn[4].y + D);
    _ctx.lineTo(cn[5].x, cn[5].y + D);
    _ctx.lineTo(cn[5].x, cn[5].y);
    _ctx.closePath();
    _ctx.fillStyle = wallR; _ctx.fill();

    // Face superieure
    _ctx.beginPath();
    _ctx.moveTo(cn[0].x, cn[0].y);
    for (var i = 1; i < 6; i++) _ctx.lineTo(cn[i].x, cn[i].y);
    _ctx.closePath();
    _ctx.fillStyle = faceFill; _ctx.fill();

    // Bordure (toujours en dernier pour passer par-dessus les murs)
    _ctx.strokeStyle = borderCol;
    _ctx.lineWidth   = borderW;
    _ctx.stroke();

    // Obstacle : face avant 3D
    if (isObs) {
      _ctx.save();
      _ctx.globalAlpha = 0.72;
      _ctx.fillStyle = '#1a2235';
      _ctx.beginPath();
      _ctx.moveTo(cn[3].x, cn[3].y);
      _ctx.lineTo(cn[3].x, cn[3].y + D);
      _ctx.lineTo(cn[5].x, cn[5].y + D);
      _ctx.lineTo(cn[5].x, cn[5].y);
      _ctx.closePath();
      _ctx.fill();
      _ctx.globalAlpha = 0.30;
      _ctx.strokeStyle = '#0d1420';
      _ctx.lineWidth = 0.8;
      for (var li = 1; li < 3; li++) {
        var lf = li / 3;
        _ctx.beginPath();
        _ctx.moveTo(cn[3].x, cn[3].y + D*lf);
        _ctx.lineTo(cn[5].x, cn[5].y + D*lf);
        _ctx.stroke();
      }
      _ctx.globalAlpha = 0.18;
      _ctx.strokeStyle = '#60a5fa';
      _ctx.lineWidth = 1;
      _ctx.beginPath();
      _ctx.moveTo(cn[3].x, cn[3].y);
      _ctx.lineTo(cn[3].x, cn[3].y + D*0.6);
      _ctx.stroke();
      _ctx.restore();
    }
  }

  function drawUnit(unit, ox, oy) {
    var pos = (unit._animPos) ? unit._animPos : unit.pos;
    var p   = HB_HEX.toPixel(pos.q, pos.r, ox, oy);
    var S   = HB_HEX.SIZE;
    var R   = S * 0.68;
    var D   = HB_HEX.DEPTH;
    var isSel = (HB.player === unit);
    var cn  = HB_HEX.corners(p.x, p.y);

    // Ombre isométrique aplatie
    _ctx.beginPath();
    _ctx.ellipse(p.x, p.y + D * 0.5, R * 0.78, R * 0.20, 0, 0, Math.PI * 2);
    _ctx.fillStyle = 'rgba(0,0,0,0.50)';
    _ctx.fill();

    // Sprite joueur : portrait clipé en hexagone
    var drawnSprite = false;
    if (unit.isPlayer) {
      var hd = (typeof getH === 'function') ? getH(META.heroId || 'berserker') : null;
      if (hd && hd.portrait) {
        var img = hbImg(hd.portrait);
        if (img && img.complete && img.naturalWidth) {
          var sw = S * 1.8, sh = S * 3.0;
          var sx = p.x - sw / 2, sy = p.y - sh * 0.78;
          _ctx.drawImage(img, sx, sy, sw, sh);
          drawnSprite = true;
          // Contour sélection cyan
          _ctx.save();
          _ctx.beginPath();
          cn.forEach(function(c,i){ i===0?_ctx.moveTo(c.x,c.y):_ctx.lineTo(c.x,c.y); });
          _ctx.closePath();
          _ctx.strokeStyle = isSel ? '#00d4ff' : 'rgba(0,212,255,0.35)';
          _ctx.lineWidth   = isSel ? 2.5 : 1.0;
          if (isSel) { _ctx.shadowColor='#00d4ff'; _ctx.shadowBlur=14; }
          _ctx.stroke();
          _ctx.shadowBlur = 0;
          _ctx.restore();
        }
      }
    }

    // Fallback (ennemis ou image non chargée)
    if (!drawnSprite) {
      // Fond coloré clipé en hexagone
      _ctx.save();
      _ctx.beginPath();
      cn.forEach(function(c,i){ i===0?_ctx.moveTo(c.x,c.y):_ctx.lineTo(c.x,c.y); });
      _ctx.closePath();
      var grad = _ctx.createRadialGradient(p.x, p.y-R*0.25, R*0.08, p.x, p.y, R);
      grad.addColorStop(0, hexToRgba(unit.col, 0.92));
      grad.addColorStop(1, hexToRgba(unit.col, 0.30));
      _ctx.fillStyle = grad; _ctx.fill();
      _ctx.strokeStyle = isSel ? '#fff' : hexToRgba(unit.col, 0.85);
      _ctx.lineWidth   = isSel ? 2.5 : 1.1;
      if (isSel) { _ctx.shadowColor=unit.col; _ctx.shadowBlur=12; }
      _ctx.stroke(); _ctx.shadowBlur=0;
      _ctx.restore();
      // Icône emoji centré
      _ctx.font = Math.round(R * 0.95) + 'px serif';
      _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
      _ctx.fillStyle = '#fff';
      _ctx.fillText(unit.icon, p.x, p.y);
    }

    // Flash dégâts
    if (unit._flash && unit._flash > 0) {
      _ctx.save();
      _ctx.globalAlpha = unit._flash / 8 * 0.52;
      _ctx.beginPath();
      cn.forEach(function(c,i){ i===0?_ctx.moveTo(c.x,c.y):_ctx.lineTo(c.x,c.y); });
      _ctx.closePath();
      _ctx.fillStyle = unit.isPlayer ? '#f87171' : '#fbbf24';
      _ctx.fill();
      _ctx.restore();
      unit._flash--;
    }

    // Barres HP + bouclier sous la case
    var bw = S * 1.5, bh = 4;
    var bx = p.x - bw/2, by = p.y + R * 0.55 + D;
    _ctx.fillStyle = 'rgba(0,0,0,0.72)';
    _ctx.fillRect(bx-1, by-1, bw+2, bh+2);
    var hpR = unit.hp / unit.mHp;
    _ctx.fillStyle = hpR > 0.4 ? '#22c55e' : '#ef4444';
    _ctx.fillRect(bx, by, Math.max(0, bw * hpR), bh);
    if (unit.mSh > 0) {
      _ctx.fillStyle = 'rgba(0,0,0,0.5)'; _ctx.fillRect(bx, by+5, bw, 3);
      _ctx.fillStyle = '#60a5fa';
      _ctx.fillRect(bx, by+5, Math.max(0, bw*(unit.sh/unit.mSh)), 3);
    }

    // Effets actifs (icônes colorés à droite)
    if (unit.effs && unit.effs.length) {
      _ctx.font = '7px sans-serif';
      _ctx.textAlign = 'left'; _ctx.textBaseline = 'top';
      var efColors = {dot:'#f87171',atkBuf:'#fbbf24',defBuf:'#60a5fa',invuln:'#a78bfa',rgn:'#4ade80'};
      unit.effs.slice(0,3).forEach(function(e, i) {
        _ctx.fillStyle = efColors[e.type] || '#aaa';
        _ctx.fillText(e.label||e.type, p.x+R+3, p.y-R*0.5+i*9);
      });
    }
  }
  function hexToRgba(hex, a) {
    if (!hex || hex[0]!=='#') return 'rgba(128,128,128,'+a+')';
    var r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return 'rgba('+r+','+g+','+b+','+a+')';
  }

  return { init:init, draw:draw, resize:resize };
}());

// ── RENDU DOM ────────────────────────────────────────────────────
function renderHexBattle() {
  var wrap   = document.getElementById('hb-wrap');
  var selDiv = document.getElementById('hb-sel');
  var actDiv = document.getElementById('hb-active');
  var resDiv = document.getElementById('hb-result');
  if (!wrap) return;

  if (!HB) {
    // Sélection de scénario
    selDiv.style.display = '';
    actDiv.style.display = 'none';
    resDiv.style.display = 'none';
    renderHexBattleSel();
    return;
  }

if (HB.over) {
    selDiv.style.display = 'none';
    actDiv.style.display = 'none';
    resDiv.style.display = 'flex';
    renderHexBattleResult();
    return;
  }

  selDiv.style.display = 'none';
  actDiv.style.display = 'flex';
  resDiv.style.display = 'none';

  // ── DOM EN PREMIER — les mises à jour HUD/log/actions changent la
  // hauteur des blocs entourant le canvas ; on les fait AVANT d'initialiser
  // le canvas pour que resize() lise les bonnes dimensions du wrapper.
  renderHexHUD();
  renderHexLog();
  renderHexActionBar();

  // ── CANVAS APRÈS — resize() lit clientWidth/Height post-reflow
  HB_CVS.init();
  HB_CVS.resize();   // force le recalcul des dimensions canvas après DOM
  HB_CVS.draw();
}

function renderHexBattleSel() {
  if (META.hero.lv < HB_MIN_LV) {
    el.innerHTML = '<div class="sec-hdr">⬡ MODE HEXAGONAL</div>'
      +'<div style="padding:30px;text-align:center">'
      +'<div style="font-size:3rem;margin-bottom:12px">🔒</div>'
      +'<div style="font-family:var(--font-h);font-size:1rem;color:var(--text)">Débloqué au niveau '+HB_MIN_LV+'</div>'
      +'<div style="font-size:.75rem;color:var(--text3);margin-top:6px">Niveau actuel : '+META.hero.lv+'</div>'
      +'</div>';
    return;
  }
  var el = document.getElementById('hb-sel');
  if (!el) return;
  var diffCol = {e:'#00e87c',m:'#00d4ff',h:'#ff3355'};
  var diffLbl = {e:'FACILE',m:'NORMAL',h:'DIFFICILE'};
  var html = '<div class="sec-hdr">\u29c6 MODE HEXAGONAL</div><div style="padding:12px;display:flex;flex-direction:column;gap:10px">';
  (HB_SCENARIOS||[]).forEach(function(sc) {
    var col = diffCol[sc.diff]||'#aaa';
    html += '<div style="background:var(--bg1);border:1px solid var(--border);border-left:3px solid '+col+';border-radius:12px;padding:12px 14px;cursor:pointer" '
      +'onclick="startHexBattle(\''+sc.id+'\')">'
      +'<div style="display:flex;align-items:center;gap:10px">'
      +'<span style="font-size:2rem">'+sc.icon+'</span>'
      +'<div style="flex:1">'
      +'<div style="font-family:var(--font-h);font-size:.88rem;font-weight:700;color:var(--text)">'+sc.name+'</div>'
      +'<div style="font-size:.72rem;color:var(--text3);margin:2px 0">'+sc.desc+'</div>'
      +'<div style="display:flex;gap:8px;margin-top:3px">'
      +'<span style="font-size:.65rem;font-weight:700;color:'+col+'">'+diffLbl[sc.diff]+'</span>'
      +'<span style="font-size:.62rem;color:var(--gold)">Récompense \xd7'+sc.rewardMult.toFixed(1)+'</span>'
      +'<span style="font-size:.62rem;color:var(--text4)">'+sc.enemies.length+' ennemi'+(sc.enemies.length>1?'s':'')+'</span>'
      +'</div></div>'
      +'<span style="color:var(--cyan);font-weight:700">\u2192</span>'
      +'</div></div>';
  });
  html += '</div>';
  el.innerHTML = html;
}
function renderHexHUD() {
  var el = document.getElementById('hb-hud');
  if (!el || !HB) return;
  var p     = HB.player;
  var alive = HB.enemies.filter(function(e){ return e.alive; });
  var isP   = HB.phase === 'player';
  function bar(v,m,col,h){ var pct=m>0?Math.round(v/m*100):0; return '<div style="flex:1;height:'+h+'px;background:rgba(255,255,255,.07);border-radius:2px"><div style="height:100%;width:'+pct+'%;background:'+col+';border-radius:2px"></div></div>'; }

  var html = '<div style="display:flex;align-items:stretch;gap:4px;padding:5px 8px;background:var(--bg1);border-bottom:1px solid var(--border)">'
    // Joueur
    +'<div style="flex:1;min-width:0">'
    +'<div style="font-size:.64rem;font-weight:700;color:var(--cyan)">'+hbEscape(p.name)+'</div>'
    +'<div style="display:flex;gap:3px;align-items:center;margin:2px 0">'+bar(p.hp,p.mHp,'#22c55e',4)+'<span style="font-size:.5rem;color:var(--text4)">'+Math.round(p.hp)+'</span></div>'
    +(p.mSh>0?'<div style="display:flex;gap:3px;align-items:center;margin:1px 0">'+bar(p.sh,p.mSh,'#60a5fa',3)+'<span style="font-size:.5rem;color:var(--text4)">◈</span></div>':'')
    +'<div style="font-size:.56rem;color:var(--text3)">PM <b style="color:var(--text)">'+p.pm+'/'+p.pmMax+'</b> PA <b style="color:var(--text)">'+p.pa+'/'+p.paMax+'</b></div>'
    +'</div>'
    // Centre : tour + phase + ordre de jeu
    +'<div style="text-align:center;flex-shrink:0;padding:0 6px">'
   +'<div style="font-size:.5rem;color:var(--text4)">Tour '+HB.round+'</div>'
    +(HB.turnTimeLeft!=null?'<div style="font-size:.75rem;font-weight:900;color:'+(HB.turnTimeLeft<=10?'var(--red)':'var(--gold)')+'">⏱'+HB.turnTimeLeft+'s</div>':'')
    +'<div style="font-size:.68rem;font-weight:700;color:'+(isP?'var(--green)':'var(--orange)')+'">'+(isP?'▶ Vous':'⏳ IA')+'</div>'
    +'<div style="display:flex;gap:2px;margin-top:2px;justify-content:center">'
    +HB.units.filter(function(u){return u.alive;}).map(function(u,i){
      var cur = i===(HB.turnIdx%Math.max(1,HB.units.filter(function(x){return x.alive;}).length));
      return '<span title="'+hbEscape(u.name)+'" style="font-size:'+(cur?'1rem':'.65rem')+';opacity:'+(cur?1:.4)+'">'+u.icon+'</span>';
    }).join('')
    +'</div>'
    +'<div style="font-size:.5rem;color:var(--red);margin-top:1px">'+alive.length+' ennemi'+(alive.length!==1?'s':'')+'</div>'
    +'</div>'
    // Ennemis vivants (barres compactes)
    +'<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;justify-content:center">'
    +alive.slice(0,3).map(function(e){
      var eid = e.id;
      return '<div style="display:flex;align-items:center;gap:3px;cursor:pointer" onclick="hbToggleInfo(\''+eid+'\')">'
        +'<span style="font-size:.75rem">'+e.icon+'</span>'
        +'<div style="flex:1">'+bar(e.hp,e.mHp,'#ef4444',3)+'</div>'
        +'<span style="font-size:.5rem;color:var(--text4)">'+Math.round(e.hp)+'</span>'
        +'</div>';
    }).join('')
    +'</div>'
    +'</div>';
  el.innerHTML = html;
  hbRenderInfoPanel();
}
function renderHexLog() {
  var el = document.getElementById('hb-log');
  if (!el || !HB) return;
  el.innerHTML = (HB.log||[]).map(function(l, i){
    return '<div style="font-size:.56rem;color:'+(i===0?'var(--text2)':'var(--text4)')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:1px 0">'+hbEscape(l)+'</div>';
  }).join('') || '<div style="font-size:.56rem;color:var(--text4)">—</div>';
  el.scrollTop = 0;  // dernier message toujours en haut
}
var _hbSpellLpTimer = null;
function hbSpellLpStart(idx) {
  _hbSpellLpTimer = setTimeout(function() {
    _hbSpellLpTimer = null;
if (idx === -1) {
      var weapU = typeof META!=='undefined'&&META.eq&&META.eq.arme&&typeof byUid==='function'?byUid(META.eq.arme):null;
      // affiche popup arme
      var div = document.createElement('div');
      div.id = 'hb-spell-popup';
      div.style.cssText = 'position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6)';
      div.onclick = function(){ div.remove(); };
      div.innerHTML = '<div style="background:var(--bg1);border:1px solid var(--border2);border-radius:14px;padding:18px 20px;max-width:280px;width:90%">'
        +'<div style="font-family:var(--font-h);font-size:1rem;font-weight:700;color:var(--cyan);margin-bottom:6px">'+(weapU?hbEscape(weapU.nm):'Attaque de base')+'</div>'
        +'<div style="font-size:.75rem;color:var(--text3)">Coût : '+HB_CFG.PA_BASIC_ATK+' PA · Portée : adjacent</div>'
        +'<div style="font-size:.72rem;color:var(--text2);margin-top:8px">Dégâts : '+(HB&&HB.player?HB.player.atk:0)+' ATQ</div>'
        +'<div style="font-size:.65rem;color:var(--text4);margin-top:10px;text-align:center">Appuie n\'importe où pour fermer</div>'
        +'</div>';
      document.body.appendChild(div);
      return;
    }
    var sp = HB && HB.player && HB.player.spells[idx];
    if (!sp) return;// Remplace renderHexActionBar avec icônes, cooldown visuel, tooltip

    var cost = sp.energy * 2;
    var existing = document.getElementById('hb-spell-popup');
    if (existing) existing.remove();
    var div = document.createElement('div');
    div.id = 'hb-spell-popup';
    div.style.cssText = 'position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6)';
    div.onclick = function(){ div.remove(); };
    div.innerHTML =
      '<div style="background:var(--bg1);border:1px solid var(--border2);border-radius:14px;padding:18px 20px;max-width:280px;width:90%">'
      +'<div style="font-family:var(--font-h);font-size:1rem;font-weight:700;color:var(--cyan);margin-bottom:6px">'+hbEscape(sp.name)+'</div>'
      +'<div style="font-size:.75rem;color:var(--text3);margin-bottom:10px">Coût : '+cost+' PA · Portée : '+(sp.range>0?sp.range+' cases':'sur soi')+'</div>'
      +'<div style="font-size:.72rem;color:var(--text2);line-height:1.5">'
      +'Type : '+sp.type+'<br>'
      +'Puissance : '+(typeof spPwr==='function'?spPwr(sp).toFixed(2):sp.pwr)+'<br>'
      +(sp.dur?'Durée : '+sp.dur+' tours<br>':'')
      +(sp.hits?'Hits : '+sp.hits+'<br>':'')
      +'AOE : '+(sp.hbAoe||'Single')
      +'</div>'
      +'<div style="font-size:.65rem;color:var(--text4);margin-top:10px;text-align:center">Appuie n\'importe où pour fermer</div>'
      +'</div>';
    document.body.appendChild(div);
  }, 500);
}

function hbWeaponAttack(forcedTarget) {
  if (!HB || HB.phase !== 'player' || HB.over) return;
  var p = HB.player;
  if (p.pa < HB_CFG.PA_BASIC_ATK) { hbLog('⚠ PA insuffisants'); return; }
  var weapUid = typeof META!=='undefined' && META.eq && META.eq.arme;
  var weap    = weapUid && typeof byUid==='function' ? byUid(weapUid) : null;
  var wRange  = HB.weaponRange || HB_CFG.WEAPON_RANGE;
  var target  = forcedTarget || null;
  if (!target) {
    var minD = 999;
    HB.enemies.forEach(function(e) {
      if (!e.alive) return;
      var d = HB_HEX.dist(p.pos, e.pos);
      if (d < minD) { minD = d; target = e; }
    });
    if (!target || minD > wRange) { hbLog('⚠ Aucun ennemi à portée ('+wRange+' cases)'); return; }
  }
  p.pa -= HB_CFG.PA_BASIC_ATK;
  hbSpawnFloating && hbSpawnFloating(HB.player.pos, '-'+HB_CFG.PA_BASIC_ATK+' PA', '#f97316');  
  var atk = p.atk;
  hbAnimAttack(p.pos, target.pos, '#fbbf24', function(){
    var isCrit = hbDamage(target, atk, p);
    hbLog('⚔ ' + p.name + ' frappe ' + target.name + (isCrit?' ✦CRIT':''));
    hbCheckDeath(target);
    hbCheckEnd();
    hbRefreshHighlights();
    renderHexBattle();
  });
  return;
}
function hbSpellLpEnd() {
  if (_hbSpellLpTimer) { clearTimeout(_hbSpellLpTimer); _hbSpellLpTimer = null; }
}

function renderHexBattleResult() {
  var el = document.getElementById('hb-result');
  if (!el || !HB) return;
  el.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;padding:20px;text-align:center">'
    +'<div style="font-size:3rem">'+(HB.won?'🏆':'💀')+'</div>'
    +'<div style="font-family:var(--font-h);font-size:1.3rem;font-weight:900;color:'+(HB.won?'var(--gold)':'var(--red)')+'">'+( HB.won?'VICTOIRE !':'DÉFAITE')+'</div>'
    +(HB.won?'<div style="font-size:.9rem;font-weight:700;color:var(--gold)">+'+HB.rewardCr+' ₵ &nbsp; +'+HB.rewardXP+' XP</div>':'')
    +'<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">'
    +'<button class="btn btn-green btn-lg" onclick="startHexBattle()">↺ Rejouer</button>'
    +'<button class="btn btn-lg" onclick="hbQuit()">← Quitter</button>'
    +'</div>'
    +'</div>';
}

function hbSetMode(mode) {
  if (!HB || HB.phase !== 'player' || HB.over) return;
  HB.actionMode  = mode;
  hbRefreshHighlights();
  navigate('hexbattle');
  renderHexBattle();
}

// ================================================================
// hexBattle.js — Étape 2 : Animations + Barre de sorts enrichie
// ================================================================

// ── SYSTÈME DE PARTICULES / NOMBRES FLOTTANTS ────────────────────
// Chaque entrée : { x, y, text, col, life, maxLife, vy }
// life décroît de 1 par frame via RAF. À 0 → supprimée.
var HB_ANIMS = [];
var HB_RAF   = null;   // id requestAnimationFrame courant
var HB_DIRTY = false;  // true = un redraw RAF est nécessaire

// Démarre la boucle RAF si elle n'est pas déjà en cours
function hbStartRAF() {
  if (HB_RAF) return;
  function loop() {
    if (!HB || !HB_ANIMS.length) { HB_RAF = null; return; }
    // Avance les animations
    for (var i = HB_ANIMS.length - 1; i >= 0; i--) {
      var a = HB_ANIMS[i];
      a.life--;
      a.y  += a.vy;
      a.vy *= 0.92;  // friction
      if (a.life <= 0) HB_ANIMS.splice(i, 1);
    }
    HB_CVS.draw();   // redraw complet (léger car canvas ~390px)
    HB_RAF = requestAnimationFrame(loop);
  }
  HB_RAF = requestAnimationFrame(loop);
}

// Arrête la boucle RAF
function hbStopRAF() {
  if (HB_RAF) { cancelAnimationFrame(HB_RAF); HB_RAF = null; }
  HB_ANIMS = [];
}

// Crée un nombre flottant centré sur un hex
function hbSpawnFloating(hexPos, text, col) {
  if (!HB) return;
  var ox = (HB.canvasW||390)/2 + HB.camX;
  var oy = (HB.canvasH||300)/2 + HB.camY;
  var p  = HB_HEX.toPixel(hexPos.q, hexPos.r, ox, oy);
  HB_ANIMS.push({
    x: p.x + (Math.random()*12 - 6),
    y: p.y - HB_HEX.SIZE,
    text: text,
    col : col || '#fff',
    life: 65,
    maxLife: 65,
    vy  : -0.8,
  });
  hbStartRAF();
}

// Flash rouge sur une unité touchée (state temporaire)
function hbFlashUnit(unit) {
  unit._flash = 8;  // 8 frames de flash
  hbStartRAF();
}
// Arc lumineux animé d'une unité vers une case cible
function hbAnimAttack(casterPos, targetPos, col, onDone) {
  if (!HB) { if(onDone) onDone(); return; }
  var ox = (HB.canvasW||390)/2 + HB.camX;
  var oy = (HB.canvasH||300)/2 + HB.camY;
  var zl = [0.65,1.0,1.35];
  var z  = zl[HB.zoom||1];
  var from = HB_HEX.toPixel(casterPos.q, casterPos.r, ox, oy);
  var to   = HB_HEX.toPixel(targetPos.q,  targetPos.r,  ox, oy);
  var t0   = Date.now();
  var DUR  = 220;  // ms

  function frame() {
    var canvas = document.getElementById('hb-canvas');
    if (!canvas) { if(onDone) onDone(); return; }
    var ctx = canvas.getContext('2d');
    var frac = Math.min(1, (Date.now()-t0)/DUR);
    // Position actuelle du projectile
    var cx = from.x + (to.x-from.x)*frac;
    var cy = from.y + (to.y-from.y)*frac;
    // Redraw complet + projectile
    HB_CVS.draw();
    ctx.save();
    ctx.translate(HB.canvasW/2, HB.canvasH/2);
    ctx.scale(z, z);
    ctx.translate(-HB.canvasW/2, -HB.canvasH/2);
    // Traînée
    var grad = ctx.createLinearGradient(from.x, from.y, cx, cy);
    grad.addColorStop(0,   'rgba('+hexToCtx(col)+',0)');
    grad.addColorStop(0.5, 'rgba('+hexToCtx(col)+',0.35)');
    grad.addColorStop(1,   'rgba('+hexToCtx(col)+',0.95)');
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(cx, cy);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = col; ctx.shadowBlur = 10;
    ctx.stroke();
    // Tête lumineuse
    ctx.beginPath();
    ctx.arc(cx, cy, 5*(1-frac*0.4), 0, Math.PI*2);
    ctx.fillStyle = col;
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
    if (frac < 1) requestAnimationFrame(frame);
    else { HB_CVS.draw(); if(onDone) onDone(); }
  }
  requestAnimationFrame(frame);
}

// Convertit #rrggbb → 'r,g,b' pour les rgba()
function hexToCtx(hex) {
  if (!hex||hex[0]!=='#') return '255,255,255';
  return parseInt(hex.slice(1,3),16)+','+parseInt(hex.slice(3,5),16)+','+parseInt(hex.slice(5,7),16);
}

// ── HOOK : remplace hbDamage pour déclencher visuels ─────────────
var _hbDamageOrig = hbDamage;
hbDamage = function(target, rawDmg, caster) {
  var hpBefore = target.hp;
  _hbDamageOrig(target, rawDmg, caster);
  var dealt = hpBefore - target.hp;
  if (dealt > 0) {
    hbSpawnFloating(target.pos, '-' + Math.round(dealt), target.isPlayer ? '#f87171' : '#fbbf24');
    hbFlashUnit(target);
  }
};

// Hook sur les soins
var _hbApplySpellOrig = hbApplySpell;
hbApplySpell = function(caster, sp, targetHex) {
  _hbApplySpellOrig(caster, sp, targetHex);
  // Soin et bouclier → chiffre vert/bleu
  if (sp.type === 'heal' || sp.type === 'fort' || sp.type === 'rgnBurst') {
    hbSpawnFloating(caster.pos, '+soin', '#4ade80');
  }
  if (sp.type === 'shFull' || sp.type === 'shBoost' || sp.type === 'nano') {
    hbSpawnFloating(caster.pos, '+boucl.', '#60a5fa');
  }
  if (sp.type === 'invuln' || sp.type === 'titan' || sp.type === 'bunk') {
    hbSpawnFloating(caster.pos, 'INVULN', '#a78bfa');
  }
};

// ── SURCHARGE drawUnit pour le flash ─────────────────────────────
// On étend le module HB_CVS sans le réécrire :
// Wrapping du draw() original pour ajouter le rendu des anims
(function() {
  var origDraw = HB_CVS.draw;

  HB_CVS.draw = function() {
    origDraw();  // rendu normal
    if (!HB || !HB_ANIMS.length) return;

    // Récupère ctx via le canvas
    var canvas = document.getElementById('hb-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;

    HB_ANIMS.forEach(function(a) {
      var alpha = Math.min(1, a.life / (a.maxLife * 0.5));
      var scale = 0.7 + 0.5 * (1 - a.life / a.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold ' + Math.round(13 * scale) + 'px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Halo sombre
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(a.text, a.x + 1, a.y + 1);
      // Texte coloré
      ctx.fillStyle = a.col;
      ctx.fillText(a.text, a.x, a.y);
      ctx.restore();
    });
  };

  // Flash rouge sur les unités : intégré dans drawUnit via _flash
  var origDrawUnit = null;  // sera pris en charge via monkey-patch ci-dessous
}());

// ── SURCHARGE drawUnit via closure globale ────────────────────────
// HB_CVS est un module fermé, on ne peut pas modifier drawUnit directement.
// Solution propre : on passe _flash dans l'état de chaque unité et
// on l'applique dans la boucle RAF côté draw() étendu.
// Ajout : dessine un cercle rouge semi-transparent par-dessus l'unité flashée.
(function() {
  var origDraw2 = HB_CVS.draw;
  HB_CVS.draw = function() {
    origDraw2();
    if (!HB) return;
    var canvas = document.getElementById('hb-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var ox = (HB.canvasW||390)/2 + HB.camX;
    var oy = (HB.canvasH||300)/2 + HB.camY;
    HB.units.forEach(function(u) {
      if (!u.alive || !u._flash || u._flash <= 0) return;
      var p = HB_HEX.toPixel(u.pos.q, u.pos.r, ox, oy);
      var R = HB_HEX.SIZE * 0.72;
      ctx.save();
      ctx.globalAlpha = u._flash / 8 * 0.55;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R, 0, Math.PI*2);
      ctx.fillStyle = u.isPlayer ? '#f87171' : '#fbbf24';
      ctx.fill();
      ctx.restore();
      u._flash--;
    });
  };
}());

// ── BARRE DE SORTS ENRICHIE ───────────────────────────────────────
renderHexActionBar = function() {
  var el = document.getElementById('hb-actions');
  if (!el || !HB) return;
  var p    = HB.player;
  if (HB.phase === 'positioning' || HB.phase === 'positioning_done') {
 var posOk = HB.phase === 'positioning_done';
    el.innerHTML = '<div style="flex:1;font-size:.72rem;color:var(--text3);padding:0 8px">'
      +(posOk ? '✓ Position choisie — prêt ?' : 'Choisissez votre position de départ')
      +'</div>'
      +'<button class="btn btn-green" onclick="hbReadyUp()" style="flex-shrink:0;padding:6px 18px;font-weight:700">✔ READY</button>'
      +'<button class="btn btn-sm" onclick="hbQuit()" style="color:var(--text4)">✕</button>';
    return;
  }
  var isP  = HB.phase === 'player' && !HB.over;
  var mode = HB.actionMode;

  // ── Bouton arme équipée (à gauche) ───────────────────────────
  var weapUid = typeof META!=='undefined' && META.eq && META.eq.arme;
  var weap    = weapUid && typeof byUid==='function' ? byUid(weapUid) : null;
  var wCanUse = isP && p.pa >= HB_CFG.PA_BASIC_ATK;
  var isWeaponMode = HB.actionMode === 'weapon';
  var html = '<div class="hb-spell-btn'+(isWeaponMode?' hb-act-on':'')+(wCanUse?'':' hb-spell-disabled')+'"'    +' onclick="'+(wCanUse?'hbSelectWeapon()':'')+'"'
    +' onmousedown="hbSpellLpStart(-1)" onmouseup="hbSpellLpEnd()" onmouseleave="hbSpellLpEnd()"'
    +' ontouchstart="hbSpellLpStart(-1)" ontouchend="hbSpellLpEnd()">'
    +'<div class="hb-spell-ico">'+(weap&&weap.icon?weap.icon:'⚔️')+'</div>'
    +'<div class="hb-spell-nm">'+(weap?hbEscape(weap.nm.split(' ')[0]):'Arme')+'</div>'
    +'<div class="hb-spell-cost" style="color:'+(wCanUse?'var(--gold)':'var(--text4)')+'">'+HB_CFG.PA_BASIC_ATK+' PA</div>'
    +'</div>';

  // ── Sorts actifs ──────────────────────────────────────────────
  if (p.spells && p.spells.length) {
    p.spells.forEach(function(sp, i) {
      var cost   = sp.energy * 2;
      var onCd   = sp.cd > 0;
      var canUse = isP && p.pa >= cost && !onCd;
      var active = mode==='spell' && HB.pendingSpell && HB.pendingSpell.id===sp.id;
      var ico    = (typeof SP_CFG!=='undefined' && SP_CFG[sp.id]) ? SP_CFG[sp.id].ico : '⚡';
      html += '<div class="hb-spell-btn'+(active?' hb-act-on':'')+(canUse?'':' hb-spell-disabled')+'"'
        +' onclick="'+(canUse?'hbSelectSpell('+i+')':'')+'"'
        +' onmousedown="hbSpellLpStart('+i+')" onmouseup="hbSpellLpEnd()" onmouseleave="hbSpellLpEnd()"'
        +' ontouchstart="hbSpellLpStart('+i+')" ontouchend="hbSpellLpEnd()">'
        +'<div class="hb-spell-ico">'+ico+'</div>'
        +'<div class="hb-spell-nm">'+hbEscape(sp.name.split(' ')[0])+'</div>'
        +'<div class="hb-spell-cost" style="color:'+(canUse?'var(--gold)':'var(--text4)')+'">'+cost+' PA</div>'
        +(onCd?'<div class="hb-spell-cd-overlay"><span>'+sp.cd+'</span></div>':'')
        +'</div>';
    });
  }

  // ── Fin de tour + quitter + toggle opacité ────────────────────
  var opOn = HB.hexOpacity !== false;
  html += '<div style="margin-left:auto;display:flex;gap:4px;flex-shrink:0">'
    +'<button class="btn btn-sm btn-green" onclick="hbEndPlayerTurn()" '+(isP?'':'disabled')+'>Fin ▶</button>'
    +'<button class="btn btn-sm" onclick="hbToggleHexOpacity()" title="Opacité des cases" style="opacity:'+(opOn?1:0.45)+';font-size:.9rem">⬡</button>'
    +'<button class="btn btn-sm" onclick="hbQuit()" style="color:var(--text4)">✕</button>'
    +'</div>';

  el.innerHTML = html;
};

// ── NETTOYAGE au quit ─────────────────────────────────────────────
var _hbQuitOrig = hbQuit;
hbQuit = function() {
  hbStopRAF();
  var bot = document.getElementById('bot');
  if (bot) bot.style.display = '';
  _hbQuitOrig();
};

var _hbCheckEndOrig = hbCheckEnd;
hbCheckEnd = function() {
  var result = _hbCheckEndOrig();
  if (result) hbStopRAF();
  return result;
};
function hbShowTurnBanner(label, col) {
  var wrap = document.getElementById('hb-canvas-wrap');
  if (!wrap) return;
  var old = document.getElementById('hb-banner');
  if (old) old.remove();
  var div = document.createElement('div');
  div.id = 'hb-banner';
  div.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:15';
  div.innerHTML = '<div style="font-family:var(--font-h);font-size:1.1rem;font-weight:900;color:'+(col||'#fff')+';letter-spacing:.1em;background:rgba(6,8,15,.82);padding:8px 22px;border-radius:10px;border:1px solid '+(col||'#aaa')+';opacity:1;transition:opacity .6s ease .4s">'+hbEscape(label)+'</div>';
  wrap.appendChild(div);
  setTimeout(function(){
    var inner = div.querySelector('div');
    if (inner) inner.style.opacity='0';
    setTimeout(function(){ div.remove(); }, 1000);
  }, 600);
}

function hbRenderInfoPanel() {
  var el = document.getElementById('hb-info-panel');
  if (!el) return;
  if (!HB || !HB.infoUnit || !HB.infoUnit.alive) { el.style.display='none'; return; }
  var u = HB.infoUnit;
  el.style.display = 'block';
  el.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
    +'<span style="font-size:1.6rem">'+u.icon+'</span>'
    +'<div style="flex:1;font-weight:700;font-size:.78rem;color:'+u.col+'">'+hbEscape(u.name)+'</div>'
    +'<span onclick="HB.infoUnit=null;hbRenderInfoPanel()" style="cursor:pointer;color:var(--text4);font-size:1.1rem">✕</span>'
    +'</div>'
    +'<div style="font-size:.66rem;color:var(--text3);display:flex;flex-direction:column;gap:3px">'
    +'<div>♥ PV : '+Math.round(u.hp)+' / '+Math.round(u.mHp)+'</div>'
    +(u.mSh>0?'<div>◈ Bouclier : '+Math.round(u.sh)+' / '+Math.round(u.mSh)+'</div>':'')
    +'<div>⚔ ATQ : '+u.atk+' · PM : '+u.pmMax+' · PA : '+u.paMax+'</div>'
    +(u.effs&&u.effs.length?'<div style="color:var(--gold)">'+u.effs.map(function(e){return(e.label||e.type)+' ('+e.turns+'t)';}).join(' · ')+'</div>':'')
    +'<div style="color:var(--text4);font-size:.58rem;margin-top:2px">'
    +(HB_HEX.dist(HB.player.pos,u.pos)<=1&&HB.player.pa>=HB_CFG.PA_BASIC_ATK?'Clic = attaque ('+HB_CFG.PA_BASIC_ATK+' PA)':'Hors portée')
    +'</div></div>';
}