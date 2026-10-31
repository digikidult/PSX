(function(root){'use strict';
const DATA=root.EDITOR_DATA,SLOT=0x1d880,TARGET='BISLPSP028001',LIMIT=DATA.maxWaitEdit;
const need=(condition,message)=>{if(!condition)throw Error(message);};
const u=(b,o,n=1)=>{let value=0;for(let i=0;i<n;i++)value+=b[o+i]*2**(8*i);return value;};
const put=(b,o,value,n=1)=>{for(let i=0;i<n;i++)b[o+i]=value>>>(8*i)&255;};
const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const sha=async b=>{need(root.crypto&&root.crypto.subtle,'瀏覽器未能使用本機檔案驗證，請用較新的Chrome或Edge開啟。');return [...new Uint8Array(await root.crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');};
const ascii=b=>String.fromCharCode(...b).split('\0')[0];
const bcd=b=>{let result=0;for(let i=0;i<b.length;i++){if((b[i]&15)>9||(b[i]>>4)>9)return null;result+=((b[i]>>4)*10+(b[i]&15))*100**i;}return result;};
const BATTLE=[{id:'streak',offset:0xbe,label:'連勝相關計數'},{id:'wins',offset:0xbf,label:'勝率用勝場'},{id:'defeats',offset:0xc0,label:'連敗相關計數'},{id:'battles',offset:0xc1,label:'參戰計數'}];
const HISTORY=[{id:'hybridAttributes',offset:0xba,label:'合體屬性紀錄',maximum:15},{id:'hybridCount',offset:0xbb,label:'合體次數',maximum:255},{id:'sleepDisturbance',offset:0xc4,label:'打擾睡眠次數',maximum:255},{id:'ignoredCalls',offset:0xc5,label:'忽略呼叫次數',maximum:255},{id:'runaways',offset:0xc6,label:'離家次數',maximum:255}];
const species=(bank,id)=>DATA.species.find(x=>x.bank===bank&&x.id===id)||{bank,id,name_zh_HK:'未辨認的數碼獸',name_jp:'',reference_sprite:null};
function extract(card){need(card.length===131072,'請選擇128 KB的原始記憶卡（.mcd、.mcr或FROM）。');need(ascii(card.slice(0,2))==='MC','這不是已支援的原始記憶卡檔案。');const entries=[];
 for(let i=1;i<=15;i++)if(card[i*128]===0x51&&ascii(card.slice(i*128+10,i*128+30))===TARGET)entries.push(i);
 need(entries.length===1,'找不到唯一的Pocket Digimon World遊戲檔。');const blocks=[];let current=entries[0],declared;
 for(;;){need(current>=1&&current<=15&&!blocks.includes(current),'記憶卡的區塊連結有錯誤或循環。');const frame=card.slice(current*128,(current+1)*128);need(frame.reduce((a,b)=>a^b,0)===0,'記憶卡目錄校驗不符，停止讀取。');const next=u(frame,8,2);need(frame[0]===(blocks.length===0?0x51:next===65535?0x53:0x52),'記憶卡區塊的種類或次序不符。');if(declared===undefined)declared=u(frame,4,4);blocks.push(current);if(next===65535)break;current=next+1;}
 need(declared===122880&&blocks.length===15,'這份遊戲檔不是已驗證的15格格式。');const app=new Uint8Array(122880);blocks.forEach((block,i)=>app.set(card.slice(block*8192,(block+1)*8192),i*8192));
 need(ascii(app.slice(0,2))==='SC'&&app[3]===15&&ascii(app.slice(0x52,0x56))==='MCX0','遊戲檔標頭或PocketStation格式不符。');return {app,blocks};
}
async function inspect(input){const card=new Uint8Array(input),{app,blocks}=extract(card),warnings=[];let family=null;
 for(const [name,f]of Object.entries(DATA.spec.program_fingerprints))if(await sha(app.slice(f.start,f.end))===f.sha256){family=name;break;}
 if(!family)warnings.push('這份程式版本未經驗證，目前只能檢視。');
 const profile=app.slice(0x1d800,0x1d880),year=bcd(profile.slice(0x1a,0x1c)),month=bcd(profile.slice(0x19,0x1a)),day=bcd(profile.slice(0x18,0x19));let birthday=null;
 if(year&&month&&day){const date=new Date(0);date.setUTCFullYear(year,month-1,day);if(date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day)birthday=`${year}/${String(month).padStart(2,'0')}/${String(day).padStart(2,'0')}`;}
 if(!birthday)warnings.push('生日資料不在已驗證格式，保留原值。');if(profile[0x21]!==0)warnings.push('姓名超出目前已驗證的字元範圍，保留原值。');
 const slots=[];for(let index=0;index<5;index++){const data=app.slice(SLOT+index*256,SLOT+(index+1)*256),marked=data.slice(0,128).every(v=>v===17),status=data[0xbd],occupied=marked&&(status===1||status===2),slot={index,marked,status,occupied,data};
  if(!marked&&(status===1||status===2))warnings.push(`夥伴${index+1}的活動資料與有效標記不一致。`);if(marked&&![0,1,2].includes(status))warnings.push(`夥伴${index+1}有未辨認的活動狀態。`);
  if(occupied){slot.stats=Object.fromEntries(DATA.spec.simple_stats.map(f=>[f.id,u(data,f.offset,2)]));for(const f of DATA.spec.simple_stats)if(slot.stats[f.id]>f.maximum)warnings.push(`夥伴${index+1}的${f.label}超出已驗證上限。`);
   slot.history=Object.fromEntries(HISTORY.map(f=>[f.id,f.id==='hybridAttributes'?data[f.offset]&15:data[f.offset]]));slot.battle=Object.fromEntries(BATTLE.map(f=>[f.id,data[f.offset]]));slot.age=u(data,0x80,4);slot.wait=u(data,0x84,4);slot.away=u(data,0x88,4);slot.currentHP=u(data,0x94,2);slot.currentMP=u(data,0x98,2);slot.id=u(data,0xa2,2);slot.storedBank=data[0xe3];slot.attribute=data[0xb9];slot.bank=slot.storedBank===2&&slot.attribute===2?3:slot.storedBank;slot.mood=data[0xbc];slot.moveCount=data[0xc9];slot.moves=[...data.slice(0xca,0xca+Math.min(slot.moveCount,8))];slot.pending=data[0xc7]!==0;slot.species=species(slot.bank,slot.id);
   if(slot.moveCount>8||slot.moves.some(id=>id<1||id>119)||new Set(slot.moves).size!==slot.moves.length)warnings.push(`夥伴${index+1}的招式清單超出已驗證範圍。`);
   if(slot.mood>15||slot.currentHP>slot.stats.max_HP||slot.currentMP>slot.stats.max_MP)warnings.push(`夥伴${index+1}有需要先核對的心情或HP／MP資料。`);
   if(data[0xbf]>data[0xc1])warnings.push(`夥伴${index+1}的勝率記錄需要先核對。`);
   if(![0,1,2].includes(slot.storedBank))warnings.push(`夥伴${index+1}的原始組別旗標未經驗證。`);
   if(!DATA.spec.partner_ids_by_bank[String(slot.bank)]?.includes(slot.id))warnings.push(`夥伴${index+1}的種類或資源組別未經驗證。`);
  }slots.push(slot);
 }
 const active=slots.filter(s=>s.marked&&s.status===1).map(s=>s.index);if(active.length!==1)warnings.push('活動夥伴不是恰好一個，需先核對資料。');
 if(family&&active.length===1&&slots[active[0]].bank!==DATA.evolution[family].bank)warnings.push('活動夥伴與卡內目前版本不符，需先核對原檔。');
 const replacement=root.PocketReplacement?await root.PocketReplacement.inspect(app,family,slots,active):null;
 return {replacement,card,app,blocks,family,slots,active,profile:{birthday,gender:profile[0x1c]},warnings,editable:!!family&&warnings.length===0,sha256:await sha(card)};
}
function evolution(app,family,slot){const config=DATA.evolution[family];if(!config)return {available:false,reason:'程式版本未經驗證。'};const state=app.slice(SLOT+slot.index*256+128,SLOT+slot.index*256+232),age=u(state,0,4);
 if(slot.bank!==config.bank)return {available:false,reason:'這個夥伴的資源組別與目前下載程式不同，暫不預覽。'};
 if(age<1920||age>=0xfffffffe)return {available:false,reason:'幼年期或特殊生命狀態，暫不作一般進化預覽。'};
 if(['Cool','Nature'].includes(family)&&state[0x65]!==0)return {available:false,reason:'夥伴正處於特殊成長狀態，暫不作一般進化預覽。'};
 if(u(state,8,4)!==0)return {available:false,reason:'夥伴正在離家，一般進化受阻。'};
 const vm=new root.EvolutionVM(app,config.entry);vm.mem.set(state,0x318);vm.r[0]=0x02000000+config.table;vm.r[1]=0x318;vm.r[2]=0x260;const id=vm.run();need(equal(vm.mem.slice(0x318,0x380),state),'原版判定意外改動夥伴資料，停止輸出。');return {available:true,id,species:id?species(config.bank,id):null,steps:vm.steps};
}
function lifecycle(family,slot){const config=root.REPLACEMENT_DATA?.families?.[family];if(!config?.lifecycle||!slot?.occupied||slot.bank!==config.bank)return {available:false,reason:'這位夥伴的生命時間資料暫未核對。'};if(slot.age>=0xfffffffe||['Cool','Nature'].includes(family)&&slot.data[0xe5]!==0)return {available:false,reason:'目前為特殊生命狀態，暫不換算一般育成時間。'};const life=config.lifecycle;return {available:true,age:slot.age,referenceHours:slot.age/life.referenceHourUnits,stage:slot.age>=life.forcedAgeEnd?'end':slot.age>=life.randomAgeEndStart?'risk':'normal',...life};}
const integer=(value,min,max,label)=>need(typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max,`${label}必須是${min}至${max}的整數。`);
function historyValues(model,slot,history){need(history&&typeof history==='object'&&!Array.isArray(history),'合體／照顧紀錄格式不符。');const permission=evolution(model.app,model.family,slot);need(permission.available,permission.reason);const data=slot.data.slice();for(const [id,value]of Object.entries(history)){const f=HISTORY.find(f=>f.id===id);need(!!f,'有未支援的合體／照顧欄位。');integer(value,0,f.maximum,f.label);data[f.offset]=id==='hybridAttributes'?(data[f.offset]&240)|value:value;}return data;}
function preparation(model,index,target=5,history,seed){integer(index,0,4,'夥伴槽');need(!!root.PocketPreparation,'進化方案未載入。');const slot=model.slots[index];if(history!==undefined)historyValues(model,slot,history);return root.PocketPreparation.plan(model,slot,target,history,seed);}
function preparationTargets(model,slot){return root.PocketPreparation?.targets(model,slot)||[];}

function patch(model,edits){need(model.editable,'這份卡檔目前只供檢視，不能修改。');need(Array.isArray(edits)&&edits.length<=5,'修改清單格式不符。');const app=model.app.slice(),allowed=new Set(),changes=[],seen=new Set();let replacementUsed=false;
 const assign=(offset,value,size,label,oldValue)=>{const before=u(app,offset,size);if(before===value)return;put(app,offset,value,size);for(let i=0;i<size;i++)allowed.add(offset+i);changes.push({label,before:oldValue===undefined?before:oldValue,after:value,offset,size});};
 for(const edit of edits){integer(edit.index,0,4,'夥伴槽');need(!seen.has(edit.index),'同一夥伴不可重複修改。');seen.add(edit.index);const slot=model.slots[edit.index];need(slot.occupied,'這個位置未有有效夥伴。');const start=SLOT+edit.index*256,prefix=`夥伴${edit.index+1} ${slot.species.name_zh_HK} · `;
  need(Object.keys(edit).every(k=>['index','stats','mood','moves','wait','battle','partnerId','prepareTarget','prepareMode','history'].includes(k)),'有未支援的修改欄位。');
  need(edit.prepareMode===undefined||edit.prepareTarget!==undefined,'方案模式必須配合指定進化目標。');
  if(edit.history!==undefined){const data=historyValues(model,slot,edit.history);for(const id of Object.keys(edit.history)){const f=HISTORY.find(f=>f.id===id);assign(start+f.offset,data[f.offset],1,prefix+f.label);if(id==='hybridAttributes'&&data[f.offset]!==slot.data[f.offset])changes[changes.length-1].kind='hybridAttributes';}}
  if(edit.prepareTarget!==undefined){const plan=preparation(model,edit.index,edit.prepareTarget,edit.history,edit);need(edit.partnerId===undefined||edit.partnerId===slot.id,'進化準備不能同時直接更換種類。');assign(start+0x80,plan.age,4,prefix+'育成累積（準備'+species(slot.bank,edit.prepareTarget).name_zh_HK+'進化）');}
  if(edit.partnerId!==undefined&&edit.partnerId!==slot.id){need(!!root.PocketReplacement,'更換功能未載入。');const target=root.PocketReplacement.plan(model,slot,edit.partnerId);for(const resource of target.resources)for(let i=0;i<resource.bytes.length;i++){app[resource.offset+i]=resource.bytes[i];allowed.add(resource.offset+i);}assign(start+0xa2,edit.partnerId,2,prefix+'直接更換數碼獸');changes[changes.length-1].kind='partner';changes[changes.length-1].bank=slot.bank;if(target.scenarioChanged)changes.push({label:prefix+'對話配套',before:'目前對話',after:'目標數碼獸適用對話',kind:'text'});replacementUsed=true;}
  if(edit.stats!==undefined){need(edit.stats&&typeof edit.stats==='object'&&!Array.isArray(edit.stats),'能力資料格式不符。');for(const [id,value]of Object.entries(edit.stats)){const f=DATA.spec.simple_stats.find(f=>f.id===id);need(!!f,'有未支援的能力欄位。');integer(value,['max_HP','max_MP'].includes(id)?1:0,f.maximum,f.label);assign(start+f.offset,value,2,prefix+f.label);}
   for(const [maxId,off,label]of [['max_HP',0x94,'目前HP（配合新上限）'],['max_MP',0x98,'目前MP（配合新上限）']]){if(edit.stats[maxId]!==undefined&&u(app,start+off,2)>edit.stats[maxId])assign(start+off,edit.stats[maxId],2,prefix+label);}
  }
  if(edit.battle!==undefined){need(edit.battle&&typeof edit.battle==='object'&&!Array.isArray(edit.battle),'對戰紀錄格式不符。');for(const [id,value]of Object.entries(edit.battle)){const f=BATTLE.find(f=>f.id===id);need(!!f,'有未支援的對戰欄位。');integer(value,0,255,f.label);assign(start+f.offset,value,1,prefix+f.label);}need(app[start+0xbf]<=app[start+0xc1],'勝率用勝場不可多於參戰計數。');}
  if(edit.mood!==undefined){integer(edit.mood,0,15,'心情值');assign(start+0xbc,edit.mood,1,prefix+'心情值');}
  if(edit.moves!==undefined){need(!slot.pending,'有新招式尚待處理，暫不能修改招式清單。');need(Array.isArray(edit.moves)&&edit.moves.length>=1&&edit.moves.length<=8,'請保留1至8招。');need(new Set(edit.moves).size===edit.moves.length,'招式不可重複。');for(const id of edit.moves){integer(id,1,119,'招式編號');const move=DATA.moves.find(m=>m.id===id);need(slot.moves.includes(id)||move.attribute===0||move.attribute===slot.attribute,'新增招式須屬於共通或夥伴目前屬性。');}
   if(!equal(edit.moves,slot.moves)){const before=slot.moves.slice();assign(start+0xc9,edit.moves.length,1,prefix+'已學招式數量');for(let i=0;i<8;i++){const value=i<edit.moves.length?edit.moves[i]:255;const off=start+0xca+i;if(app[off]!==value){put(app,off,value);allowed.add(off);}}changes.push({label:prefix+'招式清單',before,after:edit.moves.slice(),offset:start+0xca,size:8,kind:'moves'});}
  }
  if(edit.wait!==undefined&&edit.wait!==slot.wait){integer(edit.wait,0,LIMIT,'進化等候累積');const permission=evolution(model.app,model.family,slot);need(permission.available,permission.reason);assign(start+0x84,edit.wait,4,prefix+'進化等候累積',slot.wait);}
  if(edit.prepareTarget!==undefined){if(edit.prepareMode==='keepStats')for(const f of DATA.spec.simple_stats)need(u(app,start+f.offset,2)>=slot.stats[f.id],'保留能力方案不可降低原有能力。');const result=evolution(app,model.family,slot);need(result.available&&result.id===edit.prepareTarget,'目前修改後未選中指定目標。請重新套用進化準備，或取消此方案後自行調整。');}
 }
 const bytes=model.card.slice(),diff=[];for(let i=0;i<app.length;i++)if(app[i]!==model.app[i]){need(allowed.has(i),'出現未核准的改動，停止輸出。');const physical=model.blocks[Math.floor(i/8192)]*8192+i%8192;bytes[physical]=app[i];diff.push({appOffset:i,cardOffset:physical,before:model.app[i],after:app[i]});}
 need(replacementUsed||equal(app.slice(0,0x1d800),model.app.slice(0,0x1d800)),'程式或圖像資料出現變更，停止輸出。');return {bytes,app,changes,diff};
}
async function verifiedExport(model,edits){const result=patch(model,edits);need(result.diff.length>0,'尚未有需要儲存的改動。');const reread=await inspect(result.bytes);need(reread.editable&&reread.family===model.family,'輸出卡檔未通過重新檢查。');if(edits.some(e=>e.partnerId!==undefined&&e.partnerId!==model.slots[e.index].id))need(reread.replacement?.eligible,'更換後圖像或對話未通過核對。');need(equal(reread.app,result.app),'輸出內容與預覽不符。');need(result.bytes.length===model.card.length,'輸出大小不符。');return {...result,sha256:reread.sha256};}
root.PocketEditor={inspect,extract,patch,evolution,verifiedExport,sha,equal,species,u,put,MAX_WAIT:LIMIT,BATTLE,HISTORY,lifecycle,preparation,preparationTargets};if(typeof module!=='undefined')module.exports=root.PocketEditor;
})(globalThis);
