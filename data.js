// ================================================================
// data.js v11
// ================================================================

var CFG = {
  TICK_MS:100, TICKS:10,
  E_WAVE:3,
  E_BASE_HP:120,  E_HP_SC:1.13,   // adouci (était 1.18)
  E_BASE_DPS:4,   E_DPS_SC:1.09,  // adouci (était 1.12)
  E_BASE_RWD:10,  E_RWD_SC:1.10,
  E_XP_BASE:15,
  H_MAX_LV:100, XP_BASE:60, XP_SC:1.35,
  SP_CD:20, SP_MAX_LV:5,
  LOOT_CH:0.10, REL_CH:0.05, PIECE_CH:0.05,
  GEM_WAVE:10, LOG_MAX:80,
  DUEL_ENERGY:3, DUEL_AI_DELAY:850,
  MAX_ACTIVE_SP:4, PROS_BASE:100,
  BOUT_REROLL_COST:30,   // ₵ pour reroll boutique
  MAX_RELICS_PER_ITEM:2,
};

// ── RUN TYPES ────────────────────────────────────────────────────
// Express  : 100 vagues, loot ×3
// Hardcore : base ×5 dès la vague 1, courbe normale
var RUN_TYPES = [
  { id:'express',  name:'RUN EXPRESS',
    desc:'100 vagues max, ennemis affaiblis. Farm intensif avec bonus de loot massif.',
    tags:'100 vagues · Facile · Loot ×3', bg:'assets/bg/run_express.jpg', diff:'e',
    maxWave:100, hpM:0.65, dpsM:0.65, rwdM:0.90, lootM:3.0, gemM:0.8 },
  { id:'standard', name:'RUN STANDARD',
    desc:'Vagues infinies, difficulté équilibrée.',
    tags:'Infini · Normal · Loot ×1', bg:'assets/bg/run_standard.jpg', diff:'m',
    maxWave:0, hpM:1, dpsM:1, rwdM:1, lootM:1, gemM:1 },
  { id:'hardcore', name:'RUN HARDCORE',
    desc:'Les ennemis démarrent ×5 plus forts dès la vague 1. Courbe exponentielle lente mais implacable.',
    tags:'Infini · Hardcore · Loot ×2.5', bg:'assets/bg/run_hardcore.jpg', diff:'h',
    maxWave:0, hpM:5.0, dpsM:5.0, rwdM:2.5, lootM:2.5, gemM:2.5 },
];

