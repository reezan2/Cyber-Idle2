// ================================================================
// engine.js v11 — Logique de jeu pure (zéro DOM)
// ================================================================

var META = fixMeta(loadMeta()) || mkMeta();
var G    = null;   // run actif
var P    = {atk:0,aspd:0,dps:0,mHp:0,mSh:0,rgn:0,mult:1,crit:0,dodge:0,pros:100,dmgRed:0,spPwrBonus:0};
var DL   = null;   // duel actif
var CRAFT= {enhItem:null, enhRels:[], mode:null, tab:'enhance'};
var TK   = null;
var SPEED= 1;
var PRE  = {atk:0,hp:0,sh:0,aspd:0}; // stats globales hors améliorations (pour affichage renderUpg)
var UID  = Date.now();
var curRunType = null;

// ── META ─────────────────────────────────────────────────────────
function mkMeta(){
  return{gems:0,heroId:null,bought:[],cr:0,activeSp:[],boutSeed:Date.now(),
    hero:{lv:1,xp:0,skPts:0,spPts:0,passBonus:0,name:null,
      st:{force:0,dex:0,end:0,int:0,agi:0,res:0,cha:0,per:0},
      spLvPwr:{},spLvCd:{}},
    duelWins:{},
    upgLv:{},inv:[],missions:[],
    eq:{arme:null,skin:null,implant1:null,implant2:null,chaussures:null}};
}

function fixMeta(m){
  if(!m)return null;
  if(!m.hero)m.hero=mkMeta().hero;
  if(!m.hero.st)m.hero.st={force:0,dex:0,end:0,int:0,agi:0,res:0,cha:0,per:0};
  if(!m.hero.spLvPwr)m.hero.spLvPwr={};
  if(!m.hero.spLvCd)m.hero.spLvCd={};
  if(m.hero.passBonus===undefined)m.hero.passBonus=0;
  if(m.hero.name===undefined)m.hero.name=null;
  if(!m.upgLv)m.upgLv={};
  if(!m.inv)m.inv=[];
  if(!m.duelWins)m.duelWins={};
  if(m.boutSeed===undefined)m.boutSeed=Date.now();
  // Migration eq: armure → skin
  if(!m.eq)m.eq={arme:null,skin:null,implant1:null,implant2:null,chaussures:null};
  if(m.eq.armure!==undefined){m.eq.skin=m.eq.armure;delete m.eq.armure;}
  if(m.eq.implant!==undefined){m.eq.implant1=m.eq.implant;delete m.eq.implant;}
  if(m.eq.implant2===undefined)m.eq.implant2=null;
  if(m.eq.chaussures===undefined)m.eq.chaussures=null;
  if(!m.bought)m.bought=[];
  if(m.cr===undefined)m.cr=0;
  if(m.gems===undefined)m.gems=0;
  if(!m.activeSp)m.activeSp=[];
  // Migration items: armure → skin dans l'inventaire
  if(m.inv)m.inv.forEach(function(it){if(it.sl==='armure')it.sl='skin';});
  return m;
}
function saveMeta(){try{localStorage.setItem('ci_v11',JSON.stringify(META));}catch(e){}}
function loadMeta(){try{var r=localStorage.getItem('ci_v11')||localStorage.getItem('ci_v10');return r?JSON.parse(r):null;}catch(e){return null;}}

// ── SORTS ACTIFS ─────────────────────────────────────────────────
function initActiveSp(){
  var hero=getH(META.heroId),count=0;META.activeSp=[];
  for(var i=0;i<hero.spells.length&&count<CFG.MAX_ACTIVE_SP;i++)
    if(!hero.spells[i].passive){META.activeSp.push(hero.spells[i].id);count++;}
}
function isActive(sid){return META.activeSp.indexOf(sid)!==-1;}
function toggleActiveSp(sid){
  var sp=findSpell(sid);if(!sp||sp.passive)return;
  var idx=META.activeSp.indexOf(sid);
  if(idx!==-1)META.activeSp.splice(idx,1);
  else{if(META.activeSp.length>=CFG.MAX_ACTIVE_SP)return;META.activeSp.push(sid);}
  saveMeta();
}

// ── SLOTS D'ÉQUIPEMENT ───────────────────────────────────────────
var EQ_SLOTS = ['arme','skin','implant1','implant2','chaussures'];
function isEquipped(uid){return EQ_SLOTS.some(function(sl){return META.eq[sl]===uid;});}
function getSlotForItem(it){
  // Si implant, cherche implant1 ou implant2 libre
  if(it.sl==='implant'){
    if(!META.eq.implant1)return'implant1';
    if(!META.eq.implant2)return'implant2';
    return'implant1'; // remplace implant1 par défaut
  }
  return it.sl;
}
function equippedInSlot(sl){return META.eq[sl]?byUid(META.eq[sl]):null;}

// ── STATS CALCULÉES ──────────────────────────────────────────────
// Améliorations : +N% du stat de BASE du héros par niveau
// ex: up_force nv.50 + berserker baseAtk=12 → +6 ATQ (50% de 12)
function recompute(){
  var bd=computeBreakdown();
  P.atk=bd.atk.total;P.aspd=bd.aspd.total;P.dps=bd.dps;
  P.mHp=bd.hp.total;P.mSh=bd.sh.total;P.rgn=bd.rgn.total;
  P.mult=bd.mult.total;P.crit=bd.crit.total;P.dodge=bd.dodge.total;
  P.pros=bd.pros.total;P.dmgRed=bd.dmgRed;P.spPwrBonus=bd.spPwrBonus;
  PRE={atk:bd.preAtk,hp:bd.preHp,sh:bd.preSh,aspd:bd.preAspd};
  if(G){G.pHp=Math.min(G.pHp,P.mHp);G.pSh=Math.min(G.pSh,P.mSh);}
  return bd;
}

