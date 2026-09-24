const $=id=>document.getElementById(id);
let settings={user_name:"Owner",theme:"dark",accent:"blue",font_size:"normal",wallpaper:"default.svg"};
const windows={}; window.windows=windows; let z=40;
let windowState={};
const WM_KEY="alice_window_state_v32";

function saveWindowState(){
  const state={};
  Object.entries(windows).forEach(([type,w])=>{
    state[type]={
      left:w.style.left, top:w.style.top, width:w.style.width, height:w.style.height,
      maximized:w.classList.contains("maximized")
    };
  });
  localStorage.setItem(WM_KEY,JSON.stringify(state));
  fetch("/api/window-state",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(state)}).catch(()=>{});
}
function updateTaskbar(){
  const host=$("taskWindows"); if(!host)return;
  host.innerHTML="";
  Object.entries(windows).forEach(([type,w])=>{
    const b=document.createElement("button"); b.className="task-chip";
    b.textContent=({home:"Home",chat:"Alice Chat",intelligence:"Alice Intelligence",files:"Files",terminal:"Terminal",skills:"Skills",settings:"Settings",vault:"Vault",devices:"Devices",security:"Security"}[type]||type);
    b.onclick=()=>{w.classList.remove("minimized");bring(w)}; host.appendChild(b);
  });
}
function addWindowControls(w,type){
  const bar=w.querySelector(".titlebar"), close=bar.querySelector(".close");
  const controls=document.createElement("div");controls.className="window-controls";
  controls.innerHTML='<button class="min" title="Minimize">—</button><button class="max" title="Maximize">□</button>';
  bar.insertBefore(controls,close);
  controls.querySelector(".min").onclick=e=>{e.stopPropagation();w.classList.add("minimized");updateTaskbar();saveWindowState()};
  controls.querySelector(".max").onclick=e=>{e.stopPropagation();w.classList.toggle("maximized");w.classList.remove("minimized");updateTaskbar();saveWindowState()};
  enableDrag(w);
}
function enableDrag(w){
  const bar=w.querySelector(".titlebar"); let drag=false,sx=0,sy=0,sl=0,st=0;
  bar.addEventListener("pointerdown",e=>{
    if(e.target.closest("button"))return;
    drag=true;sx=e.clientX;sy=e.clientY;
    const r=w.getBoundingClientRect();sl=r.left;st=r.top;bar.setPointerCapture(e.pointerId);bring(w);
  });
  bar.addEventListener("pointermove",e=>{
    if(!drag||w.classList.contains("maximized"))return;
    const dx=e.clientX-sx,dy=e.clientY-sy;
    w.style.left=(sl+dx)+"px";w.style.top=(st+dy)+"px";w.style.transform="none";
    if(e.clientY<25)showSnap("max");else if(e.clientX<25)showSnap("left");else if(e.clientX>innerWidth-25)showSnap("right");else hideSnap();
  });
  bar.addEventListener("pointerup",e=>{
    if(!drag)return;drag=false;hideSnap();
    const x=e.clientX,y=e.clientY;
    if(y<25)w.classList.add("maximized");
    else if(x<25) snapWindow(w,"left");
    else if(x>innerWidth-25) snapWindow(w,"right");
    saveWindowState();
  });
}
function showSnap(side){
  hideSnap();const g=document.createElement("div");g.className="snap-guide";g.id="snapGuide";
  g.style.left=side==="right"?"50%":"0";g.style.top="78px";g.style.width=side==="max"?"100%":"50%";g.style.height="calc(100% - 78px)";document.body.appendChild(g);
}
function hideSnap(){const g=$("snapGuide");if(g)g.remove()}
function snapWindow(w,side){
  w.classList.remove("maximized");w.style.transform="none";w.style.top="78px";w.style.height="calc(100vh - 170px)";
  w.style.left=side==="right"?"50px":"50px";
  w.style.width="calc(50vw - 50px)";
  if(side==="right")w.style.left="50vw";
}

async function api(path, options={}) {
  const r=await fetch(path,{headers:{"Content-Type":"application/json"},...options});
  const data=await r.json(); if(!r.ok) throw new Error(data.error||"Request failed"); return data;
}

function toast(title,message){
 const area=$("toastArea"); if(!area)return;
 const t=document.createElement("div");t.className="toast";
 t.innerHTML=`<b>${escapeHtml(title)}</b><span>${escapeHtml(message)}</span>`;
 area.appendChild(t);setTimeout(()=>t.remove(),4200);
}
function escapeHtml(x){return String(x).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}


async function setupOwnerPassword(){
 const owner=($("setupOwner")?.value||"Owner").trim();
 const p=$("setupPassword")?.value||"", c=$("setupPasswordConfirm")?.value||"";
 if(p!==c){toast("Security","Passwords do not match.");return}
 try{await api("/api/auth/setup",{method:"POST",body:JSON.stringify({owner,password:p})});toast("Security","Owner password created.");}
 catch(e){toast("Security",e.message)}
}
async function changeOwnerPassword(){
 const current=$("currentPassword")?.value||"", p=$("newPassword")?.value||"", c=$("newPasswordConfirm")?.value||"";
 if(p!==c){toast("Security","New passwords do not match.");return}
 try{await api("/api/auth/change",{method:"POST",body:JSON.stringify({current,new:p})});toast("Security","Password changed.");}
 catch(e){toast("Security",e.message)}
}
async function legacyUnlockAlice(){
 const p=$("unlockPassword").value;
 try{const d=await api("/api/auth/verify",{method:"POST",body:JSON.stringify({password:p})});
  if(d.ok){$("lockScreen").classList.add("hidden");$("unlockPassword").value="";localStorage.setItem("alice_locked","0")}
  else $("unlockMsg").textContent="Incorrect password.";
 }catch(e){$("unlockMsg").textContent=e.message}
}
function legacyLockAlice(){
 $("lockScreen").classList.remove("hidden");
 $("unlockMsg").textContent="";
 localStorage.setItem("alice_locked","1");
 updateLockClock();
}
function updateLockClock(){
 const now=new Date();const t=now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
 const d=now.toLocaleDateString([], {weekday:"long",month:"long",day:"numeric"});
 if($("lockTime"))$("lockTime").textContent=t;if($("lockDate"))$("lockDate").textContent=d;
}
function toggleNotifications(){$("notificationPanel").classList.toggle("hidden");$("quickPanel").classList.add("hidden")}
function toggleQuickSettings(){$("quickPanel").classList.toggle("hidden");$("notificationPanel").classList.add("hidden")}

async function refreshSystemReal(){
  try{
    const d=await api("/api/system");
    const cpu=document.querySelector("[data-system='cpu']");
    const ram=document.querySelector("[data-system='ram']");
    const storage=document.querySelector("[data-system='storage']");
    if(cpu && d.cpu_percent!=null) cpu.textContent=d.cpu_percent+"%";
    if(ram && d.ram_percent!=null) ram.textContent=d.ram_percent+"%";
    if(storage) storage.textContent=d.storage_percent+"%";
    document.querySelectorAll("[data-system-bar]").forEach(el=>{
      const key=el.dataset.systemBar, val=key==="cpu"?d.cpu_percent:key==="ram"?d.ram_percent:d.storage_percent;
      if(val!=null) el.style.width=Math.max(2,Math.min(100,val))+"%";
    });
  }catch(e){}
}
async function routeAliceCommand(text){
 try{
   const d=await api("/api/command",{method:"POST",body:JSON.stringify({text})});
   if(d.action==="open")openWindow(d.target);
   else toast("Alice",d.message||"Done.");
 }catch(e){toast("Alice",e.message)}
}
function tick(){
 const d=new Date();
 const t=d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
 const shortDate=d.toLocaleDateString([], {weekday:"short",month:"short",day:"numeric",year:"numeric"});
 const longDate=d.toLocaleDateString([], {weekday:"long",month:"long",day:"numeric",year:"numeric"});
 [$("clock"),$("bigClock")].forEach(el=>{if(el)el.textContent=t;});
 [$("clockDate")].forEach(el=>{if(el)el.textContent=shortDate;});
 [$("date")].forEach(el=>{if(el)el.textContent=longDate;});
}
setInterval(tick,1000);tick();

function toggleStart(){$("startMenu").classList.toggle("hidden")}
function bring(w){Object.values(windows).forEach(x=>x.classList.remove("active"));w.classList.remove("minimized");w.classList.add("active");w.style.zIndex=++z;updateTaskbar()}
function openWindow(type){
 $("startMenu").classList.add("hidden");
 if(windows[type]){bring(windows[type]);return}
 const w=document.createElement("div");w.className="window";w.innerHTML=windowHTML(type);$("windows").appendChild(w);windows[type]=w;
 w.addEventListener("mousedown",()=>bring(w));w.querySelector(".close").onclick=()=>{w.remove();delete windows[type];updateTaskbar();saveWindowState()};
 addWindowControls(w,type);
 if(type==="terminal") initTerminal(w); if(type==="intelligence") initIntelligence(w); if(type==="settings") initSettings(w); if(type==="skills") initSkills(w);
 if(type==="chat") initChat(w); if(type==="devices") initDevices(w); if(type==="security") initSecurity(w);
 if(type==="files") initFiles(w); if(type==="vault") initVault(w); if(type==="home") initHome(w); if(type==="browser") initBrowser(w);
 bring(w);updateTaskbar();saveWindowState();
}
function windowHTML(type){const names={home:"Alice Home",files:"Files & Data",chat:"Alice Chat",terminal:"Alice Terminal",skills:"Skills & Tools",settings:"Settings",vault:"Memory Vault",devices:"Devices & Locator",security:"Security Lab",browser:"Browser",calculator:"Calculator",notepad:"Notepad",paint:"Paint",camera:"Camera",media:"Media Player",calendar:"Calendar"};return `<div class="titlebar"><strong>${names[type]||"Alice"}</strong><button class="close">✕</button></div><div class="window-content" id="content-${type}"></div>`}