// ── HÉROS ────────────────────────────────────────────────────────
var HEROES = [
  { id:'berserker', name:'CYBER BERSERKER', arch:'OFFENSIF',
    desc:'Haut DPS, résistance faible. Passif: +1 ATQ permanent par kill.',
    portrait:'assets/heroes/berserker.png',
    baseHp:220, baseSh:30, baseAtk:12, baseAspd:1.8, baseRgn:0.5,
    spells:[
      {id:'adren',name:'Adrénaline',      desc:'PASSIF — +1 ATQ permanent par kill.',               ulv:1, passive:true, type:'killBonus',  pwr:1,        energy:0},
      {id:'rage', name:'Rage Cybernétique',desc:'ATQ +80% 6s. Duel: +60% ATQ 2 tours.',             ulv:1, passive:false,type:'dpsBurst',   pwr:0.80,dur:6,energy:1},
      {id:'lame', name:'Lame Plasma',      desc:'600% ATQ instantané. Duel: 300% ATQ.',             ulv:5, passive:false,type:'burst',      pwr:6.0,      energy:2},
      {id:'nstim',name:'Nano-Stimulant',   desc:'Soigne 15% PV. Duel: idem.',                       ulv:8, passive:false,type:'heal',       pwr:0.15,     energy:1},
      {id:'ovchg',name:'Surcharge',        desc:'ATQ ×2 4s. Duel: ×1.8 2 tours.',                  ulv:12,passive:false,type:'dpsBurst',   pwr:1.0,dur:4, energy:2},
      {id:'chain',name:'Décharge Chainée', desc:'3 hits 120% ATQ. Duel: 260% ATQ.',                ulv:15,passive:false,type:'multiBurst', pwr:1.2,hits:3,energy:2, hbAoe:'cross'},
      {id:'saign',name:'Saignement Quant.',desc:'DOT 200% ATQ/s 6s. Duel: 90% ATQ/tour 3t.',       ulv:18,passive:false,type:'dot',        pwr:2.0,dur:6, energy:2},
      {id:'sacri',name:'Sacrifice Cyber.', desc:'Perd 20% PV, ATQ ×3 5s. Duel: ×2.5 2t.',         ulv:22,passive:false,type:'sacrifice',  pwr:3.0,dur:5, energy:2},
      {id:'apoc', name:'Apocalypse Chrome',desc:'Détruit 30% PV ennemi. Duel: -30% ATQ ennemi 2t.',ulv:25,passive:false,type:'pctKill',    pwr:0.30,     energy:3},
      {id:'omega',name:'Frappe Oméga',      desc:'1500% ATQ instantané. Duel: 700% ATQ.',           ulv:30,passive:false,type:'burst',      pwr:15.0,     energy:3},
    ]},
  { id:'warden', name:'IRON WARDEN', arch:'DÉFENSIF',
    desc:'Haute endurance. Passif: -5% dégâts reçus.',
    portrait:'assets/heroes/warden.png',
    baseHp:550, baseSh:160, baseAtk:10, baseAspd:0.8, baseRgn:3,
    spells:[
      {id:'armv', name:'Armure Vivante',    desc:'PASSIF — -5% dégâts reçus.',                     ulv:1, passive:true, type:'dmgRedux',  pwr:0.05,     energy:0},
      {id:'fort', name:'Forteresse',         desc:'Soigne 25% PV. Duel: idem.',                    ulv:1, passive:false,type:'heal',      pwr:0.25,     energy:1, hbSelfTarget: true, hbAoe: 'single'},
      {id:'nano', name:"Nanobots d'Urgence",desc:'Bouclier à 100%. Duel: idem.',                   ulv:5, passive:false,type:'shFull',    pwr:1.0,      energy:1, hbSelfTarget: true, hbAoe: 'single'},
      {id:'ishll',name:'Carapace de Fer',   desc:'+200 bouclier 4s. Duel: +150.',                  ulv:8, passive:false,type:'shBoost',   pwr:200,dur:4, energy:1, hbSelfTarget: true, hbAoe: 'single'},
      {id:'repdr',name:'Drone Réparateur',  desc:'Regen +15/s 8s. Duel: soigne 20% PV.',           ulv:12,passive:false,type:'rgnBurst',  pwr:15,dur:8,  energy:2},
      {id:'barr', name:'Barrière Adamantine',desc:'Dégâts -80% 6s. Duel: DEF +70% 2t.',            ulv:15,passive:false,type:'dmgBlk',    pwr:0.80,dur:6,energy:2},
      {id:'reflt',name:'Bouclier Réfléch.', desc:'Réfléchit 50% dégâts 4s.',                      ulv:18,passive:false,type:'reflect',   pwr:0.50,dur:4,energy:2},
      {id:'fortm',name:'Mode Forteresse',   desc:'Dégâts -95% 3s + soigne 10% PV.',               ulv:22,passive:false,type:'fortress',  pwr:0.95,dur:3,energy:2},
      {id:'bunk', name:'Bunker Quantique',   desc:'Invulnérabilité 5s. Duel: invuln 1 tour.',       ulv:25,passive:false,type:'invuln',    pwr:1.0,dur:5, energy:3},
      {id:'titan',name:'Protocole Titan',    desc:'Invuln 8s + soigne 40% PV.',                   ulv:30,passive:false,type:'titan',     pwr:1.0,dur:8, energy:3},
    ]},
];