function computeBreakdown(){
  var h=META.hero,hero=getH(META.heroId||'berserker');
  var r={
    atk:{base:hero.baseAtk,skills:0,passive:0,upg:0,equip:0,total:0},
    aspd:{base:hero.baseAspd,skills:0,upg:0,equip:0,total:0},
    hp:{base:hero.baseHp,skills:0,upg:0,equip:0,total:0},
    sh:{base:hero.baseSh,skills:0,upg:0,equip:0,total:0},
    rgn:{base:hero.baseRgn,skills:0,upg:0,equip:0,total:0},
    mult:{base:1,upg:0,total:1},
    crit:{base:0,skills:0,upg:0,equip:0,total:0},
    dodge:{base:0,skills:0,equip:0,total:0},
    pros:{base:CFG.PROS_BASE,skills:0,total:CFG.PROS_BASE},
    dpct:0,dpFlat:0,dmgRed:0,spPwrBonus:0,dps:0,
  };
  // Compétences
  r.atk.skills+=h.st.force*5;r.crit.skills+=h.st.dex*0.02;
  r.hp.skills+=h.st.end*60;r.aspd.skills+=h.st.agi*0.05;
  r.dodge.skills+=h.st.agi*0.01;r.sh.skills+=h.st.res*35;
  r.pros.skills+=h.st.cha*3;r.mult.base+=h.st.per*0.05;
  // Passifs
  if(META.heroId==='berserker')r.atk.passive=h.passBonus;
  if(META.heroId==='warden')r.dmgRed=0.05;
  // Totaux pré-amélioration (base + compétences + passifs + équipements)
  // Les améliorations donnent N% de ces totaux (N = niveau de l'amélioration)
  var upgLv=META.upgLv;
  r.preAtk  = r.atk.base +r.atk.skills +r.atk.passive+r.atk.equip;
  r.preHp   = r.hp.base  +r.hp.skills  +r.hp.equip;
  r.preSh   = r.sh.base  +r.sh.skills  +r.sh.equip;
  r.preAspd = Math.max(0.1, r.aspd.base+r.aspd.skills+r.aspd.equip);
  // Exemple : preAtk=850 ATQ, up_force nv.10 → +10% de 850 = +85 ATQ
  r.atk.upg  = Math.floor(r.preAtk  * (upgLv.up_force||0) * 0.01);
  r.crit.upg = (upgLv.up_dex||0) * 0.005;
  r.hp.upg   = Math.floor(r.preHp   * (upgLv.up_end  ||0) * 0.01);
  r.spPwrBonus= (upgLv.up_int||0) * 0.005;
  r.aspd.upg = parseFloat((r.preAspd * (upgLv.up_agi  ||0) * 0.01).toFixed(3));
  r.sh.upg   = Math.floor(r.preSh   * (upgLv.up_res  ||0) * 0.01);
  r.pros.skills += (upgLv.up_cha||0) * 0.5;
  r.mult.upg  = (upgLv.up_per||0) * 0.005;
  // Équipements (5 slots : arme, skin, implant1, implant2, chaussures)
  EQ_SLOTS.forEach(function(sl){
    var uid=META.eq[sl];if(!uid)return;
    var it=byUid(uid);if(!it)return;var s=it.st;
    if(s.atk)r.atk.equip+=s.atk;if(s.aspd)r.aspd.equip+=s.aspd;
    if(s.hp)r.hp.equip+=s.hp;if(s.sh)r.sh.equip+=s.sh;
    if(s.rgn)r.rgn.equip+=s.rgn;if(s.crit)r.crit.equip+=s.crit;
    if(s.dodge)r.dodge.equip+=s.dodge;if(s.dpct)r.dpct+=s.dpct;
  });
  // Totaux
  r.atk.total=Math.floor(r.atk.base+r.atk.skills+r.atk.passive+r.atk.upg+r.atk.equip);
  r.aspd.total=parseFloat(Math.max(0.1,r.aspd.base+r.aspd.skills+r.aspd.upg+r.aspd.equip).toFixed(2));
  r.hp.total=Math.floor(r.hp.base+r.hp.skills+r.hp.upg+r.hp.equip);
  r.sh.total=Math.floor(r.sh.base+r.sh.skills+r.sh.upg+r.sh.equip);
  r.rgn.total=parseFloat((r.rgn.base+r.rgn.skills+r.rgn.upg+r.rgn.equip).toFixed(1));
  r.mult.total=parseFloat((r.mult.base+r.mult.upg).toFixed(3));
  r.crit.total=Math.min(0.95,parseFloat((r.crit.base+r.crit.skills+r.crit.upg+r.crit.equip).toFixed(3)));
  r.dodge.total=Math.min(0.80,parseFloat((r.dodge.base+r.dodge.skills+r.dodge.equip).toFixed(3)));
  r.pros.total=Math.max(0,Math.floor(r.pros.base+r.pros.skills));
  var raw=r.atk.total*r.aspd.total+r.dpFlat;
  r.dps=Math.floor(raw*(1+r.dpct)*(1+r.crit.total));
  return r;
}

function spCd(sp){var cd=(META.hero.spLvCd[sp.id]||0)*0.10;return CFG.SP_CD*Math.max(0.3,1-cd);}
function spPwr(sp){return sp.pwr*(1+(META.hero.spLvPwr[sp.id]||0)*0.25+META.hero.st.int*0.10+P.spPwrBonus);}

// ── RUN ──────────────────────────────────────────────────────────
function mkRun(rt){
  return{rtId:rt.id,wave:1,eIdx:0,pHp:0,pSh:0,enemy:null,over:false,log:[],
    pendingGO:false,
    rs:{kills:0,waves:0,hw:1,crEarned:0,gmEarned:0,dmgO:0,dmgI:0,t0:Date.now()},
    spTm:{},autoSp:{},
    fx:{dM:1,dM_t:0,dB:1,dB_t:0,dot:0,dot_t:0,inv:false,inv_t:0,rgnB:0,rgnB_t:0,reflect:0,reflect_t:0}};
}

function startRun(rt){
  if(!META.heroId){showSel();return;}
  if(!rt)rt=RUN_TYPES[Math.floor(Math.random()*RUN_TYPES.length)];
  curRunType=rt;if(TK)clearInterval(TK);
  G=mkRun(rt);recompute();G.pHp=P.mHp;G.pSh=P.mSh;
  var hero=getH(META.heroId),i;
  for(i=0;i<hero.spells.length;i++){
    var sp=hero.spells[i];
    if(!sp.passive&&META.hero.lv>=sp.ulv&&isActive(sp.id)){G.autoSp[sp.id]=true;G.spTm[sp.id]=0;}
  }
  document.getElementById('ov-go').classList.add('hidden');
  spawnE();TK=setInterval(tick,CFG.TICK_MS);
  addLog('wave','▶ '+rt.name+' — '+(META.hero.name||getH(META.heroId).name));
  buildHomeStructure();navigate('home');
}

function tick(){if(!G||G.over)return;for(var _s=0;_s<SPEED;_s++)tickOnce();}

