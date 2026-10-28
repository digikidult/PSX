'use strict';
const data=window.POCKET_GUIDE;
const $=id=>document.getElementById(id);
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normal=s=>String(s).normalize('NFKC').toLowerCase().trim();
const empty='<p class="empty">找不到相符資料。試試日文名稱、其他版本或清除搜尋。</p>';
let evolutionSource=null;
const versionOrder=['Fire','Wind','Cool','Nature'];
const evolutionRanks=new Map();
for(const version of versionOrder){
 const rows=data.rules.filter(r=>r.version===version&&r.fromId),nodes=new Set(rows.flatMap(r=>[r.fromId,r.toId])),edges=new Map([...nodes].map(id=>[id,new Set()])),indegree=new Map([...nodes].map(id=>[id,0]));
 for(const r of rows)if(!edges.get(r.fromId).has(r.toId)){edges.get(r.fromId).add(r.toId);indegree.set(r.toId,indegree.get(r.toId)+1);}
 const queue=[...nodes].filter(id=>!indegree.get(id));for(const id of queue)evolutionRanks.set(version+':'+id,0);
 for(let i=0;i<queue.length;i++)for(const child of edges.get(queue[i])){evolutionRanks.set(version+':'+child,Math.max(evolutionRanks.get(version+':'+child)||0,evolutionRanks.get(version+':'+queue[i])+1));indegree.set(child,indegree.get(child)-1);if(!indegree.get(child))queue.push(child);}
 if(queue.length!==nodes.size)throw new Error('Evolution graph has an unexpected cycle: '+version);
}
function conditionList(conditions){return `<ul class="conditions">${conditions.map(c=>`<li>${escapeHTML(c)}</li>`).join('')}</ul>`;}
function pairCard(rules){
 const r=rules[0],common=r.conditions.filter(c=>rules.every(x=>x.conditions.includes(c)));
 const people=`<div class="route-people"><div class="route-partner">${r.fromSprite?`<img src="${r.fromSprite}" width="64" height="64" alt="" loading="lazy">`:'<span class="any-partner" aria-hidden="true">任意</span>'}<span class="partner-role">來源</span><h3>${escapeHTML(r.from)}</h3></div><span class="evolve-arrow" aria-label="進化為">→</span><div class="route-partner"><img src="${r.toSprite}" width="64" height="64" alt="" loading="lazy"><span class="partner-role">目標</span><h3>${escapeHTML(r.to)}</h3></div></div>`;
 const body=rules.length===1?`${conditionList(r.conditions)}<p class="rule-order">遊戲判定順序 ${r.priority}</p>`:`${common.length?`<p class="condition-label">每個方法都要滿足</p>${conditionList(common)}`:''}<p class="condition-label">再滿足以下其中一個方法</p><div class="alternative-grid">${rules.map((x,i)=>`<div class="route-alternative"><div class="alternative-heading"><b>方法 ${i+1}</b><span>判定順序 ${x.priority}</span></div>${conditionList(x.conditions.filter(c=>!common.includes(c)))}${x.fourAttributes?'<p class="route-note">四屬性記錄的正常取得方法仍待核實。</p>':''}</div>`).join('')}</div>`;
 const canContinue=data.rules.some(x=>x.version===r.version&&x.fromId===r.toId);
 return `<article class="route-card" data-route-pair="${r.version}:${r.fromId}:${r.toId}"><div class="route-meta"><span class="version-tag ${r.version}">${r.version}</span><span>${rules.length===1?'1 個方法':rules.length+' 個可選方法'}</span></div>${people}<p class="ja-sub" lang="ja">${escapeHTML(r.fromJa)} → ${escapeHTML(r.toJa)}</p>${body}${rules.length===1&&r.fourAttributes?'<p class="route-note">四屬性記錄的正常取得方法仍待核實。</p>':''}${canContinue?`<button class="continue-evolution" type="button" data-next-version="${r.version}" data-next-id="${r.toId}">再看${escapeHTML(r.to)}的下一步 →</button>`:''}</article>`;
}
function evolutions(){
 const version=$('evo-version').value,query=normal($('evo-search').value),direction=$('evo-direction').value;
 // Search identifies a pair; display ALL its alternatives, so one matched
 // condition never hides the other available method for that same evolution.
 const allPairs=new Map();
 for(const r of data.rules){if(version!=='all'&&r.version!==version)continue;const key=r.version+':'+r.fromId+':'+r.toId;if(!allPairs.has(key))allPairs.set(key,[]);allPairs.get(key).push(r);}
 const matches=r=>(!evolutionSource||(r.version===evolutionSource.version&&r.fromId===evolutionSource.id))&&normal(direction==='from'?[r.from,r.fromJa,r.fromId,...r.fromAliases].join(' '):direction==='to'?[r.to,r.toJa,r.toId,...r.toAliases].join(' '):[r.from,r.fromJa,r.fromId,...r.fromAliases,r.to,r.toJa,r.toId,...r.toAliases,...r.conditions].join(' ')).includes(query);
 const pairs=[...allPairs.values()].filter(rs=>rs.some(matches));
 const groups=new Map();for(const rs of pairs){const r=rs[0],key=r.version+':'+r.fromId;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(rs);}
 const ordered=[...groups.values()].sort((a,b)=>{const x=a[0][0],y=b[0][0];return versionOrder.indexOf(x.version)-versionOrder.indexOf(y.version)||(x.fromId?(evolutionRanks.get(x.version+':'+x.fromId)||0):99)-(y.fromId?(evolutionRanks.get(y.version+':'+y.fromId)||0):99)||x.fromId-y.fromId;});
 const ruleCount=pairs.reduce((n,rs)=>n+rs.length,0);
 $('evo-count').textContent=`顯示 ${pairs.length} 組進化 · ${ruleCount} 個條件方法（全表共172個） · 按進化先後排列`;
 const roots=data.sprites.filter(r=>(version==='all'||r.version===version)&&evolutionRanks.get(r.version+':'+r.id)===0);
 $('evo-starts').innerHTML=`<span>由成長期開始</span>${roots.map(r=>`<button type="button" data-next-version="${r.version}" data-next-id="${r.id}">${escapeHTML(r.name)}${version==='all'?' · '+r.version:''}</button>`).join('')}`;
 $('evo-results').innerHTML=ordered.map(group=>{const r=group[0][0],rank=evolutionRanks.get(r.version+':'+r.fromId)||0;const step=!r.fromId?'另看：泛用特殊條件':rank===0?'第1段 · 由成長期開始':`第${rank+1}段 · 接續進化`;
 return `<section class="evolution-source" data-source-id="${r.fromId}"><div class="source-heading"><div><p>${r.version} / ${step}</p><h3>${r.fromId?'由'+escapeHTML(r.from)+'進化':'不指定單一來源的進化'}</h3></div><span>${group.length} 個目標</span></div><div class="pair-grid">${group.sort((a,b)=>a[0].priority-b[0].priority).map(pairCard).join('')}</div></section>`;}).join('')||empty;
}
function followEvolution(event){const button=event.target.closest('[data-next-id]');if(!button)return;const version=button.dataset.nextVersion,id=Number(button.dataset.nextId);const row=data.sprites.find(r=>r.version===version&&r.id===id);evolutionSource={version,id};$('evo-version').value=version;$('evo-direction').value='from';$('evo-search').value=row.name;evolutions();$('evolution').scrollIntoView({block:'start'});}
$('evo-results').addEventListener('click',followEvolution);$('evo-starts').addEventListener('click',followEvolution);
function moves(){const q=normal($('move-search').value),attr=$('move-attribute').value;const rows=data.moves.filter(r=>(attr==='all'||String(r.attribute)===attr)&&normal(r.japanese+' '+r.id).includes(q));$('move-count').textContent=`顯示 ${rows.length} / 119 筆招式`; $('move-results').innerHTML=rows.map(r=>`<tr><td>${r.id}</td><td lang="ja">${escapeHTML(r.japanese)}</td><td>${r.attribute}</td><td>${r.intelligence_min}</td></tr>`).join('')||'<tr><td colspan="4">找不到相符招式。</td></tr>';}
function sprites(){const q=normal($('sprite-search').value),version=$('sprite-version').value;const rows=data.sprites.filter(r=>(version==='all'||r.version===version)&&normal([r.name,r.ja,r.id,...r.aliases].join(' ')).includes(q));$('sprite-count').textContent=`顯示 ${rows.length} / 79 份圖像資源`; $('sprite-results').innerHTML=rows.map(r=>`<article class="sprite-card"><img class="sheet-preview" loading="lazy" width="250" height="170" src="${r.portrait}" alt="${escapeHTML(r.name)}原始角色圖像"><div class="sprite-copy"><span class="version-tag ${r.version}">${r.version} · ${r.id}</span><h3>${escapeHTML(r.name)}</h3><p lang="ja">${escapeHTML(r.ja)} · ${r.frames} 幅影格</p><button type="button" data-sheet="${r.image}" data-title="${escapeHTML(r.name)} · ${r.version} · ID ${r.id}">查看圖表 ↗</button></div></article>`).join('')||empty;}
function texts(){const q=normal($('text-search').value),category=$('text-category').value;const rows=data.dialogue.filter(r=>(category==='all'||r.category===category)&&normal(r.ja+' '+r.zh).includes(q));$('text-count').textContent=`顯示 ${rows.length} / ${data.dialogue.length} 筆文字`; $('text-results').innerHTML=rows.map(r=>`<tr><td>${r.category}</td><td lang="ja">${escapeHTML(r.ja)}</td><td>${escapeHTML(r.zh)}</td></tr>`).join('')||'<tr><td colspan="3">找不到相符對白。</td></tr>';}
for(const id of ['evo-search','evo-direction','evo-version'])$(id).addEventListener(id.endsWith('search')?'input':'change',()=>{evolutionSource=null;evolutions();});
$('evo-reset').addEventListener('click',()=>{evolutionSource=null;$('evo-search').value='';$('evo-version').value='Fire';$('evo-direction').value='any';evolutions();});
for(const [ids,fn] of [[['move-search','move-attribute'],moves],[['sprite-search','sprite-version'],sprites],[['text-search','text-category'],texts]])for(const id of ids)$(id).addEventListener(id.endsWith('search')?'input':'change',fn);
const dates=[['01.01','新年'],['01.03','新年互動'],['02.03','節分'],['02.14','情人節'],['03.03','女兒節'],['04.01','愚人節'],['05.04','黃金週'],['05.05','日本兒童節'],['06月','梅雨季節'],['07.07','七夕'],['07.20','暑假'],['08.07','盛夏閒談'],['08.09','功課／去海邊'],['10.31','萬聖節'],['11.25','寒冬閒談'],['12.24','平安夜'],['12.25','聖誕節'],['12.31','除夕']];
$('calendar-dates').innerHTML=dates.map(([day,label])=>`<div class="calendar-item"><b>${day}</b><span>${label}</span></div>`).join('');
const gateA=[600,500,400,300,200,100,50,0,50,100,200,300,400,500,600,700];$('tendency-table').innerHTML=gateA.map((a,i)=>`<tr><td>${i}</td><td>${a}</td><td>${i*50}</td></tr>`).join('');
const modal=$('sprite-dialog');$('sprite-results').addEventListener('click',e=>{const button=e.target.closest('[data-sheet]');if(!button)return;$('sprite-title').textContent=button.dataset.title;$('sprite-sheet').src=button.dataset.sheet;$('sprite-sheet').alt=button.dataset.title+'原始影格總覽';$('sprite-download').href=button.dataset.sheet;modal.showModal();});
$('sprite-close').addEventListener('click',()=>modal.close());modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close();}});
evolutions();moves();sprites();texts();
