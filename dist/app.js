/* Browser shell for the unchanged Bleach vs Naruto 2.6 SWF. */
'use strict';
const $ = id => document.getElementById(id);
const maps = {
  1: {up:['w','KeyW',87],left:['a','KeyA',65],down:['s','KeyS',83],right:['d','KeyD',68],attack:['j','KeyJ',74],jump:['k','KeyK',75],dash:['l','KeyL',76],ranged:['u','KeyU',85],special:['i','KeyI',73],assist:['o','KeyO',79]},
  2: {up:['ArrowUp','ArrowUp',38],left:['ArrowLeft','ArrowLeft',37],down:['ArrowDown','ArrowDown',40],right:['ArrowRight','ArrowRight',39],attack:['1','Numpad1',97],jump:['2','Numpad2',98],dash:['3','Numpad3',99],ranged:['4','Numpad4',100],special:['5','Numpad5',101],assist:['6','Numpad6',102]}
};
let player = null, state = 'idle', runtimePromise = null, gameData = null, loadId = 0;
let touchPlayer = 1, volume = 70, muted = false, restartWasRunning = false, toastTimer;
const held = new Map(), pointerKeys = new Map(), releaseTimers = new Set();
try { const s = JSON.parse(localStorage.getItem('bvn26-settings') || '{}'); volume = Number.isFinite(s.volume) ? Math.max(0, Math.min(100, s.volume)) : 70; muted = s.muted === true; } catch {}
$('volume').value = volume;
function saveSettings() { try { localStorage.setItem('bvn26-settings', JSON.stringify({volume, muted})); } catch {} }
function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true, 3500); }
function updateVolume() {
  if (player) player.ruffle().volume = muted ? 0 : volume / 100;
  $('mute').textContent = muted || volume === 0 ? '♩' : '♪';
  $('mute').setAttribute('aria-pressed', String(muted || volume === 0));
  $('mute').setAttribute('aria-label', muted || volume === 0 ? '开启声音' : '静音');
  saveSettings();
}
function setState(next) {
  state = next;
  const text = {idle:'等待出战',loading:'正在加载',running:'游戏运行中',paused:'已暂停',error:'加载失败'};
  $('status').textContent = text[next];
  $('status-dot').classList.toggle('running', next === 'running');
  $('pause').disabled = !['running','paused'].includes(next);
  $('restart').disabled = !['running','paused'].includes(next);
  $('pause').innerHTML = next === 'paused' ? '▶ <span>继续</span>' : 'Ⅱ <span>暂停</span>';
  $('pause').setAttribute('aria-label', next === 'paused' ? '继续游戏' : '暂停游戏');
  $('pause-overlay').hidden = next !== 'paused';
  document.querySelectorAll('[data-action]').forEach(b => b.disabled = next !== 'running');
}
function focusGame() { if (player && state === 'running') player.focus({preventScroll:true}); }
function ensureRuntime() {
  if (window.RufflePlayer?.newest) return Promise.resolve();
  if (runtimePromise) return runtimePromise;
  window.RufflePlayer = {config:{autoplay:'on',unmuteOverlay:'hidden',splashScreen:false,allowScriptAccess:false,allowNetworking:'none',openUrlMode:'deny',logLevel:'error',letterbox:'on',backgroundColor:'#08090c',contextMenu:'off',scale:'showAll',forceScale:true}};
  runtimePromise = new Promise((resolve,reject) => {
    const script = document.createElement('script'); script.src = 'vendor/ruffle/ruffle.js';
    script.onload = () => { if (window.RufflePlayer?.newest) resolve(); else { runtimePromise = null; reject(new Error('运行库初始化失败，请刷新页面重试。')); } };
    script.onerror = () => { runtimePromise = null; script.remove(); reject(new Error('无法下载浏览器运行库，请检查网络后重试。')); };
    document.head.appendChild(script);
  });
  return runtimePromise;
}
async function downloadGame() {
  if (gameData) return gameData;
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch('game/main.swf', {signal:controller.signal});
    if (!response.ok) throw new Error(`游戏文件读取失败（HTTP ${response.status}）。`);
    const length = Number(response.headers.get('Content-Length'));
    let data;
    if (response.body?.getReader) {
      const reader = response.body.getReader(), chunks = []; let received = 0;
      while (true) { const {done,value} = await reader.read(); if (done) break; chunks.push(value); received += value.length;
        $('loading-message').textContent = `正在读取原版游戏 · ${(received/1048576).toFixed(1)} MB${length ? ' / ' + (length/1048576).toFixed(1) + ' MB' : ''}`;
        if (length) { $('load-progress').max = length; $('load-progress').value = received; }
      }
      data = new Uint8Array(received); let offset = 0; for (const chunk of chunks) { data.set(chunk,offset); offset += chunk.length; }
    } else data = new Uint8Array(await response.arrayBuffer());
    if (data.length < 8 || !['CWS','FWS','ZWS'].includes(String.fromCharCode(...data.slice(0,3)))) throw new Error('下载的文件不是有效的 SWF 游戏。');
    gameData = data; return data;
  } finally { clearTimeout(timeout); }
}
async function startGame() {
  if (state === 'loading') return;
  const id = ++loadId;
  releaseAll();
  if (player) { player.remove(); player = null; }
  setState('loading'); $('start').disabled = true; $('cover').hidden = true; $('error-overlay').hidden = true; $('loading').hidden = false;
  $('loading-message').textContent = '正在准备浏览器游戏引擎…'; $('load-progress').removeAttribute('value');
  try {
    if (location.protocol === 'file:') throw new Error('请用项目中的“启动游戏.bat”启动本地服务器，浏览器不能直接通过 file:// 加载 WebAssembly。');
    await ensureRuntime();
    const data = await downloadGame();
    if (id !== loadId) return;
    $('loading-message').textContent = '正在初始化原版 2.6…'; $('load-progress').removeAttribute('value');
    player = window.RufflePlayer.newest().createPlayer(); player.id = 'bvn-player'; player.tabIndex = 0;
    player.setAttribute('aria-label', '死神 VS 火影 2.6 游戏画面'); $('player-mount').replaceChildren(player);
    await player.ruffle().load({data:data.slice(),swfFileName:'main.swf',base:new URL('game/',location.href).href});
    if (id !== loadId) return;
    updateVolume(); $('loading').hidden = true; setState('running'); focusGame();
    $('focus-hint').textContent = '原版片头后，按 J 进入；W / S 选择';
    if (document.hidden) pauseGame();
  } catch (error) {
    if (id !== loadId) return;
    if (player) { player.remove(); player = null; }
    setState('error'); $('loading').hidden = true; $('error-overlay').hidden = false;
    $('error-message').textContent = error.name === 'AbortError' ? '下载超时，请检查网络后重试。' : error.message || '运行库初始化失败，请尝试更新 Chrome 或 Edge。';
  } finally { if (id === loadId) $('start').disabled = false; }
}
function pauseGame() {
  if (state !== 'running') return;
  releaseAll(); player.ruffle().suspend(); setState('paused'); $('focus-hint').textContent = '已暂停，点击继续回到游戏';
}
function resumeGame() {
  if (state !== 'paused') return;
  player.ruffle().resume(); setState('running'); focusGame(); $('focus-hint').textContent = 'J 确认 · K 返回 · 点击画面恢复键盘焦点';
}
// Pointer events hold keys across animation frames; each input source is counted
// separately so releasing one finger cannot release another finger's key.
function emitKey(type, mapping) {
  if (!player) return;
  const [key,code,keyCode] = mapping;
  player.dispatchEvent(new KeyboardEvent(type, {key,code,keyCode,which:keyCode,location:code.startsWith('Numpad')?3:0,bubbles:true,composed:true,cancelable:true}));
}
function holdKey(mapping, source) {
  const code = mapping[1]; let entry = held.get(code);
  if (!entry) { entry = {mapping,sources:new Set()}; held.set(code,entry); emitKey('keydown',mapping); }
  entry.sources.add(source);
}
function releaseKey(mapping, source) {
  const entry = held.get(mapping[1]); if (!entry) return;
  entry.sources.delete(source);
  if (!entry.sources.size) { emitKey('keyup',mapping); held.delete(mapping[1]); }
}
function releaseAll() {
  for (const timer of releaseTimers) clearTimeout(timer); releaseTimers.clear();
  for (const entry of held.values()) emitKey('keyup',entry.mapping);
  held.clear(); pointerKeys.clear(); document.querySelectorAll('.pressed').forEach(b => b.classList.remove('pressed'));
}
function endPointer(event, immediate = false) {
  const entry = pointerKeys.get(event.pointerId); if (!entry) return;
  pointerKeys.delete(event.pointerId);
  const finish = () => { releaseKey(entry.mapping,entry.source); if (![...pointerKeys.values()].some(e => e.button === entry.button)) entry.button.classList.remove('pressed'); };
  const delay = immediate ? 0 : Math.max(0,100-(performance.now()-entry.started));
  if (delay) { const timer = setTimeout(() => { releaseTimers.delete(timer); finish(); },delay); releaseTimers.add(timer); } else finish();
}
for (const button of document.querySelectorAll('[data-action]')) {
  button.addEventListener('pointerdown',event => {
    if (state !== 'running' || event.button > 0) return;
    event.preventDefault(); focusGame();
    const mapping = maps[touchPlayer][button.dataset.action], source = Symbol(`pointer:${event.pointerId}`);
    button.setPointerCapture(event.pointerId); pointerKeys.set(event.pointerId,{mapping,source,button,started:performance.now()});
    button.classList.add('pressed'); holdKey(mapping,source);
  });
  button.addEventListener('pointerup',endPointer);
  button.addEventListener('pointercancel', e => endPointer(e,true));
  button.addEventListener('lostpointercapture',e => endPointer(e,true));
  button.addEventListener('contextmenu',e => e.preventDefault());
  button.addEventListener('click', event => {
    // Keyboard activation of an accessible touch button.
    if (event.detail !== 0 || state !== 'running') return;
    focusGame(); const mapping = maps[touchPlayer][button.dataset.action], source = Symbol('button'); holdKey(mapping,source);
    const timer = setTimeout(() => { releaseTimers.delete(timer); releaseKey(mapping,source); },110); releaseTimers.add(timer);
  });
}
function setTouch(show) { releaseAll(); $('touch-pad').hidden = !show; $('game-shell').classList.toggle('touch-visible',show); $('touch-toggle').setAttribute('aria-pressed',String(show)); }
function renderGuide(p) {
  document.querySelectorAll('[data-player]').forEach(b => { b.setAttribute('aria-selected',String(Number(b.dataset.player)===p)); b.tabIndex = Number(b.dataset.player)===p?0:-1; });
  $('key-panel').setAttribute('aria-labelledby',`tab-p${p}`);
  $('movement-diagram').innerHTML = (p===1?['W','A','S','D']:['↑','←','↓','→']).map(k=>`<kbd>${k}</kbd>`).join('');
  $('movement-description').textContent = p===1 ? 'A / D 移动 · W / S 选择' : '← / → 移动 · ↑ / ↓ 选择';
  const labels = ['攻击 / 确认','跳跃 / 返回','冲刺','远程攻击','必杀技','召唤援助','防御'];
  const keys = p===1?['J','K','L','U','I','O','S']:['Num 1','Num 2','Num 3','Num 4','Num 5','Num 6','↓'];
  $('key-list').innerHTML = labels.map((label,i)=>`<div class="key-row"><span>${label}</span><kbd>${keys[i]}</kbd></div>`).join('');
}
$('start').addEventListener('click',startGame); $('retry').addEventListener('click',startGame);
$('pause').addEventListener('click',()=>state==='running'?pauseGame():resumeGame()); $('resume').addEventListener('click',resumeGame);
$('restart').addEventListener('click',()=>{restartWasRunning=state==='running';pauseGame();$('restart-dialog').showModal();});
$('cancel-restart').addEventListener('click',()=>{$('restart-dialog').close();if(restartWasRunning)resumeGame();});
$('restart-dialog').addEventListener('cancel',()=>{if(restartWasRunning)resumeGame();});
$('confirm-restart').addEventListener('click',()=>{$('restart-dialog').close();startGame();});
$('mute').addEventListener('click',()=>{if(volume===0){volume=70;$('volume').value=70;muted=false;}else muted=!muted;updateVolume();});
$('volume').addEventListener('input',()=>{volume=Number($('volume').value);muted=false;updateVolume();});
$('touch-toggle').addEventListener('click',()=>setTouch($('touch-pad').hidden));
$('touch-player').addEventListener('change',()=>{releaseAll();touchPlayer=Number($('touch-player').value);for(const b of document.querySelectorAll('.action-pad button'))b.querySelector('small').textContent=maps[touchPlayer][b.dataset.action][0].toUpperCase();renderGuide(touchPlayer);});
for (const tab of document.querySelectorAll('[data-player]')) {
  tab.addEventListener('click',()=>renderGuide(Number(tab.dataset.player)));
  tab.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const p=Number(tab.dataset.player)===1?2:1;renderGuide(p);$(`tab-p${p}`).focus();}});
}
$('fullscreen').addEventListener('click',async()=>{
  try { if(document.fullscreenElement) await document.exitFullscreen(); else if($('game-shell').requestFullscreen) await $('game-shell').requestFullscreen(); else toast('此浏览器不支持全屏，请使用横屏或浏览器的全屏功能。'); focusGame(); }
  catch { toast('全屏未能开启，可使用浏览器全屏或手机横屏。'); }
});
document.addEventListener('fullscreenchange',()=>{$('fullscreen').innerHTML=document.fullscreenElement?'⛶ <span>退出全屏</span>':'⛶ <span>全屏</span>';});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();});
window.addEventListener('blur',()=>{releaseAll();pauseGame();});
window.addEventListener('pagehide',releaseAll);
// Keep arrow keys inside the focused game instead of scrolling the page.
document.addEventListener('keydown',event=>{
  if(event.isTrusted && state==='running' && event.composedPath().includes(player) && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(event.key))event.preventDefault();
});
renderGuide(1); updateVolume(); setState('idle');
if(matchMedia('(pointer: coarse)').matches) setTouch(true);