function tickOnce(){
  if(!G||G.over)return;
  var dt=1/CFG.TICKS,fx=G.fx,hero=getH(META.heroId),si,sp;
  fx.dM_t=Math.max(0,fx.dM_t-dt);if(fx.dM_t<=0)fx.dM=1;
  fx.dB_t=Math.max(0,fx.dB_t-dt);if(fx.dB_t<=0)fx.dB=1;
  fx.dot_t=Math.max(0,fx.dot_t-dt);if(fx.dot_t<=0)fx.dot=0;
  fx.inv_t=Math.max(0,fx.inv_t-dt);fx.inv=fx.inv_t>0;
  fx.rgnB_t=Math.max(0,fx.rgnB_t-dt);if(fx.rgnB_t<=0)fx.rgnB=0;
  fx.reflect_t=Math.max(0,fx.reflect_t-dt);if(fx.reflect_t<=0)fx.reflect=0;
  for(si=0;si<hero.spells.length;si++){
    sp=hero.spells[si];
    if(sp.passive||META.hero.lv<sp.ulv||!isActive(sp.id))continue;
    if(G.spTm[sp.id]===undefined)G.spTm[sp.id]=0;
    G.spTm[sp.id]=Math.max(0,G.spTm[sp.id]-dt);
    if(G.spTm[sp.id]<=0&&G.autoSp[sp.id]){castRunSp(sp);G.spTm[sp.id]=spCd(sp);}
  }
  if(!G.enemy){spawnE();return;}
  var e=G.enemy;
  var effDps=P.dps*fx.dM+(fx.dot_t>0?fx.dot:0);
  e.hp-=effDps/CFG.TICKS;G.rs.dmgO+=effDps/CFG.TICKS;
  if(!fx.inv){
    if(Math.random()>=P.dodge){
      var dmg=(e.dps/CFG.TICKS)*fx.dB*(1-P.dmgRed);
      if(fx.reflect>0)e.hp-=dmg*fx.reflect;
      if(G.pSh>0){var ab=Math.min(G.pSh,dmg);G.pSh-=ab;dmg-=ab;}
      G.pHp-=dmg;G.rs.dmgI+=dmg;
    }
  }
  G.pHp=Math.min(G.pHp+(P.rgn+(fx.rgnB_t>0?fx.rgnB:0))/CFG.TICKS,P.mHp);
  if(G.pHp<=0){G.pHp=0;G.over=true;clearInterval(TK);TK=null;
    // N'interrompre que si le joueur est sur la page run
    if(typeof PG!=='undefined'&&PG==='home')showGO();else{G.pendingGO=true;if(typeof setNotif==='function')setNotif('run-notif-dot',true);}
    saveMeta();return;
  }
  if(e.hp<=0)onEDie();
}

function castRunSp(sp){
  if(!G||G.over)return;
  var e=G.enemy,pw=spPwr(sp),fx=G.fx;
  switch(sp.type){
    case'dpsBurst':fx.dM=1+pw;fx.dM_t=sp.dur;break;
    case'burst':if(e){var d=P.atk*P.aspd*pw;e.hp-=d;G.rs.dmgO+=d;}break;
    case'multiBurst':if(e){var md=P.atk*(sp.hits||3)*pw;e.hp-=md;G.rs.dmgO+=md;}break;
    case'dot':fx.dot=P.atk*P.aspd*pw;fx.dot_t=sp.dur;break;
    case'pctKill':if(e){var pd=e.hp*pw;e.hp-=pd;G.rs.dmgO+=pd;}break;
    case'heal':G.pHp=Math.min(G.pHp+P.mHp*pw,P.mHp);break;
    case'shFull':G.pSh=P.mSh;break;
    case'shBoost':G.pSh=Math.min(G.pSh+pw,P.mSh);break;
    case'dmgBlk':fx.dB=1-pw;fx.dB_t=sp.dur;break;
    case'invuln':fx.inv=true;fx.inv_t=sp.dur;break;
    case'rgnBurst':fx.rgnB=pw;fx.rgnB_t=sp.dur;break;
    case'reflect':fx.reflect=pw;fx.reflect_t=sp.dur;break;
    case'sacrifice':G.pHp=Math.max(1,G.pHp-P.mHp*0.20);fx.dM=pw;fx.dM_t=sp.dur;break;
    case'fortress':fx.dB=1-pw;fx.dB_t=sp.dur;G.pHp=Math.min(G.pHp+P.mHp*0.10,P.mHp);break;
    case'titan':fx.inv=true;fx.inv_t=sp.dur;G.pHp=Math.min(G.pHp+P.mHp*0.40,P.mHp);break;
  }
}

function manualCast(sid){
  if(!G||G.over)return;
  var sp=findSpell(sid);
  if(!sp||sp.passive||META.hero.lv<sp.ulv||!isActive(sid))return;
  if((G.spTm[sid]||0)>0)return;
  castRunSp(sp);G.spTm[sid]=spCd(sp);
}
function toggleAutoSp(sid){if(!G)return;G.autoSp[sid]=!G.autoSp[sid];}
function rtM(){return curRunType||RUN_TYPES[1];}

function spawnE(){
  var w=G.wave,rt=rtM(),tier=w<=5?1:w<=15?2:3;
  var eInfo=RUN_ENEMIES[tier]||RUN_ENEMIES[1];
  G.enemy={
    nm:ENEMY_NAMES[Math.floor(Math.random()*ENEMY_NAMES.length)],tier:tier,portrait:eInfo.portrait,
    hp:Math.floor(CFG.E_BASE_HP*Math.pow(CFG.E_HP_SC,w-1)*rt.hpM),
    mHp:Math.floor(CFG.E_BASE_HP*Math.pow(CFG.E_HP_SC,w-1)*rt.hpM),
    dps:parseFloat((CFG.E_BASE_DPS*Math.pow(CFG.E_DPS_SC,w-1)*rt.dpsM).toFixed(1)),
    rwd:Math.floor(CFG.E_BASE_RWD*Math.pow(CFG.E_RWD_SC,w-1)*rt.rwdM)};
}

function onEDie(){
  var e=G.enemy,rt=rtM(),rwd=Math.floor(e.rwd*P.mult);
META.cr+=rwd;G.rs.crEarned+=rwd;G.rs.kills++;
  if(typeof incMissionStat==='function'){incMissionStat('kills',1);incMissionStat('credits',rwd);}
  if(META.heroId==='berserker'){META.hero.passBonus++;recompute();}
  gainXP(Math.floor(CFG.E_XP_BASE*G.wave*0.6));
  var lootMult=(P.pros/100)*rt.lootM;
  if(Math.random()<CFG.LOOT_CH*lootMult)rollLoot();
  if(Math.random()<CFG.REL_CH*lootMult)rollRelique();
  if(Math.random()<CFG.PIECE_CH*lootMult)rollPiece();
  G.enemy=null;G.eIdx++;
  if(G.eIdx>=CFG.E_WAVE)waveDone();else spawnE();
}

function waveDone(){
  G.rs.waves++;var rt=rtM();
  if(typeof incMissionStat==='function')incMissionStat('waves',1);
  if(G.wave%CFG.GEM_WAVE===0){
    var gm=Math.max(1,Math.floor(G.wave/CFG.GEM_WAVE*rt.gemM));
    META.gems+=gm;G.rs.gmEarned+=gm;addLog('loot','💎 Vague '+G.wave+' — +'+gm+' gemmes');
  }
  if(rt.maxWave>0&&G.wave>=rt.maxWave){
    addLog('wave','✓ Run Express terminé — 100 vagues!');
    G.over=true;clearInterval(TK);TK=null;
    if(typeof PG!=='undefined'&&PG==='home')showGO();else{G.pendingGO=true;if(typeof setNotif==='function')setNotif('run-notif-dot',true);}
    saveMeta();return;
  }
  addLog('wave','─── Vague '+G.wave+' → '+(G.wave+1)+' ───');
  G.wave++;G.eIdx=0;if(G.wave>G.rs.hw)G.rs.hw=G.wave;
  G.pSh=P.mSh;spawnE();saveMeta();
}

