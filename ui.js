// ================================================================
// ui.js v13 — Rendu DOM
// ================================================================
var PG = 'home';
var INV_FILTER = 'all';
var INV_SEL_MODE = false;   // mode sélection inventaire
var INV_SEL = {};           // uid → true
var DRAG_UID = null;
var DETAIL_UID = null;
var CRAFT_TAB = 'enhance';
var RELIC_FILTER = 'all';
var POPUP = { type: null, cb: null };

// ── Sélection inventaire ──────────────────────────────────────────
function toggleSelMode(){
  INV_SEL_MODE=!INV_SEL_MODE; INV_SEL={};
  renderInv();
}
function toggleInvSel(uid){
  if(INV_SEL[uid])delete INV_SEL[uid]; else INV_SEL[uid]=true;
  var cell=document.querySelector('.inv-cell[data-uid="'+uid+'"]');
  if(cell){
    cell.classList.toggle('selected',!!INV_SEL[uid]);
    var chk=cell.querySelector('.sel-check');
    if(chk)chk.textContent=INV_SEL[uid]?'✓':'';
  }
  renderInvSelBar();
}
function selectRarInv(rar){
  META.inv.forEach(function(it){if(it.rar===rar&&!it.perm&&!isEquipped(it.uid))INV_SEL[it.uid]=true;});
  renderInv();
}
function clearInvSel(){INV_SEL={};renderInv();}
function sellSelected(){
  var uids=Object.keys(INV_SEL);var total=0;
  uids.forEach(function(uid){var it=byUid(uid);if(!it||it.perm||isEquipped(uid))return;var p=SELL[it.rar]||30;if(it.relicCount)p=Math.floor(p*(1+it.relicCount*0.2));total+=p;META.cr+=p;});
  META.inv=META.inv.filter(function(x){return!INV_SEL[x.uid]||x.perm||isEquipped(x.uid);});
  INV_SEL={};
  recompute();updateTop();renderInv();saveMeta();
}
function renderInvSelBar(){
  var bar=document.getElementById('inv-sel-bar');if(!bar)return;
  var count=Object.keys(INV_SEL).length;
  if(!count){bar.classList.add('hidden');return;}
  bar.classList.remove('hidden');
  var total=0;
  Object.keys(INV_SEL).forEach(function(uid){var it=byUid(uid);if(!it)return;var p=SELL[it.rar]||30;if(it.relicCount)p=Math.floor(p*(1+it.relicCount*0.2));total+=p;});
  bar.querySelector('#sel-count').textContent=count+' item'+(count>1?'s':'');
  bar.querySelector('#sel-total').textContent=fmt(total)+'₵';
}
// ── Reset comp / sorts ────────────────────────────────────────────
function resetSkillPts(){
  var h=META.hero,total=0;
  SDEF.forEach(function(sd){total+=h.st[sd.id]||0;h.st[sd.id]=0;});
  h.skPts+=total;recompute();renderHero();saveMeta();
}
function resetSpellPts(){
  var h=META.hero,total=0,sp;
  for(sp in h.spLvPwr){total+=h.spLvPwr[sp]||0;h.spLvPwr[sp]=0;}
  for(sp in h.spLvCd) {total+=h.spLvCd[sp] ||0;h.spLvCd[sp]=0;}
  h.spPts+=total;renderHero();saveMeta();
}

// ── SPELL CONFIG ─────────────────────────────────────────────────
// bg: gradient de l'icône · ico: emoji/picto · pour img: assets/spells/{id}.png
var SP_CFG = {
  adren:{bg:'linear-gradient(135deg,#7c1d00,#ff4500)',ico:'⚡'},
  rage: {bg:'linear-gradient(135deg,#7f0000,#dc2626)',ico:'🔥'},
  lame: {bg:'linear-gradient(135deg,#003380,#0088ff)',ico:'⚔️'},
  nstim:{bg:'linear-gradient(135deg,#004020,#00cc55)',ico:'💉'},
  ovchg:{bg:'linear-gradient(135deg,#5a3a00,#f59e0b)',ico:'⚡'},
  chain:{bg:'linear-gradient(135deg,#003344,#00d4ff)',ico:'⛓️'},
  sacri:{bg:'linear-gradient(135deg,#440000,#cc0022)',ico:'💀'},
  saign:{bg:'linear-gradient(135deg,#550010,#ff0030)',ico:'🩸'},
  apoc: {bg:'linear-gradient(135deg,#222233,#778899)',ico:'💥'},
  omega:{bg:'linear-gradient(135deg,#3a0800,#ff4400)',ico:'Ω'},
  armv: {bg:'linear-gradient(135deg,#001a44,#2255cc)',ico:'🛡️'},
  fort: {bg:'linear-gradient(135deg,#003322,#00aa55)',ico:'🏰'},
  nano: {bg:'linear-gradient(135deg,#001844,#004499)',ico:'🔬'},
  ishll:{bg:'linear-gradient(135deg,#1a2233,#445566)',ico:'⬡'},
  repdr:{bg:'linear-gradient(135deg,#002233,#0077aa)',ico:'🚁'},
  barr: {bg:'linear-gradient(135deg,#001133,#1133aa)',ico:'▣'},
  reflt:{bg:'linear-gradient(135deg,#220055,#7733dd)',ico:'🔄'},
  fortm:{bg:'linear-gradient(135deg,#112211,#335533)',ico:'🔒'},
  bunk: {bg:'linear-gradient(135deg,#1a0044,#5500bb)',ico:'◉'},
  titan:{bg:'linear-gradient(135deg,#220055,#6600ff)',ico:'👊'},
};

function spIco(id,sz){
  var c=SP_CFG[id]||{bg:'#333',ico:'?'};
  sz=sz||36;
  var r=Math.round(sz*0.22);
  // Container position:relative · img absolute → emoji stays on top (z-index:1, relative)
  return '<div class="sp-ico-wrap" style="width:'+sz+'px;height:'+sz+'px;border-radius:'+r+'px;background:'+c.bg+'">'
    +'<img src="assets/spells/'+id+'.png" onerror="this.style.display=\'none\'" alt=""/>'
    +'<span style="font-size:'+Math.round(sz*0.52)+'px">'+c.ico+'</span>'
    +'</div>';
}

function itemIco(it,sz){
  sz=sz||36;
  var ico=it.icon||{arme:'⚔️',skin:'👕',implant:'💿',chaussures:'👟',relique:'⚗️',piece:'🔩'}[it.sl||it.type]||'📦';
  var bg='linear-gradient(135deg,#111827,#1c2438)';
  // Image asset si disponible
  var src=it.sl?'assets/items/'+it.sl+'/'+it.rar+'.png':'assets/mats/'+it.type+'/'+it.rar+'.png';
return '<div style="width:'+sz+'px;height:'+sz+'px;border-radius:'+Math.round(sz*0.22)+'px;background:'+bg+';display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;flex-shrink:0">'
    +'<img src="'+src+'" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;position:absolute;inset:0;z-index:1" onerror="this.style.display=\'none\';this.nextElementSibling.style.visibility=\'visible\'" alt=""/>'
    +'<span style="font-size:'+Math.round(sz*0.5)+'px;line-height:1;position:relative;visibility:hidden;z-index:0">'+ico+'</span>'
    +'</div>';
}

function heroImg(hid,w,h){
  var hero=getH(hid||'berserker');
  var fallback={berserker:'⚔️',warden:'🛡️'}[hid]||'🦸';
  // img absolute fills container; span hidden by default, shown via onerror
  return '<div class="hero-img-wrap" style="width:'+w+'px;height:'+h+'px;border-radius:8px;background:linear-gradient(180deg,#1c2438,#0c1020)">'
    +'<img src="'+hero.portrait+'" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'" alt=""/>'
    +'<span style="font-size:'+Math.round(w*0.5)+'px;display:none">'+fallback+'</span>'
    +'</div>';
}

function enemyImg(portrait,sz,fallback){
  sz=sz||56;
  return '<div style="width:'+sz+'px;height:'+Math.round(sz*1.2)+'px;border-radius:8px;overflow:hidden;background:var(--bg2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:'+Math.round(sz*0.6)+'px;position:relative">'
    +'<img src="'+portrait+'" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0" onerror="this.style.display=\'none\'" alt=""/>'
    +(fallback||'👾')
    +'</div>';
}

// ── TOP BAR ──────────────────────────────────────────────────────
function updateTop(){
  var rc=document.getElementById('rc');
  var rg=document.getElementById('rg');
  if(rc)rc.innerHTML='<span>₵</span><strong>'+fmt(META.cr)+'</strong>';
  if(rg)rg.innerHTML='<span>💎</span><strong>'+META.gems+'</strong>';
}

// ── NAVIGATION ───────────────────────────────────────────────────
function navigate(pg){
  PG=pg;
  document.querySelectorAll('.pg').forEach(function(p){p.classList.remove('active');});
  var t=document.getElementById('pg-'+pg);if(t)t.classList.add('active');
  document.querySelectorAll('.nb').forEach(function(b){b.classList.toggle('active',b.getAttribute('data-pg')===pg);});
  if(pg==='home') setNotif('run-notif-dot', false);
  if(pg==='hero') setNotif('hero-notif-dot', false);
  if(pg==='missions') setNotif('mission-notif-dot', false);
  if(pg==='home'&&G&&G.pendingGO){G.pendingGO=false;showGO();}
  if(pg==='duel'&&DL&&DL.pendingResult){DL.pendingResult=false;showDuelResult(DL.resultWon);}
  refresh();
}

