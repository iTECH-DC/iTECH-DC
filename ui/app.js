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
 if(type==="files") initFiles(w); if(type==="vault") initVault(w); if(type==="home") initHome(w); if(type==="cloud") initCloud(w);
 bring(w);updateTaskbar();saveWindowState();
}
function windowHTML(type){const names={home:"Alice Home",files:"Files & Data",chat:"Alice Chat",terminal:"Alice Terminal",skills:"Skills & Tools",settings:"Settings",vault:"Memory Vault",cloud:"Alice Cloud",devices:"Devices & Locator",security:"Security Lab"};return `<div class="titlebar"><strong>${names[type]||"Alice"}</strong><button class="close">✕</button></div><div class="window-content" id="content-${type}"></div>`}

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
async function initDevices(w){
 const c=w.querySelector(".window-content");
 c.innerHTML=`<h2>Devices & Locator</h2>
 <p class="muted">Permission-based location map for this device and trusted people who explicitly share their location. IP addresses are not used to secretly locate people.</p>
 <div class="locator-toolbar"><button id="locPermission" class="primary-btn">Enable location permission</button><button id="locSelf">Use my current location</button><button id="locRefresh">Refresh map</button></div>
 <div id="locMap" class="locator-map"><div class="map-grid"></div><div class="map-center-label">ALICE LOCATION MAP</div></div>
 <div id="locList" class="locator-list">Loading…</div>
 <div class="card"><b>Add a shared trusted-contact location</b><p class="muted">Only add coordinates the person has intentionally shared with you.</p><div class="locator-form"><input id="locName" placeholder="Name"><input id="locLat" type="number" step="any" placeholder="Latitude"><input id="locLon" type="number" step="any" placeholder="Longitude"><label><input id="locConfirmed" type="checkbox"> They explicitly shared this location</label><button id="locAdd" class="primary-btn">Add to map</button></div></div>`;
 const map=$('locMap'), list=$('locList');
 function project(lat,lon){const x=Math.max(2,Math.min(98,(lon+180)/360*100));const y=Math.max(5,Math.min(95,(90-lat)/180*100));return [x,y]}
 function render(d){
   map.querySelectorAll('.map-pin').forEach(x=>x.remove());
   const items=[]; if(d.self)items.push({...d.self,self:true}); (d.contacts||[]).forEach(x=>items.push(x));
   items.forEach(item=>{const pin=document.createElement('div');pin.className='map-pin '+(item.self?'self':'contact');const [x,y]=project(Number(item.latitude),Number(item.longitude));pin.style.left=x+'%';pin.style.top=y+'%';pin.title=`${item.name} • ${Number(item.latitude).toFixed(4)}, ${Number(item.longitude).toFixed(4)}`;pin.innerHTML='<span></span><b>'+escapeHtml(item.name)+'</b>';map.appendChild(pin)});
   list.innerHTML=items.length?items.map(item=>`<div class="locator-item"><span class="locator-dot ${item.self?'self':'contact'}"></span><div><b>${escapeHtml(item.name)}</b><small>${Number(item.latitude).toFixed(5)}, ${Number(item.longitude).toFixed(5)}${item.accuracy_m?` • ±${Math.round(item.accuracy_m)} m`:''}</small></div>${item.self?'':`<button onclick="removeLocatorContact('${escapeHtml(item.id)}')">Remove</button>`}</div>`).join(''):'<div class="card muted">No shared locations yet.</div>';
 }
 async function refresh(){try{const d=await api('/api/locator/map');render(d);$('locPermission').textContent=d.sharing_enabled?'Location permission enabled':'Enable location permission';}catch(e){list.textContent=e.message}}
 $('locPermission').onclick=async()=>{try{const d=await api('/api/locator/permission',{method:'POST',body:JSON.stringify({enabled:true})});toast('Locator',d.sharing_enabled?'Location permission enabled.':'Location permission disabled.');refresh()}catch(e){toast('Locator',e.message)}};
 $('locSelf').onclick=()=>{if(!navigator.geolocation){toast('Locator','This host does not provide geolocation.');return}navigator.geolocation.getCurrentPosition(async pos=>{try{await api('/api/locator/self',{method:'POST',body:JSON.stringify({latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy_m:pos.coords.accuracy,label:'This device'})});toast('Locator','Your location was saved locally.');refresh()}catch(e){toast('Locator',e.message)}},err=>toast('Locator','Location permission was denied or unavailable.'),{enableHighAccuracy:true,timeout:10000,maximumAge:30000})};
 $('locRefresh').onclick=refresh;
 $('locAdd').onclick=async()=>{try{await api('/api/locator/contact',{method:'POST',body:JSON.stringify({name:$('locName').value,latitude:$('locLat').value,longitude:$('locLon').value,sharing_confirmed:$('locConfirmed').checked})});$('locName').value='';$('locLat').value='';$('locLon').value='';$('locConfirmed').checked=false;toast('Locator','Shared location added to the local map.');refresh()}catch(e){toast('Locator',e.message)}};
 refresh();
}
function initSecurity(w){const c=w.querySelector(".window-content");c.innerHTML=`<h2>Security & Protection</h2><p class="muted">Owner-controlled protection for this PC. Camera and phone alerts are opt-in.</p><div class="skill"><b>Real-time system protection</b><br><span class="muted">Alice monitors local system status and security events.</span></div><div class="setting-row"><span>Camera capture after failed unlock</span><input id="secCamera" type="checkbox"></div><div class="setting-row"><span>Phone security alerts</span><input id="secPhone" type="checkbox"></div><label class="muted">Owner-configured HTTPS phone notification webhook<input id="secWebhook" placeholder="https://your-notification-service/..." style="width:100%;margin-top:6px"></label><button id="secSave" class="primary-btn">Save protection settings</button><div id="secStatus" class="card">Loading security status…</div><div class="skill"><b>Permission control</b><br><span class="muted">Alice requests camera permission through the browser/host OS. Network alerts only work after you explicitly enable Network access.</span></div>`;initSecurityAlerts(c)}
async function initFiles(w){
 const c=w.querySelector(".window-content");
 c.innerHTML=`<h2>Files & Data</h2><div class="file-toolbar"><button id="upDir">↑ Up</button><button id="newFolder">＋ Folder</button><span id="filePath" class="muted">/</span></div><div id="fileGrid" class="file-grid">Loading...</div>`;
 let current="";
 async function load(){
  try{
   const d=await api("/api/files?path="+encodeURIComponent(current));
   $("filePath").textContent="/"+d.path;$("fileGrid").innerHTML="";
   d.items.forEach(item=>{
    const el=document.createElement("div");el.className="file-item";
    el.innerHTML=`<div class="file-icon">${item.type==="folder"?"▰":"▤"}</div><div class="file-name">${escapeHtml(item.name)}</div><div class="file-meta">${item.type==="folder"?"Folder":(Math.round(item.size/1024*10)/10)+" KB"}</div>`;
    el.onclick=()=>{if(item.type==="folder"){current=item.path;load()}};
    $("fileGrid").appendChild(el);
   });
  }catch(e){$("fileGrid").textContent=e.message}
 }
$("newFolder").onclick=async()=>{
   const name=prompt("New folder name:");
   if(!name)return;
   try{await api("/api/files/create-folder",{method:"POST",body:JSON.stringify({path:current,name})});load();toast("Files","Folder created.");}
   catch(e){toast("Files",e.message)}
  };
  $("upDir").onclick=()=>{if(!current)return;const a=current.split("/");a.pop();current=a.join("/");load()};load();
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
async function refreshAliceCapabilities(){try{const d=await api("/api/capabilities");const badge=document.querySelector(".offline-badge");const pill=$("offlinePill");if(badge){badge.textContent=d.mode.toUpperCase();badge.classList.toggle("online",d.mode==="online");}if(pill){pill.title=d.policy;}const internetButtons=document.querySelectorAll('[data-alice-internet]');internetButtons.forEach(b=>b.disabled=!d.capabilities.alice_internet);return d;}catch(_){return null}}
async function refreshNetworkStatus(){
  try{
    const d=await api("/api/network/status");
    const on=!!d.enabled;
    const quality=d.quality||(!on?'offline':'moderate');
    const label=quality==='online'?'Online':quality==='moderate'?'Moderate':'Offline';
    const latency=Number.isFinite(Number(d.latency_ms))?` • ${Math.round(Number(d.latency_ms))} ms`:'';
    $("networkStateText").textContent=`${label}${latency} — ${on?'Alice network access enabled':'Alice network access disabled'}`;
    $("networkToggle").textContent=on?"Disable":"Enable";
    const pill=$("offlinePill");
    if(pill){
      pill.classList.remove('network-online','network-moderate','network-offline');
      pill.classList.add(`network-${quality}`);
      pill.innerHTML=quality==='online'?"<span></span> Online":quality==='moderate'?"<span></span> Moderate":"<span></span> Offline";
    }
    await refreshAliceCapabilities();
  }catch(e){toast("Network",e.message)}
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
async function refreshConnectivity(){try{const d=await api("/api/control/connectivity");const r=d.radios||{};const w=r.wifi||{},b=r.bluetooth||{};const a=r.airplane_mode;$("connectivityList").innerHTML=`<div class="radio-hero"><div><b>Connectivity</b><small>${a?'Airplane mode is ON':'Radios are independently controlled'}</small></div><span class="radio-live ${a?'off':''}">${a?'AIRPLANE':'READY'}</span></div><div class="radio-grid"><div class="radio-card"><div class="radio-icon">⌁</div><div><b>Wi‑Fi</b><small>${escapeHtml(w.state||'unavailable')}</small></div><button class="primary-btn" onclick="toggleAliceRadio('wifi',${w.enabled?'false':'true'})" ${w.available?'':'disabled'}>${w.enabled?'Turn off':'Turn on'}</button></div><div class="radio-card"><div class="radio-icon">ᛒ</div><div><b>Bluetooth</b><small>${escapeHtml(b.state||'unavailable')}</small></div><button class="primary-btn" onclick="toggleAliceRadio('bluetooth',${b.enabled?'false':'true'})" ${b.available?'':'disabled'}>${b.enabled?'Turn off':'Turn on'}</button></div><div class="radio-card airplane-card"><div class="radio-icon">✈</div><div><b>Airplane mode</b><small>Wi‑Fi + Bluetooth</small></div><button class="primary-btn" onclick="toggleAliceAirplane(${a?'false':'true'})">${a?'Turn off':'Turn on'}</button></div></div><div class="control-card"><b>Network access for Alice</b><div>${d.network_enabled?'Enabled':'Disabled / offline'}</div><small>This is Alice's application-level network permission and is separate from the hardware radios.</small></div><div class="control-card"><b>Wi‑Fi networks</b><div id="wifiNetworks" class="control-list"><button onclick="scanAliceWifi()">Scan for networks</button></div><div class="wifi-connect-row"><input id="wifiSsid" placeholder="Network name (SSID)"><input id="wifiPassword" type="password" placeholder="Password"><button class="primary-btn" onclick="connectAliceWifi()">Connect</button></div></div><div class="control-card"><b>Adapters</b>${(d.interfaces||[]).map(x=>`<div class="network-line"><b>${escapeHtml(x.name||"adapter")}</b><span>${x.up?"UP":"DOWN"}</span><small>${escapeHtml((x.addresses||[]).map(a=>a.address||"").join(", "))}</small></div>`).join('')||'<div class="muted">No adapter information.</div>'}</div>`;}catch(e){toast("Connectivity",e.message)}}
window.toggleAliceRadio=async(kind,on)=>{try{const d=await api('/api/control/radios',{method:'POST',body:JSON.stringify({action:`${kind}_${on?'on':'off'}`})});if(!d.ok)throw new Error(d.error||'Radio change failed.');toast('Connectivity',`${kind==='wifi'?'Wi‑Fi':'Bluetooth'} ${on?'enabled':'disabled'}.`);await refreshConnectivity();}catch(e){toast('Connectivity',e.message)}};
window.toggleAliceAirplane=async on=>{try{const d=await api('/api/control/radios',{method:'POST',body:JSON.stringify({action:`airplane_${on?'on':'off'}`})});if(!d.ok)throw new Error(d.error||'Airplane mode change failed.');toast('Airplane mode',on?'Wi‑Fi and Bluetooth disabled.':'Previous radio states restored.');await refreshConnectivity();}catch(e){toast('Airplane mode',e.message)}};
window.scanAliceWifi=async()=>{const h=$('wifiNetworks');if(!h)return;h.innerHTML='<div class="muted">Scanning local Wi‑Fi networks…</div>';try{const d=await api('/api/control/wifi/scan');if(!d.ok)throw new Error(d.error||'Wi‑Fi scan unavailable.');h.innerHTML=(d.networks||[]).map(n=>`<button class="wifi-network" onclick="$('wifiSsid').value=${JSON.stringify(n.ssid)}"><b>${escapeHtml(n.ssid)}</b><span>${escapeHtml(n.signal)}% • ${escapeHtml(n.security||'Open')}</span></button>`).join('')||'<div class="muted">No visible networks.</div>';}catch(e){h.textContent=e.message}};
window.connectAliceWifi=async()=>{const ssid=$('wifiSsid')?.value||'',password=$('wifiPassword')?.value||'';if(!ssid.trim()){toast('Wi‑Fi','Enter a network name first.');return;}try{const d=await api('/api/control/wifi/connect',{method:'POST',body:JSON.stringify({ssid,password})});if(!d.ok)throw new Error(d.message||d.error||'Wi‑Fi connection failed.');if($('wifiPassword'))$('wifiPassword').value='';toast('Wi‑Fi','Connection request sent to NetworkManager.');await refreshConnectivity();}catch(e){toast('Wi‑Fi',e.message)}};

window.openAliceInternet=async function(){const p=$("aliceInternetPanel");if(!p)return;p.classList.remove("hidden");await refreshAliceInternet();};
window.closeAliceInternet=function(){$("aliceInternetPanel")?.classList.add("hidden")};
async function refreshAliceInternet(){try{const d=await api("/api/internet/status");const state=$("aliceInternetState"),notice=$("aliceInternetNotice");if(state)state.textContent=d.available?"Internet available. Alice Internet is ready.":"Alice is offline. Alice Internet is unavailable.";if(notice){notice.innerHTML=d.available?"<b>Online</b><br>Web access is available while Alice network access is enabled.":"<b>Offline</b><br>Alice Internet is disabled until Internet connectivity is available. Local Alice features continue working.";}}catch(e){if($("aliceInternetState"))$("aliceInternetState").textContent="Unable to determine network state."}}
window.navigateAliceInternet=async function(url){try{const d=await api("/api/internet/status");if(!d.available){toast("Alice Internet","Internet is unavailable. Alice OS remains fully usable offline.");return;}window.open(url,"_blank","noopener");}catch(e){toast("Alice Internet",e.message)}};
window.searchAliceInternet=async function(){const q=$("aliceInternetQuery")?.value.trim();if(!q)return;await navigateAliceInternet("https://duckduckgo.com/?q="+encodeURIComponent(q));};

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
      if(el){
        const quality=d.quality||(!d.enabled?'offline':'moderate');
        el.classList.remove('online','moderate','offline');
        el.classList.add(quality);
        const latency=Number.isFinite(Number(d.latency_ms))?` • ${Math.round(Number(d.latency_ms))} ms`:'';
        el.textContent=(quality==='online'?'Online':quality==='moderate'?'Moderate':'Offline')+latency;
        el.title=quality==='online'?'Internet connection is reachable.':quality==='moderate'?'Network adapter is available, but the internet connection is unavailable or slow.':'No usable internet connection detected.';
      }
    }catch(_){
      const el=$('targetNetworkState');
      if(el){el.classList.remove('online','moderate');el.classList.add('offline');el.textContent='Offline';}
    }
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
    home:{name:'Alice Home',icon:'__ALICE_LOGO__',action:'home'},chat:{name:'Alice Chat',icon:'◌',action:'chat'},
    intelligence:{name:'Intelligence',icon:'✧',action:'intelligence'},files:{name:'Files & Data',icon:'▤',action:'files'},
    terminal:{name:'Terminal',icon:'>_',action:'terminal'},skills:{name:'Skills Hub',icon:'▦',action:'skills'},
    software:{name:'Software Center',icon:'⬇',action:'software'}, internet:{name:'Alice Internet',icon:'◎',action:'internet'},control:{name:'System Control',icon:'◫',action:'control'},
    security:{name:'Security Lab',icon:'◇',action:'security'},devices:{name:'Devices & Locator',icon:'◈',action:'devices'},
    vault:{name:'Memory Vault',icon:'▣',action:'vault'}, cloud:{name:'Alice Cloud',icon:'☁',action:'cloud'},settings:{name:'Settings',icon:'⚙',action:'settings'},
    accounts:{name:'Accounts',icon:'◎',action:'accounts'},lock:{name:'Lock Alice',icon:'⏻',action:'lock'}
  };
  const widgetCatalog={
    weather:{name:'Weather',icon:'☁',desc:'Local weather display card.',builtIn:true},
    system:{name:'System Status',icon:'▣',desc:'Live CPU, RAM and storage usage.',builtIn:true},
    network:{name:'Network',icon:'⌁',desc:'Loopback/network and Bluetooth status.',builtIn:true},
    assistant:{name:'Alice Assistant',icon:'__ALICE_LOGO__',desc:'Quick access to Alice voice control.',builtIn:true},
    clock:{name:'Clock & Date',icon:'◷',desc:'Large local time and date widget.'},
    note:{name:'Quick Note',icon:'✎',desc:'A small local note pad for the desktop.'},
    calendar:{name:'Calendar',icon:'▦',desc:'Local calendar and upcoming date display.'},
    battery:{name:'Battery',icon:'▰',desc:'Device battery status when the browser exposes it.'},
    shortcuts:{name:'Quick Shortcuts',icon:'✦',desc:'One-click access to your favorite Alice tools.'},
    memory:{name:'Memory',icon:'▣',desc:'Shows locally saved Alice note size.'}
  };
  let layout=loadLayout();
  let dragId=null;

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
      b.innerHTML=`<span class="desktop-icon ${id==='home'?'di-alice':''}">${a.icon==='__ALICE_LOGO__'?'<img src="/assets/alice-logo.svg" alt="Alice OS">':esc(a.icon)}</span><b>${esc(a.name)}</b>`;
      b.onclick=()=>{if(id==='lock')lockAlice();else if(id==='software')openSoftwareCenter();else if(id==='internet')openAliceInternet();else if(id==='control')openControlCenter();else if(id==='accounts')openAccountsCenter();else openWindow(a.action)};
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
    host.innerHTML=installed.length?installed.map((w,i)=>`<div class="customizer-row" draggable="true" data-wdrag="${esc(layout.widgets[i])}"><span class="customizer-icon">${esc(w.icon)}</span><div class="row-main"><b>${esc(w.name)}</b><small>${esc(w.desc)}</small></div><button onclick="setWidgetSize('${esc(layout.widgets[i])}',widgetSize('${esc(layout.widgets[i])}')==='small'?'medium':widgetSize('${esc(layout.widgets[i])}')==='medium'?'large':'small')">Size: ${esc(widgetSize(layout.widgets[i]))}</button><button onclick="removeHomeWidget('${esc(layout.widgets[i])}')">Delete</button></div>`).join(''):'<div class="customizer-empty">No widgets are installed. Open Widget Gallery to add some.</div>';
    host.querySelectorAll('[data-wdrag]').forEach(row=>{row.addEventListener('dragstart',()=>dragId=row.dataset.wdrag);row.addEventListener('dragover',e=>e.preventDefault());row.addEventListener('drop',e=>{e.preventDefault();const to=row.dataset.wdrag;if(dragId&&to&&dragId!==to){reorder(layout.widgets,dragId,to);saveLayout();renderWidgets();renderCustomizerWidgets()}})});
  }
  function renderCustomizerIcons(){
    const host=$('customizerIcons');if(!host)return;
    host.innerHTML=layout.icons.map(id=>{const a=iconCatalog[id];return a?`<div class="customizer-row"><span class="customizer-icon">${esc(a.icon)}</span><div class="row-main"><b>${esc(a.name)}</b><small>Desktop shortcut</small></div><button class="danger-btn" onclick="removeDesktopIcon('${id}')">Delete</button></div>`:''}).join('')||'<div class="customizer-empty">No desktop icons. Add one from the list below.</div>';
    const available=Object.entries(iconCatalog).filter(([id])=>!layout.icons.includes(id));
    host.innerHTML += `<div class="customizer-empty"><b>Add a desktop icon</b><div class="gallery-actions" style="margin-top:9px;display:flex;flex-wrap:wrap">${available.map(([id,a])=>`<button onclick="addDesktopIcon('${id}')">＋ ${esc(a.name)}</button>`).join('')||'<span>All available shortcuts are already on the desktop.</span>'}</div></div>`;
  }
  function renderCustomizerTaskbar(){
    const host=$('customizerTaskbar');if(!host)return;
    const pinned=layout.taskbar||[];
    const rows=pinned.map(id=>{const a=iconCatalog[id];return a?`<div class="customizer-row"><span class="customizer-icon">${esc(a.icon)}</span><div class="row-main"><b>${esc(a.name)}</b><small>Taskbar shortcut</small></div><button class="danger-btn" onclick="unpinTaskbar('${id}')">Unpin</button></div>`:''}).join('');
    const available=Object.entries(iconCatalog).filter(([id])=>!pinned.includes(id));
    host.innerHTML=(rows||'<div class="customizer-empty">No pinned apps.</div>')+`<div class="customizer-empty"><b>Pin an app</b><div class="gallery-actions" style="margin-top:9px;display:flex;flex-wrap:wrap">${available.map(([id,a])=>`<button onclick="pinTaskbar('${id}')">＋ ${esc(a.name)}</button>`).join('')||'<span>All available apps are pinned.</span>'}</div></div>`;
  }
  window.pinTaskbar=function(id){if(!iconCatalog[id])return;if(!Array.isArray(layout.taskbar))layout.taskbar=[];if(!layout.taskbar.includes(id))layout.taskbar.push(id);saveLayout();renderTaskbarPins();renderCustomizerTaskbar();toast('Taskbar',`${iconCatalog[id].name} pinned.`)};
  window.unpinTaskbar=function(id){layout.taskbar=(layout.taskbar||[]).filter(x=>x!==id);saveLayout();renderTaskbarPins();renderCustomizerTaskbar();toast('Taskbar',`${iconCatalog[id]?.name||id} unpinned.`)};
  function renderTaskbarPins(){
    const host=document.querySelector('.task-pinned');if(!host)return;host.innerHTML='';
    (layout.taskbar||[]).forEach(id=>{const a=iconCatalog[id];if(!a)return;const b=document.createElement('button');b.className='task-icon';b.title=a.name;b.setAttribute('aria-label',a.name);b.innerHTML=esc(a.icon);b.onclick=()=>{if(id==='lock')lockAlice();else if(id==='software')openSoftwareCenter();else if(id==='control')openControlCenter();else if(id==='accounts')openAccountsCenter();else openWindow(a.action)};b.addEventListener('contextmenu',e=>{e.preventDefault();unpinTaskbar(id)});host.appendChild(b)});
  }
  window.renderTaskbarPins=renderTaskbarPins;

  function renderCustomizerGallery(){
    const host=$('customizerGallery');if(!host)return;
    host.innerHTML=`<div class="gallery-toolbar"><input id="widgetGallerySearch" placeholder="Search widgets…"><button onclick="importWidgetManifest()">＋ Import</button></div><div class="customizer-empty" style="text-align:left;margin-bottom:4px">Widgets are local and safe by design. Download exports a manifest; Import accepts <b>.alicewidget.json</b> metadata only and never executes downloaded code.</div><div class="gallery-grid" id="widgetGalleryGrid">${Object.entries(widgetCatalog).map(([id,w])=>`<article class="gallery-card" data-widget-search="${esc((w.name+' '+w.desc).toLowerCase())}"><div class="gallery-preview">${esc(w.icon)}</div><b>${esc(w.name)}</b><p>${esc(w.desc)}</p><div class="gallery-actions"><button class="primary" onclick="addHomeWidget('${id}')">＋ Install</button><button onclick="downloadWidgetManifest('${id}')">↓ Download</button></div></article>`).join('')}</div><div class="customizer-empty" style="margin-top:9px"><b>More apps</b><p>Use Software Center for actual application installation and updates.</p><button onclick="closeHomeCustomizer();openSoftwareCenter()">Open Software Center</button></div>`;
    const search=$('widgetGallerySearch');if(search)search.oninput=()=>{const q=search.value.toLowerCase();document.querySelectorAll('#widgetGalleryGrid [data-widget-search]').forEach(c=>c.style.display=!q||c.dataset.widgetSearch.includes(q)?'block':'none')};
  }
  window.downloadWidgetManifest=function(id){
    const w=widgetCatalog[id];if(!w)return;const blob=new Blob([JSON.stringify({format:'alice-widget',version:1,id,name:w.name,description:w.desc,offline:true},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${id}.alicewidget.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);toast('Widget','Widget manifest downloaded locally.');
  };
  window.importWidgetManifest=function(){
    const input=document.createElement('input');input.type='file';input.accept='.json,.alicewidget.json,application/json';
    input.onchange=()=>{const f=input.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const m=JSON.parse(String(r.result));if(m.format!=='alice-widget'||!m.id||!m.name){throw new Error('Invalid Alice widget manifest.')}if(!/^[a-z0-9_-]{2,40}$/i.test(m.id)){throw new Error('Invalid widget id.')}if(widgetCatalog[m.id]){addHomeWidget(m.id);toast('Widget','Installed the matching built-in widget.');return;}widgetCatalog[m.id]={name:String(m.name).slice(0,60),icon:'✦',desc:String(m.description||'Imported local widget').slice(0,140),imported:true};addHomeWidget(m.id);renderCustomizerGallery();toast('Widget','Imported metadata only. No downloaded code was executed.')}catch(e){toast('Widget import',e.message||'Invalid manifest.')}};r.readAsText(f)};input.click();
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
  window.openAliceAssistant=async()=>{const p=panel();if(!p)return;p.classList.remove('hidden');document.getElementById('assistantInput')?.focus();try{await api('/api/alice-assistant/status')}catch(e){toast('Alice','Local assistant is unavailable.');}try{const m=await api('/api/ai/parity');const f=document.getElementById('assistantModeFoot');if(f)f.textContent=m.mode==='online-ai'?'● Online AI active':(m.mode==='online-local'?'◐ Online · local brain':'◐ Offline parity · local brain');}catch(e){}};
  window.closeAliceAssistant=()=>panel()?.classList.add('hidden');
  function add(role,text,label){const host=document.getElementById('assistantTranscript');if(!host)return;const row=document.createElement('div');row.className=`assistant-message ${role}`;const name=role==='alice'?(label||'Alice'):'You';row.innerHTML=`<b>${esc(name)}</b><span>${esc(text).replace(/\n/g,'<br>')}</span>`;host.appendChild(row);host.scrollTop=host.scrollHeight;}
  window.askAlicePreset=(text)=>{const i=document.getElementById('assistantInput');if(i)i.value=text;document.getElementById('assistantForm')?.requestSubmit();};
  async function ask(text){text=String(text||'').trim();if(!text)return;add('user',text);const i=document.getElementById('assistantInput');if(i)i.value='';try{const d=await api('/api/alice-assistant/query',{method:'POST',body:JSON.stringify({text})});const prov=d.provider?(d.provider==='offline-brain'?'Alice · local brain':(d.provider==='gpt'?'GPT · online':(d.provider==='claude'?'Claude · online':d.provider))):'Alice';add('alice',d.answer||d.message||'I could not find a local answer.',prov);}catch(e){add('alice','The local assistant service is unavailable right now. Check Alice System Control.');}}
  document.addEventListener('DOMContentLoaded',()=>{document.getElementById('assistantForm')?.addEventListener('submit',e=>{e.preventDefault();ask(document.getElementById('assistantInput')?.value);});});
})();
// ---------- end v10.8 Unified Assistant ----------