function gainXP(amt){
  var h=META.hero;if(h.lv>=CFG.H_MAX_LV)return;h.xp+=amt;
  while(h.lv<CFG.H_MAX_LV&&h.xp>=xpReq(h.lv)){
    h.xp-=xpReq(h.lv);h.lv++;h.skPts+=2;h.spPts+=1;
    if(G){G.pHp=P.mHp;G.pSh=P.mSh;}
    addLog('xp','⬆ LEVEL UP! Nv.'+h.lv);
    recompute();
    if(typeof setNotif==='function') setNotif('hero-notif-dot', true);    recompute();
    var hero=getH(META.heroId),i;
    for(i=0;i<hero.spells.length;i++){
      var sp=hero.spells[i];
      if(!sp.passive&&h.lv===sp.ulv&&G&&isActive(sp.id)){G.autoSp[sp.id]=true;G.spTm[sp.id]=0;}
    }
  }
}
function xpReq(lv){return Math.floor(CFG.XP_BASE*Math.pow(CFG.XP_SC,lv-1));}

// ── LOOT ─────────────────────────────────────────────────────────
function rollRar(W){var w=W||RAR_W,tot=0,i;for(i=0;i<w.length;i++)tot+=w[i];var r=Math.random()*tot,sum=0;for(i=0;i<RAR_K.length;i++){sum+=w[i];if(r<sum)return RAR_K[i];}return'c';}

var EQUIP_SLOTS_ALL=['arme','skin','implant','chaussures'];
function rollLoot(){
  if(Math.random()<0.45){META.gems++;addLog('loot','💎 +1 Gemme');saveMeta();return;}
  var sl=EQUIP_SLOTS_ALL[Math.floor(Math.random()*EQUIP_SLOTS_ALL.length)];
  var rk=rollRar(),rm=RAR[rk].m,w=G.wave;
  var nms=LOOT_NAMES[sl]||LOOT_NAMES.arme;
  var nm=nms[Math.floor(Math.random()*nms.length)];
  var lrq=Math.max(1,Math.floor(w*0.15)),st={};
  if(sl==='arme'){st.atk=Math.floor((w*3+6)*rm);if(rm>=2.8&&Math.random()<0.3)st.aspd=parseFloat((rm*0.05).toFixed(2));}
  else if(sl==='skin'){st.hp=Math.floor((w*30+80)*rm);if(Math.random()<0.3)st.sh=Math.floor((w*5+15)*rm);}
  else if(sl==='chaussures'){st.aspd=parseFloat((0.05*rm).toFixed(2));if(Math.random()<0.5)st.dodge=parseFloat((0.02*rm).toFixed(2));if(Math.random()<0.4)st.crit=parseFloat((0.01*rm).toFixed(2));}
  else{if(Math.random()<0.5)st.dpct=parseFloat(Math.min(1.0,0.04*rm).toFixed(2));else st.rgn=parseFloat((1.5*rm).toFixed(1));if(rm>=2.8&&Math.random()<0.3)st.crit=parseFloat((0.03*rm).toFixed(2));if(rm>=5.0&&Math.random()<0.3)st.dodge=parseFloat((0.02*rm).toFixed(2));}
  var it={uid:'L'+(UID++),type:'equip',sl:sl,nm:nm,rar:rk,lrq:lrq,st:st,perm:false,relicCount:0};
  META.inv.push(it);addLog('loot','🎁 '+nm+' ['+RAR[rk].lbl+']');saveMeta();
}
function rollRelique(){
  var rt2=REL_TYPES[Math.floor(Math.random()*REL_TYPES.length)];
  var rk=rollRar(RAR_WL_REL); // pas de commun
  META.inv.push({uid:'R'+(UID++),type:'relique',subtype:rt2.id,nm:rt2.nm,rar:rk,perm:false});
  addLog('loot','⚗ Relique: '+rt2.nm+' ['+RAR[rk].lbl+']');saveMeta();
}
function rollPiece(){
  var rk=rollRar(RAR_WL),names=PIECE_NAMES[rk]||PIECE_NAMES.c;
  META.inv.push({uid:'P'+(UID++),type:'piece',nm:names[Math.floor(Math.random()*names.length)],rar:rk,perm:false});
  addLog('loot','🔩 Pièce ['+RAR[rk].lbl+']');saveMeta();
}
function addLog(t,m){if(!G)return;G.log.unshift({t:t,m:m});if(G.log.length>CFG.LOG_MAX)G.log.pop();}

// ── DUEL ─────────────────────────────────────────────────────────
// Scaling victoires : ×Math.pow(1.15, wins) — exponentielle lente
function oppScaled(opp){
  var heroSc=1+META.hero.lv*0.045;
  var wins=META.duelWins[opp.id]||0;
  var winSc=Math.pow(1.15,wins);
  var sc=heroSc*winSc;
  return{hp:Math.floor(opp.bHp*sc),sh:Math.floor(opp.bSh*sc),atk:Math.floor(opp.bAtk*sc),wins:wins,winSc:winSc};
}

function startDuel(opp){
  var sc=oppScaled(opp);
  DL={opp:opp,oppHp:sc.hp,oppMHp:sc.hp,oppSh:sc.sh,oppMSh:sc.sh,oppAtk:sc.atk,
    pHp:P.mHp,pMHp:P.mHp,pSh:P.mSh,pMSh:P.mSh,pAtk:P.atk,pCrit:P.crit,
    pEn:CFG.DUEL_ENERGY,turn:1,phase:'player',pEff:[],eEff:[],log:[],winner:null,
    pendingResult:false,resultWon:false};
  navigate('duel');
  document.getElementById('duel-sel').style.display='none';
  document.getElementById('duel-fight').style.display='flex';
  document.getElementById('duel-result').style.display='none';
  duelLog('sys','⚔ '+opp.name+(sc.wins>0?' (Revanche #'+sc.wins+' ×'+sc.winSc.toFixed(2)+')'  :'')+'. À vous !');
  renderDuelFight();
}
function showDuelSel(){
  document.getElementById('duel-sel').style.display='';
  document.getElementById('duel-fight').style.display='none';
  document.getElementById('duel-result').style.display='none';
  DL=null;
}
function duelAtkVal(effs,base){var m=1;for(var i=0;i<effs.length;i++){if(effs[i].type==='atkBuf')m+=effs[i].val;if(effs[i].type==='atkDeb')m-=effs[i].val;}return Math.max(0,base*m);}
function duelApplyDmgEnemy(dmg){for(var i=0;i<DL.eEff.length;i++)if(DL.eEff[i].type==='invuln')return;var def=1;for(var j=0;j<DL.eEff.length;j++)if(DL.eEff[j].type==='defBuf')def-=DL.eEff[j].val;dmg=Math.floor(dmg*Math.max(0.05,def));if(DL.oppSh>0){var ab=Math.min(DL.oppSh,dmg);DL.oppSh-=ab;dmg-=ab;}DL.oppHp=Math.max(0,DL.oppHp-dmg);}
function duelApplyDmgPlayer(dmg){for(var i=0;i<DL.pEff.length;i++)if(DL.pEff[i].type==='invuln')return;var def=1;for(var j=0;j<DL.pEff.length;j++)if(DL.pEff[j].type==='defBuf')def-=DL.pEff[j].val;if(META.heroId==='warden')def-=0.05;dmg=Math.floor(dmg*Math.max(0.05,def));if(DL.pSh>0){var ab=Math.min(DL.pSh,dmg);DL.pSh-=ab;dmg-=ab;}DL.pHp=Math.max(0,DL.pHp-dmg);}