function refresh(){
  updateTop();
  if(PG==='home') {renderHub();if(G&&!G.over)updateHomeDynamic();}
  if(PG==='duel') renderDuelSel();
  if(PG==='hero') renderHero();
  if(PG==='upg')  renderUpg();
  if(PG==='bout') renderBout();
  if(PG==='inv')  renderInv();
  if(PG==='craft')   renderCraft();
  if(PG==='missions')renderMissions();
  if(PG==='options') renderOptions();
  if(PG==='hexbattle') renderHexBattle();
}  

// ── HOME ─────────────────────────────────────────────────────────
function buildHomeStructure(){
  var root=document.getElementById('home-root');if(!root)return;
  if(!G||G.over){
    G=null;curRunType=null;SPEED=1;
    var h='<div class="run-page"><div class="sec-hdr" style="padding:0 0 10px;border:none">CHOISIR UN RUN</div>';
    RUN_TYPES.forEach(function(rr,i){
      var gc={e:'#00e87c',m:'#00d4ff',h:'#ff3355'}[rr.diff];
      var dlbl={e:'FACILE',m:'NORMAL',h:'HARDCORE'}[rr.diff];
      h+='<div class="run-card" onclick="startRun(RUN_TYPES['+i+'])" style="border-left:3px solid '+gc+'">'
        +'<div class="run-card-bg" style="background:url('+rr.bg+') center/cover,linear-gradient(135deg,var(--bg2),var(--bg3))"></div>'
        +'<div class="run-card-veil"></div>'
        +'<div class="run-card-body">'
        +'<div class="run-card-name" style="color:'+gc+'">'+rr.name+'</div>'
        +'<div class="run-card-desc">'+rr.desc+'</div>'
        +'<div class="run-card-tags">'+rr.tags+'</div>'
        +'</div>'
        +'<div class="run-card-badge" style="background:'+gc+'22;color:'+gc+';border:1px solid '+gc+'44">'+dlbl+'</div>'
        +'</div>';
    });
    h+='</div>';
    root.innerHTML=h;return;
  }
  // Active run
  var hero=getH(META.heroId),spH='';
  hero.spells.forEach(function(sp){
    if(!isActive(sp.id)&&!sp.passive)return;
    var unl=META.hero.lv>=sp.ulv;
    spH+='<div class="sp-mini'+(sp.passive?' passive':'')+(unl?'':' locked')+'" title="'+sp.name+'">'+spIco(sp.id,38);
    if(sp.passive)     spH+='<span class="sp-cd-txt" style="color:var(--green)">PASSIF</span>';
    else if(!unl)      spH+='<span class="sp-cd-txt" style="color:var(--text4)">Nv.'+sp.ulv+'</span>';
    else spH+='<span class="sp-cd-txt" id="sp-tm-'+sp.id+'">—</span>'
      +'<button class="sp-cast btn-cast" id="sp-cast-'+sp.id+'" data-sid="'+sp.id+'">▶</button>'
      +'<button class="sp-auto btn-auto'+(G&&G.autoSp[sp.id]?' on':'')+'" id="sp-auto-'+sp.id+'" data-sid="'+sp.id+'">AUTO</button>';
    spH+='</div>';
  });
  var sb='<div class="spd-row"><span class="spd-label">VITESSE</span>';
  [1,2,5,10].forEach(function(sv){sb+='<button class="spd-btn'+(SPEED===sv?' active':'')+'" onclick="setSpeed('+sv+')" data-spd="'+sv+'">×'+sv+'</button>';});
  sb+='</div>';
  var rt=curRunType;
  root.innerHTML='<div class="run-active-wrap">'
    +'<div style="display:flex;align-items:center;justify-content:space-between">'
    +'<span style="font-size:.72rem;color:var(--text4)">'+((rt&&rt.name)||'RUN')+'</span>'+sb+'</div>'
    +'<div class="combat-grid">'
    +'<div class="cpanel"><div class="cpanel-lbl">JOUEUR</div><div class="cpanel-name" id="d-pname"></div>'
    +'<div class="hp-line"><span id="d-php">PV —</span></div><div class="bar-wrap"><div class="bar-fill bar-hp" id="d-bar-hp" style="width:100%"></div></div>'
    +'<div class="hp-line"><span id="d-psh">Boucl —</span></div><div class="bar-wrap"><div class="bar-fill bar-sh" id="d-bar-sh" style="width:100%"></div></div>'
    +'<div class="stat-mini"><span>DPS <strong id="d-dps">—</strong></span><span>Rgn <strong id="d-rgn">—</strong></span></div>'
    +'<div id="d-gear" style="font-size:.66rem;margin-top:4px"></div></div>'
    +'<div class="cpanel"><div class="cpanel-lbl">ENNEMI</div>'
    +'<div class="enemy-row"><div class="enemy-img-box" id="d-enemy-img"></div>'
    +'<div style="flex:1"><div class="cpanel-name" id="d-ename">—</div>'
    +'<div class="hp-line"><span id="d-ehp"></span></div><div class="bar-wrap"><div class="bar-fill bar-en" id="d-bar-en" style="width:0"></div></div>'
    +'<div id="d-edps" style="font-size:.68rem;color:var(--text3);margin-top:3px"></div></div></div></div>'
    +'</div>'
    +'<div class="cpanel"><div class="cpanel-lbl">SORTS ACTIFS</div><div class="spells-strip" id="d-spells">'+spH+'</div></div>'
    +'<div style="font-size:.74rem;color:var(--text3)" id="d-sit"></div>'
    +'<div class="run-log" id="clog"></div>'
    +'</div>';
  updateHomeDynamic();
}

function setSpeed(s){
  SPEED=s;
  document.querySelectorAll('.spd-btn').forEach(function(b){b.classList.toggle('active',parseInt(b.getAttribute('data-spd'))===s);});
}

function updateHomeDynamic(){
  if(!G)return;
  var h=META.hero,fx=G.fx;
  setText('d-pname',META.hero.name||getH(META.heroId).name);
  setText('d-php','PV: '+Math.floor(G.pHp)+' / '+P.mHp);setBar('d-bar-hp',G.pHp,P.mHp);
  setText('d-psh','Boucl: '+Math.floor(G.pSh)+' / '+P.mSh);setBar('d-bar-sh',G.pSh,P.mSh);
  setText('d-dps',P.dps+(fx.dM!==1?' ×'+fx.dM.toFixed(1):''));setText('d-rgn',P.rgn+'/s');
  var gear='<div class="gear-strip">';
  ['arme','skin','implant1','implant2','chaussures'].forEach(function(sl){var u=META.eq[sl];if(!u)return;var it=byUid(u);if(!it)return;var ico=it.icon||{arme:'⚔️',skin:'👕',implant:'💿',chaussures:'👟'}[it.sl]||'📦';gear+='<span class="gear-ico '+RAR[it.rar].cls+'" title="'+it.nm+'">'+ico+'</span>';});
  gear+='</div>';
  var gEl=document.getElementById('d-gear');if(gEl)gEl.innerHTML=gear;
  var fxS='';if(fx.dM!==1&&fx.dM_t>0)fxS+=' ⚡×'+fx.dM.toFixed(1);if(fx.inv)fxS+=' INVULN';if(fx.dot_t>0)fxS+=' DOT';
  setText('d-sit','Vague '+G.wave+' — '+(G.eIdx+1)+'/'+CFG.E_WAVE+' | Nv.'+h.lv+(fxS?' ·'+fxS:''));
  if(G.enemy){
    var e=G.enemy;
    var imgEl=document.getElementById('d-enemy-img');
    if(imgEl)imgEl.innerHTML=enemyImg(e.portrait,50,{1:'🤖',2:'👾',3:'💀'}[e.tier]);
    setText('d-ename',e.nm);setText('d-ehp',fmt(e.hp)+' / '+fmt(e.mHp));setBar('d-bar-en',e.hp,e.mHp);
    setText('d-edps','DPS '+e.dps.toFixed(1)+' · '+e.rwd+'₵');
  }else{var ig=document.getElementById('d-enemy-img');if(ig)ig.innerHTML='';setText('d-ename','Prochain…');setText('d-ehp','');setBar('d-bar-en',0,1);}
  var hero=getH(META.heroId);
  hero.spells.forEach(function(sp){
    if(sp.passive||META.hero.lv<sp.ulv||!isActive(sp.id))return;
    var tm=G.spTm[sp.id]||0,rdy=tm<=0,over=G.over;
    var tmEl=document.getElementById('sp-tm-'+sp.id);var castEl=document.getElementById('sp-cast-'+sp.id);var autoEl=document.getElementById('sp-auto-'+sp.id);
    if(tmEl){tmEl.textContent=rdy?'PRÊT':tm.toFixed(1)+'s';tmEl.className='sp-cd-txt'+(rdy?' rdy':'');}
    if(castEl)castEl.disabled=(!rdy||over);
    if(autoEl){var on=G.autoSp[sp.id]||false;autoEl.textContent='AUTO:'+(on?'ON':'OFF');autoEl.classList.toggle('on',on);autoEl.disabled=over;}
  });
  var logEl=document.getElementById('clog');if(!logEl)return;
  logEl.innerHTML=G.log.slice(0,14).map(function(l){return'<div class="log-line">'+l.m+'</div>';}).join('');
}