// ── ADVERSAIRES DUEL ─────────────────────────────────────────────
// oppScaled() applique Math.pow(1.15, wins) pour chaque victoire passée
var OPPONENTS = [
  { id:'rookie', diff:'e', name:'Glitch Rookie',  archetype:'Débutant',
    desc:'Maladroit mais apprend vite. Il revient plus fort à chaque défaite.',
    portrait:'assets/enemies/duel/rookie.png',
    bHp:250,bSh:35,bAtk:16,rewardGems:2,rewardRarMin:'p',rewardRarMax:'r',
    spells:[{id:'oatk',name:'Tir Basique',energy:1,type:'oAtk',pwr:1.0},{id:'oheal',name:'Kit Médical',energy:2,type:'oHeal',pwr:0.15}]},
  { id:'vet',    diff:'m', name:'NetRunner Vex',   archetype:'Vétéran',
    desc:'Stratège. Sa revanche est toujours mieux préparée.',
    portrait:'assets/enemies/duel/vet.png',
    bHp:480,bSh:100,bAtk:38,rewardGems:5,rewardRarMin:'r',rewardRarMax:'e',
    spells:[{id:'vatk',name:'Salve Ionique',energy:1,type:'oAtk',pwr:1.2},{id:'vdebuf',name:'Hack Défensif',energy:1,type:'oDebuf',pwr:0.30,dur:2},{id:'vbuf',name:'Surcadençage',energy:1,type:'oBuf',pwr:0.40,dur:2},{id:'vburst',name:'Frappe Critique',energy:3,type:'oAtk',pwr:1.75}]},
  { id:'champ',  diff:'h', name:'Cyber Champion',  archetype:'Champion',
    desc:'Élite. Chaque victoire contre lui décuple sa résolution.',
    portrait:'assets/enemies/duel/champ.png',
    bHp:880,bSh:260,bAtk:85,rewardGems:12,rewardRarMin:'e',rewardRarMax:'l',
    spells:[{id:'catk',name:'Frappe Abyssale',energy:1,type:'oAtk',pwr:1.5},{id:'cdot',name:'Nanites Toxiques',energy:2,type:'oDot',pwr:0.60,dur:3},{id:'cbuf',name:'Mode Berserker',energy:2,type:'oBuf',pwr:0.80,dur:2},{id:'cinv',name:'Protocole Titan',energy:3,type:'oInv',pwr:1.0,dur:1}]},
];

var RUN_ENEMIES = {
  1:{portrait:'assets/enemies/run/drone.png'},
  2:{portrait:'assets/enemies/run/merc.png'},
  3:{portrait:'assets/enemies/run/heavy.png'},
};

// ── RELIQUES — rareté min = p (pas de commun) ─────────────────────
var RAR_WL_REL = [0, 45, 35, 15, 5];
var REL_TYPES = [
  {id:'atk', nm:"Relique d'Attaque",   effect:'atk', col:'#f86',icon:'⚔️'},
  {id:'aspd',nm:'Relique de Vitesse',  effect:'aspd',col:'#fa0',icon:'⚡'},
  {id:'vit', nm:'Relique de Vitalité', effect:'hp',  col:'#5c5',icon:'♥'},
  {id:'res', nm:'Relique de Résist.',  effect:'sh',  col:'#58e',icon:'◈'},
  {id:'rgn', nm:'Relique de Régén.',   effect:'rgn', col:'#6cf',icon:'⟳'},
  {id:'univ',nm:'Relique Universelle', effect:'all', col:'#eb2',icon:'★'},
];
var REL_BONUS = {c:0.08,p:0.15,r:0.25,e:0.40,l:0.60};

var PIECE_NAMES = {
  c:['Ferraille','Câble Usé','Chip Défaillante'],
  p:['Alliage Mineur','Circuit Renforcé'],
  r:['Alliage Quantique','Noyau Nano'],
  e:['Matrice Cybern.','Cristal Plasma'],
  l:['Noyau Absolu'],
};

// ── RECETTES CRAFT ───────────────────────────────────────────────
var RECIPES = [
  {id:'cr1', nm:'Alliage Standard',    icon:'🗡',  desc:'Forge une arme Rare.',             resultType:'arme',       req:[{type:'piece',rar:'c',count:3}],                                result:'r'},
  {id:'cr2', nm:'Forge Avancée',       icon:'⚔️', desc:'Forge un équipement Épique.',       resultType:null,         req:[{type:'piece',rar:'c',count:5},{type:'piece',rar:'r',count:2}],result:'e'},
  {id:'cr3', nm:'Œuvre Maîtresse',    icon:'✦',  desc:'Forge un item Légendaire.',          resultType:null,         req:[{type:'piece',rar:'r',count:3},{type:'piece',rar:'e',count:1}],result:'l'},
  {id:'cr4', nm:'Forge Rapide',        icon:'⚡', desc:'Forge une arme Peu Commune.',        resultType:'arme',       req:[{type:'piece',rar:'c',count:5}],                                result:'p'},
  {id:'cr5', nm:'Kit Vestimentaire',   icon:'👕', desc:'Forge un skin Rare.',               resultType:'skin',       req:[{type:'piece',rar:'c',count:4},{type:'piece',rar:'p',count:1}],result:'r'},
  {id:'cr6', nm:'Module de Mobilité', icon:'👟', desc:'Forge des chaussures Rares.',        resultType:'chaussures', req:[{type:'piece',rar:'c',count:3},{type:'piece',rar:'p',count:2}],result:'r'},
  {id:'cr7', nm:'Synthèse Neurale',    icon:'💿', desc:'Forge un implant Épique.',           resultType:'implant',    req:[{type:'piece',rar:'p',count:3},{type:'piece',rar:'r',count:1}],result:'e'},
  {id:'cr8', nm:'Propulseurs Absolus', icon:'🚀', desc:'Forge des chaussures Légendaires.', resultType:'chaussures', req:[{type:'piece',rar:'r',count:3},{type:'piece',rar:'e',count:1}],result:'l'},
  {id:'cr9', nm:'Arsenal Maîtrisé',   icon:'🔫', desc:'Forge une arme Légendaire.',         resultType:'arme',       req:[{type:'piece',rar:'r',count:2},{type:'piece',rar:'e',count:2}],result:'l'},
  {id:'cr10',nm:'Grande Transmutation',icon:'🌀', desc:'Transmute 5 Épiques en Légendaire.',resultType:null,         req:[{type:'piece',rar:'e',count:5}],                                result:'l'},
];