function duelPlayerAction(aid){
  if(!DL||DL.phase!=='player')return;
  if(aid==='weapon'){
    if(DL.pEn<1)return;DL.pEn-=1;
    var isCrit=Math.random()<DL.pCrit;
    var dmg=Math.floor(duelAtkVal(DL.pEff,DL.pAtk)*(isCrit?2:1));
    duelApplyDmgEnemy(dmg);duelLog('dmg','🗡 Arme'+(isCrit?' ✦CRIT':'')+': -'+dmg+' PV');
  }else{
    var sp=findSpell(aid);if(!sp||sp.passive||META.hero.lv<sp.ulv||!isActive(aid))return;
    if(DL.pEn<sp.energy)return;DL.pEn-=sp.energy;duelCastPlayer(sp);
  }
  checkDuelDeath();if(!DL||DL.winner)return;
  renderDuelFight();if(DL.pEn<=0)setTimeout(duelEndPlayerTurn,280);
}

function duelCastPlayer(sp){
  var pw=spPwr(sp);
  switch(sp.type){
    case'dpsBurst':DL.pEff.push({type:'atkBuf',val:pw*0.6,turns:2,label:'ATQ+'});duelLog('buff','✦ '+sp.name);break;
    case'burst':case'multiBurst':var ic=Math.random()<DL.pCrit;var bd2=Math.floor(DL.pAtk*(sp.type==='multiBurst'?pw*0.43:pw*0.5)*(ic?2:1));duelApplyDmgEnemy(bd2);duelLog('dmg','⚡ '+sp.name+(ic?' ✦CRIT':'')+': -'+bd2);break;
    case'heal':var hl=Math.floor(DL.pMHp*pw*0.6);DL.pHp=Math.min(DL.pHp+hl,DL.pMHp);duelLog('buff','💚 +'+hl+' PV');break;
    case'shFull':DL.pSh=DL.pMSh;duelLog('buff','🛡 '+sp.name);break;
    case'shBoost':DL.pSh=Math.min(DL.pSh+150,DL.pMSh);duelLog('buff','🛡 +150 Bouclier');break;
    case'dmgBlk':DL.pEff.push({type:'defBuf',val:0.70,turns:2,label:'DEF+70%'});duelLog('buff','🧱 '+sp.name);break;
    case'invuln':case'titan':DL.pEff.push({type:'invuln',val:1,turns:1,label:'INVULN'});if(sp.type==='titan'){DL.pHp=Math.min(DL.pHp+Math.floor(DL.pMHp*0.40),DL.pMHp);}duelLog('buff','✨ '+sp.name);break;
    case'rgnBurst':DL.pHp=Math.min(DL.pHp+Math.floor(DL.pMHp*0.20),DL.pMHp);duelLog('buff','🔧 '+sp.name);break;
    case'reflect':DL.pEff.push({type:'defBuf',val:0.50,turns:2,label:'REFLECT'});DL.eEff.push({type:'dot',val:Math.floor(DL.pAtk*0.25),turns:2,label:'Réflexion'});duelLog('buff','🔄 '+sp.name);break;
    case'fortress':DL.pEff.push({type:'defBuf',val:0.90,turns:2,label:'FORT'});DL.pHp=Math.min(DL.pHp+Math.floor(DL.pMHp*0.10),DL.pMHp);duelLog('buff','🏰 '+sp.name);break;
    case'dot':DL.eEff.push({type:'dot',val:Math.floor(DL.pAtk*pw*0.4),turns:3,label:'DOT'});duelLog('dmg','☣ '+sp.name);break;
    case'pctKill':var pk=Math.floor(DL.oppHp*0.25);duelApplyDmgEnemy(pk);DL.eEff.push({type:'atkDeb',val:0.25,turns:2,label:'ATQ-25%'});duelLog('dbuf','☠ -'+pk);break;
    case'sacrifice':DL.pEff.push({type:'atkBuf',val:1.5,turns:2,label:'×2.5 ATQ'});duelLog('buff','💥 '+sp.name);break;
  }
}

function duelEndPlayerTurn(){
  if(!DL||DL.phase!=='player')return;
  for(var i=0;i<DL.eEff.length;i++)if(DL.eEff[i].type==='dot'){duelApplyDmgEnemy(DL.eEff[i].val);duelLog('dmg','☣ DOT: -'+DL.eEff[i].val);}
  checkDuelDeath();if(!DL||DL.winner)return;
  DL.phase='enemy';renderDuelFight();setTimeout(duelEnemyTurn,CFG.DUEL_AI_DELAY);
}

function duelEnemyTurn(){
  if(!DL||DL.phase!=='enemy')return;
  var opp=DL.opp;DL.oppEn=CFG.DUEL_ENERGY;var att=0;
  while(DL.oppEn>0&&att<12){att++;
    var choices=[{type:'atk',cost:1,w:25}],si;
    for(si=0;si<opp.spells.length;si++){
      var sp2=opp.spells[si];if(DL.oppEn<sp2.energy)continue;
      var ww=12;if(sp2.type==='oHeal'&&DL.oppHp<DL.oppMHp*0.4)ww=50;if(sp2.type==='oBuf'&&DL.oppHp>DL.oppMHp*0.5)ww=22;if(sp2.type==='oInv'&&DL.pHp<DL.pMHp*0.4)ww=30;
      choices.push({type:'spell',sp:sp2,cost:sp2.energy,w:ww});
    }
    var tot=0,ci;for(ci=0;ci<choices.length;ci++)tot+=choices[ci].w;
    var rr=Math.random()*tot,sum=0,picked=null;for(ci=0;ci<choices.length;ci++){sum+=choices[ci].w;if(rr<sum){picked=choices[ci];break;}}
    if(!picked)break;
    if(picked.type==='atk'){DL.oppEn-=1;var d2=Math.floor(duelAtkVal(DL.eEff,DL.oppAtk));duelApplyDmgPlayer(d2);duelLog('dmg','👾 -'+d2+' PV');}
    else{DL.oppEn-=picked.cost;duelEnemySp(picked.sp);}
    checkDuelDeath();if(!DL||DL.winner)return;
  }
  for(var pi=0;pi<DL.pEff.length;pi++)if(DL.pEff[pi].type==='dot'){duelApplyDmgPlayer(DL.pEff[pi].val);duelLog('dmg','☣ DOT: -'+DL.pEff[pi].val);}
  checkDuelDeath();if(!DL||DL.winner)return;
  DL.turn++;DL.phase='player';DL.pEn=CFG.DUEL_ENERGY;
  tickEff(DL.pEff);tickEff(DL.eEff);
  DL.pSh=Math.min(DL.pSh+Math.floor(DL.pMSh*0.07),DL.pMSh);
  DL.oppSh=Math.min(DL.oppSh+Math.floor(DL.oppMSh*0.07),DL.oppMSh);
  duelLog('sys','─── Tour '+DL.turn+' ───');renderDuelFight();
}