async function initBrowser(w){
 const c=w.querySelector(".window-content");
 c.innerHTML=`<div class="alice-browser">
   <div class="browser-toolbar">
    <button class="browser-nav" id="brBack" title="Back">‹</button>
    <button class="browser-nav" id="brForward" title="Forward">›</button>
    <button class="browser-nav" id="brReload" title="Reload">↻</button>
    <button class="browser-home" id="brHome" title="Alice Internet home">⌂</button>
    <div class="browser-address-wrap"><span class="browser-lock">●</span><input id="brAddress" placeholder="Search the web or enter an address" autocomplete="off"></div>
    <select id="brEngine" class="browser-engine" aria-label="Search engine"><option value="duckduckgo">DuckDuckGo</option><option value="google">Google</option></select>
    <button class="primary-btn browser-go" id="brGo">Search</button>
    <button class="browser-external" id="brExternal" title="Open in system browser">↗</button>
   </div>
   <div class="browser-subbar"><span class="alice-internet-badge">A</span><b>Alice Internet</b><span class="browser-state" id="brState">Checking network…</span><button id="brEnable" class="primary-btn hidden">Enable network</button></div>
   <div class="browser-view" id="brView"><div class="browser-welcome"><div class="browser-logo">A</div><h2>Alice Internet</h2><p>Search with DuckDuckGo or choose Google. Network access is controlled by Alice.</p><div class="browser-quick"><button data-q="latest technology news">Technology</button><button data-q="weather Ghana">Weather</button><button data-q="Python documentation">Python</button><button data-q="Alice OS">Alice OS</button></div><small>Privacy-first: Alice does not store your web searches.</small></div></div>
 </div>`;
 const addr=c.querySelector('#brAddress'), engine=c.querySelector('#brEngine'), view=c.querySelector('#brView'), state=c.querySelector('#brState'), enable=c.querySelector('#brEnable');
 let current=''; let network=false;
 const searchUrl=(q)=>engine.value==='google'?`https://www.google.com/search?q=${encodeURIComponent(q)}`:`https://duckduckgo.com/?q=${encodeURIComponent(q)}`;
 const isUrl=(v)=>/^https?:\/\//i.test(v)||/^[a-z0-9.-]+\.[a-z]{2,}([/:?#]|$)/i.test(v);
 async function checkNetwork(){try{const d=await api('/api/network/status');network=!!d.enabled;state.textContent=network?'● Network enabled':'● Network disabled';state.className='browser-state '+(network?'online':'offline');enable.classList.toggle('hidden',network);if(!network)showWelcome();}catch(e){state.textContent='Network status unavailable';}}
 function showWelcome(){view.innerHTML=`<div class="browser-welcome"><div class="browser-logo">A</div><h2>Alice Internet</h2><p>Network access is currently disabled.</p><button class="primary-btn" id="brWelcomeEnable">Enable Network</button><small>Enabling network is an explicit Alice OS setting.</small></div>`;view.querySelector('#brWelcomeEnable')?.addEventListener('click',enableNetwork);}
 async function enableNetwork(){try{const d=await api('/api/network/toggle',{method:'POST',body:JSON.stringify({enabled:true})});network=!!d.enabled;await checkNetwork();if(network)navigate(addr.value||'');}catch(e){toast('Alice Internet',e.message)}}
 function normalize(v){v=v.trim();if(!v)return '';if(isUrl(v))return /^https?:\/\//i.test(v)?v:'https://'+v;return searchUrl(v)}
 function navigate(value){if(!network){toast('Alice Internet','Enable Network access first.');return}const url=normalize(value);if(!url)return;current=url;addr.value=url;view.innerHTML=`<iframe class="browser-frame" id="brFrame" title="Alice Internet" src="${escapeHtml(url)}"></iframe><div class="browser-fallback"><span>Some sites block embedded viewing.</span><button id="brOpenExternal" class="primary-btn">Open externally</button></div>`;view.querySelector('#brOpenExternal').onclick=()=>window.open(url,'_blank','noopener');}
 c.querySelector('#brGo').onclick=()=>navigate(addr.value);
 addr.addEventListener('keydown',e=>{if(e.key==='Enter')navigate(addr.value)});
 engine.addEventListener('change',()=>{if(addr.value && !isUrl(addr.value))navigate(addr.value)});
 c.querySelector('#brReload').onclick=()=>{const f=view.querySelector('#brFrame');if(f)f.src=f.src;else navigate(current||'')};
 c.querySelector('#brHome').onclick=()=>{current='';addr.value='';showWelcome()};
 c.querySelector('#brBack').onclick=()=>{const f=view.querySelector('#brFrame');try{f?.contentWindow.history.back()}catch(e){}};
 c.querySelector('#brForward').onclick=()=>{const f=view.querySelector('#brFrame');try{f?.contentWindow.history.forward()}catch(e){}};
 c.querySelector('#brExternal').onclick=()=>{if(current)window.open(current,'_blank','noopener');else window.open(searchUrl('Alice OS'),'_blank','noopener')};
 enable.onclick=enableNetwork;
 c.querySelectorAll('.browser-quick button').forEach(b=>b.onclick=()=>{addr.value=b.dataset.q;navigate(b.dataset.q)});
 await checkNetwork();
}

function initHome(w){w.querySelector(".window-content").innerHTML="<h2>Alice OS</h2><p>Your offline command center. Use the Start menu or dock to open tools.</p><div class='card'><b>Notebook integration: active</b><p class='muted'>Python core • terminal • skills • security • devices • voice/AI adapters • offline mode</p></div>"}
function initChat(w){w.querySelector(".window-content").innerHTML=`<h2>Alice Chat</h2><p class="muted">Local system assistant — no cloud request is made.</p><div class="card"><div class="panel-row"><b>System-aware assistant</b><button class="primary-btn" onclick="chatQuickStatus()">System status</button></div><div id="chatOut" class="chat-output">Ready. Try “Alice status”, “security status”, “recent events”, or “recommendations”.</div><div class="chat-row"><input id="chatInput" placeholder="Ask Alice…" autocomplete="off"><button onclick="chatSend()">Send</button></div></div>`;w.querySelector("#chatInput")?.focus()}
async function chatQuickStatus(){const q=$("chatInput");if(q){q.value="Alice status";await chatSend()}}
async function chatSend(){
 const q=$("chatInput").value.trim(); if(!q){$("chatOut").textContent="Type something first.";return}
 $("chatInput").value="";$("chatOut").textContent="Alice is thinking locally…";
 try{const d=await api("/api/command",{method:"POST",body:JSON.stringify({text:q})});
   if(d.action==="open"||d.target){if(d.target==="lock"){window.lockAlice?.();}else if(d.target)openWindow(d.target);}
   $("chatOut").textContent=d.message||"Done.";
 }catch(e){$("chatOut").textContent=e.message}
}
async function initSkills(w){const c=w.querySelector(".window-content");c.innerHTML="<h2>Skills & Tools</h2><p class='muted'>Each skill maps to a backend module.</p><div id='skillList'>Loading...</div>";try{const d=await api("/api/notebook/skills");$("skillList").innerHTML=d.skills.map(s=>`<div class="skill"><b>${s.name}</b><br><span class="muted">${s.status} • ${s.mode}</span><p class="muted">${escapeHtml(s.description||"")}</p></div>`).join("")}catch(e){$("skillList").textContent=e.message}}
async function initIntelligence(w){
 const c=w.querySelector(".window-content");
 c.innerHTML=`<h2>Alice Intelligence</h2><p class="muted">The local brain that connects commands to offline skills.</p><div class="card"><b>Offline Core</b><p id="intelStatus" class="muted">Checking…</p></div><div class="card"><b>Local Memory</b><p id="intelMemory" class="muted">Loading…</p></div><div class="card"><b>Example commands</b><p class="muted">“Open Terminal” · “System status” · “Remember …” · “Show skills” · “Offline status” · “What time is it?”</p></div>`;
 try{const d=await api("/api/intelligence/status");$("intelStatus").textContent=`Version ${d.version} • offline ${d.offline?"ON":"OFF"} • ${d.history_items} command records`;$("intelMemory").textContent=`${d.memory_items} local memory item(s)`}catch(e){$("intelStatus").textContent=e.message}
}
async function initDevices(w){const c=w.querySelector(".window-content");c.innerHTML=`<h2>Devices & Locator</h2><div id="loc" class="card">Checking...</div><div class="setting-row"><span>Satellite View</span><span class="muted">Adapter</span></div><div class="setting-row"><span>Phone / Watch / Earbuds</span><span class="muted">Pairing adapter</span></div><div class="setting-row"><span>Contact Lens View</span><span class="muted">Future AR interface</span></div>`;try{const d=await api("/api/locator/status");$("loc").innerHTML=`<b>${d.message}</b><p class="muted">Tracking: ${d.tracking?"active":"off"}</p>`}catch(e){$("loc").textContent=e.message}}
function initSecurity(w){const c=w.querySelector(".window-content");c.innerHTML=`<h2>Security & Protection</h2><p class="muted">Owner-controlled protection for this PC. Camera and phone alerts are opt-in.</p><div class="skill"><b>Real-time system protection</b><br><span class="muted">Alice monitors local system status and security events.</span></div><div class="setting-row"><span>Camera capture after failed unlock</span><input id="secCamera" type="checkbox"></div><div class="setting-row"><span>Phone security alerts</span><input id="secPhone" type="checkbox"></div><label class="muted">Owner-configured HTTPS phone notification webhook<input id="secWebhook" placeholder="https://your-notification-service/..." style="width:100%;margin-top:6px"></label><button id="secSave" class="primary-btn">Save protection settings</button><div id="secStatus" class="card">Loading security status…</div><div class="skill"><b>Permission control</b><br><span class="muted">Alice requests camera permission through the browser/host OS. Network alerts only work after you explicitly enable Network access.</span></div>`;initSecurityAlerts(c)}
async function initFiles(w){
 const c=w.querySelector(".window-content");
 c.innerHTML=`
 <div class="win-file-manager">
  <aside class="fm-nav">
   <div class="fm-nav-title">Home</div>
   <button class="fm-nav-item active" data-path=""><span class="fm-nav-icon">${win11Icon('home')}</span><span>Home</span></button>
   <button class="fm-nav-item" data-path="workspace"><span class="fm-nav-icon">${win11Icon('files')}</span><span>Alice Workspace</span></button>
   <button class="fm-nav-item" data-special="downloads"><span class="fm-nav-icon">${win11Icon('software')}</span><span>Downloads</span></button>
   <button class="fm-nav-item" data-special="pictures"><span class="fm-nav-icon">${win11Icon('paint')}</span><span>Pictures</span></button>
   <button class="fm-nav-item" data-special="documents"><span class="fm-nav-icon">${win11Icon('note')}</span><span>Documents</span></button>
   <button class="fm-nav-item" data-special="recycle"><span class="fm-nav-icon">${win11Icon('security')}</span><span>Recycle Bin</span></button>
   <div class="fm-nav-title fm-space">This PC</div>
   <button class="fm-nav-item" data-path=""><span class="fm-nav-icon">${win11Icon('devices')}</span><span>Local Alice System</span></button>
   <div class="fm-nav-title fm-space">Network</div>
   <button class="fm-nav-item" id="fmNetwork"><span class="fm-nav-icon">${win11Icon('network')}</span><span>Network</span></button>
  </aside>
  <section class="fm-main">
   <div class="fm-commandbar">
    <button class="fm-round" id="fmBack" title="Back">‹</button><button class="fm-round" id="fmForward" title="Forward">›</button><button class="fm-round" id="fmUp" title="Up">↑</button>
    <div class="fm-address"><span>${win11Icon('files')}</span><input id="fmPathInput" aria-label="Address bar"></div>
    <div class="fm-search"><span>${win11Icon('search')}</span><input id="fmSearch" placeholder="Search this PC"></div>
   </div>
   <div class="fm-commandstrip">
    <button id="fmNew"><span>＋</span> New</button><button id="fmCut" disabled>Cut</button><button id="fmCopy" disabled>Copy</button><button id="fmPaste" disabled>Paste</button><button id="fmRename" disabled>Rename</button><button id="fmShare" disabled>Share</button><button id="fmDelete" disabled>Delete</button><button id="fmMore">•••</button>
    <span class="fm-spacer"></span><button id="fmSort">Sort</button><button id="fmView">View</button><button id="fmDetails">Details</button>
   </div>
   <div class="fm-breadcrumb" id="fmBreadcrumb"></div>
   <div class="fm-body">
    <div class="fm-list-wrap"><div id="fmList" class="fm-list"></div><div id="fmEmpty" class="fm-empty hidden">This folder is empty</div></div>
    <aside id="fmPreview" class="fm-preview"><div class="fm-preview-empty">Select an item to see details</div></aside>
   </div>
   <div class="fm-statusbar"><span id="fmStatus">0 items</span><span id="fmSelection">No selection</span></div>
  </section>
 </div>
 <div id="fmContext" class="fm-context hidden"></div>
 <div id="fmMoreMenu" class="fm-menu hidden"><button data-cmd="refresh">Refresh</button><button data-cmd="newfolder">New folder</button><button data-cmd="upload">Upload files</button><button data-cmd="properties">Properties</button></div>
 <input id="fmUpload" type="file" multiple hidden>`;
 let current="", history=[], hIndex=-1, selected=null, clipboard=null, view="details", sort="name";
 const list=()=>$("fmList"), status=()=>$("fmStatus");
 const iconFor=item=>item.type==='folder'?win11Icon('files'):(/^\.(png|jpg|jpeg|webp|gif|svg)$/i.test(item.extension)?win11Icon('paint'):win11Icon('note'));
 const setButtons=()=>['fmCut','fmCopy','fmRename','fmShare','fmDelete'].forEach(id=>{const b=$(id);if(b)b.disabled=!selected});
 function pathParts(p){return p? p.split('/').filter(Boolean):[]}
 function renderCrumb(){const parts=pathParts(current);$("fmPathInput").value=current?`Alice OS / ${parts.join(' / ')}`:'Alice OS';$("fmBreadcrumb").innerHTML=`<button data-p="">Home</button>`+parts.map((x,i)=>`<span>›</span><button data-p="${escapeHtml(parts.slice(0,i+1).join('/'))}">${escapeHtml(x)}</button>`).join('');$("fmBreadcrumb").querySelectorAll('button').forEach(b=>b.onclick=()=>navigate(b.dataset.p,true));}
 function select(item){selected=item;setButtons();renderPreview();document.querySelectorAll('.fm-row').forEach(r=>r.classList.toggle('selected',r.dataset.path===item?.path));}
 async function renderPreview(){const p=$("fmPreview");if(!selected){p.innerHTML='<div class="fm-preview-empty">Select an item to see details</div>';return;}const img=/\.(png|jpg|jpeg|webp|gif|svg)$/i.test(selected.extension);p.innerHTML=`<div class="fm-preview-icon">${iconFor(selected)}</div>${img?`<img class="fm-preview-image" src="/api/files/raw?path=${encodeURIComponent(selected.path)}" alt="">`:''}<h3>${escapeHtml(selected.name)}</h3><div class="fm-prop"><span>Type</span><b>${selected.type==='folder'?'Folder':(selected.extension||'File')}</b></div><div class="fm-prop"><span>Size</span><b>${selected.type==='folder'?'—':formatBytes(selected.size)}</b></div><div class="fm-prop"><span>Location</span><b>${escapeHtml(selected.path)}</b></div><div class="fm-preview-actions"><button id="fmPreviewOpen">${selected.type==='folder'?'Open':'Open'}</button><button id="fmPreviewProp">Properties</button></div>`;$("fmPreviewOpen").onclick=()=>openSelected();$("fmPreviewProp").onclick=()=>showProperties(selected);}
 function formatBytes(n){if(!n)return '0 KB';const u=['B','KB','MB','GB','TB'];let i=0,x=n;while(x>=1024&&i<u.length-1){x/=1024;i++}return `${x<10&&i?x.toFixed(1):Math.round(x)} ${u[i]}`}
 function typeLabel(x){return x.type==='folder'?'File folder':(x.extension?x.extension.slice(1).toUpperCase()+' file':'File')}
 function render(items){items=[...items].sort((a,b)=>sort==='type'?String(a.type).localeCompare(b.type)||a.name.localeCompare(b.name):sort==='size'?(b.size-a.size)||a.name.localeCompare(b.name):a.name.localeCompare(b.name));list().innerHTML='';$("fmEmpty").classList.toggle('hidden',items.length!==0);items.forEach(item=>{const r=document.createElement('div');r.className='fm-row';r.dataset.path=item.path;r.innerHTML=`<div class="fm-name-cell"><span class="fm-item-icon">${iconFor(item)}</span><span class="fm-name">${escapeHtml(item.name)}</span></div><div>${escapeHtml(typeLabel(item))}</div><div>${item.type==='folder'?'':formatBytes(item.size)}</div><div>${new Date(item.modified*1000).toLocaleString()}</div>`;r.ondblclick=()=>item.type==='folder'?navigate(item.path,true):openFile(item);r.onclick=e=>{e.stopPropagation();select(item)};r.oncontextmenu=e=>{e.preventDefault();select(item);showContext(e.clientX,e.clientY)};list().appendChild(r)});status().textContent=`${items.length} item${items.length===1?'':'s'}`;setButtons();}
 async function load(path=current, push=true){try{const d=await api('/api/files?path='+encodeURIComponent(path));current=d.path==='.'?'':d.path;if(push){history=history.slice(0,hIndex+1);history.push(current);hIndex=history.length-1}selected=null;setButtons();render(d.items);renderCrumb();renderPreview();document.querySelectorAll('.fm-nav-item').forEach(b=>b.classList.toggle('active',b.dataset.path===current));}catch(e){toast('File Explorer',e.message)}}
 async function search(q){if(!q){return load(current,false)}try{const d=await api('/api/files/search?q='+encodeURIComponent(q)+'&path='+encodeURIComponent(current));render(d.items);$("fmPathInput").value=`Search results for “${q}”`;$("fmStatus").textContent=`${d.items.length} result(s)`;}catch(e){toast('Search',e.message)}}
 async function navigate(p,push=true){await load(p,push)}
 async function openSelected(){if(!selected)return;if(selected.type==='folder')return navigate(selected.path,true);return openFile(selected)}
 async function openFile(item){const ext=item.extension; if(/\.(png|jpg|jpeg|webp|gif|svg)$/i.test(ext)){const win=document.createElement('div');win.className='fm-modal';win.innerHTML=`<div class="fm-modal-card"><button class="fm-modal-close">×</button><img src="/api/files/raw?path=${encodeURIComponent(item.path)}" alt="${escapeHtml(item.name)}"><h3>${escapeHtml(item.name)}</h3></div>`;document.body.appendChild(win);win.querySelector('.fm-modal-close').onclick=()=>win.remove();return;}try{const d=await api('/api/files/content?path='+encodeURIComponent(item.path));if(d.content!==undefined){const modal=document.createElement('div');modal.className='fm-modal';modal.innerHTML=`<div class="fm-modal-card fm-text-preview"><button class="fm-modal-close">×</button><h3>${escapeHtml(item.name)}</h3><pre>${escapeHtml(d.content)}</pre></div>`;document.body.appendChild(modal);modal.querySelector('.fm-modal-close').onclick=()=>modal.remove();}else window.open('/api/files/download?path='+encodeURIComponent(item.path),'_blank')}catch(e){window.open('/api/files/download?path='+encodeURIComponent(item.path),'_blank')}}
 async function action(cmd){if(cmd==='refresh')return load(current,false);if(cmd==='newfolder'){const name=prompt('New folder name:','New folder');if(name)try{await api('/api/files/create-folder',{method:'POST',body:JSON.stringify({path:current,name})});load(current,false)}catch(e){toast('New folder',e.message)}return;}if(cmd==='upload'){return $("fmUpload").click()}if(cmd==='properties'&&selected)return showProperties(selected)}
 async function showProperties(item){alert(`${item.name}\n\nType: ${typeLabel(item)}\nSize: ${item.type==='folder'?'—':formatBytes(item.size)}\nLocation: ${item.path}\nModified: ${new Date(item.modified*1000).toLocaleString()}`)}
 function showContext(x,y){const m=$("fmContext");m.innerHTML=`<button data-c="open">Open</button><button data-c="rename">Rename</button><button data-c="copy">Copy</button><button data-c="cut">Cut</button><button data-c="delete">Delete</button><button data-c="properties">Properties</button>`;m.style.left=Math.min(x,window.innerWidth-190)+'px';m.style.top=Math.min(y,window.innerHeight-250)+'px';m.classList.remove('hidden');m.querySelectorAll('button').forEach(b=>b.onclick=()=>{m.classList.add('hidden');command(b.dataset.c)});}
 async function command(cmd){if(!selected)return;if(cmd==='open')return openSelected();if(cmd==='rename'){const n=prompt('Rename:',selected.name);if(!n||n===selected.name)return;try{await api('/api/files/rename',{method:'POST',body:JSON.stringify({path:selected.path,name:n})});load(current,false)}catch(e){toast('Rename',e.message)}}else if(cmd==='copy'||cmd==='cut'){clipboard={...selected,mode:cmd};toast('File Explorer',`${selected.name} ${cmd==='copy'?'copied':'cut'}.`)}else if(cmd==='delete'){if(confirm(`Move “${selected.name}” to Recycle Bin?`)){try{await api('/api/files/delete',{method:'POST',body:JSON.stringify({path:selected.path})});load(current,false)}catch(e){toast('Delete',e.message)}}}else if(cmd==='properties')showProperties(selected)}
 $("fmBack").onclick=()=>{if(hIndex>0){hIndex--;load(history[hIndex],false)}};$("fmForward").onclick=()=>{if(hIndex<history.length-1){hIndex++;load(history[hIndex],false)}};$("fmUp").onclick=()=>{if(!current)return;const a=current.split('/');a.pop();navigate(a.join('/'),true)};
 $("fmPathInput").onkeydown=e=>{if(e.key==='Enter'){let p=e.target.value.replace(/^Alice OS\s*\/\s*/i,'').trim();navigate(p,false)}};
 let searchTimer;$("fmSearch").oninput=e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>search(e.target.value.trim()),220)};
 $("fmNew").onclick=()=>action('newfolder');$("fmMore").onclick=()=>$("fmMoreMenu").classList.toggle('hidden');$("fmMoreMenu").querySelectorAll('button').forEach(b=>b.onclick=()=>{$("fmMoreMenu").classList.add('hidden');action(b.dataset.cmd)});
 $("fmSort").onclick=()=>{sort=sort==='name'?'type':sort==='type'?'size':'name';load(current,false)};$("fmView").onclick=()=>{view=view==='details'?'grid':'details';list().classList.toggle('fm-grid-view',view==='grid');};$("fmDetails").onclick=()=>$("fmPreview").classList.toggle('hidden');
 $("fmRename").onclick=()=>command('rename');$("fmDelete").onclick=()=>command('delete');$("fmCopy").onclick=()=>command('copy');$("fmCut").onclick=()=>command('cut');$("fmShare").onclick=()=>selected&&toast('Share',`Sharing is available for local files. ${selected.name} can be copied to another Alice folder.`);$("fmPaste").onclick=async()=>{if(!clipboard)return;try{if(clipboard.mode==='copy')await api('/api/files/copy',{method:'POST',body:JSON.stringify({source:clipboard.path,destination:current})});else await api('/api/files/move',{method:'POST',body:JSON.stringify({source:clipboard.path,destination:current})});clipboard=null;load(current,false)}catch(e){toast('Paste',e.message)}};
 $("fmUpload").onchange=async e=>{for(const f of [...e.target.files]){const reader=new FileReader();await new Promise((resolve,reject)=>{reader.onload=async()=>{try{await api('/api/files/upload',{method:'POST',body:JSON.stringify({path:current,name:f.name,data:String(reader.result).split(',')[1]})});resolve()}catch(err){toast('Upload',err.message);resolve()}};reader.onerror=reject;reader.readAsDataURL(f)});}e.target.value='';load(current,false)};
 $("fmList").onclick=e=>{if(e.target===list()||!e.target.closest('.fm-row'))select(null)};document.querySelectorAll('.fm-nav-item').forEach(b=>b.onclick=()=>b.dataset.path!==undefined?navigate(b.dataset.path,true):toast('Network','Network browser is available through System Control.'));
 document.addEventListener('click',e=>{if(!e.target.closest('.fm-context'))$("fmContext").classList.add('hidden');if(!e.target.closest('#fmMore')&&!e.target.closest('#fmMoreMenu'))$("fmMoreMenu").classList.add('hidden')},{once:false});
 await load('',true);
}

function initVault(w){w.querySelector(".window-content").innerHTML=`<h2>Memory Vault</h2><p>Local Alice settings and notes are stored on this computer.</p><div class="card">Sensitive future vault data should be encrypted before production use.</div>`}

async function openSystemSoftwareCenter(){
 $("systemSoftwarePanel").classList.remove("hidden");
 await loadNetworkInterfaces(); await loadPackageManagers();
}
function closeSystemSoftwareCenter(){ $("systemSoftwarePanel").classList.add("hidden"); }
async function loadNetworkInterfaces(){
 const el=$("networkInterfaces"); if(!el)return; el.textContent="Loading…";
 try{const d=await api("/api/network/interfaces");el.innerHTML=(d.interfaces||[]).map(x=>`<div class="network-line"><b>${escapeHtml(x.name)}</b><span>${x.up===true?"Online":x.up===false?"Offline":"Unknown"}</span><small>${(x.addresses||[]).map(a=>escapeHtml(a.address)).join(" • ")||"No IP address reported"}</small></div>`).join("")||"No adapters reported."}catch(e){el.textContent=e.message}
}
async function loadPackageManagers(){
 const el=$("managerList"); if(!el)return; el.textContent="Checking…";
 try{const d=await api("/api/software/managers");el.innerHTML=Object.entries(d.managers||{}).map(([n,p])=>`<div class="network-line"><b>${escapeHtml(n)}</b><span>${p?"Available":"Not detected"}</span><small>${p?escapeHtml(p):""}</small></div>`).join("")}catch(e){el.textContent=e.message}
}
async function installPackage(){
 const id=$("packageId").value.trim(); if(!id)return toast("Software","Enter a package ID first.");
 if(!confirm(`Install ${id} using the detected local package manager?`))return;
 try{const d=await api("/api/software/manager",{method:"POST",body:JSON.stringify({action:"install",package_id:id})});$("packageOutput").textContent=(d.stdout||"")+(d.stderr||"");toast("Software",d.ok?"Installation command completed.":"Installation did not complete successfully.")}catch(e){toast("Software",e.message)}
}
async function packageList(){try{const d=await api("/api/software/manager",{method:"POST",body:JSON.stringify({action:"list"})});$("packageOutput").textContent=(d.stdout||"")+(d.stderr||"")}catch(e){$("packageOutput").textContent=e.message}}
async function packageUpgrade(){try{const d=await api("/api/software/manager",{method:"POST",body:JSON.stringify({action:"upgrade"})});$("upgradeOutput").textContent=(d.stdout||"")+(d.stderr||"")}catch(e){$("upgradeOutput").textContent=e.message}}

function initTerminal(w){
 w.querySelector(".window-content").innerHTML=`<div class="terminal"><div class="terminal-out" id="termOut">Alice Terminal v5.7\nOffline local bridge ready.\nType "help" for permitted commands.\n\n</div><div class="terminal-row"><span>alice&gt;&nbsp;</span><input id="termInput" autofocus></div></div>`;
 const input=w.querySelector("#termInput");input.addEventListener("keydown",async e=>{if(e.key==="Enter"){const cmd=input.value;input.value="";await termCommand(cmd,w)}});input.focus();
}
async function termCommand(cmd,w){
 const out=w.querySelector("#termOut");out.textContent+=`alice> ${cmd}\n`;
 if(cmd.trim().toLowerCase()==="help"){out.textContent+="help, pwd, dir, ls, whoami, systeminfo, ipconfig, python, git, echo\n\n";return}
 try{const d=await api("/api/terminal",{method:"POST",body:JSON.stringify({command:cmd})});out.textContent+=(d.stdout||"")+(d.stderr||"")+"\n"}catch(e){out.textContent+=e.message+"\n"}out.scrollTop=out.scrollHeight;
}