// ── AMÉLIORATIONS (REWORK) ────────────────────────────────────────
// 1 amélioration par stat. Boost = N × 1% du stat de base du héros.
// Niveau 100 → +100% du stat de base ajouté aux stats.
// Le calcul effectif se fait dans engine.js → computeBreakdown()
var UPGRADES = [
  {id:'up_force',stat:'atk',  name:'Augmentation Physique',  icon:'⚔️',desc:'+1% de l\'ATQ totale par niveau',  bCost:120,sc:1.55,max:100},
  {id:'up_dex',  stat:'crit', name:'Précision Cybernétique', icon:'🎯',desc:'+0.5% Critique par niveau',     bCost:140,sc:1.55,max:100},
  {id:'up_end',  stat:'hp',   name:'Renforcement Cellulaire',icon:'♥', desc:'+1% des PV totaux par niveau',   bCost:130,sc:1.55,max:100},
  {id:'up_int',  stat:'spPwr',name:'Surcadençage Neural',    icon:'🧠',desc:'+0.5% puissance sorts par niveau',        bCost:160,sc:1.60,max:100},
  {id:'up_agi',  stat:'aspd', name:'Boost de Vitesse',       icon:'⚡',desc:'+1% de la VitAtq totale par niveau',        bCost:140,sc:1.55,max:100},
  {id:'up_res',  stat:'sh',   name:'Blindage Quantique',     icon:'◈', desc:'+1% du Bouclier total par niveau',      bCost:130,sc:1.55,max:100},
  {id:'up_cha',  stat:'pros', name:'Algo. de Chance',        icon:'⭐',desc:'+0.5 Prospérité par niveau',           bCost:120,sc:1.50,max:100},
  {id:'up_per',  stat:'mult', name:'Optimiseur de Revenus',  icon:'₵', desc:'+0.5% multiplicateur crédits/niveau',       bCost:150,sc:1.60,max:100},
];