function duelEnemySp(sp){
  var opp=DL.opp;
  switch(sp.type){
    case'oAtk':var dd=Math.floor(duelAtkVal(DL.eEff,DL.oppAtk)*sp.pwr);duelApplyDmgPlayer(dd);duelLog('dmg','⚡ -'+dd);break;
    case'oHeal':DL.oppHp=Math.min(DL.oppHp+Math.floor(opp.bHp*sp.pwr),DL.oppMHp);duelLog('buff','💚 Ennemi soigné');break;
    case'oBuf':DL.eEff.push({type:'atkBuf',val:sp.pwr,turns:sp.dur||2,label:'ATQ+'});duelLog('buff','⬆ Ennemi buffé');break;
    case'oDebuf':DL.pEff.push({type:'defBuf',val:-sp.pwr,turns:sp.dur||2,label:'DEF-'});duelLog('dbuf','⬇ Vous êtes debuffé');break;
    case'oDot':DL.pEff.push({type:'dot',val:Math.floor(duelAtkVal(DL.eEff,DL.oppAtk)*sp.pwr),turns:sp.dur||3,label:'DOT'});duelLog('dbuf','☣ DOT appliqué');break;
    case'oInv':DL.eEff.push({type:'invuln',val:1,turns:1,label:'INVULN'});duelLog('buff','✨ Invulnérable');break;
  }
}
function tickEff(effs){for(var i=effs.length-1;i>=0;i--){effs[i].turns--;if(effs[i].turns<=0)effs.splice(i,1);}}
function duelLog(t,m){if(DL)DL.log.unshift({t:t,m:m});}

function checkDuelDeath(){
  if(!DL)return;
  if(DL.oppHp<=0){DL.oppHp=0;DL.winner='player';DL.phase='over';
    META.duelWins[DL.opp.id]=(META.duelWins[DL.opp.id]||0)+1;
    if(typeof incMissionStat==='function')incMissionStat('duels',1);
    saveMeta();
    // Popup seulement si sur page duel
    if(typeof PG!=='undefined'&&PG==='duel')showDuelResult(true);
    else{DL.pendingResult=true;DL.resultWon=true;}
    return;
  }
  if(DL.pHp<=0){DL.pHp=0;DL.winner='enemy';DL.phase='over';
    if(typeof PG!=='undefined'&&PG==='duel')showDuelResult(false);
    else{DL.pendingResult=true;DL.resultWon=false;}
  }
}

function showDuelResult(won){
  document.getElementById('duel-fight').style.display='none';
  document.getElementById('duel-result').style.display='flex';
  var tEl=document.getElementById('dr-title'),rEl=document.getElementById('dr-rewards');
  if(won){
    tEl.innerHTML='<div style="font-size:2rem">🏆</div><div style="font-size:1.1rem;color:#eb2;font-weight:700">VICTOIRE ! (Revanche #'+((META.duelWins[DL.opp.id]||1)-1)+')</div>';
    var opp=DL.opp,gems=opp.rewardGems;META.gems+=gems;
    var pool=RAR_K,mi=pool.indexOf(opp.rewardRarMin),mxi=pool.indexOf(opp.rewardRarMax);
    var rk=pool[Math.min(mxi,mi+Math.floor(Math.random()*(mxi-mi+1)))];
    var sl=EQUIP_SLOTS_ALL[Math.floor(Math.random()*EQUIP_SLOTS_ALL.length)];
    var w=Math.max(5,META.hero.lv),rm=RAR[rk].m;
    var nm=(LOOT_NAMES[sl]||LOOT_NAMES.arme)[Math.floor(Math.random()*(LOOT_NAMES[sl]||LOOT_NAMES.arme).length)];
    var st={};
    if(sl==='arme'){st.atk=Math.floor((w*3+6)*rm);if(rm>=2.8)st.aspd=parseFloat((rm*0.04).toFixed(2));}
    else if(sl==='skin'){st.hp=Math.floor((w*30+80)*rm);st.sh=Math.floor((w*5+20)*rm);}
    else if(sl==='chaussures'){st.aspd=parseFloat((0.06*rm).toFixed(2));st.dodge=parseFloat((0.03*rm).toFixed(2));if(rm>=2.8)st.crit=parseFloat((0.02*rm).toFixed(2));}
    else{st.dpct=parseFloat(Math.min(0.80,0.05*rm).toFixed(2));st.rgn=parseFloat((1.8*rm).toFixed(1));if(rm>=2.8)st.crit=parseFloat((0.02*rm).toFixed(2));}
    var it={uid:'D'+(UID++),type:'equip',sl:sl,nm:nm,rar:rk,lrq:Math.max(1,META.hero.lv-3),st:st,perm:false,relicCount:0};
    META.inv.push(it);saveMeta();updateTop();
    rEl.innerHTML='<div style="color:#eb2;margin-bottom:6px">+'+gems+' 💎</div><div>🎁 <span class="'+RAR[rk].cls+'"><strong>'+nm+'</strong></span><br><small>'+cap(sl)+' · '+stStr(it.st)+'</small></div>';
  }else{
    tEl.innerHTML='<div style="font-size:2rem">💀</div><div style="font-size:1.1rem;color:#a33;font-weight:700">DÉFAITE</div>';
    rEl.innerHTML='<div style="color:#555">Aucune récompense.</div>';
  }
}

// ── ACHATS ───────────────────────────────────────────────────────
function uCost(u){return Math.floor(u.bCost*Math.pow(u.sc,META.upgLv[u.id]||0));}
function buyUpg(id){
  var u=findUpg(id);if(!u)return;
  var lv=META.upgLv[u.id]||0,c=uCost(u);if(lv>=u.max||META.cr<c)return;
  META.cr-=c;META.upgLv[u.id]=lv+1;recompute();updateTop();renderUpg();saveMeta();
}
function getBoutDisplay(){
  var seed=META.boutSeed||0;
  var lv=META.hero.lv||1;
  var types=['arme','skin','implant','chaussures'];
  var result=[];
  types.forEach(function(tp,ti){
    // Filtre épique/légendaire ET dans la plage de niveau ±5 du héros
    var items=BOUT.filter(function(b){
      return b.sl===tp&&(b.rar==='e'||b.rar==='l')&&b.lrq>=(lv-5)&&b.lrq<=(lv+5);
    });
    // Fallback : si aucun item dans la plage, prend les plus proches
    if(!items.length){
      items=BOUT.filter(function(b){return b.sl===tp&&(b.rar==='e'||b.rar==='l');});
      items.sort(function(a,b){return Math.abs(a.lrq-lv)-Math.abs(b.lrq-lv);});
      items=items.slice(0,2);
    }
    if(!items.length)return;
    var idx1=(seed+ti*7)%items.length;
    var idx2=(seed+ti*7+3)%items.length;
    result.push(items[idx1]);
    if(idx1!==idx2&&items.length>1)result.push(items[idx2]);
  });
  return result;
}
function rerollBout(){
  if(META.cr<CFG.BOUT_REROLL_COST)return;
  META.cr-=CFG.BOUT_REROLL_COST;
  META.boutSeed=Date.now();
  saveMeta();updateTop();renderBout();
}