// ── DUEL ─────────────────────────────────────────────────────────
function renderDuelSel(){
  var c=document.getElementById('opp-cards');if(!c)return;
  var dL={e:'FACILE',m:'NORMAL',h:'DIFFICILE'};
  var gc={e:'var(--green)',m:'var(--cyan)',h:'var(--red)'};
  var emo={rookie:'🤖',vet:'👾',champ:'💀'};
  c.innerHTML=OPPONENTS.map(function(o,i){
    var sc=oppScaled(o),wins=META.duelWins[o.id]||0;
    return '<div class="opp-card" onclick="startDuel(OPPONENTS['+i+'])">'
      +'<div class="opp-art">'+emo[o.id]
      +'<img src="'+o.portrait+'" alt="" onerror="this.style.display=\'none\'"/></div>'
      +'<div class="opp-body">'
      +'<div class="opp-diff" style="color:'+gc[o.diff]+'">'+dL[o.diff]+(wins>0?' · Revanche #'+wins+' (×'+Math.pow(1.15,wins).toFixed(2)+')':'')+'</div>'
      +'<div class="opp-name">'+o.name+'</div><div class="opp-arch">'+o.archetype+'</div>'
      +'<div class="opp-desc">'+o.desc+'</div>'
      +'<div class="opp-stats">PV:'+sc.hp+' · Boucl:'+sc.sh+' · ATQ:'+sc.atk+'</div>'
      +'<div class="opp-stats" style="margin-top:3px">💎 '+o.rewardGems+' · '+o.rewardRarMin+'→'+o.rewardRarMax+'</div>'
      +'<div class="opp-cta" style="margin-top:6px">DÉFIER →</div>'
      +'</div></div>';
  }).join('');
}

function renderDuelFight(){
  if(!DL)return;
  var d=DL,opp=d.opp;
  var badge=document.getElementById('df-turn-badge');
  badge.textContent=d.phase==='player'?'▶ VOTRE TOUR':'⏳ ENNEMI';
  badge.className='turn-badge '+(d.phase==='player'?'turn-p':'turn-e');
  setText('df-turn-n','Tour '+d.turn);
  document.getElementById('btn-endturn').disabled=(d.phase!=='player');
  setText('dop-name',opp.name);
  setText('dop-hp',Math.floor(d.oppHp)+' / '+d.oppMHp);setBar('dop-bar-hp',d.oppHp,d.oppMHp);
  setText('dop-sh','Boucl: '+Math.floor(d.oppSh)+' / '+d.oppMSh);setBar('dop-bar-sh',d.oppSh,d.oppMSh);
  document.getElementById('dop-stats').textContent='ATQ: '+Math.floor(duelAtkVal(d.eEff,d.oppAtk));
  setText('dop-eff',d.eEff.map(function(e){return'['+e.label+']';}).join(' '));
  setText('dme-name',(META.hero.name||getH(META.heroId).name)+' Nv.'+META.hero.lv);
  setText('dme-hp',Math.floor(d.pHp)+' / '+d.pMHp);setBar('dme-bar-hp',d.pHp,d.pMHp);
  setText('dme-sh','Boucl: '+Math.floor(d.pSh)+' / '+d.pMSh);setBar('dme-bar-sh',d.pSh,d.pMSh);
  document.getElementById('dme-stats').textContent='ATQ: '+Math.floor(duelAtkVal(d.pEff,d.pAtk))+' · Crit: '+Math.round(d.pCrit*100)+'%';
  setText('dme-eff',d.pEff.map(function(e){return'['+e.label+']';}).join(' '));
  var pips='';for(var ei=0;ei<CFG.DUEL_ENERGY;ei++)pips+='<div class="en-pip'+(ei<d.pEn?' full':'')+'"></div>';
  document.getElementById('energy-pips').innerHTML=pips;setText('energy-txt',d.pEn+'/'+CFG.DUEL_ENERGY+' ⚡');
  var hero=getH(META.heroId),isP=d.phase==='player';
  var eqArme=META.eq['arme']?byUid(META.eq['arme']):null;
  var actH='<button class="da btn-dact" data-act="weapon"'+(isP&&d.pEn>=1?'':' disabled')+'>'
    +'🗡 '+(eqArme?eqArme.nm:'Poing')+' <span class="ec">1⚡</span></button>';
  hero.spells.forEach(function(sp2){
    if(sp2.passive||META.hero.lv<sp2.ulv||!isActive(sp2.id))return;
    var canA=isP&&d.pEn>=sp2.energy,cfg=SP_CFG[sp2.id]||{ico:'?'};
    actH+='<button class="da btn-dact" data-act="'+sp2.id+'"'+(canA?'':' disabled')+'>'+cfg.ico+' '+sp2.name+' <span class="ec">'+sp2.energy+'⚡</span></button>';
  });
  document.getElementById('duel-act-btns').innerHTML=actH;
  var logEl=document.getElementById('duel-log');if(!logEl)return;
  logEl.innerHTML=d.log.slice(0,20).map(function(l){return'<div class="dl-'+l.t+'">'+l.m+'</div>';}).join('');
}

