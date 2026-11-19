"use strict";
const q = (selector, scope = document) => scope.querySelector(selector);
const qa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
const persist = {
  get(key, fallback) { try { return localStorage.getItem("civil3reader-" + key) || fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem("civil3reader-" + key, value); } catch {} }
};
function setSize(value) {
  const sizes = {small:"16px", normal:"18px", large:"21px"};
  if (!sizes[value]) value = "normal";
  document.documentElement.style.setProperty("--body", sizes[value]);
  qa("[data-size]").forEach(btn => btn.setAttribute("aria-pressed", String(btn.dataset.size === value)));
  persist.set("size", value);
}
function setFont(value) {
  if (!["serif", "sans"].includes(value)) value = "serif";
  const name = value === "sans" ? 'ReaderSans,"Malgun Gothic",sans-serif' : 'ReaderSerif,"Noto Serif CJK KR",serif';
  document.documentElement.style.setProperty("--reading-font", name);
  qa("[data-font]").forEach(btn => btn.setAttribute("aria-pressed", String(btn.dataset.font === value)));
  persist.set("font", value);
}
setSize(persist.get("size", "normal"));
setFont(persist.get("font", "serif"));
qa("[data-size]").forEach(b => b.onclick = () => setSize(b.dataset.size));
qa("[data-font]").forEach(b => b.onclick = () => setFont(b.dataset.font));
const menuButton = q(".mobilemenu");
const shade = q(".backdrop");
function setMenu(open) {
  document.body.classList.toggle("navopen", open);
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "강의 목차 닫기" : "강의 목차 열기");
  shade.hidden = !open;
  if (open) q(".sidebar [aria-current]").focus({preventScroll:true});
}
menuButton.setAttribute("aria-expanded","false");
menuButton.onclick = () => setMenu(!document.body.classList.contains("navopen"));
shade.onclick = () => {setMenu(false);menuButton.focus();};
window.matchMedia("(min-width:761px)").addEventListener("change", e => {if (e.matches) setMenu(false);});
function show(id) {
  setMenu(false);
  const d = document.getElementById(id);
  if (!d.open) d.showModal();
}
q(".settingsopen").onclick = () => show("settings");
qa("dialog [data-close]").forEach(b => b.onclick = () => b.closest("dialog").close());
qa("dialog").forEach(d => d.addEventListener("click", e => {
  if(e.target !== d) return;
  const r = d.getBoundingClientRect();
  if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
}));
qa(".graphic").forEach(link => link.addEventListener("click", e => {
  if(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  const d = q("#picture");
  const from = q("img", link);
  q("img",d).src = link.href;
  q("img",d).alt = from.alt;
  q("h2",d).textContent = q("figcaption", link.parentElement).textContent;
  q("a",d).href = link.href;
  show("picture");
}));
qa(".mobileoutline a").forEach(a=>a.onclick=()=>q(".mobileoutline").open=false);
const links = qa(".outline nav a");
const targets = links.map(a => document.getElementById(a.getAttribute("href").slice(1)));
let pending = false;
function track() {
  pending = false;
  let current = -1;
  targets.forEach((el,i)=>{if (el && el.getBoundingClientRect().top < 140) current=i;});
  links.forEach((a,i)=>a.classList.toggle("active",i===current));
}
window.addEventListener("scroll",()=>{if(!pending){pending=true;requestAnimationFrame(track);}}, {passive:true});
track();
const input=q("#query"), count=q(".searchcount"), hits=q("#hits");
let indexPromise, resultLimit=45, timer;
function loadIndex() {
  if(window.readerEntries) return Promise.resolve(window.readerEntries);
  if(!indexPromise) indexPromise = new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src="search-data.js";
    script.onload=()=>resolve(window.readerEntries);
    script.onerror=()=>{indexPromise=undefined;reject(new Error("검색 자료를 불러오지 못했습니다."));};
    document.head.append(script);
  });
  return indexPromise;
}
function context(text,term) {
  const pos=text.toLowerCase().indexOf(term.toLowerCase());
  const frag=document.createDocumentFragment();
  if(pos<0) {frag.append(text.slice(0,95));return frag;}
  const a=Math.max(0,pos-25),end=Math.min(text.length,pos+term.length+56);
  const mark=document.createElement("mark");
  mark.textContent=text.slice(pos,pos+term.length);
  frag.append((a?"…":"")+text.slice(a,pos),mark,text.slice(pos+term.length,end)+(end<text.length?"…":""));
  return frag;
}
async function search() {
  const term=input.value.trim(),lower=term.toLowerCase();
  hits.replaceChildren();count.textContent="";
  if(!term){count.textContent="제6–10강의 본문과 판례를 검색합니다.";return;}
  let data;
  try {data=await loadIndex();} catch(e){count.textContent=e.message;return;}
  if(term!==input.value.trim()) return;
  const results=data.filter(item=>item[4].toLowerCase().includes(lower));
  count.textContent=results.length ? "검색 결과 "+results.length.toLocaleString()+"곳" : "일치하는 내용이 없습니다.";
  const fragment=document.createDocumentFragment();
  results.slice(0,resultLimit).forEach(([url,l,sec,kind,raw])=>{
    const a=document.createElement("a");a.className="hit";
    const [path,anchor]=url.split("#");a.href=path+"?find="+encodeURIComponent(term)+"#"+anchor;
    const small=document.createElement("small");small.textContent="제"+l+"강 · "+sec+(kind==="case"?" · 판례":kind==="classnote"?" · 수업 필기":kind==="flow"?" · 수업 흐름":"");
    const p=document.createElement("p");p.append(context(raw,term));a.append(small,p);fragment.append(a);
  });
  if(results.length>resultLimit) {
    const more=document.createElement("button");more.className="more";more.textContent="검색 결과 더 보기";
    more.onclick=()=>{resultLimit+=45;search();};fragment.append(more);
  }
  hits.replaceChildren(fragment);
}
function openSearch(){show("searchbox");input.focus();search();}
q(".searchopen").onclick=openSearch;
input.oninput=()=>{resultLimit=45;clearTimeout(timer);timer=setTimeout(search,90);};
q("#clear").onclick=()=>{input.value="";input.focus();search();};
document.addEventListener("keydown",e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();if(!q("dialog[open]"))openSearch();return;}
  if(e.key==="Escape" && document.body.classList.contains("navopen")){setMenu(false);menuButton.focus();}
});
function locateHit(){
  const term=new URLSearchParams(location.search).get("find");
  const el=document.getElementById(location.hash.slice(1));
  if(!el||!term) return;
  const det=q("details.original",el);
  if(det && q(".quote",det).textContent.toLowerCase().includes(term.toLowerCase())
      && ![q(".holding",el),q("h3",el)].some(n=>n?.textContent.toLowerCase().includes(term.toLowerCase()))) det.open=true;
  if(!el.hasAttribute("data-hit")){
    const walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node;
    while(node=walk.nextNode()){
      const i=node.textContent.toLowerCase().indexOf(term.toLowerCase());
      if(i<0 || node.parentElement.closest("details:not([open]) .quote"))continue;
      const range=document.createRange();range.setStart(node,i);range.setEnd(node,i+term.length);
      const mark=document.createElement("mark");mark.className="found";range.surroundContents(mark);break;
    }
    el.dataset.hit="true";
  }
  requestAnimationFrame(()=>el.scrollIntoView({block:"start"}));
}
window.addEventListener("hashchange",locateHit);
window.addEventListener("pageshow",locateHit);
const classToggle = q("#class-toggle");
function setClassNotes(visible) {
  document.documentElement.classList.toggle("notes-off", !visible);
  if (classToggle) classToggle.checked = visible;
  persist.set("notes", visible ? "on" : "off");
}
if (classToggle) {
  setClassNotes(location.hash.startsWith("#lecture-note-") || persist.get("notes", "on") === "on");
  classToggle.addEventListener("change", () => setClassNotes(classToggle.checked));
  const jump = q("#class-jump");
  jump.addEventListener("change", () => {
    if (!jump.value) return;
    setClassNotes(true);
    location.hash = jump.value;
    document.getElementById(jump.value)?.scrollIntoView({block:"start"});
    jump.selectedIndex = 0;
  });
  window.addEventListener("hashchange", () => {
    if (location.hash.startsWith("#lecture-note-")) setClassNotes(true);
  });
}