// ---------- Alice OS v11.7 Intelligence Core ----------
(() => {
  const esc = window.escapeHtml || (x => String(x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  const $ = id => document.getElementById(id);
  const panel = () => $('aliceIntelligenceCore');
  function add(role,text,provider='FRIDAY'){
    const host=$('aiCoreTranscript'); if(!host)return;
    const row=document.createElement('div'); row.className=`assistant-message ${role}`;
    row.innerHTML=`<b>${role==='alice'?esc(provider):'You'}</b><span>${esc(text).replace(/\n/g,'<br>')}</span>`;
    host.appendChild(row); host.scrollTop=host.scrollHeight;
  }
  window.openAliceIntelligenceCore=async()=>{const p=panel();if(!p)return;p.classList.remove('hidden');await refreshAliceAI();await loadCyberTools();$('aiCoreInput')?.focus();};
  window.closeAliceIntelligenceCore=()=>panel()?.classList.add('hidden');
  async function refreshAliceAI(){
    try{
      const d=await api('/api/ai/status');
      $('aiOpenAIStatus').textContent=d.gpt.configured?(d.gpt.enabled?'Ready':'Key detected; disabled'):'API key not configured';
      $('aiAnthropicStatus').textContent=d.claude.configured?(d.claude.enabled?'Ready':'Key detected; disabled'):'API key not configured';
      $('aiSecurityStatus').textContent=d.security_ai.enabled?'Local defensive audit':'Disabled';
      $('aiFridayStatus').textContent=d.friday.enabled?'Active':'Disabled';
      if($('aiAutoOnline'))$('aiAutoOnline').checked=d.auto_online_ai!==false;
      $('aiNetworkEnabled').checked=!!d.network_ai_enabled;
      $('aiOpenAIEnabled').checked=!!d.gpt.enabled;
      $('aiAnthropicEnabled').checked=!!d.claude.enabled;
      $('aiSecurityEnabled').checked=!!d.security_ai.enabled;
      $('aiOpenAIModel').value=d.gpt.model||'gpt-5.6-luna';
      $('aiAnthropicModel').value=d.claude.model||'claude-sonnet-5';
      $('aiSecurityModel').value=d.security_ai.cloud_model||'gpt-5.6-cyber';
      $('aiRoutingMode').value=d.routing_mode||'friday-smart';
      $('aiNetworkFoot').textContent=d.cloud_ready?'Online AI ACTIVE':'Offline parity';
      renderAIParity(d);
    }catch(e){add('alice','Intelligence status is unavailable.','FRIDAY');}
  }
  function renderAIParity(d){
    const banner=$('aiParityBanner'); if(!banner)return;
    const mode=d.mode||'offline-local';
    const online=!!d.online;
    const quality=d.quality||'offline';
    banner.dataset.mode=mode;
    const dot=$('aiParityDot'); if(dot)dot.className='ai-parity-dot '+(online?'on':'off');
    const title=$('aiParityMode'), detail=$('aiParityDetail');
    if(mode==='online-ai'){
      if(title)title.textContent='Online — running directly with AI';
      if(detail)detail.textContent=`Provider ready · ${quality} connection · cloud responses enabled`;
    } else if(mode==='online-local'){
      if(title)title.textContent='Online — local brain (no provider ready)';
      if(detail)detail.textContent='Connected, but no cloud key/model is enabled. Enable GPT or Claude for direct AI.';
    } else {
      if(title)title.textContent='Offline — local brain parity';
      if(detail)detail.textContent='No network needed. Full local reasoning, math, definitions and system skills.';
    }
  }
  window.saveAliceAIConfig=async()=>{
    try{
      const d=await api('/api/ai/config',{method:'POST',body:JSON.stringify({auto_online_ai:$('aiAutoOnline')?.checked!==false,network_ai_enabled:$('aiNetworkEnabled').checked,openai_enabled:$('aiOpenAIEnabled').checked,anthropic_enabled:$('aiAnthropicEnabled').checked,security_ai_enabled:$('aiSecurityEnabled').checked,friday_enabled:true,openai_model:$('aiOpenAIModel').value,anthropic_model:$('aiAnthropicModel').value,security_model:$('aiSecurityModel').value,routing_mode:$('aiRoutingMode').value})});
      await refreshAliceAI(); toast('Intelligence Core',d.ok?'Settings saved locally.':'Could not save settings.');
    }catch(e){toast('Intelligence Core',e.message);}
  };
  // ----- Cool Ethical Security Workbench console -----
  let cyberTools=[], cyberCategory='all';
  const CYBER_CAT_ICON={recon:'\u2316',network:'\u21c4',hardening:'\u26e8',supply:'\u26d3',analysis:'\u2315',forensics:'\u2318',lab:'\u2623',password:'\u26bf',web:'\u2318',malware:'\u2623',code:'{ }',other:'\u25c8'};
  function cyberCatId(cat){const c=String(cat||'').toLowerCase();if(c.includes('recon'))return'recon';if(c.includes('network'))return'network';if(c.includes('hardening'))return'hardening';if(c.includes('supply'))return'supply';if(c.includes('analysis')||c.includes('forensic'))return'analysis';if(c.includes('lab'))return'lab';if(c.includes('password'))return'password';if(c.includes('web'))return'web';if(c.includes('malware'))return'malware';if(c.includes('code'))return'code';return'other';}
  function renderCyberTabs(){
    const host=$('cyberTabs'); if(!host)return;
    const cats=['all',...Array.from(new Set(cyberTools.map(t=>cyberCatId(t.category))))];
    host.innerHTML=cats.map(c=>`<button class="cyber-tab ${c===cyberCategory?'active':''}" onclick="setCyberCategory('${c}')">${c==='all'?'\u25c8 All':(CYBER_CAT_ICON[c]||'\u2022')+' '+c}</button>`).join('');
  }
  window.setCyberCategory=(c)=>{cyberCategory=c;renderCyberTabs();renderCyberTools();const lbl=$('cyberActiveCategory');if(lbl)lbl.textContent=c==='all'?'All tools':c+' tools';};
  function renderCyberTools(){
    const box=$('cyberToolsGrid'); if(!box)return;
    const list=cyberTools.filter(t=>cyberCategory==='all'||cyberCatId(t.category)===cyberCategory);
    if(!list.length){box.innerHTML='<span class="cyber-empty">No tools in this category.</span>';return;}
    box.innerHTML=list.map(t=>`<button class="cyber-tool" onclick="runCyberTool(${JSON.stringify(t.id)})"><span class="cyber-tool-ic">${CYBER_CAT_ICON[cyberCatId(t.category)]||'\u25c8'}</span><span class="cyber-tool-body"><b>${esc(t.name)}</b><small>${esc(t.category)}</small><em>${esc(t.description)}</em></span><span class="cyber-tool-go">RUN \u25b8</span></button>`).join('');
  }
  window.loadCyberTools=async()=>{
    const box=$("cyberToolsGrid"); if(!box)return; box.innerHTML='<span class="cyber-empty">Loading defensive tools\u2026</span>';
    try{const d=await api("/api/security/tools"); cyberTools=d.tools||[]; renderCyberTabs(); renderCyberTools(); await refreshCyberToolStatus();}
    catch(e){box.innerHTML='<span class="cyber-empty">Security tool catalog unavailable.</span>';}
  };
  window.refreshCyberToolStatus=async()=>{
    const box=$("cyberStatusGrid"); if(!box)return; box.innerHTML='<span class="cyber-empty">Checking local tool availability\u2026</span>';
    try{const d=await api("/api/security/tool-status"); box.innerHTML=(d.tools||[]).map(t=>`<div class="cyber-status-card ${t.installed?'is-on':'is-off'}"><span class="cyber-dot ${t.installed?'on':'off'}"></span><div><b>${esc(t.tool)}</b><small>${t.installed?esc(t.version||'Available'):'Not installed'}</small></div></div>`).join("");}
    catch(e){box.innerHTML='<span class="cyber-empty">Tool status unavailable.</span>';}
  };
  function cyberPrint(text){const out=$("cyberToolOutput");if(!out)return;out.textContent=text;out.scrollTop=0;}
  function cyberState(s){const el=$("cyberRunState");if(el){el.textContent=s;el.dataset.state=s;}}
  window.clearCyberOutput=()=>{cyberPrint('$ alice-security --ready\nConsole cleared. Awaiting an authorized defensive task\u2026');cyberState('idle');};
  window.runCyberTool=async(id,args={})=>{
    const t=cyberTools.find(x=>x.id===id)||{name:id,category:''};
    cyberState('running');
    cyberPrint(`$ alice-security run ${id}\n> ${t.name} \u00b7 ${t.category}\n> scope: localhost / workspace (defensive)\n\n[ scanning\u2026 ]`);
    try{
      const d=await api("/api/security/tool",{method:"POST",body:JSON.stringify({tool:id,args})});
      const stamp=new Date().toLocaleTimeString();
      cyberPrint(`$ alice-security run ${id}\n> ${t.name} \u00b7 ${t.category}\n> completed ${stamp} \u00b7 status OK\n${'\u2500'.repeat(46)}\n${JSON.stringify(d.result||d,null,2)}`);
      cyberState('done');
    }catch(e){cyberPrint(`$ alice-security run ${id}\n> ${t.name}\n${'\u2500'.repeat(46)}\n[!] error: ${e.message}`);cyberState('error');}
  };
  window.runCyberAudit=async()=>{
    cyberState('running');
    cyberPrint('$ alice-security quick-audit --authorized\n> running local defensive checks\u2026\n');
    const steps=['system_inventory','config_audit','local_ports','secret_scan'];
    let acc='$ alice-security quick-audit --authorized\n> scope: localhost / workspace \u00b7 defensive-only\n\n';
    for(const id of steps){
      const t=cyberTools.find(x=>x.id===id)||{name:id};
      acc+=`[ ${t.name} ] \u2026\n`;
      cyberPrint(acc);
      try{await api("/api/security/tool",{method:"POST",body:JSON.stringify({tool:id,args:{}})});acc+=`  \u2714 ${t.name} complete\n`;}
      catch(e){acc+=`  \u2716 ${t.name} failed: ${e.message}\n`;}
      cyberPrint(acc);
    }
    acc+=`\n${'\u2500'.repeat(46)}\nQuick audit finished. Review findings above. No remote target was touched.`;
    cyberPrint(acc);cyberState('done');
  };

  window.runAliceSecurityReview=async()=>{
    const box=$('aiSecurityReview'); if(!box)return; box.classList.remove('hidden'); box.textContent='Running local defensive review…';
    try{const d=await api('/api/ai/security-review'); const r=d.review||{}; box.innerHTML=`<b>Defensive Security AI</b><div>${esc(r.passed)} checks passed • ${esc(r.warnings)} warning(s)</div><ul>${(r.recommendations||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul><small>Scope: ${esc(r.scope||'local')}</small>`;}catch(e){box.textContent='Security review unavailable.';}
  };
  async function ask(text){text=String(text||'').trim();if(!text)return;add('user',text);$('aiCoreInput').value='';
    try{const d=await api('/api/ai/query',{method:'POST',body:JSON.stringify({text,context:{}})});add('alice',d.answer||d.message||'No answer returned.',d.provider||'FRIDAY');if(d.data?.recommendations?.length){const box=$('aiSecurityReview');if(box){box.classList.remove('hidden');box.innerHTML='<b>Security findings</b><ul>'+d.data.recommendations.map(x=>`<li>${esc(x)}</li>`).join('')+'</ul>';}}}catch(e){add('alice','The Intelligence Core is unavailable.','FRIDAY');}
  }
  document.addEventListener('DOMContentLoaded',()=>{$('aiCoreForm')?.addEventListener('submit',e=>{e.preventDefault();ask($('aiCoreInput')?.value);});});
})();
// ---------- end v11.7 Intelligence Core ----------

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
    openWindow('settings');
    setTimeout(()=>{const b=document.querySelector('.customizer-tabs button[data-tab="taskbar"]'); if(b)b.click();},80);
  };
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

async function removeLocatorContact(id){try{await api('/api/locator/contact/remove',{method:'POST',body:JSON.stringify({id})});const w=windows.devices;if(w){const btn=w.querySelector('#locRefresh');btn?.click()}}catch(e){toast('Locator',e.message)}}

// ---------- Alice Cloud Vault v13.3 ----------
async function initCloud(w){
  const c=w.querySelector('.window-content');
  c.innerHTML=`<h2>Alice Cloud</h2><p class="muted">Persistent memory, process history, scheduling and optional encrypted multi-device sync.</p><div class="cloud-banner"><div class="cloud-orb">☁</div><div><b>Cloud Vault</b><p class="muted">Local-first. Remote sync is encrypted before it leaves this PC and remains disabled until the owner enables it.</p></div></div><div class="cloud-stats" id="windowCloudStats"></div><div class="cloud-tabs"><button onclick="cloudWindowTab('memory')">Memory</button><button onclick="cloudWindowTab('process')">Processes</button><button onclick="cloudWindowTab('schedule')">Schedule</button><button onclick="cloudWindowTab('sync')">Encrypted Sync</button></div><div id="cloudWindowBody"></div>`;
  await loadCloudWindow('memory');
}
window.cloudWindowTab=async function(tab){await loadCloudWindow(tab)};
async function loadCloudWindow(tab){
  const stats=await api('/api/cloud/status');
  const st=$('windowCloudStats'); if(st) st.innerHTML=`<div class="cloud-stat"><b>${stats.memories}</b><small>Memories</small></div><div class="cloud-stat"><b>${stats.events}</b><small>Process records</small></div><div class="cloud-stat"><b>${stats.schedules}</b><small>Schedules</small></div>`;
  const body=$('cloudWindowBody'); if(!body)return;
  if(tab==='memory'){
    body.innerHTML=`<div class="cloud-compose"><textarea id="winCloudMemoryText" placeholder="Tell Alice something to remember…"></textarea><input id="winCloudMemoryTags" placeholder="Tags (optional)"><button class="primary-btn" onclick="saveCloudWindowMemory()">Save to Cloud</button></div><div id="winCloudList" class="panel-list">Loading…</div>`;
    const d=await api('/api/cloud/memories');$('winCloudList').innerHTML=d.items.map(x=>`<div class="cloud-item"><div class="cloud-item-head"><b>${escapeHtml(x.text)}</b><small>${new Date(x.created_at*1000).toLocaleString()}</small></div>${x.tags?`<span class="cloud-badge">${escapeHtml(x.tags)}</span>`:''}</div>`).join('')||'<div class="muted">No memories saved yet.</div>';
  } else if(tab==='process'){
    const d=await api('/api/cloud/events'); body.innerHTML=`<div class="panel-list">${d.items.map(x=>`<div class="cloud-item"><div class="cloud-item-head"><b>${escapeHtml(x.title)}</b><small>${new Date(x.created_at*1000).toLocaleString()}</small></div><span class="cloud-badge">${escapeHtml(x.kind)}</span>${x.detail?`<p class="muted">${escapeHtml(x.detail)}</p>`:''}</div>`).join('')||'<div class="muted">No process history yet.</div>'}</div>`;
  } else if(tab==='sync'){
    const sy=stats.sync||{};
    body.innerHTML=`<div class="cloud-sync-card"><div class="cloud-sync-state"><b>Encrypted Sync</b><span class="cloud-badge">${sy.enabled?'Enabled':'Disabled'}</span></div><p class="muted">The relay stores ciphertext only. Your encryption passphrase never leaves Alice.</p><div class="cloud-compose"><input id="cloudSyncEndpoint" placeholder="https://your-cloud.example.com" value="${escapeHtml(sy.endpoint||'')}"><input id="cloudSyncToken" type="password" placeholder="Owner cloud access token"><input id="cloudSyncPassphrase" type="password" placeholder="Encryption passphrase"><div class="cloud-actions"><button class="primary-btn" onclick="configureCloudSync()">Enable / Save</button><button onclick="pushCloudSync()">Push</button><button onclick="pullCloudSync()">Preview Pull</button><button onclick="disableCloudSync()">Disable</button></div></div><small class="muted">Device ID: ${escapeHtml(sy.device_id||'not configured')} • Revision: ${Number(sy.revision||0)}</small></div>`;
  } else {
    body.innerHTML=`<div class="cloud-compose schedule-form"><input id="winScheduleTitle" placeholder="Reminder title"><input id="winScheduleNote" placeholder="What should Alice remind you about?"><input id="winScheduleTime" type="datetime-local"><select id="winScheduleRepeat"><option value="none">Once</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select><button class="primary-btn" onclick="saveCloudWindowSchedule()">Schedule</button></div><div id="winScheduleList" class="panel-list">Loading…</div>`;
    const d=await api('/api/cloud/schedules');$('winScheduleList').innerHTML=d.items.map(x=>`<div class="cloud-item"><div class="cloud-item-head"><b>${escapeHtml(x.title)}</b><small>${new Date(x.run_at*1000).toLocaleString()}</small></div><span class="cloud-badge">${escapeHtml(x.repeat)} • ${x.enabled?'enabled':'paused'}</span><p class="muted">${escapeHtml(x.note||'')}</p><div class="cloud-actions"><button onclick="toggleCloudSchedule(${x.id},${!x.enabled})">${x.enabled?'Pause':'Resume'}</button><button onclick="deleteCloudSchedule(${x.id})">Delete</button></div></div>`).join('')||'<div class="muted">No schedules yet.</div>';
  }
}

window.configureCloudSync=async function(){try{await api('/api/cloud/sync/configure',{method:'POST',body:JSON.stringify({endpoint:$('cloudSyncEndpoint').value,token:$('cloudSyncToken').value,enabled:true})});toast('Alice Cloud','Encrypted sync enabled.');await loadCloudWindow('sync')}catch(e){toast('Alice Cloud',e.message)}};
window.disableCloudSync=async function(){try{await api('/api/cloud/sync/disable',{method:'POST',body:'{}'});toast('Alice Cloud','Remote sync disabled.');await loadCloudWindow('sync')}catch(e){toast('Alice Cloud',e.message)}};
window.pushCloudSync=async function(){try{const p=$('cloudSyncPassphrase').value;if(!p)throw new Error('Enter the encryption passphrase.');const r=await api('/api/cloud/sync/push',{method:'POST',body:JSON.stringify({passphrase:p})});toast('Alice Cloud',`Encrypted snapshot pushed • revision ${r.revision}`);await loadCloudWindow('sync')}catch(e){toast('Alice Cloud',e.message)}};
window.pullCloudSync=async function(){try{const p=$('cloudSyncPassphrase').value;if(!p)throw new Error('Enter the encryption passphrase.');const r=await api('/api/cloud/sync/pull',{method:'POST',body:JSON.stringify({passphrase:p,apply:false})});toast('Alice Cloud',r.message||`Remote revision ${r.preview?.remote_revision||0} ready for review.`)}catch(e){toast('Alice Cloud',e.message)}};
window.saveCloudWindowMemory=async function(){try{await api('/api/cloud/memory',{method:'POST',body:JSON.stringify({text:$('winCloudMemoryText').value,tags:$('winCloudMemoryTags').value})});toast('Alice Cloud','Memory stored.');await loadCloudWindow('memory')}catch(e){toast('Alice Cloud',e.message)}};
window.saveCloudWindowSchedule=async function(){try{const v=$('winScheduleTime').value;if(!v)throw new Error('Choose a date and time.');await api('/api/cloud/schedule',{method:'POST',body:JSON.stringify({title:$('winScheduleTitle').value,note:$('winScheduleNote').value,run_at:new Date(v).getTime()/1000,repeat:$('winScheduleRepeat').value})});toast('Alice Cloud','Schedule created.');await loadCloudWindow('schedule')}catch(e){toast('Alice Cloud',e.message)}};
window.toggleCloudSchedule=async function(id,enabled){await api('/api/cloud/schedule/toggle',{method:'POST',body:JSON.stringify({id,enabled})});await loadCloudWindow('schedule')};
window.deleteCloudSchedule=async function(id){await api('/api/cloud/schedule/delete',{method:'POST',body:JSON.stringify({id})});await loadCloudWindow('schedule')};
window.openAliceCloud=function(){openWindow('cloud')};