// ── HÉROS ────────────────────────────────────────────────────────
function renderHero(){
  var el=document.getElementById('hr-c');if(!el)return;
  var h=META.hero,hero=getH(META.heroId||'berserker'),bd=computeBreakdown();
  var xpMax=h.lv<CFG.H_MAX_LV?xpReq(h.lv):1;
  el.innerHTML='<div class="hero-page">'
    // RPG Card
    +'<div class="hero-rpg"><div class="hero-rpg-top">'
    // Portrait gauche
    +'<div class="hero-portrait">'+heroImg(META.heroId,94,122)+'</div>'
    // Info droite
    +'<div class="hero-info">'
    +'<input id="hero-name-inp" class="hero-name-inp" value="'+(h.name||hero.name)+'" maxlength="20">'
    +'<div class="hero-arch">'+hero.arch+'</div>'
    +'<div class="hero-lv-row">Niveau <strong>'+h.lv+'</strong><span style="color:var(--text4)">/ '+CFG.H_MAX_LV+'</span></div>'
    +'<div class="bar-wrap" style="height:5px;margin:3px 0"><div class="bar-fill bar-xp" style="width:'+(h.lv<CFG.H_MAX_LV?pct(h.xp,xpMax):100)+'%"></div></div>'
    +'<div style="font-size:.7rem;color:var(--text3)">XP: '+fmt(h.xp)+' / '+(h.lv<CFG.H_MAX_LV?fmt(xpMax):'MAX')+'</div>'
    +'<div class="pts-chips" style="margin-top:6px">'
    +(h.skPts>0?'<span class="chip chip-sk">'+h.skPts+' comp.</span>':'')
    +(h.spPts>0?'<span class="chip chip-sp">'+h.spPts+' sorts</span>':'')
    +'</div>'
    +'<div style="display:flex;gap:5px;margin-top:5px">'
    +'<button class="btn-reset" onclick="resetSkillPts()" title="Rembourse tous les points de compétence">↺ Comp.</button>'
    +'<button class="btn-reset" onclick="resetSpellPts()" title="Rembourse tous les points de sorts">↺ Sorts</button>'
    +'</div>'
    +'</div></div></div>'
    // Skills
    +'<div class="skills-sect"><div class="sec-hdr" style="padding:0 0 6px;border:none;font-size:.68rem">COMPÉTENCES</div><div class="skills-grid">'
    +SDEF.map(function(sd){var val=h.st[sd.id]||0;return'<div class="sk-cell"><span class="sk-name">'+sd.icon+' '+sd.nm+'</span><span class="sk-val">'+val+'</span><button class="sk-btn btn-stat" data-stat="'+sd.id+'"'+(h.skPts>0?'':' disabled')+' title="'+sd.d+'">+</button></div>';}).join('')
    +'</div></div>'
    // Stats boxes
    +'<div class="stats-sect"><div class="sec-hdr" style="padding:0 0 6px;border:none;font-size:.68rem">STATS</div><div class="stat-boxes">'
    +sBox('⚔️','ATQ',P.atk)+sBox('⚡','VitAtq',P.aspd.toFixed(2)+'/s')+sBox('≋','DPS',fmt(P.dps))
    +sBox('♥','PV',fmt(P.mHp))+sBox('◈','Bouclier',fmt(P.mSh))+sBox('⟳','Regen',P.rgn+'/s')
    +sBox('★','Crit',Math.round(P.crit*100)+'%')+sBox('◌','Esquive',Math.round(P.dodge*100)+'%')
    +sBox('🌟','Pros.',P.pros)+sBox('₵','Mult.',P.mult.toFixed(2)+'×')
    +'</div>'
    +'<details style="margin-top:8px"><summary>▸ Détail du calcul</summary>'
+'<table class="dtbl" style="margin-top:7px"><tr><th style="text-align:left;font-size:.66rem;color:var(--text4);padding:3px 5px">Stat</th><th style="font-size:.66rem;color:var(--text4);text-align:right;padding:3px 5px">Base</th><th style="font-size:.66rem;color:var(--green);text-align:right;padding:3px 5px">+Comp</th><th style="font-size:.66rem;color:var(--rar-r);text-align:right;padding:3px 5px">+Équip</th><th style="font-size:.66rem;color:var(--cyan);text-align:right;padding:3px 5px">+Lab</th><th style="font-size:.66rem;color:var(--text);text-align:right;padding:3px 5px">Total</th></tr>'
    +dRow('ATQ',bd.atk)+dRow('VitAtq',bd.aspd)+dRow('PV',bd.hp)+dRow('Bouclier',bd.sh)+dRow('Regen',bd.rgn)
  +'<tr><td>Crit</td><td style="text-align:right">0%</td><td style="text-align:right;color:var(--green)">'+((bd.crit.skills)?'+'+Math.round(bd.crit.skills*100)+'%':'—')+'</td><td style="text-align:right;color:var(--rar-r)">'+((bd.crit.equip)?'+'+Math.round(bd.crit.equip*100)+'%':'—')+'</td><td style="text-align:right;color:var(--cyan)">'+((bd.crit.upg)?'+'+Math.round(bd.crit.upg*100)+'%':'—')+'</td><td style="text-align:right;font-weight:700">'+Math.round(P.crit*100)+'%</td></tr>'
+'<tr><td>Esquive</td><td style="text-align:right">0%</td><td style="text-align:right;color:var(--green)">'+((bd.dodge.skills)?'+'+Math.round(bd.dodge.skills*100)+'%':'—')+'</td><td style="text-align:right;color:var(--rar-r)">'+((bd.dodge.equip)?'+'+Math.round(bd.dodge.equip*100)+'%':'—')+'</td><td style="text-align:right;color:var(--cyan)">—</td><td style="text-align:right;font-weight:700">'+Math.round(P.dodge*100)+'%</td></tr>'
    +'</table></details></div>'
    +'</div>'
    // Sorts 2 colonnes
    +'<div class="hero-rpg" style="margin-top:0"><div class="spells-sect"><div class="sec-hdr" style="padding:12px 12px 6px;border:none;font-size:.68rem">SORTS — '+hero.spells.length+' DISPONIBLES (MAX '+CFG.MAX_ACTIVE_SP+' ACTIFS)</div><div class="spells-2col">'
    +hero.spells.map(function(sp){
      var unl=h.lv>=sp.ulv,lvP=h.spLvPwr[sp.id]||0,lvC=h.spLvCd[sp.id]||0;
      var canP=!sp.passive&&unl&&h.spPts>0&&lvP<CFG.SP_MAX_LV;
      var canC=!sp.passive&&unl&&h.spPts>0&&lvC<CFG.SP_MAX_LV;
      var act=isActive(sp.id);
      var canToggle=!sp.passive&&unl;
      return '<div class="sp-card'+(unl?'':' locked')+(sp.passive?' passive':'')+(act?' active-sp':'')+'">'
        +'<div class="sp-card-top">'
        +'<div class="sp-card-img" style="background:'+(SP_CFG[sp.id]||{bg:'#333'}).bg+'">'+spIco(sp.id,34)+'</div>'
        +'<div style="flex:1"><div class="sp-card-name">'+sp.name+'</div><div class="sp-card-meta">'
        +(sp.passive?'<span style="color:var(--green)">PASSIF</span>'
          :unl?'Nv.P:'+lvP+' CD:'+lvC+' · '+spCd(sp).toFixed(0)+'s · '+sp.energy+'⚡'
          :'<span style="color:var(--text4)">Nv.'+sp.ulv+'</span>')
        +'</div></div>'
        +(canToggle?'<button onclick="onToggleSp(\''+sp.id+'\')" style="flex-shrink:0;padding:3px 7px;border-radius:6px;border:1px solid '+(act?'rgba(0,212,255,.4)':'var(--border)')+';background:'+(act?'rgba(0,212,255,.08)':'transparent')+';color:'+(act?'var(--cyan)':'var(--text4)')+';font-size:.65rem;cursor:pointer;font-family:var(--font)">'+(act?'★ Actif':'○ Inactif')+'</button>':'')
        +'</div>'
        +'<div class="sp-card-desc">'+sp.desc+'</div>'
        +(!sp.passive&&unl?'<div class="sp-card-btns"><button class="btn btn-sm btn-spwr" data-spell="'+sp.id+'"'+(canP?'':' disabled')+'>↑ Puiss.</button><button class="btn btn-sm btn-scd" data-spell="'+sp.id+'"'+(canC?'':' disabled')+'>↓ CD</button></div>':'')
        +(!sp.passive&&!unl?'<div style="font-size:.65rem;color:var(--text4)">Débloqué Nv.'+sp.ulv+'</div>':'')
        +'</div>';
    }).join('')
    +'</div></div></div>'
    +'</div>';
  document.getElementById('hr-c').querySelector('#hero-name-inp').addEventListener('change',function(){META.hero.name=this.value.trim()||null;saveMeta();});
}

function sBox(ico,lbl,val){return'<div class="stat-bx"><span class="stat-bx-ico">'+ico+'</span><span class="stat-bx-lbl">'+lbl+'</span><span class="stat-bx-val">'+val+'</span></div>';}
function fmtVal(v){if(v===0||v===undefined)return'—';var n=parseFloat(v);if(!isNaN(n)){var r=parseFloat(n.toFixed(1));return r===Math.floor(r)?Math.floor(r).toString():r.toFixed(1);}return String(v);}
function dRow(lbl,s){
  var comp=(s.skills||0)+(s.passive||0),eq=s.equip||0,lab=s.upg||0;
  return'<tr><td>'+lbl+'</td>'
    +'<td style="text-align:right">'+fmtVal(s.base)+'</td>'
    +'<td style="text-align:right;color:var(--green)">'+(comp?fmtVal(comp):'—')+'</td>'
    +'<td style="text-align:right;color:var(--rar-r)">'+(eq?fmtVal(eq):'—')+'</td>'
    +'<td style="text-align:right;color:var(--cyan)">'+(lab?fmtVal(lab):'—')+'</td>'
    +'<td style="text-align:right;font-weight:700">'+fmtVal(s.total)+'</td>'
    +'</tr>';
}

// ── HUB PAGE D'ACCUEIL ────────────────────────────────────────────
function renderHub(){
  var hubMode = document.getElementById('hub-mode');
  var homeRoot= document.getElementById('home-root');
  if(!hubMode||!homeRoot)return;
  var goVisible=document.getElementById('ov-go')&&!document.getElementById('ov-go').classList.contains('hidden');
  if(goVisible)return;
  if(G&&!G.over){
    // Run actif
    hubMode.classList.add('hidden');
    homeRoot.style.display='';
    buildHomeStructure();
  } else {
    // Pas de run actif → hub
    homeRoot.style.display='none';
    hubMode.classList.remove('hidden');
  }
}

function openHubModal(type){
  var modal=document.getElementById('hub-modal');
  var title=document.getElementById('hub-modal-title');
  var choices=document.getElementById('hub-modal-choices');
  if(!modal||!title||!choices)return;

  if(type==='run'){
    title.textContent='▶ Choisir un Run';
    choices.innerHTML=RUN_TYPES.map(function(rr,i){
      var gc={e:'#00e87c',m:'#00d4ff',h:'#ff3355'}[rr.diff];
      return '<button class="btn hub-modal-choice" style="border-left:3px solid '+gc+'" onclick="closeHubModal();startRun(RUN_TYPES['+i+'])">'
        +'<strong style="color:'+gc+'">'+rr.name+'</strong>'
        +'<span class="hub-choice-tags">'+rr.tags+'</span>'
        +'</button>';
    }).join('');
  } else if(type==='duel'){
    title.textContent='⚔ Choisir un Adversaire';
    choices.innerHTML=OPPONENTS.map(function(o,i){
      var gc={e:'#00e87c',m:'#00d4ff',h:'#ff3355'}[o.diff];
      var wins=META.duelWins[o.id]||0;
      return '<button class="btn hub-modal-choice" style="border-left:3px solid '+gc+'" onclick="closeHubModal();startDuel(OPPONENTS['+i+'])">'
        +'<strong style="color:'+gc+'">'+o.name+'</strong>'
        +'<span class="hub-choice-tags">'+o.archetype+(wins?' · Revanche #'+wins:'')+'</span>'
        +'</button>';
    }).join('');
  }
  modal.classList.remove('hidden');
}