async function initSettings(w){
 const c=w.querySelector(".window-content");c.innerHTML=`<h2>Settings</h2>
 <div class="setting-row"><span>Owner name</span><input id="nameSet" value="${settings.user_name}"></div>
 <div class="setting-row"><span>Wallpaper</span><button id="wallBtn">Choose image</button></div>
 <div class="setting-row"><span>Theme</span><select id="themeSet"><option value="dark">Dark</option><option value="light">Light</option></select></div>
 <div class="setting-row"><span>Password</span><button id="passBtn">Set / Change password</button></div>
 <div class="setting-row"><span>Offline mode</span><b>ON</b></div>
 <div class="setting-row"><span>Locator permission</span><button id="locPerm">Review permission</button></div>
 <div class="setting-row"><span>Auto-lock</span><select id="autoLock"><option value="5">5 minutes</option><option value="10">10 minutes</option><option value="30">30 minutes</option></select></div>
 <div class="card"><b>Offline-first</b><p class="muted">Alice does not require cloud access for the desktop foundation.</p></div>`;
 $("autoLock").value=String(settings.auto_lock_minutes||10);
 $("autoLock").onchange=async e=>{settings.auto_lock_minutes=Number(e.target.value);await saveSettings();toast("Settings","Auto-lock preference saved.")};
 $("locPerm").onclick=()=>toast("Locator","Location access is permission-based and currently disabled.");

 $("themeSet").value=settings.theme;$("nameSet").onchange=async e=>{settings.user_name=e.target.value||"Owner";await saveSettings();applySettings()};
 $("themeSet").onchange=async e=>{settings.theme=e.target.value;await saveSettings()};$("passBtn").onclick=setPassword;$("wallBtn").onclick=chooseWallpaper;
}
async function saveSettings(){try{await api("/api/settings",{method:"POST",body:JSON.stringify(settings)})}catch(e){alert(e.message)}}
function applySettings(){
 $("ownerName").textContent=settings.user_name; if($("heroOwner"))$("heroOwner").textContent=settings.user_name; if($("profileAvatar"))$("profileAvatar").textContent=(settings.user_name||"A").trim().charAt(0).toUpperCase();
 document.body.classList.toggle("light",settings.theme==="light");
 const desk=$("desktop");
 if(desk && settings.wallpaper){
   desk.style.backgroundImage=`url("${settings.wallpaper}")`;
   desk.style.backgroundSize="cover"; desk.style.backgroundPosition="center";
 }
}
async function setPassword(){const p=prompt("Create a new Alice password (minimum 8 characters):");if(!p)return;if(p.length<8)return alert("Use at least 8 characters.");try{await api("/api/auth/setup",{method:"POST",body:JSON.stringify({password:p})});alert("Password saved securely on this computer.")}catch(e){alert(e.message)}}
function chooseWallpaper(){
 const input=document.createElement("input");input.type="file";input.accept="image/*";input.onchange=()=>{const f=input.files[0];if(!f)return;const reader=new FileReader();reader.onload=async()=>{try{const b64=String(reader.result).split(",")[1];const d=await api("/api/wallpaper",{method:"POST",body:JSON.stringify({name:f.name,mime:f.type,data:b64})});setWallpaper(d.wallpaper);settings.wallpaper=d.wallpaper}catch(e){alert(e.message)}};reader.readAsDataURL(f)};input.click();
}
function setWallpaper(name){$("desktop").style.backgroundImage=`linear-gradient(180deg,rgba(2,12,31,.14),rgba(2,10,27,.36)),url("/wallpapers/${encodeURIComponent(name)}")`}
async function saveNote(){localStorage.setItem("aliceNote",$("note").value)}
async function askAlice(){const q=$("askInput").value.trim();if(q){$("askInput").value="";await routeAliceCommand(q)}}
async function refreshSystem(){try{const d=await api("/api/system");if(d.ram_percent!=null){$("ram").textContent=d.ram_percent+"%";$("ramBar").style.width=d.ram_percent+"%"}$("storage").textContent=(d.storage_percent ?? d.storage_used_percent ?? 0)+"%";$("storageBar").style.width=(d.storage_percent ?? d.storage_used_percent ?? 0)+"%";$("cpu").textContent="--";$("cpuBar").style.width="10%"}catch{}}
async function legacyWindowLockAlice(){
 const st=await api("/api/auth/status");if(!st.configured){openWindow("settings");alert("Set your password in Settings first.");return}
 const overlay=document.createElement("div");overlay.className="window";overlay.style.zIndex=100;overlay.innerHTML=`<div class="window-content" style="display:grid;place-items:center;height:100%"><div style="text-align:center"><div class="orb" style="margin:auto;width:120px;height:120px"><div>A</div></div><h2>Alice is locked</h2><input id="unlock" type="password" placeholder="Password" style="padding:12px;border-radius:9px"><button id="unlockBtn" style="padding:12px;margin-left:6px">Unlock</button><p id="unlockMsg"></p></div></div>`;$("windows").appendChild(overlay);
 overlay.querySelector("#unlockBtn").onclick=async()=>{try{await api("/api/auth/login",{method:"POST",body:JSON.stringify({password:overlay.querySelector("#unlock").value})});overlay.remove()}catch{overlay.querySelector("#unlockMsg").textContent="Incorrect password."}}
}
(async function boot(){
 try{settings={...settings,...await api("/api/settings")}}catch{}
 applySettings();const n=localStorage.getItem("aliceNote");if(n)$("note").value=n;if(settings.wallpaper&&settings.wallpaper!=="default.svg")setWallpaper(settings.wallpaper);try{
   const auth=await api("/api/auth/status");
   if(auth.owner && $("lockOwner"))$("lockOwner").textContent=auth.owner;
   if(auth.configured && localStorage.getItem("alice_locked")==="1")lockAlice();
 }catch(e){}
 refreshSystem();refreshSystemReal();setInterval(refreshSystem,5000);setInterval(refreshSystemReal,3000);
 try{windowState=JSON.parse(localStorage.getItem(WM_KEY)||"{}")}catch{windowState={}}
 document.addEventListener("contextmenu",e=>{
   if(e.target.closest("input,textarea,.window"))return;
   e.preventDefault();const m=document.createElement("div");m.className="context-menu";m.style.left=e.clientX+"px";m.style.top=e.clientY+"px";
   m.innerHTML="<button data-open='settings'>Personalize</button><button data-open='terminal'>Open Terminal</button><button data-open='skills'>Apps & Tools</button>";
   m.querySelectorAll("button").forEach(b=>b.onclick=()=>{openWindow(b.dataset.open);m.remove()});
   document.body.appendChild(m);const kill=()=>{m.remove();document.removeEventListener("click",kill)};setTimeout(()=>document.addEventListener("click",kill),0);
 });
})();

document.addEventListener("input",e=>{
 if(e.target.id==="appSearch"){
   const q=e.target.value.toLowerCase();
   document.querySelectorAll("#appGrid button").forEach(b=>b.style.display=(b.dataset.app.includes(q)||b.innerText.toLowerCase().includes(q))?"flex":"none");
 }
});


const originalOpenWindow = openWindow;
openWindow = function(type){
  originalOpenWindow(type);
  if(type==="settings") setTimeout(enhanceSettings,40);
};
function enhanceSettings(){
 const c=document.querySelector("#windows .window.active .window-content");
 if(!c || c.dataset.enhanced)return;
 c.dataset.enhanced="1";
 c.innerHTML=`<div class="settings-center">
 <div class="settings-nav">
  <button class="settings-nav-btn active" data-sec="personal">Personalization</button>
  <button class="settings-nav-btn" data-sec="system">System</button>
  <button class="settings-nav-btn" data-sec="apps">Apps</button>
  <button class="settings-nav-btn" data-sec="network">Network & Internet</button>
  <button class="settings-nav-btn" data-sec="accounts">Accounts</button>
  <button class="settings-nav-btn" data-sec="privacy">Privacy & Security</button>
  <button class="settings-nav-btn" data-sec="access">Accessibility</button>
  <button class="settings-nav-btn" data-sec="time">Time & Language</button>
  <button class="settings-nav-btn" data-sec="backup">Backup & Recovery</button>
  <button class="settings-nav-btn" data-sec="update">Windows-style Update</button>
 </div>
 <div class="settings-main">
  <section data-page="personal"><h2>Personalization</h2><div class="setting-grid">
   <label>Owner name<input id="scOwner" value="${esc(settings.user_name)}"></label>
   <label>Theme<select id="scTheme"><option value="dark">Dark</option><option value="light">Light</option></select></label>
   <label>Accent<select id="scAccent"><option>blue</option><option>purple</option><option>gold</option></select></label>
   <label>Text scale<select id="scScale"><option value="100">100%</option><option value="110">110%</option><option value="125">125%</option></select></label>
  </div><button class="primary-btn" id="scWall">Choose wallpaper</button> <button class="primary-btn" id="scSavePersonal">Save</button>
  <div class="toggle-row"><span>Animations</span><input type="checkbox" id="scAnim"></div><div class="toggle-row"><span>Transparency</span><input type="checkbox" id="scTrans"></div></section>
  <section data-page="system" class="hidden"><h2>System</h2><div id="scEnv" class="control-list">Loading system information…</div><div class="toggle-row"><span>Reduce motion</span><input type="checkbox" id="scReduce"></div></section>
  <section data-page="apps" class="hidden"><h2>Apps</h2><p class="muted">Use Software Center for installation and updates. Default apps are host-OS controlled.</p><div class="setting-grid"><label>Default browser<select id="scBrowser"><option value="system">System default</option></select></label><label>Default media<select id="scMedia"><option value="system">System default</option></select></label></div><button class="primary-btn" onclick="openSoftwareCenter()">Open Software Center</button></section>
  <section data-page="network" class="hidden"><h2>Network & Internet</h2><p class="muted">Alice can inspect local connectivity. Hardware radio controls remain delegated to the host OS.</p><button class="primary-btn" onclick="openControlCenter();controlTab('network')">Open Network Control</button><button class="primary-btn" onclick="openControlCenter();controlTab('connectivity')">Wi-Fi / Bluetooth</button></section>
  <section data-page="accounts" class="hidden"><h2>Accounts</h2><div class="card"><b>Owner</b><p>${esc(settings.user_name)}</p><p class="muted">Alice owner authentication is local to this computer.</p></div><button class="primary-btn" id="scPassword">Set / Change password</button></section>
  <section data-page="privacy" class="hidden"><h2>Privacy & Security</h2><div class="toggle-row"><span>Location permission</span><input type="checkbox" id="scLocation"></div><div class="toggle-row"><span>Diagnostic telemetry</span><input type="checkbox" id="scTelemetry"></div><div class="card">Network access is explicit. Locator features require permission and do not provide hidden tracking.</div><button class="primary-btn" onclick="openWindow('security')">Open Security Lab</button></section>
  <section data-page="access" class="hidden"><h2>Accessibility</h2><div class="toggle-row"><span>High contrast</span><input type="checkbox" id="scContrast"></div><div class="toggle-row"><span>Reduce motion</span><input type="checkbox" id="scReduce2"></div><div class="setting-grid"><label>Text scale<select id="scScale2"><option value="100">100%</option><option value="110">110%</option><option value="125">125%</option></select></label></div><button class="primary-btn" id="scSaveAccess">Save</button></section>
  <section data-page="time" class="hidden"><h2>Time & Language</h2><div class="setting-grid"><label>Language<select id="scLang"><option>English</option></select></label><label>Region<input id="scRegion"></label><label>Time zone<input id="scTZ"></label></div><button class="primary-btn" id="scSaveTime">Save</button></section>
  <section data-page="backup" class="hidden"><h2>Backup & Recovery</h2><p class="muted">Create a local backup of non-secret Alice settings. Authentication secrets are not exported.</p><button class="primary-btn" id="scBackup">Create settings backup</button><div id="scBackupResult" class="card"></div></section>
  <section data-page="update" class="hidden"><h2>Update</h2><p class="muted">Alice checks host package-manager availability rather than pretending to be Windows Update.</p><button class="primary-btn" onclick="openControlCenter();controlTab('updates')">Check updates</button></section>
 </div></div>`;
 const bind=(id,ev,fn)=>{const e=$(id);if(e)e.addEventListener(ev,fn)};
 c.querySelectorAll('.settings-nav-btn').forEach(b=>b.onclick=()=>{c.querySelectorAll('.settings-nav-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');c.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('hidden',x.dataset.page!==b.dataset.sec));});
 $("scTheme").value=settings.theme||"dark"; $("scAccent").value=settings.accent_color||"blue"; $("scScale").value=settings.text_scale||"100"; $("scScale2").value=settings.text_scale||"100";
 $("scAnim").checked=settings.animations!==false; $("scTrans").checked=settings.transparency!==false; $("scReduce").checked=!!settings.reduce_motion; $("scReduce2").checked=!!settings.reduce_motion; $("scLocation").checked=!!settings.location_permission; $("scTelemetry").checked=!!settings.privacy_telemetry; $("scContrast").checked=!!settings.high_contrast; $("scBrowser").value=settings.default_browser||"system"; $("scMedia").value=settings.default_media||"system"; $("scLang").value=settings.language||"English"; $("scRegion").value=settings.region||"Ghana"; $("scTZ").value=settings.timezone||"Africa/Accra";
 bind("scSavePersonal","click",async()=>{settings.user_name=$("scOwner").value||"Owner";settings.theme=$("scTheme").value;settings.accent_color=$("scAccent").value;settings.text_scale=$("scScale").value;settings.animations=$("scAnim").checked;settings.transparency=$("scTrans").checked;await saveSettings();applySettings();toast("Settings","Personalization saved.")});
 bind("scSaveAccess","click",async()=>{settings.high_contrast=$("scContrast").checked;settings.reduce_motion=$("scReduce2").checked;settings.text_scale=$("scScale2").value;await saveSettings();toast("Settings","Accessibility saved.")});
 bind("scSaveTime","click",async()=>{settings.language=$("scLang").value;settings.region=$("scRegion").value;settings.timezone=$("scTZ").value;await saveSettings();toast("Settings","Time and language saved.")});
 bind("scPassword","click",setPassword); bind("scWall","click",chooseWallpaper);
 bind("scBackup","click",async()=>{try{const d=await api('/api/settings/backup',{method:'POST',body:'{}'});$("scBackupResult").textContent=d.ok?'Backup created: '+d.path:d.error}catch(e){$("scBackupResult").textContent=e.message}});
 api('/api/system/environment').then(d=>{if($("scEnv"))$("scEnv").innerHTML=`<div><b>Platform:</b> ${esc(d.platform)}</div><div><b>Python:</b> ${esc(d.python)}</div><div><b>Machine:</b> ${esc(d.machine)}</div><div><b>Processor:</b> ${esc(d.processor||'n/a')}</div><div><b>Hostname:</b> ${esc(d.hostname)}</div>`}).catch(()=>{});
}
// ---------- Alice OS v4.1 ----------
function togglePanel(id){const e=document.getElementById(id);if(e)e.classList.toggle("hidden")}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
async function loadSkillHub(){
  try{const d=await (await fetch("/api/skills")).json();const b=document.getElementById("skillsList");
  if(b)b.innerHTML=(d.skills||[]).map(s=>`<div class="skill-card"><strong>${esc(s.name)} · ${esc(s.status)}</strong><small>${esc(s.description)}</small></div>`).join("")
  }catch(e){console.error(e)}
}
async function runSecurityAudit(){
 const b=document.getElementById("securityResults");if(b)b.innerHTML="<div class='audit-card'>Running…</div>";
 try{const d=await (await fetch("/api/security/audit")).json();if(b)b.innerHTML=(d.checks||[]).map(c=>`<div class="audit-card"><strong>${esc(c.status)}</strong> — ${esc(c.name)}</div>`).join("")+`<div class="audit-card">${esc(d.scope)}</div>`}catch(e){if(b)b.innerHTML="<div class='audit-card'>Audit unavailable.</div>"}
}
async function createAliceBackup(){
 const b=document.getElementById("backupResult");if(b)b.innerHTML="<div class='audit-card'>Creating backup…</div>";
 try{const d=await (await fetch("/api/backup",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"})).json();if(b)b.innerHTML=`<div class="audit-card">Created: ${esc(d.file||"unknown")}</div>`}catch(e){if(b)b.innerHTML="<div class='audit-card'>Backup failed.</div>"}
}
function resetAliceAutoLock(){
 clearTimeout(window.aliceAutoLockTimer);
 let s={};try{s=JSON.parse(localStorage.getItem("alice_settings")||"{}")}catch(e){}
 const m=Number(s.autoLockMinutes||0);
 if(m>0 && typeof lockAlice==="function") window.aliceAutoLockTimer=setTimeout(()=>{try{localStorage.setItem("alice_locked","1");lockAlice()}catch(e){}},m*60000);
}
["mousemove","mousedown","keydown","touchstart","click"].forEach(e=>window.addEventListener(e,resetAliceAutoLock,{passive:true}));
document.addEventListener("DOMContentLoaded",()=>{loadSkillHub();resetAliceAutoLock()});

// ---------- Alice OS v4.2 ----------
async function loadWallpaperGallery(){
  const box=document.getElementById("wallpaperList"); if(!box)return;
  try{
    const d=await (await fetch("/api/v42/wallpapers")).json();
    box.innerHTML=(d.items||[]).map(w=>`
      <div class="wallpaper-card" onclick="setAliceWallpaper('${esc(w.url)}')">
        <img src="${esc(w.url)}" alt="${esc(w.name)}"><span>${esc(w.name)}</span>
      </div>`).join("") || "<div class='audit-card'>No packaged wallpapers found.</div>";
  }catch(e){box.innerHTML="<div class='audit-card'>Wallpaper gallery unavailable.</div>"}
}
function setAliceWallpaper(url){
  $("desktop").style.backgroundImage=`url("${url}")`;
  let s={}; try{s=JSON.parse(localStorage.getItem("alice_settings")||"{}")}catch(e){}
  s.wallpaper=url; localStorage.setItem("alice_settings",JSON.stringify(s));
  fetch("/api/v42/settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({wallpaper:url})}).catch(()=>{});
  if(typeof showToast==="function") showToast("Wallpaper changed");
}
async function loadAliceExplorer(){
  const box=document.getElementById("explorerList"); if(!box)return;
  try{
    const d=await (await fetch("/api/workspace")).json();
    box.innerHTML=(d.items||[]).map(i=>`
      <div class="explorer-item"><span>${i.type==="folder"?"📁":"📄"} ${esc(i.name)}</span>
      <button onclick="deleteAliceItem('${esc(i.name)}')">Delete</button></div>`).join("") || "<div class='audit-card'>Workspace is empty.</div>";
  }catch(e){box.innerHTML="<div class='audit-card'>Explorer unavailable.</div>"}
}
async function createAliceFolder(){
  const name=prompt("Folder name:"); if(!name)return;
  const r=await fetch("/api/workspace/folder",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});
  if(r.ok) loadAliceExplorer(); else alert((await r.json()).error||"Could not create folder.");
}
async function createAliceTextFile(){
  const name=prompt("Text file name:","note.txt"); if(!name)return;
  const r=await fetch("/api/workspace/file",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,content:""})});
  if(r.ok) loadAliceExplorer(); else alert((await r.json()).error||"Could not create file.");
}
async function deleteAliceItem(name){
  if(!confirm("Delete "+name+" from Alice workspace?"))return;
  const r=await fetch("/api/workspace/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name})});
  if(r.ok) loadAliceExplorer(); else alert((await r.json()).error||"Could not delete item.");
}
async function refreshAliceNotifications(){
  const b=document.getElementById("notificationList"); if(!b)return;
  try{
    const d=await (await fetch("/api/v42/notifications")).json();
    b.innerHTML=(d.items||[]).map(n=>`<div class="audit-card"><strong>${esc(n.title)}</strong><br>${esc(n.message)}</div>`).join("") || "<div class='audit-card'>No new notifications.</div>";
  }catch(e){}
}
document.addEventListener("DOMContentLoaded",()=>{loadWallpaperGallery();loadAliceExplorer();refreshAliceNotifications()});


/* Alice OS v4.5 lock controller — single authoritative lock flow */
(() => {
  const $ = id => document.getElementById(id);
  let busy = false;
  window.aliceIsLocked = false;
  function setLocked(show){
    const el=$('lockScreen'); if(!el)return;
    el.classList.toggle('hidden',!show); el.setAttribute('aria-hidden',show?'false':'true');
    window.aliceIsLocked=!!show;
    if(show)setTimeout(()=>$('unlockPassword')?.focus(),80);
  }
  function lockClock(){
    const d=new Date();
    if($('lockTime'))$('lockTime').textContent=d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    if($('lockDate'))$('lockDate').textContent=d.toLocaleDateString([], {weekday:'long',month:'long',day:'numeric'});
    if($('lockOwnerName'))$('lockOwnerName').textContent=settings.user_name||'Owner';
  }
  window.showLockHelp=()=>toast('Alice Security','Owner password verification is local to this PC.');
  window.lockAlice=async()=>{
    try{const st=await api('/api/auth/status'); if(!st.configured){openWindow('settings');toast('Security','Create an owner password in Settings first.');return;}}
    catch(e){toast('Security','Local authentication service is unavailable.');return;}
    localStorage.setItem('alice_locked','1'); setLocked(true); lockClock();
  };
  window.unlockAlice=async()=>{
    if(busy)return; const input=$('unlockPassword'), err=$('unlockError'), btn=$('unlockButton'), label=$('unlockButtonText'), spin=$('unlockSpinner');
    const password=input?.value||''; if(!password){if(err)err.textContent='Enter your owner password.';return;}
    busy=true;if(btn)btn.disabled=true;if(label)label.textContent='Verifying…';spin?.classList.remove('hidden');if(err)err.textContent='';
    try{const d=await api('/api/auth/verify',{method:'POST',body:JSON.stringify({password})});if(!d.ok){ window.aliceSecurityCapture?.(); throw new Error(d.error||'Password verification failed.'); }input.value='';localStorage.removeItem('alice_locked');setLocked(false);if(window.resetAliceAutoLock)window.resetAliceAutoLock();toast('Alice','Welcome back.');}
    catch(e){if(err)err.textContent=e.message||'Unable to unlock Alice.';input?.focus();}
    finally{busy=false;if(btn)btn.disabled=false;if(label)label.textContent='Unlock Alice';spin?.classList.add('hidden');}
  };
  document.addEventListener('DOMContentLoaded',async()=>{
    $('unlockForm')?.addEventListener('submit',e=>{e.preventDefault();window.unlockAlice();});
    lockClock();setInterval(lockClock,1000);
    try{const st=await api('/api/auth/status');setLocked(!!st.configured && localStorage.getItem('alice_locked')==='1');}
    catch{setLocked(false);}
    try{const off=await api('/api/offline/status');if(off.offline)document.body.dataset.offline='true';}catch{}
    const search=$('desktopSearch'); search?.addEventListener('keydown',e=>{if(e.key==='Enter'){const q=search.value.trim();if(q){$('askInput').value=q;askAlice();search.value='';}}});
  });
})();

/* Alice OS v4.5 integration layer */
(() => {
  const appNames = {
    home:"Alice Home", chat:"Alice Chat", files:"Files & Data", terminal:"Terminal",
    skills:"Skills Hub", security:"Security Lab", devices:"Devices",
    vault:"Memory Vault", settings:"Settings", lock:"Lock"
  };

  function filterApps(query){
    const grid=document.getElementById("appGrid");
    if(!grid)return;
    const q=String(query||"").trim().toLowerCase();
    let visible=0;
    grid.querySelectorAll("[data-app]").forEach(btn=>{
      const key=btn.dataset.app||"";
      const label=appNames[key]||btn.innerText||key;
      const match=!q || key.includes(q) || label.toLowerCase().includes(q);
      btn.style.display=match?"":"none";
      if(match) visible++;
      btn.classList.toggle("app-match",match && !!q);
    });
    let empty=grid.querySelector(".search-empty");
    if(!visible){
      if(!empty){empty=document.createElement("div");empty.className="search-empty";grid.appendChild(empty);}
      empty.textContent="No Alice tool matches that search.";
    }else if(empty) empty.remove();
  }

  window.runAliceDiagnostics=async()=>{
    try{
      const d=await api("/api/diagnostics");
      const checks=d.checks||{};
      const html=Object.entries(checks).map(([k,v])=>
        `<div class="diagnostic-row"><span>${escapeHtml(k.replaceAll("_"," "))}</span><strong>${v?"Ready":"Check"}</strong></div>`
      ).join("");
      if(typeof toast==="function")toast("System Diagnostics",d.ok?"All local checks passed.":"One or more local checks need attention.");
      const w=openWindow("home");
      const box=w?.querySelector?.(".window-content");
      if(box)box.innerHTML=`<h2>System Diagnostics</h2><p class="muted">Alice OS ${escapeHtml(d.version||"4.5")} local health check.</p><div class="diagnostic-card">${html}</div>`;
    }catch(e){
      if(typeof toast==="function")toast("Diagnostics","The local diagnostic service could not be reached.");
    }
  };

  document.addEventListener("DOMContentLoaded",()=>{
    const search=document.getElementById("appSearch");
    search?.addEventListener("input",e=>filterApps(e.target.value));
    search?.addEventListener("keydown",e=>{
      if(e.key==="Enter"){
        const first=[...document.querySelectorAll("#appGrid [data-app]")]
          .find(b=>b.style.display!=="none");
        if(first){first.click();e.preventDefault();}
      }
    });

    const desktopSearch=document.getElementById("desktopSearch");
    document.addEventListener("keydown",e=>{
      if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="k"){
        e.preventDefault();
        const start=document.getElementById("startMenu");
        if(start)start.classList.remove("hidden");
        const q=document.getElementById("appSearch");
        q?.focus(); q?.select();
      }
      if(e.key==="Escape"){
        document.getElementById("notificationPanel")?.classList.add("hidden");
        document.getElementById("quickPanel")?.classList.add("hidden");
        document.getElementById("startMenu")?.classList.add("hidden");
      }
    });

    // Restore the locally saved quick note.
    const note=document.getElementById("note");
    if(note){
      const saved=localStorage.getItem("aliceNote");
      if(saved!==null)note.value=saved;
    }

    // Keep the displayed offline state explicit.
    const pill=document.getElementById("offlinePill");
    if(pill)pill.setAttribute("aria-label","Alice OS offline mode");
  });
})();