function buyBout(id){
  var b=findBout(id);if(!b)return;
  if(META.bought.indexOf(id)!==-1)return;
  if(b.cost>0&&META.gems<b.cost)return;
  if(b.costCr>0&&META.cr<b.costCr)return;
  if(META.hero.lv<b.lrq)return;
  if(b.cost>0)META.gems-=b.cost;if(b.costCr>0)META.cr-=b.costCr;
  META.bought.push(id);
  var it={uid:'B'+id,type:'equip',sl:b.sl,nm:b.nm,rar:b.rar,lrq:b.lrq,st:b.st,perm:true,icon:b.icon,relicCount:0};
  META.inv.push(it);
  // Auto-équiper si slot libre
  if(b.sl==='implant'){if(!META.eq.implant1){META.eq.implant1='B'+id;recompute();}}
  else if(!META.eq[b.sl]){META.eq[b.sl]='B'+id;recompute();}
  saveMeta();updateTop();renderBout();if(PG==='inv')renderInv();
}

function equipIt(uid,slotHint){
  var it=byUid(uid);if(!it||it.type!=='equip'||META.hero.lv<(it.lrq||1))return;
  var sl=slotHint||getSlotForItem(it);
  META.eq[sl]=uid;recompute();renderInv();saveMeta();
}
function unequip(sl){META.eq[sl]=null;recompute();renderInv();saveMeta();}

function sellItem(uid){
  var it=byUid(uid);if(!it||it.perm)return;
  var price=SELL[it.rar]||30;
  if(it.relicCount)price=Math.floor(price*(1+it.relicCount*0.2));
  META.cr+=price;
  EQ_SLOTS.forEach(function(sl){if(META.eq[sl]===uid)META.eq[sl]=null;});
  META.inv=META.inv.filter(function(x){return x.uid!==uid;});
  recompute();updateTop();renderInv();saveMeta();
}

// Vendre tous les items d'un type et rareté (non perm, non équipés)
function sellAll(type,rar){
  var toSell=META.inv.filter(function(it){
    return it.type===type&&it.rar===rar&&!it.perm&&!isEquipped(it.uid);
  });
  if(!toSell.length)return;
  var total=0;
  toSell.forEach(function(it){
    var price=SELL[it.rar]||30;
    if(it.relicCount)price=Math.floor(price*(1+it.relicCount*0.2));
    total+=price;
  });
  META.cr+=total;
  var sellUids=toSell.map(function(x){return x.uid;});
  META.inv=META.inv.filter(function(x){return sellUids.indexOf(x.uid)===-1;});
  recompute();updateTop();renderInv();saveMeta();
  addLog('loot','₵ Vendu '+toSell.length+' items pour '+fmt(total)+'₵');
}

function spendSt(sid){var h=META.hero;if(h.skPts<=0)return;h.st[sid]++;h.skPts--;recompute();renderHero();saveMeta();}
function upgSpPwr(spId){var h=META.hero;if(h.spPts<=0)return;var lv=h.spLvPwr[spId]||0;if(lv>=CFG.SP_MAX_LV)return;h.spLvPwr[spId]=lv+1;h.spPts--;renderHero();saveMeta();}
function upgSpCd(spId){var h=META.hero;if(h.spPts<=0)return;var lv=h.spLvCd[spId]||0;if(lv>=CFG.SP_MAX_LV)return;h.spLvCd[spId]=lv+1;h.spPts--;renderHero();saveMeta();}

// ── CRAFT — RELIQUES (multi-select, max 2 par item) ───────────────
function isRelicCompatible(relic, item){
  if(!item||!relic)return false;
  if((item.relicCount||0)>=CFG.MAX_RELICS_PER_ITEM)return false;
  if(relic.subtype==='univ')return true;
  var sm={atk:'atk',aspd:'aspd',vit:'hp',res:'sh',rgn:'rgn'};
  var targetStat=sm[relic.subtype];
  return !!(targetStat&&item.st&&item.st[targetStat]!==undefined);
}

function toggleCraftRelic(uid){
  var idx=CRAFT.enhRels.indexOf(uid);
  if(idx!==-1){CRAFT.enhRels.splice(idx,1);}
  else{
    if(CRAFT.enhRels.length>=2)return; // max 2 reliques
    CRAFT.enhRels.push(uid);
  }
  renderCraft();
}

function doEnhance(){
  var item=byUid(CRAFT.enhItem);
  if(!item||!CRAFT.enhRels.length)return;
  var sm={atk:'atk',aspd:'aspd',vit:'hp',res:'sh',rgn:'rgn'};
  var applied=0;
  CRAFT.enhRels.forEach(function(relUid){
    var rel=byUid(relUid);if(!rel)return;
    if((item.relicCount||0)>=CFG.MAX_RELICS_PER_ITEM)return;
    var pct=REL_BONUS[rel.rar]||0.08;
    var stat=rel.subtype==='univ'?mainStat(item.st):sm[rel.subtype];
    if(stat&&item.st[stat]!==undefined){
      item.st[stat]+=Math.floor(item.st[stat]*pct);
      item.relicCount=(item.relicCount||0)+1;
      META.inv=META.inv.filter(function(x){return x.uid!==rel.uid;});
      applied++;
    }
  });
  if(applied>0){
    CRAFT.enhItem=null;CRAFT.enhRels=[];
    recompute();saveMeta();
    document.getElementById('ce-log').textContent='⚗ '+applied+' relique(s) fusionnée(s) !';
    renderCraft();if(PG==='inv')renderInv();
  }
}