function closeHubModal(){
  var modal=document.getElementById('hub-modal');
  if(modal)modal.classList.add('hidden');
}
// ── UPGRADES ─────────────────────────────────────────────────────
function _labBonus(u){
  var lv=META.upgLv[u.id]||0;if(!lv)return u.desc;
  if(u.stat==='atk')  return lv+'% → +'+Math.floor(PRE.atk*lv*0.01)+' ATQ';
  if(u.stat==='hp')   return lv+'% → +'+Math.floor(PRE.hp*lv*0.01)+' PV';
  if(u.stat==='sh')   return lv+'% → +'+Math.floor(PRE.sh*lv*0.01)+' Boucl.';
  if(u.stat==='aspd') return lv+'% → +'+parseFloat((PRE.aspd*lv*0.01).toFixed(2))+' VitAtq';
  if(u.stat==='crit') return '+'+Math.round(lv*0.5)+'% Crit';
  if(u.stat==='pros') return '+'+parseFloat((lv*0.5).toFixed(1))+' Pros.';
  if(u.stat==='mult') return 'x'+parseFloat((1+lv*0.005).toFixed(3));
  if(u.stat==='spPwr')return '+'+Math.round(lv*0.5)+'% sorts';
  return u.desc;
}
function openLabPopup(id){
  var u=UPGRADES.filter(function(x){return x.id===id;})[0];if(!u)return;
  var lv=META.upgLv[u.id]||0;
  var popup=document.getElementById('lab-popup');if(!popup)return;
  document.getElementById('lab-popup-title').textContent='Lab — '+u.name;
  document.getElementById('lab-popup-body').innerHTML=
    '<div style="text-align:center;padding:10px 6px">'
    +'<div style="font-size:2rem">'+u.icon+'</div>'
    +'<div style="font-weight:700;font-size:.9rem;color:var(--text);margin:6px 0">'+u.name+'</div>'
    +'<div style="font-size:.76rem;color:var(--text2);margin-bottom:8px">'+u.desc+'</div>'
    +'<div style="font-size:.78rem;color:var(--green)">'+_labBonus(u)+'</div>'
    +'<div style="font-size:.72rem;color:var(--text4);margin-top:6px">Niveau : '+lv+' / '+u.max+'</div>'
    +'</div>';
  popup.classList.remove('hidden');
}
function renderUpg(){
  var cats=[
    {lbl:'⚔️ Attaque', ids:['up_force','up_dex','up_agi']},
    {lbl:'🛡️ Défense',  ids:['up_end','up_res']},
    {lbl:'🧰 Autre',    ids:['up_int','up_cha','up_per']},
  ];
  var wrap=document.getElementById('upg-grid');if(!wrap)return;
  wrap.innerHTML=cats.map(function(cat){
    var items=UPGRADES.filter(function(u){return cat.ids.indexOf(u.id)!==-1;});
    return '<div class="lab-cat-title">'+cat.lbl+'</div>'
      +'<div class="lab-grid3">'
      +items.map(function(u){
        var lv=META.upgLv[u.id]||0,c=uCost(u),mx=lv>=u.max,ca=!mx&&META.cr>=c;
        var bp=Math.round(lv/u.max*100);
        return '<div class="lab-card3" onclick="openLabPopup(\''+u.id+'\')">'
          +'<div class="lab-card3-ico">'+u.icon+'</div>'
          +'<div class="lab-card3-name">'+u.name+'</div>'
          +'<div class="bar-wrap" style="height:3px;margin:3px 0"><div class="bar-fill bar-xp" style="width:'+bp+'%"></div></div>'
          +'<div class="lab-card3-lv">Nv.'+lv+'/'+u.max+'</div>'
          +'<div class="lab-card3-cost">'+(mx?'MAX':fmt(c)+' ₵')+'</div>'
+'<button class="btn btn-sm'+(ca?' btn-green':'')+' btn-upg lab-card3-btn" data-id="'+u.id+'" '+(ca?'':' disabled')+' onclick="event.stopPropagation();buyUpg(\''+u.id+'\')">'+(mx?'MAX':'Acheter')+'</button>'

          +'</div>';
      }).join('')
      +'</div>';
  }).join('');
}

// ── BOUTIQUE ─────────────────────────────────────────────────────
var BOUT_FILTER='all';
function renderBout(){
  var items=getBoutDisplay();
  var types=[{id:'all',lbl:'Tout'},{id:'arme',lbl:'⚔️ Armes'},{id:'skin',lbl:'👕 Skins'},{id:'implant',lbl:'💿 Implants'},{id:'chaussures',lbl:'👟 Chaussures'}];
  document.getElementById('shop-filters').innerHTML=types.map(function(tp){
    return'<button class="flt-btn'+(BOUT_FILTER===tp.id?' active':'')+'" onclick="BOUT_FILTER=\''+tp.id+'\';renderBout()">'+tp.lbl+'</button>';
  }).join('');
  var grouped={};
  items.forEach(function(b){if(!grouped[b.sl])grouped[b.sl]=[];grouped[b.sl].push(b);});
  var slabs={arme:'⚔️ Armes',skin:'👕 Skins',implant:'💿 Implants',chaussures:'👟 Chaussures'};
  var html='';
  Object.keys(slabs).forEach(function(sl){
    if(BOUT_FILTER!=='all'&&BOUT_FILTER!==sl)return;
    var grp=grouped[sl];if(!grp||!grp.length)return;
    html+='<div class="shop-cat-title">'+slabs[sl]+'</div><div class="shop-grid">';
    grp.slice(0,6).forEach(function(b){
      var r=RAR[b.rar],bought=META.bought.indexOf(b.id)!==-1;
      var okG=b.cost<=0||META.gems>=b.cost,okC=b.costCr<=0||META.cr>=b.costCr,okL=META.hero.lv>=b.lrq;
      var canB=!bought&&okG&&okC&&okL;
      var parts=[];if(b.cost>0)parts.push(b.cost+'💎');if(b.costCr>0)parts.push(fmt(b.costCr)+'₵');
      html+='<div class="shop-card"><div class="shop-card-top">'
        +'<span class="shop-card-ico">'+(b.icon||'📦')+'</span>'
        +'<div><div class="shop-card-name '+r.cls+'">'+b.nm+'</div><div class="shop-card-rar '+r.cls+'">'+r.lbl+' · Nv.'+b.lrq+'</div></div></div>'
        +'<div class="shop-card-stats">'+stStr(b.st)+'</div>'
        +'<div class="shop-card-footer">'
        +(bought?'<span class="shop-bought">✔ Acheté</span>':'<span class="shop-card-cost">'+(parts.join(' + ')||'Gratuit')+'</span>')
        +(!bought?'<button class="btn btn-sm'+(canB?' btn-green':'')+' btn-bout" data-id="'+b.id+'"'+(canB?'':' disabled')+'>'+(canB?'Acheter':'N/A')+'</button>':'')
        +'</div></div>';
    });
    html+='</div>';
  });
  document.getElementById('shop-body').innerHTML=html||'<p style="color:var(--text4);padding:16px">Aucun article.</p>';
}