/* Alice OS v5.7 skill dispatcher */
async function dispatchAliceSkill(command){
 const q=String(command||"").trim(); if(!q)return;
 try{const d=await api("/api/skills/dispatch",{method:"POST",body:JSON.stringify({command:q})}); const r=d.result||{};
 if(r.action==="open_window"&&r.window){if(r.window==="terminal"){openTermuxTerminal();return d;}openWindow(r.window);return d;}
 if(r.action==="lock"){lockAlice();return d;}
 if(r.action==="diagnostics"&&window.runAliceDiagnostics){runAliceDiagnostics();return d;}
 if(r.action==="time"){const t=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});if(window.toast)toast("Alice",`The local time is ${t}.`);return d;}
 if(r.action==="remember"){localStorage.setItem("aliceNote",r.text||"");if(window.toast)toast("Alice Memory","Saved locally.");return d;}
 if(window.toast)toast("Alice",`Dispatched to ${d.skill}.`); return d;
 }catch(e){if(window.toast)toast("Alice","Local skill dispatcher unavailable.");throw e;}
}


/* Alice OS v5.7 voice controller — browser-local speech only */
let aliceVoiceRecognition=null;
let aliceVoiceListening=false;
function speakAlice(text){
  if(!("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(String(text));
  u.rate=.98; u.pitch=1;
  window.speechSynthesis.speak(u);
  return true;
}
function startAliceVoice(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){ if(window.toast)toast("Alice Voice","Speech recognition is not available in this browser."); return; }
  if(aliceVoiceListening) return;
  aliceVoiceRecognition=new SR();
  aliceVoiceRecognition.lang=navigator.language||"en-US";
  aliceVoiceRecognition.interimResults=false;
  aliceVoiceRecognition.continuous=false;
  aliceVoiceListening=true;
  if(window.toast)toast("Alice Voice","Listening…");
  aliceVoiceRecognition.onresult=async e=>{
    const text=e.results[0][0].transcript;
    if(window.toast)toast("Alice heard",text);
    try{
      const d=await dispatchAliceSkill(text);
      if(d && d.skill==="general") speakAlice("I heard you. That local skill is not registered yet.");
      else speakAlice("Done.");
    }catch(_){ speakAlice("I could not complete that local command."); }
  };
  aliceVoiceRecognition.onerror=()=>{
    aliceVoiceListening=false;
    if(window.toast)toast("Alice Voice","I couldn't hear a command.");
  };
  aliceVoiceRecognition.onend=()=>{aliceVoiceListening=false;};
  aliceVoiceRecognition.start();
}
function stopAliceVoice(){
  if(aliceVoiceRecognition){try{aliceVoiceRecognition.stop();}catch(_){}}
  aliceVoiceListening=false;
}


/* Alice OS v5.7 voice state + orb */
let aliceVoiceState="READY";
function setAliceVoiceState(state){
  aliceVoiceState=state;
  const orb=document.getElementById("aliceVoiceOrb");
  const label=document.getElementById("aliceVoiceState");
  if(orb) orb.dataset.state=state.toLowerCase();
  if(label) label.textContent=state;
}
function toggleAliceVoice(){
  if(aliceVoiceListening){ stopAliceVoice(); setAliceVoiceState("READY"); }
  else { setAliceVoiceState("LISTENING"); startAliceVoice(); }
}
/* Wrap the v5.7 recognition lifecycle with UI state updates. */
const _aliceStartVoiceV52 = startAliceVoice;
startAliceVoice = function(){
  setAliceVoiceState("LISTENING");
  return _aliceStartVoiceV52();
};
const _aliceStopVoiceV52 = stopAliceVoice;
stopAliceVoice = function(){
  setAliceVoiceState("READY");
  return _aliceStopVoiceV52();
};
if(window.speechSynthesis){
  window.speechSynthesis.addEventListener("start",()=>setAliceVoiceState("SPEAKING"));
  window.speechSynthesis.addEventListener("end",()=>setAliceVoiceState("READY"));
}


/* Alice OS v5.7 Command Center */
function openAliceCommandCenter(){
  const p=document.getElementById("aliceCommandCenter");
  if(p)p.classList.remove("hidden");
  const i=document.getElementById("ccInput"); if(i)setTimeout(()=>i.focus(),50);
}
function closeAliceCommandCenter(){
  const p=document.getElementById("aliceCommandCenter"); if(p)p.classList.add("hidden");
}
async function runAliceCommandCenter(command){
  const input=String(command||"").trim(); if(!input)return;
  const response=document.getElementById("ccResponse");
  const status=document.getElementById("ccStatus");
  if(status)status.textContent="PROCESSING";
  if(response)response.textContent="Routing locally…";
  try{
    const center=await api("/api/command-center",{method:"POST",body:JSON.stringify({command:input})});
    const result=await dispatchAliceSkill(input);
    if(response)response.textContent=result?.skill ? `Local skill: ${result.skill}` : center.message;
    if(status)status.textContent="DONE";
    setTimeout(()=>{if(status)status.textContent="READY"},900);
  }catch(e){
    if(response)response.textContent="Local command could not be completed.";
    if(status)status.textContent="ERROR";
  }
}
document.addEventListener("DOMContentLoaded",()=>{
  const form=document.getElementById("ccForm");
  if(form)form.addEventListener("submit",e=>{
    e.preventDefault(); const i=document.getElementById("ccInput");
    runAliceCommandCenter(i?.value||""); if(i)i.value="";
  });
  document.querySelectorAll("#aliceCommandCenter .cc-quick button").forEach(btn=>{
    btn.addEventListener("click",()=>runAliceCommandCenter(btn.dataset.cmd||btn.textContent));
  });
});


/* Alice OS v5.7 Termux terminal */
function openTermuxTerminal(){
  const t=document.getElementById("termuxTerminal"); if(t)t.classList.remove("hidden");
  const i=document.getElementById("termuxInput"); if(i)setTimeout(()=>i.focus(),50);
}
function closeTermuxTerminal(){
  const t=document.getElementById("termuxTerminal"); if(t)t.classList.add("hidden");
}
function termuxPrint(value){
  const out=document.getElementById("termuxOutput"); if(!out)return;
  const line=document.createElement("div");
  line.textContent=typeof value==="string"?value:JSON.stringify(value,null,2);
  out.appendChild(line); out.scrollTop=out.scrollHeight;
}
async function runTermuxCommand(command){
  const q=String(command||"").trim(); if(!q)return;
  termuxPrint("$ "+q);
  try{
    const d=await api("/api/termux/command",{method:"POST",body:JSON.stringify({command:q})});
    if(d.ok) termuxPrint(d.result);
    else termuxPrint("alice: "+(d.error||"command rejected"));
  }catch(e){termuxPrint("alice: local terminal unavailable");}
}
document.addEventListener("DOMContentLoaded",()=>{
  const f=document.getElementById("termuxForm");
  if(f)f.addEventListener("submit",e=>{
    e.preventDefault();const i=document.getElementById("termuxInput");
    runTermuxCommand(i?.value||"");if(i)i.value="";
  });
});


/* Alice OS v5.7 Termux bridge */
let termuxHistory=[];
let termuxHistoryIndex=-1;
function termuxClear(){
 const out=document.getElementById("termuxOutput");
 if(out)out.innerHTML="";
}
async function termuxBridgeStatus(){
 try{
  const d=await api("/api/termux/status");
  termuxPrint(d.termux_detected
    ?"Termux tools detected in the local environment."
    :"Termux tools were not detected in this Alice OS process.");
 }catch(_){termuxPrint("Unable to check local Termux status.");}
}
(function(){
 const oldRun=window.runTermuxCommand;
 if(typeof oldRun==="function"){
  window.runTermuxCommand=async function(command){
   const q=String(command||"").trim();
   if(q){termuxHistory.push(q);termuxHistoryIndex=termuxHistory.length;saveTermuxHistory();}
   return oldRun(command);
  };
 }
 document.addEventListener("keydown",e=>{
   const input=document.getElementById("termuxInput");
   if(!input || document.activeElement!==input)return;
   if(e.key==="ArrowUp" && termuxHistory.length){
     e.preventDefault(); termuxHistoryIndex=Math.max(0,termuxHistoryIndex-1);
     input.value=termuxHistory[termuxHistoryIndex]||"";
   }else if(e.key==="ArrowDown" && termuxHistory.length){
     e.preventDefault(); termuxHistoryIndex=Math.min(termuxHistory.length,termuxHistoryIndex+1);
     input.value=termuxHistory[termuxHistoryIndex]||"";
   }
 });
})();


/* Alice OS v5.7 terminal sessions */
let termuxTabs=[{id:1,title:"alice@local:~"}];
let activeTermuxTab=1;
function renderTermuxTabs(){
 const box=document.getElementById("termuxTabs"); if(!box)return;
 box.querySelectorAll(".termux-tab").forEach(x=>x.remove());
 const add=box.querySelector(".termux-newtab");
 termuxTabs.forEach(t=>{
  const btn=document.createElement("button");
  btn.className="termux-tab"+(t.id===activeTermuxTab?" active":"");
  btn.textContent=t.title; btn.onclick=()=>{activeTermuxTab=t.id;renderTermuxTabs();};
  box.insertBefore(btn,add);
 });
}
function newTermuxTab(){
 const id=Date.now();
 termuxTabs.push({id,title:"alice@local:~"});
 activeTermuxTab=id; renderTermuxTabs();
 termuxClear(); termuxPrint("New local Alice terminal session.");
}
async function loadTermuxHistory(){
 try{
  const d=await api("/api/termux/session");
  if(Array.isArray(d.history)){termuxHistory=d.history;termuxHistoryIndex=termuxHistory.length;}
 }catch(_){}
}
async function saveTermuxHistory(){
 try{await api("/api/termux/session",{method:"POST",body:JSON.stringify({history:termuxHistory})});}catch(_){}
}
document.addEventListener("DOMContentLoaded",()=>{
 renderTermuxTabs(); loadTermuxHistory();
});

async function openSoftwareCenter(){
  const p=$("softwarePanel"); if(!p)return; p.classList.remove("hidden"); await refreshNetworkStatus(); await refreshDownloads();
}
function closeSoftwareCenter(){ $("softwarePanel")?.classList.add("hidden"); }
async function refreshNetworkStatus(){
  try{const d=await api("/api/network/status"); const on=!!d.enabled; $("networkStateText").textContent=on?"Enabled — online downloads available":"Disabled — Alice is offline"; $("networkToggle").textContent=on?"Disable":"Enable"; const pill=$("offlinePill"); if(pill){pill.innerHTML=on?"<span></span> Network enabled":"<span></span> Offline mode";} }catch(e){toast("Network",e.message)}
}
async function toggleAliceNetwork(){
  try{const d=await api("/api/network/toggle",{method:"POST",body:JSON.stringify({enabled:!((await api("/api/network/status")).enabled)})}); toast("Network",d.enabled?"Network access enabled.":"Network access disabled."); await refreshNetworkStatus();}catch(e){toast("Network",e.message)}
}
async function downloadSoftware(){
  const url=$("softwareUrl")?.value.trim(); const filename=$("softwareName")?.value.trim(); const sha256=$("softwareSha")?.value.trim();
  if(!url){toast("Software Center","Enter a download URL.");return;}
  try{const d=await api("/api/network/download",{method:"POST",body:JSON.stringify({url,filename,sha256})}); $("downloadResult").innerHTML=`<div class="diagnostic-card"><b>${escapeHtml(d.name)}</b><div>${Number(d.bytes).toLocaleString()} bytes</div><div>SHA-256: ${escapeHtml(d.sha256)}</div>${d.verified?"<div>Checksum verified.</div>":"<div>Checksum not supplied.</div>"}</div>`; toast("Software Center","Download complete."); await refreshDownloads();}catch(e){toast("Download blocked",e.message);}
}
async function refreshDownloads(){
  try{const d=await api("/api/network/downloads"); const el=$("downloadList"); if(!el)return; el.innerHTML=d.items.length?d.items.map(x=>`<div class="diagnostic-card"><b>${escapeHtml(x.name)}</b><div>${Number(x.bytes).toLocaleString()} bytes</div></div>`).join(""):"<div class=\"muted\">No downloads yet.</div>";}catch(e){}
}


// Alice OS v6.0 — System Control Center
function openControlCenter(){const p=$("controlPanel");if(!p)return;p.classList.remove("hidden");controlTab("tasks");refreshTaskManager();}
function closeControlCenter(){$("controlPanel")?.classList.add("hidden");}
function controlTab(name){["tasks","network","devices","storage","connectivity","updates"].forEach(x=>$("control"+x[0].toUpperCase()+x.slice(1))?.classList.add("hidden"));const el=$("control"+name[0].toUpperCase()+name.slice(1));if(el)el.classList.remove("hidden");if(name==="network")refreshControlNetwork();if(name==="devices")refreshDeviceManager();if(name==="storage")refreshStorageManager();if(name==="connectivity")refreshConnectivity();if(name==="updates")refreshUpdateCenter();}
async function refreshTaskManager(){try{const d=await api("/api/control/task-manager");$("taskSummary").textContent=`${d.count||0} processes • source: ${d.source||"local"}`;$("taskList").innerHTML=(d.processes||[]).map(p=>`<div class="task-line"><b>${escapeHtml(String(p.name))}</b><span>PID ${escapeHtml(String(p.pid))}</span><span>CPU ${escapeHtml(String(p.cpu))}%</span><span>RAM ${escapeHtml(String(p.memory))}%</span><small>${escapeHtml(String(p.status))}</small></div>`).join("")||"<div class='muted'>No process data.</div>";}catch(e){toast("Task Manager",e.message)}}
async function refreshControlNetwork(){try{const d=await api("/api/control/network");$("networkControlInfo").innerHTML=`<div class="control-card"><b>${escapeHtml(d.hostname||"Device")}</b><div>Local IP: ${escapeHtml(d.local_ip||"unavailable")}</div><div>Network access: ${d.network_enabled?"Enabled":"Disabled"}</div><small>${escapeHtml(d.scope||"")}</small></div>`+(d.interfaces||[]).map(x=>`<div class="network-line"><b>${escapeHtml(x.name||"interface")}</b><span>${escapeHtml(x.status||"")}</span><small>${escapeHtml((x.addresses||[]).join(", "))}</small></div>`).join("");}catch(e){toast("Network",e.message)}}
async function refreshUpdateCenter(){try{const d=await api("/api/control/updates");$("updateInfo").innerHTML=`<div class="control-card"><b>Alice OS ${escapeHtml(d.alice_version||"")}</b><div>Detected package managers:</div><pre class="software-output">${escapeHtml(JSON.stringify(d.package_managers||{},null,2))}</pre><small>${escapeHtml(d.note||"")}</small></div>`+(d.update_actions||[]).map(x=>`<div class="feature-grid"><span>✓ ${escapeHtml(x)}</span></div>`).join("");}catch(e){toast("Updates",e.message)}}
async function refreshSupervisor(){try{const d=await api("/api/supervisor/status"),c=d.config||{};$("supEnabled").checked=!!c.enabled;$("supHealth").checked=!!c.health_notifications;$("supSecurity").checked=!!c.security_notifications;$("supUpdates").checked=!!c.update_notifications;$("supDesktop").checked=!!c.desktop_notifications;$("supLaunch").checked=!!c.app_launch_permission;$("supCamera").checked=!!c.camera_permission;$("supMic").checked=!!c.microphone_permission;$("supLocation").checked=!!c.location_permission;const m=d.monitor||{},u=d.updates||{},sec=d.security||{};$("supervisorStatus").innerHTML=`<div class="control-card"><b>System monitor</b><div>${m.enabled?"Active":"Paused"} • ${escapeHtml(String(m.interval_seconds||5))} second interval</div><small>Health warnings are threshold-based and local.</small></div><div class="control-card"><b>Security</b><div>${sec.camera_permission?"Camera permission enabled":"Camera permission disabled"} • ${sec.phone_alerts_enabled?"Phone alerts enabled":"Phone alerts disabled"}</div></div><div class="control-card"><b>Updates</b><div>Alice OS ${escapeHtml(u.alice_version||"")}</div><small>Update installation remains an explicit owner action.</small></div>`;await refreshEventEngine()}catch(e){toast("Supervisor",e.message)}}
async function refreshEventEngine(){try{const d=await api("/api/events/status");const r=$("eventRecommendations"),t=$("eventTimeline");if(r)r.innerHTML=(d.recommendations||[]).map(x=>`<div class="control-card"><b>${escapeHtml(x.title)}</b><div>${escapeHtml(x.message)}</div></div>`).join("")||'<div class="muted">No recommendations right now.</div>';if(t)t.innerHTML=(d.timeline||[]).slice(0,20).map(x=>`<div class="network-line"><b>${escapeHtml(x.title||"Event")}</b><span>${escapeHtml(x.level||"info")}</span><small>${escapeHtml(x.time||"")} — ${escapeHtml(x.message||"")}</small></div>`).join("")||'<div class="muted">No local events yet.</div>';}catch(e){toast("Event Engine",e.message)}}
async function saveSupervisor(){const body={enabled:$('supEnabled')?.checked,health_notifications:$('supHealth')?.checked,security_notifications:$('supSecurity')?.checked,update_notifications:$('supUpdates')?.checked,desktop_notifications:$('supDesktop')?.checked,app_launch_permission:$('supLaunch')?.checked,camera_permission:$('supCamera')?.checked,microphone_permission:$('supMic')?.checked,location_permission:$('supLocation')?.checked};try{await api('/api/supervisor/config',{method:'POST',body:JSON.stringify(body)});toast('Alice Supervisor','Supervisor and permission preferences saved.');await refreshSupervisor();await refreshEventEngine()}catch(e){toast('Supervisor',e.message)}}

async function refreshDeviceManager(){try{const d=await api("/api/control/devices");$("deviceList").innerHTML=(d.devices||[]).map(x=>`<div class="control-card"><b>${escapeHtml(x.category||"Device")}</b><div>${escapeHtml(x.name||"Unknown")}</div><small>${escapeHtml(x.status||"")} ${escapeHtml(x.details||"")}</small></div>`).join("")||"<div class='muted'>No device information.</div>";}catch(e){toast("Device Manager",e.message)}}
async function refreshStorageManager(){try{const d=await api("/api/control/storage");$("storageList").innerHTML=(d.drives||[]).map(x=>`<div class="control-card"><b>${escapeHtml(x.mount||"Drive")}</b><div>${escapeHtml(x.used_gb)} GB used • ${escapeHtml(x.free_gb)} GB free • ${escapeHtml(x.total_gb)} GB total</div><small>${escapeHtml(x.filesystem||"")} • ${escapeHtml(x.used_percent)}% used</small></div>`).join("")||"<div class='muted'>No mounted storage found.</div>";}catch(e){toast("Storage Manager",e.message)}}
async function refreshConnectivity(){try{const d=await api("/api/control/connectivity");$("connectivityList").innerHTML=`<div class="control-card"><b>Network access</b><div>${d.network_enabled?"Enabled":"Disabled / offline"}</div><small>Use the host OS to toggle Wi‑Fi or Bluetooth radios.</small></div>`+(d.interfaces||[]).map(x=>`<div class="network-line"><b>${escapeHtml(x.name||"adapter")}</b><span>${x.up?"UP":"DOWN"}</span><small>${escapeHtml((x.addresses||[]).map(a=>a.address||"").join(", "))}</small></div>`).join("");}catch(e){toast("Connectivity",e.message)}}

/* ---------- Alice OS v6.3 Centers ---------- */
async function openAccountsCenter(){const p=$("accountsCenter");if(!p)return;p.classList.remove("hidden");await refreshAccountsCenter();await loadAliceStartup();}
function closeAccountsCenter(){$("accountsCenter")?.classList.add("hidden")}
async function refreshAccountsCenter(){const b=$("accountStatus");if(!b)return;try{const d=await api("/api/accounts/status");b.innerHTML=`<div class="audit-card"><b>Owner:</b> ${esc(d.owner_name)}<br><b>Password:</b> ${d.password_configured?"Configured":"Not configured"}<br><b>Authentication:</b> ${esc(d.authentication)}</div>`}catch(e){b.textContent="Account service unavailable."}}
async function loadAliceStartup(){try{const d=await api("/api/startup"),s=d.settings||{};["startupLaunch","startupRestore","startupLocked"].forEach(id=>{if($(id))$(id).checked=!!s[{startupLaunch:"launch_on_start",startupRestore:"restore_windows",startupLocked:"start_locked"}[id]]})}catch(e){}}
async function saveAliceStartup(){const s={launch_on_start:$("startupLaunch")?.checked,restore_windows:$("startupRestore")?.checked,start_locked:$("startupLocked")?.checked};try{await api("/api/startup",{method:"POST",body:JSON.stringify(s)});toast("Startup","Startup settings saved locally.")}catch(e){toast("Startup","Could not save startup settings.")}}
async function openActionCenter(){const p=$("actionCenter");if(!p)return;p.classList.remove("hidden");await refreshActionCenter()}
function closeActionCenter(){$("actionCenter")?.classList.add("hidden")}
async function refreshActionCenter(){const b=$("actionCenterList");if(!b)return;try{const d=await api("/api/action-center");b.innerHTML=(d.items||[]).reverse().map(x=>`<div class="audit-card"><strong>${esc(x.title)}</strong><small>${esc(x.time||"")}</small><br>${esc(x.message)}</div>`).join("")||"<div class='audit-card'>No recent events.</div>"}catch(e){b.textContent="Action Center unavailable."}}
async function clearActionCenter(){try{await api("/api/action-center/clear",{method:"POST",body:"{}"});refreshActionCenter()}catch(e){}}
async function openRecoveryCenter(){const p=$("recoveryCenter");if(!p)return;p.classList.remove("hidden");await loadRecoveryCenter()}
function closeRecoveryCenter(){$("recoveryCenter")?.classList.add("hidden")}
async function loadRecoveryCenter(){const b=$("recoveryList");if(!b)return;try{const d=await api("/api/recovery");b.innerHTML=(d.backups||[]).map(x=>`<div class="audit-card"><b>${esc(x.name)}</b><br><small>${esc(x.path)} · ${Number(x.bytes||0).toLocaleString()} bytes</small></div>`).join("")||"<div class='audit-card'>No local backups yet.</div>"}catch(e){b.textContent="Recovery information unavailable."}}
window.addEventListener("DOMContentLoaded",()=>{setTimeout(refreshActionCenter,1000)});

/* Alice OS 9.7 — target desktop interaction layer */
(function(){
  function wireTargetDesktop(){
    const search=$('appSearch');
    if(search){
      search.addEventListener('input',()=>{
        const q=search.value.trim().toLowerCase();
        document.querySelectorAll('#appGrid [data-app]').forEach(b=>{
          const text=(b.innerText||'').toLowerCase();
          b.style.display=!q||text.includes(q)?'grid':'none';
        });
      });
      search.addEventListener('keydown',e=>{
        if(e.key==='Escape'){search.value='';search.dispatchEvent(new Event('input'));toggleStart();}
        if(e.key==='Enter'){
          const first=[...document.querySelectorAll('#appGrid [data-app]')].find(b=>getComputedStyle(b).display!=='none');
          if(first){first.click();}
        }
      });
    }
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'){
        document.querySelectorAll('.start-menu,.side-panel,.quick-panel,.notification-panel').forEach(x=>x.classList.add('hidden'));
      }
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){
        e.preventDefault();toggleStart();setTimeout(()=>$('appSearch')?.focus(),40);
      }
    });
    refreshTargetCards();
    setInterval(refreshTargetCards,2500);
  }

  async function refreshTargetCards(){
    try{
      const d=await api('/api/system');
      const map=[['targetCpu','targetCpuBar','cpu_percent'],['targetRam','targetRamBar','ram_percent'],['targetStorage','targetStorageBar','storage_percent']];
      map.forEach(([v,b,k])=>{
        const n=Number(d[k]); if(!Number.isFinite(n))return;
        if($(v))$(v).textContent=Math.round(n)+'%';
        if($(b))$(b).style.width=Math.max(2,Math.min(100,n))+'%';
      });
    }catch(_){ }
    try{
      const d=await api('/api/network/status');
      const el=$('targetNetworkState');
      if(el)el.textContent=d.enabled?'Connected':'Offline-first';
    }catch(_){ }
  }

  const oldUpdateTaskbar=window.updateTaskbar;
  window.updateTaskbar=function(){
    if(typeof oldUpdateTaskbar==='function')oldUpdateTaskbar();
    const active=Object.entries(windows).find(([,w])=>w.classList.contains('active')&&!w.classList.contains('minimized'))?.[0];
    document.querySelectorAll('#taskWindows .task-chip').forEach((b,i)=>{
      const keys=Object.keys(windows);
      if(keys[i]===active)b.classList.add('active'); else b.classList.remove('active');
    });
  };

  document.addEventListener('DOMContentLoaded',wireTargetDesktop);
})();