function canCraft(rec){var i,req,c,j;for(i=0;i<rec.req.length;i++){req=rec.req[i];c=0;for(j=0;j<META.inv.length;j++)if(META.inv[j].type===req.type&&META.inv[j].rar===req.rar)c++;if(c<req.count)return false;}return true;}
function doCraft(rid){
  var rec=null,i;for(i=0;i<RECIPES.length;i++)if(RECIPES[i].id===rid){rec=RECIPES[i];break;}
  if(!rec||!canCraft(rec))return;
  var req,j,c;for(i=0;i<rec.req.length;i++){req=rec.req[i];c=req.count;for(j=META.inv.length-1;j>=0&&c>0;j--){if(META.inv[j].type===req.type&&META.inv[j].rar===req.rar){META.inv.splice(j,1);c--;}}}
  var slots=rec.resultType?[rec.resultType]:EQUIP_SLOTS_ALL;
  var sl=slots[Math.floor(Math.random()*slots.length)];
  var rk=rec.result,rm=RAR[rk].m,w=Math.max(5,META.hero.lv);
  var nms=LOOT_NAMES[sl]||LOOT_NAMES.arme;
  var nm=nms[Math.floor(Math.random()*nms.length)];
  var lrq=Math.max(1,META.hero.lv-5),st={};
  if(sl==='arme'){st.atk=Math.floor((w*3+6)*rm);st.aspd=parseFloat((rm*0.04).toFixed(2));}
  else if(sl==='skin'){st.hp=Math.floor((w*30+80)*rm);st.sh=Math.floor((w*5+20)*rm);}
  else if(sl==='chaussures'){st.aspd=parseFloat((0.06*rm).toFixed(2));st.dodge=parseFloat((0.03*rm).toFixed(2));if(rm>=2.8)st.crit=parseFloat((0.02*rm).toFixed(2));}
  else{st.dpct=parseFloat(Math.min(0.80,0.06*rm).toFixed(2));st.rgn=parseFloat((1.8*rm).toFixed(1));if(rm>=2.8)st.crit=parseFloat((0.02*rm).toFixed(2));}
  var craft={uid:'C'+(UID++),type:'equip',sl:sl,nm:nm,rar:rk,lrq:lrq,st:st,perm:false,relicCount:0};
  META.inv.push(craft);
  if(typeof incMissionStat==='function')incMissionStat('forges',1);
  saveMeta();renderCraft();  document.getElementById('ce-log').textContent='🔨 Créé: '+nm+' ['+RAR[rk].lbl+'] '+stStr(craft.st);
}
function countInv(type,rar){var c=0,i;for(i=0;i<META.inv.length;i++)if(META.inv[i].type===type&&META.inv[i].rar===rar)c++;return c;}
function mainStat(st){if(!st)return null;if(st.atk)return'atk';if(st.hp)return'hp';if(st.sh)return'sh';if(st.rgn)return'rgn';if(st.aspd)return'aspd';return null;}

// ── UTILS ────────────────────────────────────────────────────────
function getH(id){for(var i=0;i<HEROES.length;i++)if(HEROES[i].id===id)return HEROES[i];return HEROES[0];}
function findSpell(sid){var hero=getH(META.heroId||'berserker');for(var i=0;i<hero.spells.length;i++)if(hero.spells[i].id===sid)return hero.spells[i];return null;}
function findUpg(id){for(var i=0;i<UPGRADES.length;i++)if(UPGRADES[i].id===id)return UPGRADES[i];return null;}
function findBout(id){for(var i=0;i<BOUT.length;i++)if(BOUT[i].id===id)return BOUT[i];return null;}
function byUid(uid){for(var i=0;i<META.inv.length;i++)if(META.inv[i].uid===uid)return META.inv[i];return null;}
function stStr(s){
  if(!s)return'—';var p=[];
  if(s.atk)p.push('+'+s.atk+' ATQ');if(s.aspd)p.push('+'+s.aspd.toFixed(2)+' VitAtq');
  if(s.crit)p.push('+'+Math.round(s.crit*100)+'% Crit');if(s.dodge)p.push('+'+Math.round(s.dodge*100)+'% Esq');
  if(s.dpct)p.push('+'+Math.round(s.dpct*100)+'% DPS');if(s.hp)p.push('+'+s.hp+' PV');
  if(s.sh)p.push('+'+s.sh+' Boucl.');if(s.rgn)p.push('+'+s.rgn+' Rgn/s');
  return p.join(', ')||'—';
}
function fmt(n){n=Math.floor(n||0);if(n>=1e9)return(n/1e9).toFixed(2)+'G';if(n>=1e6)return(n/1e6).toFixed(2)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'k';return String(n);}
function pct(v,m){return m>0?Math.max(0,Math.min(100,v/m*100)).toFixed(1):0;}
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1);}
function fmtT(s){s=Math.floor(s||0);return pad(Math.floor(s/3600))+':'+pad(Math.floor((s%3600)/60))+':'+pad(s%60);}
function pad(n){return n<10?'0'+n:String(n);}
function setText(id,v){var e=document.getElementById(id);if(e)e.textContent=v;}
function setBar(id,v,m){var e=document.getElementById(id);if(e)e.style.width=pct(v,m)+'%';}
// ── MISSIONS ─────────────────────────────────────────────────────
var MISSION_POOL=[
  {id:'kills',   lbl:'Éliminer {n} ennemis en run',    key:'kills',   rewardCr:200, rewardGems:1},
  {id:'waves',   lbl:'Compléter {n} vagues',           key:'waves',   rewardCr:300, rewardGems:1},
  {id:'duels',   lbl:'Remporter {n} duel(s)',          key:'duels',   rewardCr:250, rewardGems:2},
  {id:'craft',   lbl:'Forger {n} équipement(s)',       key:'forges',  rewardCr:180, rewardGems:1},
  {id:'credits', lbl:'Accumuler {n} crédits',         key:'credits', rewardCr:0,   rewardGems:3},
];
var MISSION_STATS={kills:0,waves:0,duels:0,forges:0,credits:0};

function generateMissions(){
  if(!META.missions)META.missions=[];
  if(META.missions.length===3)return;
  var pool=MISSION_POOL.slice(),missions=[];
  var lv=META.hero.lv||1;
  while(missions.length<3&&pool.length){
    var idx=Math.floor(Math.random()*pool.length);
    var tpl=pool.splice(idx,1)[0];
    var target=tpl.id==='kills'?10+lv*2:tpl.id==='waves'?5+lv:tpl.id==='duels'?1+Math.floor(lv/10):tpl.id==='craft'?2+Math.floor(lv/5):500+lv*50;
    missions.push({id:tpl.id,lbl:tpl.lbl.replace('{n}',target),key:tpl.key,target:target,progress:0,done:false,claimed:false,rewardCr:tpl.rewardCr,rewardGems:tpl.rewardGems});
  }
  META.missions=missions;
  saveMeta();
}
function incMissionStat(key,n){
  MISSION_STATS[key]=(MISSION_STATS[key]||0)+(n||1);
  if(META.missions){META.missions.forEach(function(m){if(m.key===key&&!m.claimed){m.progress=Math.min(m.target,m.progress+(n||1));if(m.progress>=m.target&&!m.done){m.done=true;if(typeof setNotif==='function')setNotif('mission-notif-dot',true);}}});}
}
function claimMission(idx){
  var m=META.missions&&META.missions[idx];
  if(!m||!m.done||m.claimed)return;
  m.claimed=true;
  META.cr+=m.rewardCr;META.gems+=m.rewardGems;
  saveMeta();updateTop();
  if(PG==='missions')renderMissions();
}
function restartMissions(){META.missions=[];generateMissions();if(PG==='missions')renderMissions();}