// ── INVENTAIRE ────────────────────────────────────────────────────
function renderInv(){
  var hero=getH(META.heroId||'berserker'),h=META.hero;

  // ── Layout Diablo 3 ─────────────────────────────────────────────
  // Disposition : arme (gauche) | portrait héros | skin (droite)
  //               implant1 + implant2 + chaussures (bas centré)
  function makeSlot(sl,lbl,ico){
    var uid=META.eq[sl],it=uid?byUid(uid):null;
    var rar=it?RAR[it.rar].cls:'';
    var tooltip=it?it.nm+'\n'+stStr(it.st):'';
  var imgHtml='';
    if(it){
      var imgSrc='assets/items/'+(it.sl||'arme')+'/'+it.rar+'.png';
      imgHtml='<img src="'+imgSrc+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;z-index:1" onerror="this.style.display=\'none\'" alt=""/>'
        +'<span class="d3-slot-ico '+rar+'" style="position:relative;z-index:0;display:none">'+(it.icon||ico)+'</span>';
    } else {
      imgHtml='<span class="d3-slot-ico">'+ico+'</span>';
    }
    return '<div class="d3-slot'+(it?' filled':'')+'\" '
      +'title="'+tooltip+'" '
      +(it?'onclick="openItemDetail(\''+it.uid+'\')" ':'')
      +'ondragover="allowDrop(event)" ondrop="dropIntoSlot(event,\''+sl+'\')">'
      +imgHtml
      +'<span class="d3-slot-lbl">'+lbl+'</span>'
      +(it?'<span class="d3-slot-nm '+rar+'">'+it.nm+'</span>':'')
      +'</div>';
  }
  var heroData=getH(META.heroId||'berserker');
  var heroName=h.name||heroData.name;
  var fallbackIco={berserker:'⚔️',warden:'🛡️'}[META.heroId]||'🦸';
  var d3html=
    // Colonne gauche : arme
    '<div class="d3-col-l">'+makeSlot('arme','Arme','⚔️')+makeSlot('implant1','Impl. 1','💿')+'</div>'

    // Centre : portrait héros
    +'<div class="d3-center">'
    +'<div class="d3-hero-portrait" '
    +'ondragover="allowDrop(event)">'
    +'<img src="'+heroData.portrait+'" onerror="this.style.display=\'none\'" alt=""/>'
    +'<span class="fallback-ico" style="display:none">'+fallbackIco+'</span>'
    +'</div>'
    +'<div class="d3-hero-name">'+heroName+'</div>'
    +'</div>'
    // Colonne droite : skin
    +'<div class="d3-col-r">'+makeSlot('skin','Skin','👕')+makeSlot('implant2','Impl. 2','💿')+makeSlot('chaussures','Chaus.','👟')+'</div>';
  document.getElementById('d3-equip').innerHTML=d3html;

  // Sorts actifs
  var spRow=document.getElementById('sp-slots-row');if(spRow)spRow.innerHTML='';


  // Filtres + toggle sélection
  var fltH=[{id:'all',lbl:'Tout'},{id:'equip-arme',lbl:'⚔️'},{id:'equip-skin',lbl:'👕'},{id:'equip-implant',lbl:'💿'},{id:'equip-chaussures',lbl:'👟'},{id:'piece',lbl:'🔩'}].map(function(f){
    return'<button class="flt-btn'+(INV_FILTER===f.id?' active':'')+'" onclick="INV_FILTER=\''+f.id+'\';renderInv()">'+f.lbl+'</button>';
  }).join('');
  fltH+='<button class="flt-btn'+(INV_SEL_MODE?' active':'')+'" onclick="toggleSelMode()" style="margin-left:auto">☑</button>';
  document.getElementById('inv-filters').innerHTML=fltH;

  // Sélection rapide par rareté
  var sarH='';
  if(INV_SEL_MODE){
    sarH='<span style="font-size:.68rem;color:var(--text4);padding:0 4px">Sél.:</span>';
    RAR_K.forEach(function(rk){
      var cnt=META.inv.filter(function(x){return x.rar===rk&&!x.perm&&!isEquipped(x.uid);}).length;
      if(!cnt)return;
      sarH+='<span class="rar-dot '+RAR[rk].cls+'" onclick="selectRarInv(\''+rk+'\')" title="Tout '+RAR[rk].lbl+' ('+cnt+')">'+cnt+'</span>';
    });
    sarH+='<span class="rar-dot" onclick="clearInvSel()" style="color:var(--text4)" title="Désélectionner tout">✕</span>';
  }
  document.getElementById('sell-all-row').innerHTML=sarH;

  // Grille items
  var stacked=stackItems();
  var filtered=stacked.filter(function(s){
    if(s.item.type==='relique')return false;  // reliques = page Craft uniquement
    if(s.item.type==='relique')return false;
    if(INV_FILTER==='all')return true;
    if(INV_FILTER.startsWith('equip-'))return s.item.type==='equip'&&s.item.sl===INV_FILTER.slice(6);
    return s.item.type===INV_FILTER;
  });
  var sel=INV_SEL_MODE;
  document.getElementById('inv-grid').innerHTML=filtered.map(function(s){
    var it=s.item,r=RAR[it.rar],eq=isEquipped(it.uid),isSel=sel&&!!INV_SEL[it.uid];
    var ico=it.icon||{arme:'⚔️',skin:'👕',implant:'💿',chaussures:'👟',relique:'⚗️',piece:'🔩'}[it.sl||it.type]||'📦';
    return '<div class="inv-cell rar-'+it.rar+(isSel?' selected':'')+'\" data-uid="'+it.uid+'" '
      +'draggable="'+(sel?'false':'true')+'" ondragstart="dragStart(event,\''+it.uid+'\')" ondragover="allowDrop(event)" ondrop="dropCell(event,\''+it.uid+'\')"'
      +' onclick="'+(sel?'toggleInvSel(\''+it.uid+'\')':'openItemDetail(\''+it.uid+'\')')+'\">'
      +(eq?'<div class="inv-eq-badge">EQ</div>':'')
      +(sel?'<div class="sel-check">'+(isSel?'✓':'')+'</div>':'')
+(it.sl&&it.rar?'<img src="assets/items/'+it.sl+'/'+it.rar+'.png" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1" onerror="this.style.display=\'none\';this.nextSibling.style.visibility=\'visible\'" alt=""/>':'')
      +'<span class="inv-cell-ico" style="position:relative;z-index:0;'+(it.sl&&it.rar?'visibility:hidden':'')+'">'+ico+'</span>'
      +(s.count>1?'<span class="inv-count">×'+s.count+'</span>':'')
      +'</div>';
  }).join('')||'<p style="color:var(--text4);padding:14px;font-size:.78rem">Inventaire vide.</p>';

  renderInvSelBar();
  if(!sel)hideItemDetail();
}


function stackItems(){
  var stacks={},i,it,key;
  for(i=0;i<META.inv.length;i++){
    it=META.inv[i];
    if(it.relicCount||isEquipped(it.uid))key=it.uid;
    else key=it.type+'_'+it.rar+'_'+(it.sl||'')+'_'+it.nm;
    if(!stacks[key])stacks[key]={item:it,uids:[],count:0};
    stacks[key].uids.push(it.uid);stacks[key].count++;
  }
  return Object.values(stacks).sort(function(a,b){
    var ta={equip:0,relique:1,piece:2}[a.item.type]||3,tb={equip:0,relique:1,piece:2}[b.item.type]||3;
    if(ta!==tb)return ta-tb;return RAR_K.indexOf(b.item.rar)-RAR_K.indexOf(a.item.rar);
  });
}

// Drag & Drop
function dragStart(e,uid){DRAG_UID=uid;e.dataTransfer.effectAllowed='move';}
function allowDrop(e){e.preventDefault();}
function dropCell(e,targetUid){e.preventDefault();if(!DRAG_UID||DRAG_UID===targetUid)return;DRAG_UID=null;renderInv();}
function dropIntoSlot(e,sl){
  e.preventDefault();if(!DRAG_UID)return;
  var uid=DRAG_UID; DRAG_UID=null;
  var it=byUid(uid);
  if(!it||it.type!=='equip')return;
  if((it.sl==='implant'&&(sl==='implant1'||sl==='implant2'))||(it.sl===sl)){equipIt(uid,sl);}
}

// Item detail
function openItemDetail(uid){
  DETAIL_UID=uid;var it=byUid(uid);if(!it)return;
  var el=document.getElementById('item-detail');if(!el)return;
  el.classList.remove('hidden');
  var eq=isEquipped(uid),r=RAR[it.rar];
  var price=SELL[it.rar]||30;if(it.relicCount)price=Math.floor(price*(1+it.relicCount*0.2));
  var ico=it.icon||{arme:'⚔️',skin:'👕',implant:'💿',chaussures:'👟',relique:'⚗️',piece:'🔩'}[it.sl||it.type]||'📦';
  document.getElementById('item-detail-content').innerHTML=
    '<div class="item-detail-top"><span class="item-detail-ico">'+ico+'</span><div>'
    +'<div class="item-detail-nm '+r.cls+'">'+it.nm+(it.relicCount?'<span style="color:var(--gold)"> ⚗×'+it.relicCount+'</span>':'')+'</div>'
    +'<div class="item-detail-rar '+r.cls+'">'+r.lbl+' · '+cap(it.type)+(it.sl?' '+it.sl:'')+'</div>'
    +'</div></div>'
    +'<div class="item-detail-stats">'+stStr(it.st||{})+'</div>'
    +'<div class="item-detail-btns">'
    +(it.type==='equip'&&!eq?'<button class="btn btn-sm btn-green btn-eq" data-uid="'+uid+'">Équiper</button>':'')
    +(it.type==='equip'&&eq?'<button class="btn btn-sm btn-orange" onclick="unequipDetail()">Retirer</button>':'')
    +(!it.perm?'<button class="btn btn-sm btn-red btn-sell" data-uid="'+uid+'">Vendre '+fmt(price)+'₵</button>':'<span style="font-size:.7rem;color:var(--text4)">[Permanent]</span>')
    +'<button class="btn btn-sm" onclick="hideItemDetail()">✕</button>'
    +'</div>';
}
function hideItemDetail(){var el=document.getElementById('item-detail');if(el)el.classList.add('hidden');DETAIL_UID=null;}
function unequipDetail(){if(!DETAIL_UID)return;var it=byUid(DETAIL_UID);if(!it)return;['arme','skin','implant1','implant2','chaussures'].forEach(function(sl){if(META.eq[sl]===DETAIL_UID)META.eq[sl]=null;});recompute();renderInv();saveMeta();hideItemDetail();}