/* ============================================================
   Alice OS 9.7 — User-friendly Home Screen Customizer
   Local-only personalization. Widget/icon state is stored in
   localStorage; no remote widget code is executed or installed.
   ============================================================ */
function win11Icon(name){
  const paths={
    home:'<path d="M5 11.5 12 5l7 6.5V19a1 1 0 0 1-1 1h-4v-5h-4v5H6a1 1 0 0 1-1-1z"/>',
    chat:'<path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v4A3.5 3.5 0 0 1 15.5 14H11l-4 3v-3.7A3.5 3.5 0 0 1 5 10.5z"/><path d="M8 8.5h8M8 11h5"/>',
    intelligence:'<path d="M9 4a3 3 0 0 1 6 0v1.2a3.5 3.5 0 0 1 2 6.3A3 3 0 0 1 14 16H10a3 3 0 0 1-3-4.5 3.5 3.5 0 0 1 2-6.3z"/><path d="M12 7v6M9.5 9.5h5M10 16v2M14 16v2"/>',
    files:'<path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h5l1.5 2H19a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 17H5a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M3.8 8h16.4"/>',
    terminal:'<rect x="4" y="5" width="16" height="14" rx="2"/><path d="m8 10 2.5 2L8 14M12.5 14H16"/>',
    skills:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h8M8 12h3M13 12h3M8 16h8"/>',
    software:'<path d="M12 3v10M8 9l4 4 4-4"/><path d="M5 14v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/>',
    control:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h8v3H8zM8 13h3v3H8zM13 13h3v3h-3z"/>',
    security:'<path d="M12 3 19 6v5c0 4.5-2.8 7.4-7 10-4.2-2.6-7-5.5-7-10V6z"/><path d="m9 12 2 2 4-4"/>',
    devices:'<rect x="3.5" y="5" width="12" height="9" rx="1.5"/><path d="M7 18h5M9 14v4"/><rect x="17" y="8" width="3.5" height="8" rx=".8"/>',
    vault:'<rect x="5" y="4" width="14" height="16" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M12 9v6M9 12h6"/>',
    settings:'<circle cx="12" cy="12" r="3.2"/><path d="m19 13 1.2 1-.9 1.6-1.5-.4a7.5 7.5 0 0 1-1.3 1.3l.4 1.5-1.6.9-1-1.2a7.4 7.4 0 0 1-1.8.3L12 21h-2l-.5-1.8a7.4 7.4 0 0 1-1.8-.3l-1 1.2-1.6-.9.4-1.5a7.5 7.5 0 0 1-1.3-1.3l-1.5.4L1.8 15l1.2-1a7.5 7.5 0 0 1 0-2l-1.2-1 .9-1.6 1.5.4a7.5 7.5 0 0 1 1.3-1.3L5.1 7l1.6-.9 1 1.2a7.4 7.4 0 0 1 1.8-.3L10 5h2l.5 2a7.4 7.4 0 0 1 1.8.3l1-1.2L17 7l-.4 1.5a7.5 7.5 0 0 1 1.3 1.3l1.5-.4.9 1.6-1.2 1a7.5 7.5 0 0 1 0 2Z"/>',
    accounts:'<circle cx="12" cy="8" r="3"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    lock:'<rect x="5" y="9" width="14" height="11" rx="2"/><path d="M8 9V7a4 4 0 0 1 8 0v2M12 13v3"/>',
    weather:'<path d="M7 17h9a4 4 0 1 0-.7-7.9A5 5 0 0 0 6 10a3.5 3.5 0 0 0 1 7Z"/><path d="M6 5v2M3.5 7.5 5 9M15 5v2M17.5 7.5 16 9"/>',
    system:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 16v-3M12 16V8M16 16v-5"/>',
    network:'<circle cx="12" cy="12" r="3"/><path d="M4 12a8 8 0 0 1 16 0M7 17a7 7 0 0 0 10 0"/>',
    clock:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
    note:'<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h3M9 12h6M9 16h4"/>',
    calendar:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 9h16M8 13h3M13 13h3M8 16h3"/>',
    battery:'<rect x="4" y="7" width="15" height="10" rx="2"/><path d="M19 10h2v4h-2M7 10h7v4H7z"/>',
    shortcuts:'<path d="m13 5 6 7-6 7v-4H5v-6h8z"/>',
    memory:'<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 12h5M8 15h8"/>',
    volume:'<path d="M5 10h3l4-3v10l-4-3H5z"/><path d="M16 9a4 4 0 0 1 0 6M18 7a7 7 0 0 1 0 10"/>',
    bell:'<path d="M6 16h12l-1.3-2V10a4.7 4.7 0 0 0-9.4 0v4z"/><path d="M10 19h4"/>',
    search:'<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/>',
    mic:'<rect x="9" y="4" width="6" height="10" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3M9 20h6"/>'
  };
  return `<span class="win11-icon win11-${name}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]||paths.home}</svg></span>`;
}
function appIconMarkup(token){return token==='__ALICE_LOGO__'?'<span class="win11-icon win11-alice"><img src="/assets/alice-logo.svg" alt="Alice OS"></span>':win11Icon(token)}

(function initReferenceMatch(){
  const desktop=document.getElementById('desktop');
  if(!desktop)return;
  document.body.classList.add('reference-match');
  desktop.classList.add('reference-match');
  const start=document.getElementById('startMenu');
  if(start)start.classList.add('hidden');
})();