// ── BOUTIQUE (Épique + Légendaire uniquement) ─────────────────────
// getBoutDisplay() in engine.js choisit 2 items/type selon boutSeed
var BOUT = [
  // Armes
  {id:'bw3',sl:'arme',      nm:'Canon Antimatière',    icon:'🔫',rar:'e',cost:20,costCr:5000, lrq:25,st:{atk:335}},
  {id:'bw4',sl:'arme',      nm:'Faucheuse Absolue',    icon:'⚙️',rar:'l',cost:60,costCr:0,    lrq:50,st:{atk:1400,aspd:0.4}},
  {id:'bw5',sl:'arme',      nm:'Lame Plasma Rés.',     icon:'⚔️',rar:'e',cost:22,costCr:6000, lrq:30,st:{atk:280,aspd:0.15}},
  {id:'bw6',sl:'arme',      nm:'Fusil Absolu',         icon:'🔫',rar:'l',cost:65,costCr:0,    lrq:55,st:{atk:1200,aspd:0.3,crit:0.10}},
  // Skins
  {id:'bs3',sl:'skin',      nm:'Carapace Adamantine',  icon:'🦺',rar:'e',cost:25,costCr:8000, lrq:25,st:{hp:6000}},
  {id:'bs4',sl:'skin',      nm:'Armure Absolue',       icon:'🛡️',rar:'l',cost:70,costCr:0,    lrq:50,st:{hp:25000,sh:2500}},
  {id:'bs5',sl:'skin',      nm:'Exosquelette Phantom', icon:'🦺',rar:'e',cost:28,costCr:9000, lrq:35,st:{hp:4500,sh:800}},
  {id:'bs6',sl:'skin',      nm:'Nanosuit Transcendant',icon:'🛡️',rar:'l',cost:75,costCr:0,    lrq:60,st:{hp:18000,sh:4000}},
  // Implants
  {id:'bi3',sl:'implant',   nm:'NeuroLink Omega',      icon:'🔮',rar:'e',cost:30,costCr:10000,lrq:25,st:{dpct:0.40,crit:0.10,rgn:15}},
  {id:'bi4',sl:'implant',   nm:'Nexus Transcendant',   icon:'🔮',rar:'l',cost:80,costCr:0,    lrq:50,st:{dpct:0.60,crit:0.20,dodge:0.15,rgn:30}},
  {id:'bi5',sl:'implant',   nm:'Interface Quant. X',   icon:'💿',rar:'e',cost:32,costCr:11000,lrq:30,st:{dpct:0.35,aspd:0.2,crit:0.08}},
  {id:'bi6',sl:'implant',   nm:'Cortex Singularité',   icon:'🔮',rar:'l',cost:85,costCr:0,    lrq:55,st:{dpct:0.80,crit:0.25,dodge:0.20,rgn:25}},
  // Chaussures
  {id:'bc3',sl:'chaussures',nm:'Talonnettes Cyber.',   icon:'👟',rar:'e',cost:25,costCr:7000, lrq:20,st:{aspd:0.20,crit:0.05,dodge:0.08}},
  {id:'bc4',sl:'chaussures',nm:'Propulseurs Absolus',  icon:'🚀',rar:'l',cost:70,costCr:0,    lrq:50,st:{aspd:0.40,crit:0.15,dodge:0.20}},
  {id:'bc5',sl:'chaussures',nm:'Semelles Quantiques',  icon:'👟',rar:'e',cost:28,costCr:8000, lrq:28,st:{aspd:0.15,dodge:0.12,rgn:8}},
  {id:'bc6',sl:'chaussures',nm:'Grippers de Vide',     icon:'🚀',rar:'l',cost:72,costCr:0,    lrq:52,st:{aspd:0.35,crit:0.10,dodge:0.25,rgn:20}},
];

var SELL = {c:30,p:80,r:300,e:1000,l:4000};
var RAR   = {c:{lbl:'Commun',cls:'rc',m:1.0},p:{lbl:'Peu commun',cls:'rp',m:1.6},r:{lbl:'Rare',cls:'rb',m:2.8},e:{lbl:'Épique',cls:'re',m:5.0},l:{lbl:'Légend.',cls:'rl',m:9.0}};
var RAR_K = ['c','p','r','e','l'];
var RAR_W = [50,30,14,5,1];
var RAR_WL= [55,30,15,0,0];

var SDEF = [
  {id:'force',nm:'Force',       icon:'⚔️',d:'+5 ATQ/pt'},
  {id:'dex',  nm:'Dextérité',   icon:'🎯',d:'+2% Crit/pt'},
  {id:'end',  nm:'Endurance',   icon:'♥', d:'+60 PV/pt'},
  {id:'int',  nm:'Intelligence',icon:'🧠',d:'+10% sorts/pt'},
  {id:'agi',  nm:'Agilité',     icon:'💨',d:'+0.05 VitAtq +1% Esq/pt'},
  {id:'res',  nm:'Résistance',  icon:'◈', d:'+35 Bouclier/pt'},
  {id:'cha',  nm:'Chance',      icon:'⭐',d:'+3 Prospérité/pt'},
  {id:'per',  nm:'Perception',  icon:'👁️',d:'+5% crédits/kill/pt'},
];

var ENEMY_NAMES = ['Drone Sentinelle','Mercenaire Augm.','Robot Assaillant','Garde Cybernétique','Assassin Nantite','Colosse Méc.','Chasseur Prime','Cyber-Soldat'];
var LOOT_NAMES  = {
  arme:       ['Lame Plasma','Griffe Chromée','Fusil Quantique','Canon Nantite','Faucheuse Sombre','Arc Électrique'],
  skin:       ['Tissu Balistique','Plaque Chromée','Manteau Blindé','Veste Nantite','Blindage Quant.','Armure Sombre'],
  implant:    ['Puce Combat','Module Défense','Interface Quant.','Chip Overclk.','Driver Synaptique','Augment Neural'],
  chaussures: ['Bottes de Sprint','Semelles Nano','Grippers Tactiques','Amortisseurs Quant.','Talonnettes Arcs'],
};