// ── CRAFT ────────────────────────────────────────────────────────
function renderCraft(){
  document.querySelectorAll('.craft-tab').forEach(function(t){t.classList.toggle('active',t.getAttribute('data-tab')===CRAFT_TAB);});
  document.getElementById('craft-enhance').classList.toggle('hidden',CRAFT_TAB!=='enhance');
  document.getElementById('craft-recipes').classList.toggle('hidden',CRAFT_TAB!=='forge');
  if(CRAFT_TAB==='enhance')renderEnhance();
  else renderRecipes();
}
function renderOptions(){
  var inp=document.getElementById('opt-pseudo');
  if(inp)inp.value=META.hero.name||'';
}
function selectOpt(btn,group){
  var parent=btn.parentNode;
  parent.querySelectorAll('.option-sel').forEach(function(b){b.classList.remove('active-opt');});
  btn.classList.add('active-opt');
}
function renderEnhance(){
  var eItem=byUid(CRAFT.enhItem);
  var ceItem=document.getElementById('ce-item-slot');if(!ceItem)return;
  if(eItem){
    ceItem.innerHTML='<div class="enhance-slot has"><div style="font-size:2rem">'+(eItem.icon||'📦')+'</div><div class="enhance-slot-content"><div class="'+RAR[eItem.rar].cls+'"><strong>'+eItem.nm+'</strong></div><div style="font-size:.72rem;color:var(--text2)">'+stStr(eItem.st)+'</div><div style="font-size:.7rem;color:var(--gold)">Reliques: '+((eItem.relicCount||0)+'/'+CFG.MAX_RELICS_PER_ITEM)+'</div></div><button class="btn btn-sm btn-red" onclick="CRAFT.enhItem=null;CRAFT.enhRels=[];renderCraft()" style="flex-shrink:0">✕</button></div>';
  }else{
    ceItem.innerHTML='<div class="enhance-slot" onclick="openPopup(\'item\')" style="cursor:pointer"><div class="enhance-slot-add">+</div><div class="enhance-slot-lbl">Équipement à améliorer</div></div>';
  }
var allRels=META.inv.filter(function(x){return x.type==='relique';});
  // Si item sélectionné → masque incompatibles
  var compatRels=eItem?allRels.filter(function(r){return isRelicCompatible(r,eItem)||CRAFT.enhRels.indexOf(r.uid)!==-1;}):allRels;
  // Filtre rareté
  var visibleRels=RELIC_FILTER==='all'?compatRels:compatRels.filter(function(r){return r.rar===RELIC_FILTER;});
  var ceRel=document.getElementById('ce-rel-slot');if(!ceRel)return;
  // Boutons filtres rareté
  var rarPresent={};
  compatRels.forEach(function(r){rarPresent[r.rar]=true;});
  var filters='<div class="relic-filters"><button class="relic-flt'+(RELIC_FILTER==='all'?' active':'')+'" onclick="RELIC_FILTER=\'all\';renderEnhance()">Tout</button>';
  RAR_K.forEach(function(rk){
    if(!rarPresent[rk])return;
    filters+='<button class="relic-flt '+(RELIC_FILTER===rk?' active ':'')+''+RAR[rk].cls+'" onclick="RELIC_FILTER=\''+rk+'\';renderEnhance()">'+RAR[rk].lbl+'</button>';
  });
  filters+='</div>';
  var relH=filters;
  relH+='<div style="font-size:.62rem;color:var(--text3);margin-bottom:5px">'+CRAFT.enhRels.length+'/2 sélectionnées'+(eItem?' · incompatibles masquées':'')+'</div>';
  if(!visibleRels.length){
    relH+='<p style="color:var(--text4);font-size:.74rem;padding:4px 0">'+(allRels.length?'Aucune relique ici.':'Aucune relique en inventaire.')+'</p>';
  } else {
    relH+='<div class="relic-grid">';
    visibleRels.forEach(function(rel){
      var selected=CRAFT.enhRels.indexOf(rel.uid)!==-1;
      var maxed=CRAFT.enhRels.length>=2&&!selected;
      var relEntry=REL_TYPES.filter(function(x){return x.id===rel.subtype;})[0];
      var clickFn=maxed?'':selected?'removeCraftRelic(\''+rel.uid+'\')':'toggleCraftRelic(\''+rel.uid+'\')';
  relH+='<div class="relic-cell rar-'+rel.rar+(selected?' relic-sel':'')+(maxed?' relic-dim':'')+'"'
        +(clickFn?' onclick="'+clickFn+'"':'')
        +' onmousedown="relLpStart(\''+rel.uid+'\')" onmouseup="relLpEnd()" onmouseleave="relLpEnd()"'
        +' ontouchstart="relLpStart(\''+rel.uid+'\')" ontouchend="relLpEnd()">'
        +(selected?'<span class="relic-cell-check">✓</span>':'')
        +'<span class="relic-cell-ico">'+(relEntry?relEntry.icon:'⚗️')+'</span>'
        +'<span class="relic-cell-nm '+(relEntry?RAR[rel.rar].cls:'')+'">'+(relEntry?relEntry.nm:'Relique')+'</span>'
        +'<span class="relic-cell-pct" style="color:'+(relEntry?relEntry.col:'#888')+'">+'+Math.round((REL_BONUS[rel.rar]||0)*100)+'%</span>'
        +'</div>';
    });
    relH+='</div>';
  }
  ceRel.innerHTML=relH;
  var prev='',sm={atk:'atk',aspd:'aspd',vit:'hp',res:'sh',rgn:'rgn'};
  if(eItem&&CRAFT.enhRels.length){
    CRAFT.enhRels.forEach(function(ru){var rel=byUid(ru);if(!rel)return;var stat=rel.subtype==='univ'?mainStat(eItem.st):sm[rel.subtype];if(stat&&eItem.st[stat]!==undefined)prev+='+'+Math.floor(eItem.st[stat]*(REL_BONUS[rel.rar]||0))+' '+stat+' ';else prev+='[incompat.] ';});
  }
  var prevEl=document.getElementById('enhance-preview');if(prevEl)prevEl.textContent=prev?'Résultat: '+prev:'';
  var btnE=document.getElementById('btn-enhance');if(btnE)btnE.disabled=!(eItem&&CRAFT.enhRels.length&&prev&&prev.indexOf('incompat.')===-1);
}

function removeCraftRelic(uid){var idx=CRAFT.enhRels.indexOf(uid);if(idx!==-1)CRAFT.enhRels.splice(idx,1);renderCraft();}
var _relLpTimer=null;
function relLpStart(uid){
  _relLpTimer=setTimeout(function(){
    _relLpTimer=null;
    var rel=byUid(uid);if(!rel)return;
    var relEntry=REL_TYPES.filter(function(x){return x.id===rel.subtype;})[0];
    var col=relEntry?relEntry.col:'#888';
    var popup=document.getElementById('craft-popup');if(!popup)return;
    popup.querySelector('#popup-list').innerHTML=
      '<div style="text-align:center;padding:8px">'
      +'<div style="font-size:2.2rem">'+(relEntry?relEntry.icon:'⚗️')+'</div>'
      +'<div style="color:'+col+';font-weight:700;margin:6px 0">'+rel.nm+'</div>'
      +'<div class="'+RAR[rel.rar].cls+'" style="font-size:.8rem">'+RAR[rel.rar].lbl+'</div>'
      +'<div style="color:var(--green);margin-top:6px;font-size:.8rem">+'+Math.round((REL_BONUS[rel.rar]||0)*100)+'% du stat</div>'
      +'<div style="color:var(--text3);margin-top:4px;font-size:.72rem">'+(relEntry?relEntry.nm:'—')+'</div>'
      +'</div>';
    popup.querySelector('.popup-title').textContent='Détail relique';
    popup.classList.remove('hidden');
  },500);
}
function relLpEnd(){if(_relLpTimer){clearTimeout(_relLpTimer);_relLpTimer=null;}}
function renderRecipes(){
  var lv=META.hero.lv||1;
  document.getElementById('recipes-list').innerHTML=RECIPES.map(function(rec){
    var can=canCraft(rec);
    var rarColor={'p':'var(--rar-p)','r':'var(--rar-r)','e':'var(--rar-e)','l':'var(--rar-l)'}[rec.result]||'var(--text)';
    // Niveau requis estimé = niveau minimum des pièces nécessaires
    var rarToLv={c:1,p:5,r:15,e:30,l:50};
    var minLv=rec.req.reduce(function(acc,rq){return Math.max(acc,rarToLv[rq.rar]||1);},1);
    var lvOk=lv>=minLv;
    // Noms des composants
    var ingList=rec.req.map(function(rq){
      var have=countInv(rq.type,rq.rar);
      var ingName=rq.type==='piece'?(PIECE_NAMES[rq.rar]||['Pièce'])[0]:'Équipement';
      return '<div class="recipe-ing'+(have>=rq.count?' ok':' nok')+'">'
        +'<span class="recipe-ing-ico">'+(rq.type==='piece'?'🔩':'📦')+'</span>'
        +'<div style="display:flex;flex-direction:column;gap:1px">'
        +'<span style="font-size:.68rem;font-weight:700;color:var(--text)">'+rq.count+'× '+ingName+'</span>'
        +'<span class="'+RAR[rq.rar].cls+'" style="font-size:.62rem">'+RAR[rq.rar].lbl+'</span>'
        +'<span style="font-size:.62rem;color:'+(have>=rq.count?'var(--green)':'var(--red)')+'">En stock : '+have+'</span>'
        +'</div></div>';
    }).join('');
    return '<div class="recipe-card"><div class="recipe-result-box"><span class="recipe-result-ico">'+rec.icon+'</span>'
      +'<span class="recipe-result-rar" style="color:'+rarColor+'">'+RAR[rec.result].lbl+'</span>'
      +'<span style="font-size:.58rem;color:'+(lvOk?'var(--text4)':'var(--red)')+'">Nv.'+minLv+'</span>'
      +'</div>'
      +'<div class="recipe-body"><div class="recipe-name">'+rec.nm+'</div>'
      +'<div class="recipe-desc">'+rec.desc+'</div>'
      +'<div class="recipe-ings">'+ingList+'</div>'
      +'<button class="btn btn-sm'+(can&&lvOk?' btn-green':'')+'\" onclick="doCraft(\''+rec.id+'\')"'+((can&&lvOk)?'':' disabled')+'>⚙ Forger</button>'
      +'</div></div>';
  }).join('');
}