const flowSettings = document.createElement("fieldset");
flowSettings.innerHTML = '<legend>수업 흐름</legend><label class="flow-choice"><input type="checkbox"> 수업 흐름 상자 표시</label>';
q("#settings").append(flowSettings);
const flowCheckbox = q("input", flowSettings);
const flowPrompt = document.createElement("label");
flowPrompt.className = "flow-choice flow-prompt";
flowPrompt.innerHTML = '<input type="checkbox"> 수업 흐름 상자 표시';

function displayFlows(enabled) {
  document.documentElement.classList.toggle("flows-on", enabled);
  flowCheckbox.checked = enabled;
  flowPrompt.firstElementChild.checked = enabled;
}
function chooseFlows(enabled) {
  displayFlows(enabled);
  persist.set("flows", enabled ? "on" : "off");
}
flowCheckbox.addEventListener("change", () => chooseFlows(flowCheckbox.checked));
flowPrompt.addEventListener("change", () => {
  const target = flowPrompt.parentElement;
  chooseFlows(true);
  target.scrollIntoView({block:"start"});
  q(".flow-target", target)?.focus({preventScroll:true});
});

// A dated or bookmarked reference offers an opt-in at its destination.
function locateFlow() {
  const target = document.getElementById(location.hash.slice(1));
  if (target?.classList.contains("course-flow")) {
    if (flowPrompt.parentElement !== target) target.append(flowPrompt);
    target.scrollIntoView({block:"start"});
  } else {
    flowPrompt.remove();
  }
}
displayFlows(persist.get("flows", "off") === "on");
locateFlow();
window.addEventListener("hashchange", locateFlow);
window.addEventListener("pageshow", event => {
  if (event.persisted) displayFlows(persist.get("flows", "off") === "on");
  locateFlow();
});
window.addEventListener("storage", event => {
  if (event.key === "civil3reader-flows" || event.key === null) {
    displayFlows(persist.get("flows", "off") === "on");
  }
});

function openClassRoute() {
  if (location.hash !== "#class-route") return;
  const route = document.getElementById("class-route");
  if (route) route.open = true;
}
window.addEventListener("hashchange", openClassRoute);
window.addEventListener("pageshow", openClassRoute);
q(".course-flow-link")?.addEventListener("click", () => {
  if (document.getElementById("class-route")) {
    setMenu(false);
    document.getElementById("class-route").open = true;
  }
});
openClassRoute();