(function initHomePersonalization(){
  const HOME_KEY='alice_home_layout_v99';
  const TASKBAR_KEY='alice_taskbar_pins_v99';
  const defaultLayout={
    widgets:['weather','system','network','assistant'],
    icons:['home','files','terminal','security'],
    editMode:false,
    sizes:{},
    taskbar:['home','chat','files','terminal','software','control','devices','security','settings']
  };
  const iconCatalog={
    home:{name:'Alice Home',icon:'__ALICE_LOGO__',action:'home'},chat:{name:'Alice Chat',icon:'chat',action:'chat'},
    intelligence:{name:'Intelligence',icon:'intelligence',action:'intelligence'},files:{name:'Files & Data',icon:'files',action:'files'},
    terminal:{name:'Terminal',icon:'terminal',action:'terminal'},skills:{name:'Skills Hub',icon:'skills',action:'skills'},
    software:{name:'Software Center',icon:'software',action:'software'},control:{name:'System Control',icon:'control',action:'control'},
    security:{name:'Security Lab',icon:'security',action:'security'},devices:{name:'Devices & Locator',icon:'devices',action:'devices'},
    vault:{name:'Memory Vault',icon:'vault',action:'vault'},settings:{name:'Settings',icon:'settings',action:'settings'},
    accounts:{name:'Accounts',icon:'accounts',action:'accounts'},lock:{name:'Lock Alice',icon:'lock',action:'lock'}
  };
  const widgetCatalog={
    weather:{name:'Weather',icon:'weather',desc:'Local weather display card.',builtIn:true},
    system:{name:'System Status',icon:'system',desc:'Live CPU, RAM and storage usage.',builtIn:true},
    network:{name:'Network',icon:'network',desc:'Loopback/network and Bluetooth status.',builtIn:true},
    assistant:{name:'Alice Assistant',icon:'__ALICE_LOGO__',desc:'Quick access to Alice voice control.',builtIn:true},
    clock:{name:'Clock & Date',icon:'clock',desc:'Large local time and date widget.'},
    note:{name:'Quick Note',icon:'note',desc:'A small local note pad for the desktop.'},
    calendar:{name:'Calendar',icon:'calendar',desc:'Local calendar and upcoming date display.'},
    battery:{name:'Battery',icon:'battery',desc:'Device battery status when the browser exposes it.'},
    shortcuts:{name:'Quick Shortcuts',icon:'shortcuts',desc:'One-click access to your favorite Alice tools.'},
    memory:{name:'Memory',icon:'memory',desc:'Shows locally saved Alice note size.'}
  };
  let layout=loadLayout();
  let dragId=null;

  document.querySelectorAll('#appGrid [data-app]').forEach(btn=>{const id=btn.dataset.app;const target=btn.querySelector('span');if(target&&iconCatalog[id])target.innerHTML=appIconMarkup(iconCatalog[id].icon)});
  const startSettings=document.querySelector('.start-head>button');if(startSettings)startSettings.innerHTML=appIconMarkup('settings');
  document.querySelectorAll('.tray-icon').forEach(b=>{const t=b.title||'';const k=t.includes('Network')?'network':t.includes('Bluetooth')?'devices':t.includes('Sound')?'volume':t.includes('Notifications')?'bell':null;if(k)b.innerHTML=appIconMarkup(k)});
  document.querySelectorAll('.icon-btn').forEach(b=>{const t=b.title||'';const k=t.includes('Ask Alice')?'mic':t.includes('Notifications')?'bell':null;if(k)b.innerHTML=appIconMarkup(k)});
  const topSearch=document.querySelector('.top-search>span');if(topSearch)topSearch.innerHTML=appIconMarkup('search');
  const railWeather=document.querySelector('.weather-card .target-card-head>span');if(railWeather)railWeather.innerHTML=appIconMarkup('weather');
  const railNetwork=document.querySelector('.network-card .target-card-title>span:first-child');if(railNetwork)railNetwork.innerHTML=appIconMarkup('network')+' Network';
  const mic=document.querySelector('.assistant-mic');if(mic)mic.innerHTML=appIconMarkup('mic');
  function loadLayout(){
    try{
      const x=JSON.parse(localStorage.getItem(HOME_KEY)||'null');
      if(x && Array.isArray(x.widgets) && Array.isArray(x.icons)) return {...defaultLayout,...x,sizes:(x.sizes&&typeof x.sizes==='object')?x.sizes:{},taskbar:Array.isArray(x.taskbar)?x.taskbar:defaultLayout.taskbar.slice()};
    }catch(_){ }
    return JSON.parse(JSON.stringify(defaultLayout));
  }
  function saveLayout(){localStorage.setItem(HOME_KEY,JSON.stringify(layout));}
  function widgetSize(id){return layout.sizes?.[id]||'medium';}
  function setWidgetSize(id,size){if(!['small','medium','large'].includes(size))return;if(!layout.sizes)layout.sizes={};layout.sizes[id]=size;saveLayout();renderWidgets();renderCustomizerWidgets();toast('Widget',`${widgetCatalog[id]?.name||id} set to ${size} size.`)}
  window.setWidgetSize=setWidgetSize;
  function $(id){return document.getElementById(id)}
  function esc(x){return escapeHtml(String(x))}

  function openHomeCustomizer(){
    $('homeCustomizer')?.classList.remove('hidden');
    renderCustomizerWidgets();renderCustomizerIcons();renderCustomizerGallery();renderCustomizerTaskbar();
  }
  window.openHomeCustomizer=openHomeCustomizer;
  window.closeHomeCustomizer=()=>$('homeCustomizer')?.classList.add('hidden');
  window.switchHomeTab=function(tab){
    document.querySelectorAll('.customizer-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    ['widgets','icons','gallery','taskbar'].forEach(x=>$('customizer'+x.charAt(0).toUpperCase()+x.slice(1))?.classList.toggle('hidden',x!==tab));
  };
  window.toggleHomeEditMode=function(){
    layout.editMode=!layout.editMode;saveLayout();applyEditMode();renderCustomizerWidgets();renderCustomizerIcons();
    toast('Home screen',layout.editMode?'Edit mode enabled. Drag cards to reorder.':'Edit mode disabled.');
  };
  function applyEditMode(){
    document.body.classList.toggle('home-edit-mode',!!layout.editMode);
    const b=$('homeEditButton');if(b)b.textContent=layout.editMode?'Disable edit mode':'Enable edit mode';
    const icons=$('desktopIcons');if(icons)icons.classList.toggle('home-draggable',!!layout.editMode);
  }

  function renderDesktopIcons(){
    const host=$('desktopIcons');if(!host)return;host.innerHTML='';
    layout.icons.forEach(id=>{
      const a=iconCatalog[id];if(!a)return;
      const b=document.createElement('button');b.dataset.iconId=id;b.draggable=!!layout.editMode;
      b.innerHTML=`<span class="desktop-icon ${id==='home'?'di-alice':''}">${appIconMarkup(a.icon)}</span><b>${esc(a.name)}</b>`;
      b.onclick=()=>{if(id==='lock')lockAlice();else if(id==='software')openSoftwareCenter();else if(id==='control')openControlCenter();else if(id==='accounts')openAccountsCenter();else openWindow(a.action)};
      b.addEventListener('contextmenu',e=>{if(!layout.editMode)return;e.preventDefault();removeDesktopIcon(id)});
      b.addEventListener('dragstart',()=>dragId=id);b.addEventListener('dragover',e=>{if(layout.editMode)e.preventDefault()});
      b.addEventListener('drop',e=>{e.preventDefault();if(!layout.editMode||!dragId||dragId===id)return;reorder(layout.icons,dragId,id);saveLayout();renderDesktopIcons();renderCustomizerIcons()});
      host.appendChild(b);
    });
  }
  function reorder(arr,from,to){const a=arr.indexOf(from),b=arr.indexOf(to);if(a<0||b<0)return;arr.splice(a,1);arr.splice(arr.indexOf(to),0,from)}
  function removeDesktopIcon(id){layout.icons=layout.icons.filter(x=>x!==id);saveLayout();renderDesktopIcons();renderCustomizerIcons();toast('Home screen',`${iconCatalog[id]?.name||id} removed from desktop.`)}
  window.removeDesktopIcon=removeDesktopIcon;
  function addDesktopIcon(id){if(!iconCatalog[id]||layout.icons.includes(id))return;layout.icons.push(id);saveLayout();renderDesktopIcons();renderCustomizerIcons();toast('Desktop icon',`${iconCatalog[id].name} added.`)}
  window.addDesktopIcon=addDesktopIcon;

  function ensureWidgetCard(id){
    const rail=$('targetRightRail')||document.querySelector('.target-right-rail');if(!rail)return null;
    let card=rail.querySelector(`[data-widget-id="${id}"]`);if(card)return card;
    const c=document.createElement('section');c.className='target-card home-extra-widget';c.dataset.widgetId=id;c.dataset.widgetSize=widgetSize(id);
    const commonHead=`<div class="target-card-title"><span>${esc(widgetCatalog[id]?.icon||'✦')} ${esc(widgetCatalog[id]?.name||id)}</span><span class="widget-actions"><button class="widget-size" onclick="setWidgetSize('${id}',widgetSize('${id}')==='small'?'medium':widgetSize('${id}')==='medium'?'large':'small')" title="Change size">↗</button><button class="widget-x" onclick="removeHomeWidget('${id}')" aria-label="Remove widget">×</button></span></div>`;
    if(id==='clock')c.innerHTML=commonHead+`<div class="extra-clock" id="extraClock">--:--</div><div class="target-muted" id="extraClockDate">Loading…</div>`;
    else if(id==='note')c.innerHTML=commonHead+`<textarea id="extraNote" class="extra-note" placeholder="Write a quick note…"></textarea><button class="extra-action" onclick="saveExtraNote()">Save</button>`;
    else if(id==='calendar')c.innerHTML=commonHead+`<div id="extraCalendar" class="extra-calendar"></div>`;
    else if(id==='battery')c.innerHTML=commonHead+`<div class="extra-big" id="extraBattery">Checking…</div><div class="target-muted">Uses the device battery API when available.</div>`;
    else if(id==='shortcuts')c.innerHTML=commonHead+`<div class="extra-shortcuts"><button onclick="openWindow('chat')">Alice Chat</button><button onclick="openWindow('files')">Files</button><button onclick="openWindow('terminal')">Terminal</button><button onclick="openWindow('settings')">Settings</button></div>`;
    else if(id==='memory')c.innerHTML=commonHead+`<div class="extra-big" id="extraMemory">0 KB</div><div class="target-muted">Local Alice note storage.</div>`;
    else c.innerHTML=commonHead+`<div class="target-muted">Ready.</div>`;
    rail.appendChild(c);decorateWidgetCard(c);return c;
  }
  function decorateWidgetCard(card){
    if(!card)return;
    let title=card.querySelector('.target-card-title');
    if(title && !title.querySelector('.widget-x')){
      const id=card.dataset.widgetId;const b=document.createElement('button');b.className='widget-x';b.textContent='×';b.title='Remove widget';b.onclick=()=>removeHomeWidget(id);title.appendChild(b);
    }
    card.dataset.widgetSize=widgetSize(card.dataset.widgetId);card.classList.remove('widget-small','widget-medium','widget-large');card.classList.add('widget-'+widgetSize(card.dataset.widgetId));card.draggable=!!layout.editMode;
    card.addEventListener('dragstart',()=>{dragId=card.dataset.widgetId;card.classList.add('dragging')});
    card.addEventListener('dragend',()=>card.classList.remove('dragging'));
    card.addEventListener('dragover',e=>{if(layout.editMode)e.preventDefault()});
    card.addEventListener('drop',e=>{e.preventDefault();const to=card.dataset.widgetId;if(!layout.editMode||!dragId||dragId===to)return;reorder(layout.widgets,dragId,to);saveLayout();renderWidgets();renderCustomizerWidgets()});
  }
  function renderWidgets(){
    const rail=document.querySelector('.target-right-rail');if(!rail)return;
    const all=[...rail.querySelectorAll('[data-widget-id]')];
    all.forEach(c=>c.style.display='none');
    layout.widgets.forEach(id=>{const c=ensureWidgetCard(id);if(c){c.style.display='block';decorateWidgetCard(c)}});
    // Keep target order predictable and save new widgets at their requested position.
    layout.widgets.forEach(id=>{const c=rail.querySelector(`[data-widget-id="${id}"]`);if(c)rail.appendChild(c)});
    updateExtraWidgets();
  }
  function removeHomeWidget(id){
    layout.widgets=layout.widgets.filter(x=>x!==id);saveLayout();renderWidgets();renderCustomizerWidgets();toast('Home screen',`${widgetCatalog[id]?.name||id} removed.`);
  }
  window.removeHomeWidget=removeHomeWidget;
  function addHomeWidget(id){
    if(!widgetCatalog[id]||layout.widgets.includes(id))return;
    layout.widgets.push(id);saveLayout();renderWidgets();renderCustomizerWidgets();toast('Widget',`${widgetCatalog[id].name} added to Home.`);
  }
  window.addHomeWidget=addHomeWidget;

  function renderCustomizerWidgets(){
    const host=$('customizerWidgets');if(!host)return;
    const installed=layout.widgets.map(id=>widgetCatalog[id]).filter(Boolean);
    host.innerHTML=installed.length?installed.map((w,i)=>`<div class="customizer-row" draggable="true" data-wdrag="${esc(layout.widgets[i])}"><span class="customizer-icon">${appIconMarkup(w.icon)}</span><div class="row-main"><b>${esc(w.name)}</b><small>${esc(w.desc)}</small></div><button onclick="setWidgetSize('${esc(layout.widgets[i])}',widgetSize('${esc(layout.widgets[i])}')==='small'?'medium':widgetSize('${esc(layout.widgets[i])}')==='medium'?'large':'small')">Size: ${esc(widgetSize(layout.widgets[i]))}</button><button onclick="removeHomeWidget('${esc(layout.widgets[i])}')">Delete</button></div>`).join(''):'<div class="customizer-empty">No widgets are installed. Open Widget Gallery to add some.</div>';
    host.querySelectorAll('[data-wdrag]').forEach(row=>{row.addEventListener('dragstart',()=>dragId=row.dataset.wdrag);row.addEventListener('dragover',e=>e.preventDefault());row.addEventListener('drop',e=>{e.preventDefault();const to=row.dataset.wdrag;if(dragId&&to&&dragId!==to){reorder(layout.widgets,dragId,to);saveLayout();renderWidgets();renderCustomizerWidgets()}})});
  }
  function renderCustomizerIcons(){
    const host=$('customizerIcons');if(!host)return;
    host.innerHTML=layout.icons.map(id=>{const a=iconCatalog[id];return a?`<div class="customizer-row"><span class="customizer-icon">${appIconMarkup(a.icon)}</span><div class="row-main"><b>${esc(a.name)}</b><small>Desktop shortcut</small></div><button class="danger-btn" onclick="removeDesktopIcon('${id}')">Delete</button></div>`:''}).join('')||'<div class="customizer-empty">No desktop icons. Add one from the list below.</div>';
    const available=Object.entries(iconCatalog).filter(([id])=>!layout.icons.includes(id));
    host.innerHTML += `<div class="customizer-empty"><b>Add a desktop icon</b><div class="gallery-actions" style="margin-top:9px;display:flex;flex-wrap:wrap">${available.map(([id,a])=>`<button onclick="addDesktopIcon('${id}')">＋ ${esc(a.name)}</button>`).join('')||'<span>All available shortcuts are already on the desktop.</span>'}</div></div>`;
  }
  function renderCustomizerTaskbar(){
    const host=$('customizerTaskbar');if(!host)return;
    const pinned=layout.taskbar||[];
    const rows=pinned.map(id=>{const a=iconCatalog[id];return a?`<div class="customizer-row"><span class="customizer-icon">${appIconMarkup(a.icon)}</span><div class="row-main"><b>${esc(a.name)}</b><small>Taskbar shortcut</small></div><button class="danger-btn" onclick="unpinTaskbar('${id}')">Unpin</button></div>`:''}).join('');
    const available=Object.entries(iconCatalog).filter(([id])=>!pinned.includes(id));
    host.innerHTML=(rows||'<div class="customizer-empty">No pinned apps.</div>')+`<div class="customizer-empty"><b>Pin an app</b><div class="gallery-actions" style="margin-top:9px;display:flex;flex-wrap:wrap">${available.map(([id,a])=>`<button onclick="pinTaskbar('${id}')">＋ ${esc(a.name)}</button>`).join('')||'<span>All available apps are pinned.</span>'}</div></div>`;
  }
  window.pinTaskbar=function(id){if(!iconCatalog[id])return;if(!Array.isArray(layout.taskbar))layout.taskbar=[];if(!layout.taskbar.includes(id))layout.taskbar.push(id);saveLayout();renderTaskbarPins();renderCustomizerTaskbar();toast('Taskbar',`${iconCatalog[id].name} pinned.`)};
  window.unpinTaskbar=function(id){layout.taskbar=(layout.taskbar||[]).filter(x=>x!==id);saveLayout();renderTaskbarPins();renderCustomizerTaskbar();toast('Taskbar',`${iconCatalog[id]?.name||id} unpinned.`)};
  function renderTaskbarPins(){
    const host=document.querySelector('.task-pinned');if(!host)return;host.innerHTML='';
    (layout.taskbar||[]).forEach(id=>{const a=iconCatalog[id];if(!a)return;const b=document.createElement('button');b.className='task-icon';b.title=a.name;b.setAttribute('aria-label',a.name);b.innerHTML=appIconMarkup(a.icon);b.onclick=()=>{if(id==='lock')lockAlice();else if(id==='software')openSoftwareCenter();else if(id==='control')openControlCenter();else if(id==='accounts')openAccountsCenter();else openWindow(a.action)};b.addEventListener('contextmenu',e=>{e.preventDefault();unpinTaskbar(id)});host.appendChild(b)});
  }
  window.renderTaskbarPins=renderTaskbarPins;

  function renderCustomizerGallery(){
    const host=$('customizerGallery');if(!host)return;
    host.innerHTML=`<div class="gallery-toolbar"><input id="widgetGallerySearch" placeholder="Search widgets…"><button onclick="importWidgetManifest()">＋ Import</button></div><div class="customizer-empty" style="text-align:left;margin-bottom:4px">Widgets are local and safe by design. Download exports a manifest; Import accepts <b>.alicewidget.json</b> metadata only and never executes downloaded code.</div><div class="gallery-grid" id="widgetGalleryGrid">${Object.entries(widgetCatalog).map(([id,w])=>`<article class="gallery-card" data-widget-search="${esc((w.name+' '+w.desc).toLowerCase())}"><div class="gallery-preview">${appIconMarkup(w.icon)}</div><b>${esc(w.name)}</b><p>${esc(w.desc)}</p><div class="gallery-actions"><button class="primary" onclick="addHomeWidget('${id}')">＋ Install</button><button onclick="downloadWidgetManifest('${id}')">↓ Download</button></div></article>`).join('')}</div><div class="customizer-empty" style="margin-top:9px"><b>More apps</b><p>Use Software Center for actual application installation and updates.</p><button onclick="closeHomeCustomizer();openSoftwareCenter()">Open Software Center</button></div>`;
    const search=$('widgetGallerySearch');if(search)search.oninput=()=>{const q=search.value.toLowerCase();document.querySelectorAll('#widgetGalleryGrid [data-widget-search]').forEach(c=>c.style.display=!q||c.dataset.widgetSearch.includes(q)?'block':'none')};
  }
  window.downloadWidgetManifest=function(id){
    const w=widgetCatalog[id];if(!w)return;const blob=new Blob([JSON.stringify({format:'alice-widget',version:1,id,name:w.name,description:w.desc,offline:true},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${id}.alicewidget.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);toast('Widget','Widget manifest downloaded locally.');
  };
  window.importWidgetManifest=function(){
    const input=document.createElement('input');input.type='file';input.accept='.json,.alicewidget.json,application/json';
    input.onchange=()=>{const f=input.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const m=JSON.parse(String(r.result));if(m.format!=='alice-widget'||!m.id||!m.name){throw new Error('Invalid Alice widget manifest.')}if(!/^[a-z0-9_-]{2,40}$/i.test(m.id)){throw new Error('Invalid widget id.')}if(widgetCatalog[m.id]){addHomeWidget(m.id);toast('Widget','Installed the matching built-in widget.');return;}widgetCatalog[m.id]={name:String(m.name).slice(0,60),icon:'shortcuts',desc:String(m.description||'Imported local widget').slice(0,140),imported:true};addHomeWidget(m.id);renderCustomizerGallery();toast('Widget','Imported metadata only. No downloaded code was executed.')}catch(e){toast('Widget import',e.message||'Invalid manifest.')}};r.readAsText(f)};input.click();
  };
  window.resetHomeLayout=function(){
    if(!confirm('Reset Home screen widgets and desktop icons to the Alice OS default layout?'))return;
    layout=JSON.parse(JSON.stringify(defaultLayout));saveLayout();renderDesktopIcons();renderWidgets();renderTaskbarPins();renderCustomizerWidgets();renderCustomizerIcons();renderCustomizerTaskbar();applyEditMode();toast('Home screen','Default layout restored.');
  };
  function updateExtraWidgets(){
    const now=new Date();
    if($('extraClock'))$('extraClock').textContent=now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    if($('extraClockDate'))$('extraClockDate').textContent=now.toLocaleDateString([], {weekday:'long',month:'long',day:'numeric'});
    if($('extraNote'))$('extraNote').value=localStorage.getItem('aliceExtraNote')||'';
    if($('extraCalendar')){$('extraCalendar').innerHTML=`<b>${now.toLocaleDateString([], {weekday:'long'})}</b><div>${now.toLocaleDateString([], {month:'long',day:'numeric',year:'numeric'})}</div><small>Local calendar • no cloud required</small>`}
    if($('extraMemory')){const n=localStorage.getItem('aliceNote')||localStorage.getItem('aliceExtraNote')||'';$('extraMemory').textContent=(new Blob([n]).size/1024).toFixed(1)+' KB'}
    if($('extraBattery') && navigator.getBattery){navigator.getBattery().then(b=>{$('extraBattery').textContent=Math.round(b.level*100)+'%'+(b.charging?' • Charging':'')}).catch(()=>{$('extraBattery').textContent='Unavailable'})}else if($('extraBattery'))$('extraBattery').textContent='Unavailable';
  }
  window.saveExtraNote=function(){localStorage.setItem('aliceExtraNote',$('extraNote')?.value||'');toast('Quick Note','Saved locally.')};
  function start(){
    renderDesktopIcons();renderWidgets();renderTaskbarPins();applyEditMode();
    setInterval(updateExtraWidgets,1000);
    // Desktop context menu gets a direct Home customization entry.
    document.addEventListener('contextmenu',e=>{
      if(e.target.closest('input,textarea,.window,.start-menu,.home-customizer'))return;
      setTimeout(()=>{const menus=document.querySelectorAll('.context-menu');const m=menus[menus.length-1];if(m && !m.querySelector('[data-home-customize]')){const b=document.createElement('button');b.textContent='Customize Home';b.dataset.homeCustomize='1';b.onclick=()=>{m.remove();openHomeCustomizer()};m.prepend(b)}},0);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();


/* Alice OS 10.0 — real-time security & owner-controlled camera alerts */
(() => {
  let securityStream = null;
  window.aliceSecurityCapture = async () => {
    try {
      const cfg = await api('/api/security/status');
      if (!cfg.config?.camera_permission) { toast('Alice Security','Camera capture is disabled. Enable it in Security Lab first.'); return; }
      if (!navigator.mediaDevices?.getUserMedia) return;
      if (!securityStream) securityStream = await navigator.mediaDevices.getUserMedia({video:true,audio:false});
      const video=document.createElement('video'); video.srcObject=securityStream; video.muted=true; await video.play();
      await new Promise(r=>setTimeout(r,250));
      const canvas=document.createElement('canvas'); canvas.width=640; canvas.height=480;
      canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
      const image=canvas.toDataURL('image/jpeg',0.72);
      await api('/api/security/intrusion',{method:'POST',body:JSON.stringify({image})});
      toast('Alice Security','Failed unlock recorded.');
    } catch(e) { toast('Alice Security','Camera alert could not be captured.'); }
  };
  window.initSecurityAlerts = async (root) => {
    try {
      const d=await api('/api/security/status');
      root.querySelector('#secCamera').checked=!!d.config.camera_permission;
      root.querySelector('#secPhone').checked=!!d.config.phone_alerts_enabled;
      root.querySelector('#secWebhook').value='';
      root.querySelector('#secStatus').textContent=`${(d.events||[]).length} recent security event(s)`;
    } catch(e) { root.querySelector('#secStatus').textContent=e.message; }
    root.querySelector('#secSave').onclick=async()=>{
      try { const webhook=root.querySelector('#secWebhook').value.trim(); const cam=root.querySelector('#secCamera').checked; const phone=root.querySelector('#secPhone').checked;
        if(cam && navigator.mediaDevices?.getUserMedia) { const st=await navigator.mediaDevices.getUserMedia({video:true,audio:false}); st.getTracks().forEach(t=>t.stop()); }
        const d=await api('/api/security/config',{method:'POST',body:JSON.stringify({camera_permission:cam,phone_alerts_enabled:phone,phone_webhook:webhook})});
        root.querySelector('#secStatus').textContent='Security permissions saved.'; toast('Alice Security','Security controls updated.');
      } catch(e){ toast('Alice Security',e.message); }
    };
  };
})();

/* Alice OS 10.1 — proactive local system monitor */
(() => {
  let lastMonitorEvent = null;
  async function refreshAliceMonitor() {
    try {
      const d = await api('/api/monitor/status');
      const s = d.system || {};
      const cpu = document.querySelector('[data-system="cpu"]');
      const ram = document.querySelector('[data-system="ram"]');
      const storage = document.querySelector('[data-system="storage"]');
      if(cpu && s.cpu_percent != null) cpu.textContent = `${Number(s.cpu_percent).toFixed(0)}%`;
      if(ram && s.ram_percent != null) ram.textContent = `${Number(s.ram_percent).toFixed(0)}%`;
      if(storage && s.storage_percent != null) storage.textContent = `${Number(s.storage_percent).toFixed(0)}%`;
      const events = d.events || [];
      const latest = events[events.length - 1];
      if (latest && latest.id !== lastMonitorEvent) {
        if (lastMonitorEvent !== null) toast(latest.title || 'Alice Monitor', latest.message || 'System event detected.');
        lastMonitorEvent = latest.id;
      }
    } catch(e) {}
  }
  window.refreshAliceMonitor = refreshAliceMonitor;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { refreshAliceMonitor(); setInterval(refreshAliceMonitor, 5000); });
  else { refreshAliceMonitor(); setInterval(refreshAliceMonitor, 5000); }
})();

// ---------- Alice OS v10.4 Action Center ----------
window.openActionCenter=async()=>{const p=$('actionCenterPanel');if(p){p.classList.remove('hidden');await refreshActionCenter10();}};
window.closeActionCenter=()=>{$('actionCenterPanel')?.classList.add('hidden');};
window.refreshActionCenter10=async()=>{try{const d=await api('/api/actions/status');const host=$('actionCenterList');if(!host)return;const items=d.active||[];host.innerHTML=items.map(x=>`<div class="control-card"><b>${escapeHtml(x.title)}</b><div>${escapeHtml(x.message)}</div><small>${escapeHtml(x.level||'info')}</small><div class="panel-row"><button class="primary-btn" onclick="actionCenterRun('${escapeHtml(x.key)}')">Review</button><button class="primary-btn" onclick="ackAction10('${escapeHtml(x.key)}')">Acknowledge</button></div></div>`).join('')||'<div class="muted">No active recommendations.</div>';}catch(e){toast('Action Center',e.message)}};
window.ackAction10=async(key)=>{try{await api('/api/actions/ack',{method:'POST',body:JSON.stringify({key})});await refreshActionCenter10();toast('Alice Action Center','Recommendation acknowledged locally.');}catch(e){toast('Action Center',e.message)}};
window.actionCenterRun=(id)=>{closeActionCenter();if(id==='task_manager')return controlTab('tasks');if(id==='storage')return controlTab('storage');if(id==='security')return openSecurityCenter?.();if(id==='updates')return controlTab('updates');if(id==='lock')return lockAlice();};
window.loadAliceWorkflows=async()=>{try{const d=await api('/api/workflows/status');const host=$('workflowList');if(!host)return;host.innerHTML=(d.workflows||[]).map(w=>`<div class="control-card"><b>${escapeHtml(w.name)}</b><div>${escapeHtml(w.description)}</div><small>${escapeHtml(w.mode)}</small><div class="panel-row"><button class="primary-btn" onclick="runAliceWorkflow('${escapeHtml(w.id)}')">Run</button></div></div>`).join('')||'<div class="muted">No workflows available.</div>';}catch(e){if($('workflowList'))$('workflowList').textContent='Automation unavailable.';}};
window.runAliceWorkflow=async(id)=>{const names={health_check:'System Health Check',security_review:'Security Review',update_check:'Update Check',settings_backup:'Settings Backup',diagnostics:'Alice Diagnostics'};if(!confirm(`Run ${names[id]||'this workflow'}?`))return;try{const d=await api('/api/workflows/run',{method:'POST',body:JSON.stringify({id})});const out=$('workflowResult');if(out){out.classList.remove('hidden');out.innerHTML=`<b>${escapeHtml(names[id]||id)} completed</b><pre class="software-output">${escapeHtml(JSON.stringify(d.data||d,null,2))}</pre>`;}toast('Alice Automation','Workflow completed.');await loadAliceWorkflows();}catch(e){toast('Alice Automation',e.message)}};
window.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>refreshActionCenter10(),1500);setTimeout(loadAliceWorkflows,1800);setInterval(()=>{if(!$('actionCenterPanel')?.classList.contains('hidden')){refreshActionCenter10();loadAliceWorkflows();}},5000);});
// ---------- end v10.4 Action Center ----------

// ---------- Alice OS v10.6 Intelligent System Dashboard ----------
(() => {
  let dashboardTimer = null;
  const pct = v => v == null ? '—' : `${Number(v).toFixed(0)}%`;
  window.openAliceDashboard = async () => { const p=$('aliceDashboardPanel'); if(!p)return; p.classList.remove('hidden'); await refreshAliceDashboard(); if(!dashboardTimer) dashboardTimer=setInterval(()=>{ if(!p.classList.contains('hidden')) refreshAliceDashboard(); },5000); };
  window.closeAliceDashboard = () => $('aliceDashboardPanel')?.classList.add('hidden');
  window.refreshAliceDashboard = async () => {
    try {
      const d=await api('/api/dashboard/status'), s=d.system||{}, h=$('dashHealth');
      if($('dashCpu')) $('dashCpu').textContent=pct(s.cpu_percent);
      if($('dashRam')) $('dashRam').textContent=pct(s.ram_percent);
      if($('dashStorage')) $('dashStorage').textContent=pct(s.storage_percent);
      if(h){h.textContent=d.health==='normal'?'Normal':'Attention';h.dataset.alert=d.health==='normal'?'0':'1';}
      const detail=$('dashDetails'); if(detail){
        const n=d.network||{}, sup=d.supervisor||{}, sec=d.security||{}, ev=d.events||{}, ac=d.actions||{}, wf=d.workflows||{};
        detail.innerHTML=`<div class="control-card"><b>Supervisor</b><div>${sup.enabled?'Active':'Paused'} • Desktop notifications ${sup.desktop_notifications?'enabled':'disabled'}</div></div><div class="control-card"><b>Security</b><div>Camera ${sec.camera_permission?'enabled':'disabled'} • Phone alerts ${sec.phone_alerts_enabled?'enabled':'disabled'} • ${sec.recent_events} recent event(s)</div></div><div class="control-card"><b>Activity</b><div>${ev.recent} timeline event(s) • ${ev.recommendations} recommendation(s) • ${ac.active} active action(s)</div></div><div class="control-card"><b>Automation</b><div>${wf.available} workflow(s) available • ${wf.history} history item(s)</div></div><div class="control-card"><b>Network</b><div>${n.enabled?'Enabled':'Offline/disabled'} • ${n.state||n.connection_state||'local control'}</div></div>`;
      }
    } catch(e){ if($('dashDetails')) $('dashDetails').textContent='Dashboard unavailable.'; }
  };
})();
// ---------- end v10.6 Intelligent System Dashboard ----------


// ---------- Alice OS v10.8 Unified Assistant ----------
(() => {
  const esc = window.escapeHtml || (x => String(x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const panel=()=>document.getElementById('aliceAssistantPanel');
  window.openAliceAssistant=async()=>{const p=panel();if(!p)return;p.classList.remove('hidden');document.getElementById('assistantInput')?.focus();try{await api('/api/alice-assistant/status')}catch(e){toast('Alice','Local assistant is unavailable.');}};
  window.closeAliceAssistant=()=>panel()?.classList.add('hidden');
  function add(role,text){const host=document.getElementById('assistantTranscript');if(!host)return;const row=document.createElement('div');row.className=`assistant-message ${role}`;row.innerHTML=`<b>${role==='alice'?'Alice':'You'}</b><span>${esc(text).replace(/\n/g,'<br>')}</span>`;host.appendChild(row);host.scrollTop=host.scrollHeight;}
  window.askAlicePreset=(text)=>{const i=document.getElementById('assistantInput');if(i)i.value=text;document.getElementById('assistantForm')?.requestSubmit();};
  async function ask(text){text=String(text||'').trim();if(!text)return;add('user',text);const i=document.getElementById('assistantInput');if(i)i.value='';try{const d=await api('/api/alice-assistant/query',{method:'POST',body:JSON.stringify({text})});add('alice',d.answer||d.message||'I could not find a local answer.');}catch(e){add('alice','The local assistant service is unavailable right now. Check Alice System Control.');}}
  document.addEventListener('DOMContentLoaded',()=>{document.getElementById('assistantForm')?.addEventListener('submit',e=>{e.preventDefault();ask(document.getElementById('assistantInput')?.value);});});
})();
// ---------- end v10.8 Unified Assistant ----------

// ---------- Alice OS 12.6 — Windows-style keyboard shortcuts + File Explorer ----------
(() => {
  const shortcutState = { desktopShown:false, lastClosed:null, altTabOpen:false, altTabIndex:0 };
  const shortcutMap = [
    ['Win / Ctrl+Esc','Open Start'],['Win+D','Show / restore desktop'],['Win+E','Files & Data'],
    ['Win+I','Settings'],['Win+A','Quick Settings'],['Win+N','Notifications'],['Win+S','Search'],
    ['Win+R','Alice Run'],['Win+X','System Control'],['Win+L','Lock Alice'],['Win+Tab','Window switcher'],
    ['Alt+Tab','Switch window'],['Alt+F4','Close active window'],['Alt+Space','Window menu'],
    ['Win+← / →','Snap active window'],['Win+↑ / ↓','Maximize / minimize'],
    ['Ctrl+Shift+Esc','Task Manager'],['Ctrl+Shift+T','Reopen last closed window'],
    ['Ctrl+Tab','Next window'],['Ctrl+Shift+Tab','Previous window'],['Ctrl+W','Close active window'],
    ['F5','Refresh system'],['Esc','Close menus / panels'],['Ctrl+K','Start search'],
    ['Ctrl+Shift+N','New folder in Files'],['Ctrl+L','Clear terminal / focus search'],
    ['Win+1…9','Open pinned taskbar app'],['Win+M','Minimize all windows'],['Win+Shift+M','Restore all windows'],['Win+Home','Minimize all except active'],
    ['Win+B','Alice Internet'],['Win+C','Open Alice Assistant'],['Win+K','Connectivity Center'],['Win+U','Accessibility settings'],['Win+P','System Control'],['Win+W','Alice Dashboard'],['Win+Z','Window menu'],
  ];

  const style = document.createElement('style');
  style.textContent = `
    .alice-shortcut-overlay{position:fixed;inset:0;background:rgba(5,10,24,.58);backdrop-filter:blur(14px);z-index:10050;display:flex;align-items:center;justify-content:center}
    .alice-shortcut-card{width:min(720px,92vw);max-height:82vh;overflow:auto;border:1px solid rgba(130,190,255,.28);border-radius:24px;background:rgba(15,23,42,.92);box-shadow:0 30px 90px rgba(0,0,0,.48);padding:24px;color:#eef6ff}
    .alice-shortcut-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px}.alice-shortcut-head h2{margin:0}
    .alice-shortcut-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.alice-shortcut-row{display:flex;justify-content:space-between;gap:12px;padding:10px 12px;border-radius:13px;background:rgba(255,255,255,.055)}
    .alice-shortcut-key{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;color:#9fd4ff}.alice-shortcut-desc{font-size:13px;color:#dce9f8}
    .alice-alt-tab{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);z-index:10060;padding:18px 22px;border-radius:22px;background:rgba(10,18,35,.94);border:1px solid rgba(130,190,255,.3);box-shadow:0 24px 80px rgba(0,0,0,.55);display:flex;gap:10px;max-width:86vw;overflow:auto}
    .alice-alt-item{min-width:110px;padding:14px;border-radius:15px;text-align:center;background:rgba(255,255,255,.055);color:#dbeafe}.alice-alt-item.active{outline:2px solid #5bbcff;background:rgba(80,170,255,.16)}
    .alice-run-dialog{position:fixed;left:50%;top:25%;transform:translateX(-50%);z-index:10055;width:min(520px,88vw);padding:18px;border-radius:20px;background:rgba(12,20,38,.96);border:1px solid rgba(130,190,255,.3);box-shadow:0 25px 80px rgba(0,0,0,.55)}
    .alice-run-dialog input{width:100%;box-sizing:border-box;padding:13px 14px;border-radius:12px;border:1px solid rgba(140,190,255,.22);background:rgba(255,255,255,.06);color:inherit;outline:none}
    .alice-window-menu{position:fixed;z-index:10070;width:210px;padding:6px;border-radius:14px;background:rgba(14,22,40,.97);border:1px solid rgba(130,190,255,.28);box-shadow:0 20px 60px rgba(0,0,0,.5)}
    .alice-window-menu button{display:block;width:100%;text-align:left;padding:9px 11px;border:0;background:transparent;color:#eef6ff;border-radius:9px}.alice-window-menu button:hover{background:rgba(90,170,255,.14)}
    @media(max-width:650px){.alice-shortcut-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function activeWindow(){
    const list=Object.entries(windows).filter(([,w])=>w && document.body.contains(w) && !w.classList.contains('minimized'));
    list.sort((a,b)=>(Number(a[1].style.zIndex)||0)-(Number(b[1].style.zIndex)||0));
    return list[list.length-1]?.[1] || null;
  }
  function activeType(){const w=activeWindow();return w ? Object.keys(windows).find(k=>windows[k]===w) : null;}
  function closeActive(){const w=activeWindow();if(!w)return false;const type=activeType();shortcutState.lastClosed=type;w.remove();delete windows[type];updateTaskbar();saveWindowState();return true;}
  function minimizeActive(){const w=activeWindow();if(!w)return false;w.classList.add('minimized');updateTaskbar();saveWindowState();return true;}
  function maximizeActive(){const w=activeWindow();if(!w)return false;w.classList.add('maximized');w.classList.remove('minimized');bring(w);saveWindowState();return true;}
  function restoreActive(){const w=activeWindow();if(!w)return false;w.classList.remove('maximized','minimized');bring(w);saveWindowState();return true;}
  function snapActive(side){const w=activeWindow();if(!w)return false;snapWindow(w,side);bring(w);saveWindowState();return true;}
  function cycleWindow(reverse=false){
    const list=Object.entries(windows).filter(([,w])=>w && document.body.contains(w));
    if(!list.length)return;
    list.sort((a,b)=>(Number(a[1].style.zIndex)||0)-(Number(b[1].style.zIndex)||0));
    const cur=list.findIndex(([,w])=>w===activeWindow());
    const next=(cur+(reverse?-1:1)+list.length)%list.length;
    bring(list[next][1]);
  }
  function toggleDesktop(){
    const list=Object.values(windows).filter(w=>w&&document.body.contains(w));
    if(!list.length)return;
    shortcutState.desktopShown=!shortcutState.desktopShown;
    list.forEach(w=>{if(shortcutState.desktopShown)w.classList.add('minimized');else w.classList.remove('minimized');});
    updateTaskbar();
  }
  function openRun(){
    document.querySelector('.alice-run-dialog')?.remove();
    const d=document.createElement('div');d.className='alice-run-dialog';
    d.innerHTML='<div style="font-weight:700;margin-bottom:6px">Run a local Alice command</div><div style="font-size:12px;opacity:.7;margin-bottom:10px">Safe Alice commands only. Nothing is executed directly by the browser.</div><input id="aliceRunInput" placeholder="e.g. Open Terminal, System status"><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px"><button id="aliceRunCancel">Cancel</button><button id="aliceRunGo" class="primary-btn">Run</button></div>';
    document.body.appendChild(d);const input=d.querySelector('#aliceRunInput');input.focus();
    const go=()=>{const v=input.value.trim();if(v){routeAliceCommand(v);d.remove();}};
    d.querySelector('#aliceRunGo').onclick=go;d.querySelector('#aliceRunCancel').onclick=()=>d.remove();input.addEventListener('keydown',e=>{if(e.key==='Enter')go();if(e.key==='Escape')d.remove();});
  }
  function openShortcuts(){
    document.querySelector('.alice-shortcut-overlay')?.remove();
    const o=document.createElement('div');o.className='alice-shortcut-overlay';
    o.innerHTML='<div class="alice-shortcut-card"><div class="alice-shortcut-head"><div><h2>Keyboard shortcuts</h2><div style="font-size:12px;opacity:.7;margin-top:4px">Alice OS PC keyboard controls</div></div><button id="aliceShortcutClose">✕</button></div><div class="alice-shortcut-grid">'+shortcutMap.map(x=>`<div class="alice-shortcut-row"><span class="alice-shortcut-key">${escapeHtml(x[0])}</span><span class="alice-shortcut-desc">${escapeHtml(x[1])}</span></div>`).join('')+'</div></div>';
    document.body.appendChild(o);o.onclick=e=>{if(e.target===o)o.remove();};o.querySelector('#aliceShortcutClose').onclick=()=>o.remove();
  }
  function showAltTab(){
    document.querySelector('.alice-alt-tab')?.remove();
    const list=Object.entries(windows).filter(([,w])=>w&&document.body.contains(w));if(!list.length)return;
    const cur=list.findIndex(([,w])=>w===activeWindow());shortcutState.altTabIndex=cur<0?0:cur;
    const d=document.createElement('div');d.className='alice-alt-tab';
    d.innerHTML=list.map(([type],i)=>`<div class="alice-alt-item ${i===shortcutState.altTabIndex?'active':''}">${escapeHtml(({home:'Alice Home',chat:'Alice Chat',files:'Files',terminal:'Terminal',settings:'Settings',security:'Security Lab',devices:'Devices',browser:'Browser',calculator:'Calculator',notepad:'Notepad'}[type]||type))}</div>`).join('');document.body.appendChild(d);
    window.__aliceAltList=list;
  }
  function moveAltTab(dir){
    const list=window.__aliceAltList;if(!list?.length)return;shortcutState.altTabIndex=(shortcutState.altTabIndex+dir+list.length)%list.length;
    document.querySelectorAll('.alice-alt-item').forEach((x,i)=>x.classList.toggle('active',i===shortcutState.altTabIndex));
  }
  function finishAltTab(){const list=window.__aliceAltList;if(list?.length)bring(list[shortcutState.altTabIndex][1]);document.querySelector('.alice-alt-tab')?.remove();window.__aliceAltList=null;}
  function windowMenu(){
    const w=activeWindow();if(!w)return;
    document.querySelector('.alice-window-menu')?.remove();const r=w.getBoundingClientRect();const m=document.createElement('div');m.className='alice-window-menu';m.style.left=Math.min(r.left,innerWidth-220)+'px';m.style.top=Math.min(r.top+38,innerHeight-190)+'px';
    m.innerHTML='<button data-a="restore">Restore</button><button data-a="min">Minimize</button><button data-a="max">Maximize</button><button data-a="left">Snap left</button><button data-a="right">Snap right</button><button data-a="close">Close</button>';
    document.body.appendChild(m);m.onclick=e=>{const a=e.target.dataset.a;if(!a)return;if(a==='restore')restoreActive();if(a==='min')minimizeActive();if(a==='max')maximizeActive();if(a==='left')snapActive('left');if(a==='right')snapActive('right');if(a==='close')closeActive();m.remove();};
  }
  function refresh(){refreshSystemReal?.();refreshAliceMonitor?.();toast('Alice','System information refreshed.');}

  document.addEventListener('keydown',e=>{
    const key=e.key.toLowerCase(), meta=e.metaKey||e.getModifierState?.('Meta'), win=e.getModifierState?.('OS')||false, mod=meta||win;
    const ctrl=e.ctrlKey, alt=e.altKey, shift=e.shiftKey;
    // Alt+Tab needs keyup to finalize, so don't let browser switch tabs where possible.
    if(alt && e.key==='Tab'){e.preventDefault();if(!shortcutState.altTabOpen){shortcutState.altTabOpen=true;showAltTab();}else moveAltTab(shift?-1:1);return;}
    if(mod && e.key==='Tab'){e.preventDefault();showAltTab();moveAltTab(1);setTimeout(finishAltTab,0);return;}
    if(shortcutState.altTabOpen && e.key==='Enter'){e.preventDefault();finishAltTab();shortcutState.altTabOpen=false;return;}
    if(mod && key==='d'){e.preventDefault();toggleDesktop();return;}
    if(mod && key==='e'){e.preventDefault();openWindow('files');return;}
    if(mod && key==='i'){e.preventDefault();openWindow('settings');return;}
    if(mod && key==='a'){e.preventDefault();toggleQuickSettings();return;}
    if(mod && key==='n'){e.preventDefault();toggleNotifications();return;}
    if(mod && key==='s'){e.preventDefault();toggleStart();setTimeout(()=>{$('appSearch')?.focus();},30);return;}
    if(mod && key==='r'){e.preventDefault();openRun();return;}
    if(mod && key==='x'){e.preventDefault();openControlCenter?.();return;}
    if(mod && key==='c'){e.preventDefault();openAliceAssistant?.();return;}
    if(mod && key==='k'){e.preventDefault();openControlCenter?.();controlTab?.('connectivity');return;}
    if(mod && key==='u'){e.preventDefault();openWindow('settings');setTimeout(()=>document.querySelector('[data-page=\"access\"]')?.click(),80);return;}
    if(mod && key==='p'){e.preventDefault();openControlCenter?.();return;}
    if(mod && key==='w'){e.preventDefault();openAliceDashboard?.();return;}
    if(mod && key==='z'){e.preventDefault();windowMenu();return;}
    if(mod && key==='m' && shift){e.preventDefault();Object.values(windows).forEach(w=>w.classList.remove('minimized'));updateTaskbar();return;}
    if(mod && key==='m'){e.preventDefault();Object.values(windows).forEach(w=>w.classList.add('minimized'));updateTaskbar();return;}
    if(mod && key==='home'){e.preventDefault();const current=activeWindow();Object.values(windows).forEach(w=>{if(w!==current)w.classList.add('minimized');});updateTaskbar();return;}
    if(mod && /^[1-9]$/.test(e.key)){e.preventDefault();const buttons=[...document.querySelectorAll('#taskbar .task-icon, #taskbar button')];const b=buttons[Number(e.key)-1];if(b)b.click();return;}
    if(mod && key==='l'){e.preventDefault();lockAlice?.();return;}
    if(mod && e.key==='ArrowLeft'){e.preventDefault();snapActive('left');return;}
    if(mod && e.key==='ArrowRight'){e.preventDefault();snapActive('right');return;}
    if(mod && e.key==='ArrowUp'){e.preventDefault();maximizeActive();return;}
    if(mod && e.key==='ArrowDown'){e.preventDefault();minimizeActive();return;}
    if(mod && e.key==='Escape'){e.preventDefault();openShortcuts();return;}
    if(mod && shift && key==='s'){e.preventDefault();toast('Alice','Screenshot shortcut reserved for the native desktop compositor.');return;}
    if(ctrl && shift && key==='escape'){e.preventDefault();openControlCenter?.();controlTab?.('tasks');return;}
    if(ctrl && shift && key==='t'){e.preventDefault();if(shortcutState.lastClosed)openWindow(shortcutState.lastClosed);return;}
    if(ctrl && key==='tab'){e.preventDefault();cycleWindow(shift);return;}
    if(ctrl && key==='w'){if(activeWindow()){e.preventDefault();closeActive();return;}}
    if(ctrl && key==='l'){e.preventDefault();const t=activeType();if(t==='terminal'){$('termInput')?.focus();$('termOut')?.replaceChildren();}else {$('appSearch')?.focus();$('appSearch')?.select();}return;}
    if(ctrl && shift && key==='n'){e.preventDefault();if(activeType()==='files'){$('newFolder')?.click();}else openWindow('files');return;}
    if(e.key==='F5'){e.preventDefault();refresh();return;}
    if(alt && e.key==='F4'){e.preventDefault();closeActive();return;}
    if(alt && e.key===' '){e.preventDefault();windowMenu();return;}
    if(e.key==='Escape'){
      document.querySelector('.alice-shortcut-overlay')?.remove();document.querySelector('.alice-run-dialog')?.remove();document.querySelector('.alice-window-menu')?.remove();
      $('notificationPanel')?.classList.add('hidden');$('quickPanel')?.classList.add('hidden');$('startMenu')?.classList.add('hidden');
    }
    // F1: Alice shortcut help; Ctrl+Esc / Windows key: Start.
    if(e.key==='F1'){e.preventDefault();openShortcuts();return;}
    if((e.key==='Escape' && ctrl)||(!ctrl&&!alt&&!shift&&e.key==='Meta')){e.preventDefault();toggleStart();return;}
    // Common app shortcuts.
    if(activeType()==='terminal' && key==='l' && ctrl){e.preventDefault();$('termOut')?.replaceChildren();$('termInput')?.focus();return;}
    if(activeType()==='files' && e.key==='F5'){e.preventDefault();$('fileGrid')?.dispatchEvent(new Event('alice-refresh'));return;}
  });
  document.addEventListener('keyup',e=>{if(e.key==='Alt'&&shortcutState.altTabOpen){finishAltTab();shortcutState.altTabOpen=false;}});
  window.showAliceShortcuts=openShortcuts;
})();
// ---------- end 12.6 keyboard shortcuts ----------

/* Alice OS 12.8 — Windows-style taskbar, Task View and Win+X power-user layer */
(function(){
  const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  window.toggleWinX=function(){
    const p=document.getElementById('winXMenu'); if(!p)return;
    p.classList.toggle('hidden');
    document.getElementById('startMenu')?.classList.add('hidden');
    document.getElementById('quickPanel')?.classList.add('hidden');
  };
  window.openWinX=function(action){
    document.getElementById('winXMenu')?.classList.add('hidden');
    const map={
      apps:()=>openSoftwareCenter(), mobility:()=>openControlCenter(), power:()=>openWindow('settings'),
      event:()=>{if(typeof openActionCenter==='function')openActionCenter();else openControlCenter();}, system:()=>openWindow('settings'), device:()=>openWindow('devices'),
      network:()=>{openControlCenter();controlTab('network')}, disk:()=>{openControlCenter();controlTab('storage')},
      computer:()=>{openControlCenter();controlTab('supervisor')}, task:()=>{openControlCenter();controlTab('tasks');refreshTaskManager()},
      terminal:()=>openTermuxTerminal(), 'terminal-admin':()=>{toast('Alice Security','Administrator terminal is restricted to an explicitly authorized host session.');openTermuxTerminal()},
      taskbar:()=>openTaskbarSettings(), settings:()=>openWindow('settings'), lock:()=>lockAlice(),
      shutdown:()=>openPowerMenu()
    };
    try{(map[action]||map.settings)()}catch(e){toast('Alice',e.message||'Action unavailable.')}
  };
  window.openTaskbarSearch=function(){
    document.getElementById('winXMenu')?.classList.add('hidden');
    toggleStart();
    setTimeout(()=>document.getElementById('appSearch')?.focus(),50);
  };
  window.toggleTaskView=function(){
    const p=document.getElementById('taskViewPanel'); if(!p)return;
    p.classList.toggle('hidden');
    document.getElementById('startMenu')?.classList.add('hidden');
    if(!p.classList.contains('hidden')) renderTaskView();
  };
  window.renderTaskView=function(){
    const host=document.getElementById('taskViewList'); if(!host)return;
    const entries=Object.entries(window.windows||{});
    host.innerHTML=entries.length?entries.map(([type,w])=>`<button class="taskview-card ${w.classList.contains('active')?'active':''}" onclick="bring(window.windows['${esc(type)}']);toggleTaskView()"><b>${esc(type.replace(/[-_]/g,' '))}</b><small>${w.classList.contains('minimized')?'Minimized':'Open'}</small></button>`).join(''):'<div class="muted">No open Alice windows. Launch an app from Start.</div>';
  };
  window.toggleDesktopWidgets=function(){
    const desktop=document.getElementById('desktop'); if(!desktop)return;
    desktop.classList.toggle('widgets-hidden');
    toast('Widgets',desktop.classList.contains('widgets-hidden')?'Desktop widgets hidden.':'Desktop widgets restored.');
  };
  window.toggleCalendarPanel=function(){
    const p=document.getElementById('calendarPanel'); if(!p)return;
    p.classList.toggle('hidden'); document.getElementById('winXMenu')?.classList.add('hidden');
    if(!p.classList.contains('hidden')) renderCalendarPanel();
  };
  window.renderCalendarPanel=function(){
    const now=new Date(), body=document.getElementById('calendarBody'), today=document.getElementById('calendarToday');
    if(today)today.textContent=now.toLocaleDateString([], {weekday:'long',month:'long',day:'numeric'});
    if(!body)return;
    const y=now.getFullYear(), m=now.getMonth(), first=new Date(y,m,1).getDay(), days=new Date(y,m+1,0).getDate();
    const names=['Sun','Mon','Tue','Wed','Thu','Fri','Sat']; let h=`<div class="cal-month"><b>${now.toLocaleDateString([], {month:'long',year:'numeric'})}</b></div><div class="cal-grid">${names.map(n=>`<span class="cal-name">${n}</span>`).join('')}`;
    for(let i=0;i<first;i++)h+='<span></span>';
    for(let d=1;d<=days;d++)h+=`<span class="cal-day ${d===now.getDate()?'today':''}">${d}</span>`;
    body.innerHTML=h+'</div>';
  };
  window.openPowerMenu=function(){
    const p=document.createElement('div');p.className='power-menu-overlay';
    p.innerHTML=`<div class="power-menu"><div class="power-head"><b>Alice OS</b><button onclick="this.closest('.power-menu-overlay').remove()">×</button></div><button onclick="lockAlice();this.closest('.power-menu-overlay').remove()">Lock</button><button onclick="location.reload()">Restart Alice desktop</button><button onclick="this.closest('.power-menu-overlay').remove()">Sign out (desktop session)</button><p class="muted">Physical shutdown/restart is controlled by the host operating system.</p></div>`;
    document.body.appendChild(p);
  };
  window.openTaskbarSettings=function(){
    const old=document.getElementById('aliceTaskbarSettings'); if(old){old.classList.remove('hidden');return;}
    const cfg=JSON.parse(localStorage.getItem('alice_taskbar_settings')||'{}');
    const p=document.createElement('section');p.id='aliceTaskbarSettings';p.className='taskbar-settings-panel';
    p.innerHTML=`<div class="taskbar-settings-head"><div><b>Taskbar settings</b><small>Windows-style desktop personalization</small></div><button onclick="this.closest('#aliceTaskbarSettings').remove()">×</button></div>
      <label><span>Show Search</span><input id="tbSearch" type="checkbox" ${cfg.search!==false?'checked':''}></label>
      <label><span>Show Task View</span><input id="tbView" type="checkbox" ${cfg.view!==false?'checked':''}></label>
      <label><span>Show Widgets</span><input id="tbWidgets" type="checkbox" ${cfg.widgets!==false?'checked':''}></label>
      <label><span>Auto-hide taskbar</span><input id="tbAuto" type="checkbox" ${cfg.autoHide?'checked':''}></label>
      <label><span>Center taskbar</span><input id="tbCenter" type="checkbox" ${cfg.center!==false?'checked':''}></label>
      <button class="primary-btn" onclick="saveTaskbarSettings()">Save taskbar settings</button>`;
    document.body.appendChild(p);
  };
  window.saveTaskbarSettings=function(){
    const cfg={search:document.getElementById('tbSearch')?.checked!==false,view:document.getElementById('tbView')?.checked!==false,widgets:document.getElementById('tbWidgets')?.checked!==false,autoHide:!!document.getElementById('tbAuto')?.checked,center:document.getElementById('tbCenter')?.checked!==false};
    localStorage.setItem('alice_taskbar_settings',JSON.stringify(cfg));
    document.querySelector('.task-search')?.classList.toggle('hidden',!cfg.search);document.querySelector('.task-view')?.classList.toggle('hidden',!cfg.view);document.querySelector('.task-widgets')?.classList.toggle('hidden',!cfg.widgets);
    const tb=document.getElementById('taskbar');tb?.classList.toggle('taskbar-left',!cfg.center);tb?.classList.toggle('taskbar-auto-hide',cfg.autoHide);
    document.getElementById('aliceTaskbarSettings')?.remove();toast('Taskbar','Settings saved locally.');
  };
  const tbSaved=JSON.parse(localStorage.getItem('alice_taskbar_settings')||'{}');
  setTimeout(()=>{const tb=document.getElementById('taskbar');document.querySelector('.task-search')?.classList.toggle('hidden',tbSaved.search===false);document.querySelector('.task-view')?.classList.toggle('hidden',tbSaved.view===false);document.querySelector('.task-widgets')?.classList.toggle('hidden',tbSaved.widgets===false);tb?.classList.toggle('taskbar-left',tbSaved.center===false);tb?.classList.toggle('taskbar-auto-hide',!!tbSaved.autoHide)},120);
  window.switchTaskManagerTab=function(tab){
    document.querySelectorAll('[data-tm-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tmTab===tab));
    ['processes','performance','users','details','services','startup'].forEach(x=>document.getElementById('tm'+x[0].toUpperCase()+x.slice(1))?.classList.toggle('hidden',x!==tab));
    if(tab==='performance')refreshTaskPerformance();
    if(tab==='users')refreshTaskUsers();
    if(tab==='details')refreshTaskDetails();
    if(tab==='services')refreshTaskServices();
    if(tab==='startup')refreshTaskStartup();
  };
  window.refreshTaskManager=async function(){
    try{
      const d=await api('/api/control/task-manager');
      const summary=document.getElementById('taskSummary'); if(summary)summary.textContent=`${d.count||0} processes • ${d.source||'local'} • Alice server protected`;
      const list=document.getElementById('taskList'); if(!list)return;
      list.innerHTML=(d.processes||[]).map(p=>`<div class="task-line task-row"><span><b>${esc(p.name)}</b><small>${esc(p.user||'local')}</small></span><span>${esc(p.pid)}</span><span>${esc(p.cpu)}%</span><span>${esc(p.memory)}%</span><span>${esc(p.status)}</span><span>${p.can_terminate?`<button class="danger-btn" onclick="terminateAliceProcess(${Number(p.pid)})">End task</button>`:'<small class="muted">Protected</small>'}</span></div>`).join('')||'<div class="muted">No process data.</div>';
    }catch(e){toast('Task Manager',e.message)}
  };
  window.terminateAliceProcess=async function(pid){
    if(!confirm(`End local process ${pid}? Unsaved work in that process may be lost.`))return;
    try{const d=await api('/api/control/task-manager/terminate',{method:'POST',body:JSON.stringify({pid})});toast('Task Manager',d.message||d.error||'Done');refreshTaskManager();}catch(e){toast('Task Manager',e.message)}
  };
  window.openTaskManagerFull=function(){
    openControlCenter();controlTab('tasks');switchTaskManagerTab('processes');refreshTaskManager();
  };
  window.refreshTaskPerformance=async function(){
    try{const d=await api('/api/system');
      [['tmCpu','tmCpuBar','cpu_percent'],['tmRam','tmRamBar','ram_percent'],['tmStorage','tmStorageBar','storage_percent']].forEach(([v,b,k])=>{const val=Number(d[k]||0);if(document.getElementById(v))document.getElementById(v).textContent=val+'%';if(document.getElementById(b))document.getElementById(b).style.width=Math.max(2,Math.min(100,val))+'%';});
      const n=await api('/api/network/status');const online=n.network_enabled?'Connected':'Offline';document.getElementById('tmNetwork').textContent=online;document.getElementById('tmNetworkBar').style.width=online==='Connected'?'100%':'8%';
    }catch(e){toast('Task Manager',e.message)}
  };
  window.refreshTaskUsers=async function(){const h=document.getElementById('tmUsersList');if(h)h.innerHTML=`<div class="task-detail-card"><b>Current owner</b><span>${esc(settings.user_name||'Owner')}</span><small>Local Alice session</small></div>`};
  window.refreshTaskDetails=async function(){try{const d=await api('/api/control/task-manager');const h=document.getElementById('tmDetailsList');if(h)h.innerHTML=(d.processes||[]).map(p=>`<div class="task-detail-card"><b>${esc(p.name)}</b><span>PID ${esc(p.pid)} • ${esc(p.status)}</span><small>CPU ${esc(p.cpu)}% • Memory ${esc(p.memory)}% • ${esc(p.user||'local')}</small></div>`).join('')}catch(e){toast('Task Manager',e.message)}};
  window.refreshTaskServices=async function(){try{const d=await api('/api/control/task-manager/services');const h=document.getElementById('tmServicesList');if(h)h.innerHTML=(d.services||[]).map(s=>`<div class="task-detail-card"><b>${esc(s.name)}</b><span>${esc(s.active)}</span><small>${esc(s.description||'')}</small></div>`).join('')||'<div class="muted">No systemd service inventory available on this host.</div>'}catch(e){toast('Services',e.message)}};
  window.refreshTaskStartup=async function(){const h=document.getElementById('tmStartupList');if(h)h.innerHTML='<div class="task-detail-card"><b>Alice startup</b><span>Owner-controlled</span><small>Use Accounts & Security to configure launch, restore windows and start-locked behavior.</small></div>'};
  const oldBoot=window.boot;
  document.addEventListener('keydown',e=>{
    const key=e.key.toLowerCase();
    if(e.key==='Escape'){
      document.getElementById('winXMenu')?.classList.add('hidden');document.getElementById('taskViewPanel')?.classList.add('hidden');document.getElementById('calendarPanel')?.classList.add('hidden');
    }
    if(e.metaKey && key==='x'){e.preventDefault();toggleWinX();}
    if(e.metaKey && key==='b'){e.preventDefault();openWindow('devices');}
    if(e.metaKey && key==='t'){e.preventDefault();openTermuxTerminal();}
    if(e.metaKey && key==='j'){e.preventDefault();openTaskManagerFull();}
  });
  document.addEventListener('contextmenu',e=>{
    if(e.target.closest('#taskbar')){e.preventDefault();toggleWinX();}
  });
  document.addEventListener('mousedown',e=>{
    const wx=document.getElementById('winXMenu');if(wx&&!wx.classList.contains('hidden')&&!e.target.closest('#winXMenu,#taskbar'))wx.classList.add('hidden');
  });
})();