// Popup sélection item/relique
function openPopup(type){
  POPUP.type=type;
  var el=document.getElementById('craft-popup');if(!el)return;
  el.classList.remove('hidden');
  var items=[];
  if(type==='item')items=META.inv.filter(function(x){return x.type==='equip'&&(x.relicCount||0)<CFG.MAX_RELICS_PER_ITEM;});
  if(!items.length){el.querySelector('#popup-list').innerHTML='<p style="color:var(--text4);padding:10px">Aucun item disponible.</p>';el.classList.remove('hidden');return;}
  el.querySelector('#popup-list').innerHTML=items.map(function(it){
    return '<div class="popup-item" onclick="selectPopupItem(\''+it.uid+'\')">'
      +'<span class="popup-item-ico">'+(it.icon||'📦')+'</span>'
      +'<div><div class="'+RAR[it.rar].cls+'" style="font-weight:700;font-size:.82rem">'+it.nm+'</div>'
      +'<div style="font-size:.72rem;color:var(--text2)">'+stStr(it.st)+(it.relicCount?' ⚗×'+it.relicCount+'/'+CFG.MAX_RELICS_PER_ITEM:'')+'</div></div>'
      +'</div>';
  }).join('');
}
function closePopup(){var el=document.getElementById('craft-popup');if(el)el.classList.add('hidden');}
function selectPopupItem(uid){CRAFT.enhItem=uid;CRAFT.enhRels=[];closePopup();renderCraft();}

// ── OVERLAYS ─────────────────────────────────────────────────────
function showSel(){
  document.getElementById('ov-sel').classList.remove('hidden');
  document.getElementById('hcards').innerHTML=HEROES.map(function(he){
    return '<div class="hcard" onclick="chooseHero(\''+he.id+'\')">'
      +'<img class="hcard-img" src="'+he.portrait+'" onerror="this.outerHTML=\'<span style=&quot;font-size:4rem;margin:.5rem auto&quot;>'+({berserker:'⚔️',warden:'🛡️'}[he.id]||'🦸')+'</span>\'" alt=""/>'
      +'<div class="hcard-name">'+he.name+'</div>'
      +'<div class="hcard-arch">'+he.arch+'</div>'
      +'<div class="hcard-desc">'+he.desc+'</div>'
      +'<div class="hcard-stats">ATQ:'+he.baseAtk+' · VitAtq:'+he.baseAspd+'/s<br>PV:'+he.baseHp+' · Boucl:'+he.baseSh+'</div>'
      +'<div class="hcard-cta">CHOISIR</div>'
      +'</div>';
  }).join('');
}
function chooseHero(hid){META.heroId=hid;initActiveSp();saveMeta();document.getElementById('ov-sel').classList.add('hidden');navigate('hero');}

function showGO(){
  // Remet le hub en place d'abord si besoin
  var homeRoot=document.getElementById('home-root');
  var hubMode =document.getElementById('hub-mode');
  if(homeRoot)homeRoot.style.display='none';
  if(hubMode) hubMode.classList.remove('hidden');
  document.getElementById('ov-go').classList.remove('hidden');
  setNotif('run-notif-dot', true);
  var rs=G.rs,el=Math.floor((Date.now()-rs.t0)/1000);
  setText('go-inf','Vague:'+G.wave+' — '+((curRunType&&curRunType.name)||''));
  document.getElementById('go-tbl').innerHTML=
    '<tr><td>Kills</td><td>'+fmt(rs.kills)+'</td></tr><tr><td>Vagues</td><td>'+rs.waves+'</td></tr>'
    +'<tr><td>Crédits</td><td>'+fmt(rs.crEarned)+'</td></tr><tr><td>Gemmes</td><td>'+rs.gmEarned+'</td></tr>'
    +'<tr><td>Niveau</td><td>'+META.hero.lv+'</td></tr><tr><td>Durée</td><td>'+fmtT(Math.floor((Date.now()-rs.t0)/1000))+'</td></tr>';
}

function showDuelResult(won){
  document.getElementById('duel-fight').style.display='none';
  document.getElementById('duel-result').style.display='flex';
  var tEl=document.getElementById('dr-title'),rEl=document.getElementById('dr-rewards');
  if(won){
    tEl.innerHTML='<div style="font-size:2.5rem">🏆</div><div style="font-family:var(--font-h);font-size:1.1rem;color:var(--gold);letter-spacing:.08em">VICTOIRE !</div>';
    var opp=DL.opp,gems=opp.rewardGems;META.gems+=gems;
    var pool=RAR_K,mi=pool.indexOf(opp.rewardRarMin),mxi=pool.indexOf(opp.rewardRarMax);
    var rk=pool[Math.min(mxi,mi+Math.floor(Math.random()*(mxi-mi+1)))];
    var sls=['arme','skin','implant','chaussures'];
    var sl=sls[Math.floor(Math.random()*sls.length)];
    var w=Math.max(5,META.hero.lv),rm=RAR[rk].m;
    var nms=LOOT_NAMES[sl]||LOOT_NAMES.arme;
    var nm=nms[Math.floor(Math.random()*nms.length)],st={};
    if(sl==='arme'){st.atk=Math.floor((w*3+6)*rm);if(rm>=2.8)st.aspd=parseFloat((rm*0.04).toFixed(2));}
    else if(sl==='skin'){st.hp=Math.floor((w*30+80)*rm);st.sh=Math.floor((w*5+20)*rm);}
    else if(sl==='chaussures'){st.aspd=parseFloat((0.06*rm).toFixed(2));st.dodge=parseFloat((0.03*rm).toFixed(2));}
    else{st.dpct=parseFloat(Math.min(0.80,0.05*rm).toFixed(2));st.rgn=parseFloat((1.8*rm).toFixed(1));}
    var it={uid:'D'+(UID++),type:'equip',sl:sl,nm:nm,rar:rk,lrq:Math.max(1,META.hero.lv-3),st:st,perm:false,relicCount:0};
    META.inv.push(it);saveMeta();updateTop();
    rEl.innerHTML='<div style="font-size:.9rem;color:var(--gold);margin-bottom:6px">+'+gems+' 💎</div>'
      +'<div><span class="'+RAR[rk].cls+'"><strong>'+nm+'</strong></span> ['+RAR[rk].lbl+']<br><small style="color:var(--text3)">'+cap(sl)+' · '+stStr(it.st)+'</small></div>';
  }else{
    tEl.innerHTML='<div style="font-size:2.5rem">💀</div><div style="font-family:var(--font-h);font-size:1.1rem;color:var(--red);letter-spacing:.08em">DÉFAITE</div>';
    rEl.innerHTML='<div style="color:var(--text4)">Aucune récompense.</div>';
  }
}
function onToggleSp(sid){
  toggleActiveSp(sid);
  if(PG==='inv')renderInv();
  if(PG==='hero')renderHero();
  if(G&&!G.over&&PG==='home')buildHomeStructure();
}
function renderMissions(){
  generateMissions();
  var el=document.getElementById('missions-list');if(!el)return;
  el.innerHTML=(META.missions||[]).map(function(m,i){
    var pct=Math.round(Math.min(100,m.progress/m.target*100));
    return '<div class="mission-card">'
      +'<div class="mission-lbl">'+m.lbl+'</div>'
      +'<div class="bar-wrap" style="height:6px;margin:5px 0"><div class="bar-fill bar-xp" style="width:'+pct+'%"></div></div>'
      +'<div style="display:flex;justify-content:space-between;align-items:center">'
      +'<span style="font-size:.7rem;color:var(--text3)">'+m.progress+' / '+m.target+'</span>'
      +'<span style="font-size:.7rem;color:var(--gold)">'+(m.rewardCr?'+'+fmt(m.rewardCr)+'₵ ':'')+( m.rewardGems?'+'+m.rewardGems+'💎':'')+'</span>'
      +'</div>'
      +(m.done&&!m.claimed?'<button class="btn btn-green btn-sm" onclick="claimMission('+i+')" style="margin-top:6px">Récupérer ▶</button>':'')
      +(m.claimed?'<span style="font-size:.7rem;color:var(--text4)">✔ Réclamée</span>':'')
      +'</div>';
  }).join('');
}
function setNotif(id, on){
  var el=document.getElementById(id);
  if(el) el.classList.toggle('hidden', !on);
}
var _relicLPTimer=null;
function relicLongPressStart(uid){
  _relicLPTimer=setTimeout(function(){
    _relicLPTimer=null;
    var rel=byUid(uid);if(!rel)return;
    var relEntry=REL_TYPES.filter(function(x){return x.id===rel.subtype;})[0];
    var col=relEntry?relEntry.col:'#888';
    var popup=document.getElementById('craft-popup');
    var plist=popup&&popup.querySelector('#popup-list');
    if(!plist)return;
    plist.innerHTML='<div style="text-align:center;padding:10px">'
      +'<div style="font-size:2rem">'+(relEntry?relEntry.icon:'⚗️')+'</div>'
      +'<div style="color:'+col+';font-weight:700;font-size:.9rem;margin:6px 0">'+rel.nm+'</div>'
      +'<div class="'+RAR[rel.rar].cls+'" style="font-size:.8rem">'+RAR[rel.rar].lbl+'</div>'
      +'<div style="font-size:.8rem;color:var(--green);margin-top:6px">+'+Math.round((REL_BONUS[rel.rar]||0)*100)+'% du stat</div>'
      +'<div style="font-size:.72rem;color:var(--text3);margin-top:4px">Effet : '+(relEntry?relEntry.nm:'—')+'</div>'
      +'</div>';
    popup.querySelector('.popup-title').textContent='Détail relique';
    popup.classList.remove('hidden');
  }, 500);
}
function relicLongPressEnd(){
  if(_relicLPTimer){clearTimeout(_relicLPTimer);_relicLPTimer=null;}
}