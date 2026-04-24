// ================================================================
// main.js v12 — Init + événements
// ================================================================
(function init(){
  recompute(); updateTop();
  document.querySelectorAll('.nb').forEach(function(b){
    b.addEventListener('click',function(){navigate(b.getAttribute('data-pg'));});
  });
  if(!META.heroId) showSel();
  else navigate('hero');
  setInterval(saveMeta, 30000);
  window.addEventListener('beforeunload', saveMeta);
  setInterval(function(){
    if(!G||G.over)return;
    if(PG==='upg')  renderUpg();
    if(PG==='bout') renderBout();
    if(PG==='craft')renderCraft();
  }, 3000);
  setInterval(function(){
    if(G&&!G.over&&PG==='home') updateHomeDynamic();
    updateTop();
  }, CFG.TICK_MS*2);
})();

// Buttons
document.getElementById('btn-rep').addEventListener('click',function(){
  document.getElementById('ov-go').classList.add('hidden');
  setNotif('run-notif-dot', false);
  G=null; startRun();
});
document.getElementById('btn-goH').addEventListener('click',function(){
  document.getElementById('ov-go').classList.add('hidden');
  setNotif('run-notif-dot', false);
  G=null; curRunType=null; SPEED=1; navigate('home');
});
document.getElementById('btn-rst').addEventListener('click',function(){
  if(!confirm('Réinitialiser toute la progression ? Irréversible.')) return;
  clearInterval(TK); TK=null; G=null; curRunType=null; DL=null; SPEED=1;
  META=mkMeta(); saveMeta();
  document.getElementById('ov-go').classList.add('hidden');
  showSel(); updateTop();
});
document.getElementById('btn-endturn').addEventListener('click', duelEndPlayerTurn);
document.getElementById('btn-duel-quit').addEventListener('click', showDuelSel);
document.getElementById('btn-duel-again').addEventListener('click',function(){showDuelSel();renderDuelSel();});
document.getElementById('btn-reroll').addEventListener('click', rerollBout);

// Main delegation
document.getElementById('main').addEventListener('click',function(e){
  var t=e.target;
  while(t&&t!==this&&t.tagName!=='BUTTON') t=t.parentNode;
  if(!t||t.tagName!=='BUTTON') return;
  var id    = t.getAttribute('data-id');
  var uid   = t.getAttribute('data-uid');
  var stat  = t.getAttribute('data-stat');
  var spell = t.getAttribute('data-spell');
  var sid   = t.getAttribute('data-sid');
  var act   = t.getAttribute('data-act');
  if(t.classList.contains('btn-upg'))  { buyUpg(id);      return; }
  if(t.classList.contains('btn-bout')) { buyBout(id);     return; }
  if(t.classList.contains('btn-eq'))   { equipIt(uid);    return; }
  if(t.classList.contains('btn-sell')) { sellItem(uid);   hideItemDetail(); return; }
  if(t.classList.contains('btn-stat')) { spendSt(stat);   return; }
  if(t.classList.contains('btn-spwr')) { upgSpPwr(spell); return; }
  if(t.classList.contains('btn-scd'))  { upgSpCd(spell);  return; }
  if(t.classList.contains('btn-cast')) { manualCast(sid); return; }
  if(t.classList.contains('btn-auto')) { toggleAutoSp(sid); if(PG==='home') updateHomeDynamic(); return; }
  if(t.classList.contains('btn-dact')) { duelPlayerAction(act); return; }
});

function selectChip(el, groupId){
  document.getElementById(groupId)
    .querySelectorAll('.cpick')
    .forEach(function(b){ b.classList.remove('active'); });
  el.classList.add('active');
}
