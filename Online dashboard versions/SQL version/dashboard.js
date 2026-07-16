/* ============================================================================
 * لوحة تحليل حالات الأيتام — ENGINE  [SQL / Supabase edition]
 * ONLINE, multi-user analytics for orphan-care case data — backed by a real
 * Supabase (Postgres) database with email+password login and RLS-enforced access.
 * (Fork of the shared engine; the Excel/offline flow is replaced by sign-in + live DB.)
 *
 * Runs AFTER index.html defines the shared data model + state (CASE_COLS /
 * VISIT_COLS / FIELD_META / NAT_CITIES / state / BRANDING), and after the vendor
 * libs load: supabase-js (auth + queries), ExcelJS (mould + formatted report,
 * write) and SheetJS/XLSX (import, read — ExcelJS chokes on full-column validations).
 *
 * WHAT'S LIVE IN THIS EDITION:
 *   • DATA LAYER (at the very bottom) — Supabase Auth + Postgres via supabase-js:
 *       signInWithPassword → session token → RLS-gated sb.from().select/upsert/delete.
 *   • BULK IMPORT (Excel) — the local edition's mould + gatekeeper, revived and
 *       re-pointed at the DB: the «إضافة حالات من Excel» modal downloads the FULL
 *       mould (downloadTemplate — all packages, no picker) or imports a filled one
 *       (importBuffer → validate → showReport), then uploadImport ships the valid
 *       rows to Postgres in CHUNKS (upsert by id: existing row = update, new = add;
 *       visits = insert new rows only). One-way import — the file is a vehicle, the
 *       DB stays the source of truth. Editor/admin only (RLS enforces regardless).
 *   • measures — KPIs + charts (coverage, vuln, priority, geo, income, housing, age,
 *       visits, cov-by-city) + governance strip.
 *   • editing — add / edit / delete modal (mandatory + soft rules).
 *   • export — exportReport (ExcelJS): formatted workbook + statistics summary.
 *   • toolbar · role UI · brand.
 *
 * INHERITED BUT UNUSED HERE (kept for parity with the offline build; never called —
 * safe dead code): renderPkgs (no package picker here — the mould is always full),
 * loadSample, buildWorkbook/saveToExcel (no local file to sync back to).
 *
 * Served edition — bump `dashboard.js?v=N` in index.html on edit. Real guard = RLS.
 * See README.md / CLAUDE.md.
 * ========================================================================== */

/* ---------- package picker ---------- */
function renderPkgs(){
  $('#pkgs').innerHTML=PACKAGES.map(p=>{
    const on=SELECTED.has(p.id);
    return `<div class="pkg${on?' on':''}${p.core?' core':''}" data-p="${p.id}">
      <span class="chk">✓</span>
      <div><div class="t">${p.label}${p.core?' · أساسية':''}</div><div class="d">${p.desc}</div></div>
    </div>`;
  }).join('');
  $$('#pkgs .pkg').forEach(el=>el.addEventListener('click',()=>{
    const p=PACKAGES.find(x=>x.id===el.dataset.p); if(p.core) return;
    if(SELECTED.has(p.id)) SELECTED.delete(p.id); else SELECTED.add(p.id);
    renderPkgs();
  }));
}
/* NOTE (SQL edition): the gate is a LOGIN (no onboarding) — but the Excel mould +
 * gatekeeper below are LIVE again, revived as the bulk-import feature («إضافة حالات
 * من Excel»): downloadTemplate/connectExcel/importBuffer/validate/showReport feed
 * uploadImport (chunked upsert to the DB). Only renderPkgs/loadSample stay unused. */
function gateErr(msg){ const b=$('#g-err'); if(b){ b.innerHTML=msg||''; b.style.display=msg?'block':'none'; } }   // login-gate errors (#g-err)

/* ---------- template generator (from selected packages) ---------- */
function selectedCaseCols(){
  const keys=new Set(); PACKAGES.filter(p=>SELECTED.has(p.id)).forEach(p=>p.fields.forEach(k=>keys.add(k)));
  return CASE_COLS.filter(c=>keys.has(c[1]));
}
const NOTES={priority:'القيم: حرجة، عالية، متوسطة، منخفضة',spStatus:'القيم: مكفول، غير مكفول، قيد الدراسة، منتهية',gender:'القيم: ذكر، أنثى',vuln:'رقم من 0 إلى 100',age:'رقم (سنوات)',dataStatus:'القيم: مكتملة، تحتاج تحديث، ناقصة',sick:'القيم: نعم، لا',motherAlive:'القيم: نعم، لا',id:'رقم فريد لكل يتيم (إلزامي)'};
function colLtr(n){ let s=''; while(n>0){ n--; s=String.fromCharCode(65+(n%26))+s; n=Math.floor(n/26); } return s; }
/* header fill follows the PAGE THEME at runtime (Daleel deep-green + gold underline here) —
 * read the tokens, never hardcode a hex (same rule as exportReport). */
function themeTok(name, fallback){
  const v=getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace('#','');
  return /^[0-9a-fA-F]{6}$/.test(v) ? ('FF'+v.toUpperCase()) : fallback;
}
function styleHeader(row){
  const HEAD=themeTok('--accent','FF2A78D6'), LINE=themeTok('--gold','FF184F95');
  row.height=22; row.font={bold:true,color:{argb:'FFFFFFFF'}}; row.alignment={horizontal:'center',vertical:'middle'};
  row.eachCell(c=>{ c.fill={type:'pattern',pattern:'solid',fgColor:{argb:HEAD}}; c.border={bottom:{style:'medium',color:{argb:LINE}}}; });
}
async function downloadTemplate(){
  const cols=selectedCaseCols();   // SQL edition: SELECTED = all packages (set by openImport) → the FULL mould
  if(!window.ExcelJS){ toast('تعذّر تحميل محرّك القوالب'); return; }
  const wb=new ExcelJS.Workbook();

  // hidden lookup sheet: option lists live here so dropdowns work even for values containing commas (e.g. income brackets)
  const lists=wb.addWorksheet('القوائم'); lists.state='veryHidden';
  const listRef={}; let lc=0;
  cols.forEach(c=>{ const m=FIELD_META[c[1]];
    if(m && (m.t==='choice'||m.t==='soft') && m.opts && m.opts.length && c[1]!=='city'){   // city is a dependent list, built separately
      lc++; const L=colLtr(lc);
      m.opts.forEach((o,i)=>{ lists.getCell(L+(i+1)).value=o; });
      listRef[c[1]]=`'القوائم'!$${L}$1:$${L}$${m.opts.length}`;
    }
  });

  // main data sheet: frozen header row + RTL + real column widths (fixes the in-cell edit overlap)
  const ws=wb.addWorksheet('الأيتام',{views:[{state:'frozen',ySplit:1,rightToLeft:true}]});
  ws.columns=cols.map(c=>({ header:c[0], key:c[1], width:Math.max(14,Math.min(30,c[0].length+6)) }));
  styleHeader(ws.getRow(1));

  // per-column data validation applied to the whole column (row 2 → bottom), by logical type
  const BOTTOM=1048576, dobIdx=cols.findIndex(c=>c[1]==='dob'), ageIdx=cols.findIndex(c=>c[1]==='age');
  cols.forEach((c,i)=>{ const k=c[1], m=FIELD_META[k]; if(!m||k==='city') return; const L=colLtr(i+1), rng=`${L}2:${L}${BOTTOM}`;   // city handled after (dependent)
    if(m.t==='choice'||m.t==='soft'){
      // list fields are strict in the mould: a value not on the list is rejected (can't be typed in freely)
      ws.dataValidations.add(rng,{ type:'list', allowBlank:true, formulae:[listRef[k]],
        showErrorMessage:true, errorStyle:'stop', errorTitle:'قيمة غير مسموحة', error:'اختر قيمة من القائمة المنسدلة فقط.' });
    } else if(m.t==='num'){
      if(k==='age' && dobIdx>=0) return;   // age is auto-computed from dob (formula added below) — no manual entry
      const hasMax=m.max!=null;
      ws.dataValidations.add(rng,{ type:'decimal', operator:hasMax?'between':'greaterThanOrEqual', allowBlank:true,
        formulae:hasMax?[m.min,m.max]:[m.min], showErrorMessage:true, errorStyle:'stop',
        errorTitle:'قيمة رقمية مطلوبة', error:hasMax?`أدخل رقمًا بين ${m.min} و ${m.max}.`:`أدخل رقمًا ≥ ${m.min}.` });
    } else if(m.t==='name'){
      // a name/description can't be only digits: require the cell to be text
      ws.dataValidations.add(rng,{ type:'custom', allowBlank:true, formulae:[`ISTEXT(${L}2)`],
        showErrorMessage:true, errorStyle:'stop', errorTitle:'قيمة غير صالحة', error:'هذا الحقل نصّي (اسم) ولا يقبل رقمًا فقط.' });
    } else if(m.t==='date'){
      ws.getColumn(i+1).numFmt='yyyy-mm-dd';
      if(k==='dob'){   // birthdate must yield a plausible age (0..max)
        const mx=(FIELD_META.age&&FIELD_META.age.max)||30, now=new Date(), floor=new Date(now.getFullYear()-mx,now.getMonth(),now.getDate());
        ws.dataValidations.add(rng,{ type:'date', operator:'between', allowBlank:true, formulae:[floor,now],
          showErrorMessage:true, errorStyle:'stop', errorTitle:'تاريخ ميلاد غير منطقي', error:`أدخل تاريخ ميلاد يجعل العمر بين 0 و ${mx} سنة.` });
      } else {
        ws.dataValidations.add(rng,{ type:'date', operator:'greaterThanOrEqual', allowBlank:true, formulae:[new Date(1900,0,1)],
          showErrorMessage:true, errorStyle:'stop', errorTitle:'تاريخ غير صالح', error:'أدخل تاريخًا صحيحًا بالصيغة: سنة-شهر-يوم.' });
      }
    }
  });
  // dependent city dropdown: the city list follows the chosen nationality (INDIRECT + named ranges)
  const natIdx=cols.findIndex(c=>c[1]==='nat'), cityIdx=cols.findIndex(c=>c[1]==='city');
  if(cityIdx>=0){
    const cityRng=`${colLtr(cityIdx+1)}2:${colLtr(cityIdx+1)}${BOTTOM}`;
    if(natIdx>=0){
      NATIONALITIES.forEach(nat=>{ lc++; const L=colLtr(lc), cs=NAT_CITIES[nat];
        cs.forEach((c,i)=>{ lists.getCell(L+(i+1)).value=c; });
        try{ wb.definedNames.add(`'القوائم'!$${L}$1:$${L}$${cs.length}`, nat); }catch(_){}
      });
      ws.dataValidations.add(cityRng,{ type:'list', allowBlank:true, formulae:[`INDIRECT($${colLtr(natIdx+1)}2)`],
        showErrorMessage:true, errorStyle:'stop', errorTitle:'اختر الجنسية أولًا', error:'اختر الجنسية أولًا، ثم اختر المدينة من قائمتها.' });
    } else {
      lc++; const L=colLtr(lc); ALL_CITIES.forEach((c,i)=>{ lists.getCell(L+(i+1)).value=c; });
      ws.dataValidations.add(cityRng,{ type:'list', allowBlank:true, formulae:[`'القوائم'!$${L}$1:$${L}$${ALL_CITIES.length}`], showErrorMessage:true, errorStyle:'stop', errorTitle:'قيمة غير مسموحة', error:'اختر مدينة من القائمة.' });
    }
  }
  // العمر auto-computes from تاريخ الميلاد (formula) — the dashboard also computes it for every row
  const AGE_ROWS=2000;
  if(dobIdx>=0 && ageIdx>=0){
    const dobL=colLtr(dobIdx+1), ageL=colLtr(ageIdx+1); ws.getColumn(ageIdx+1).numFmt='0';
    for(let r=2;r<=AGE_ROWS+1;r++){ ws.getCell(ageL+r).value={ formula:`IF(${dobL}${r}="","",IFERROR(DATEDIF(${dobL}${r},TODAY(),"Y"),""))`, result:'' }; }   // result:'' required or ExcelJS drops the formula
  }

  if(SELECTED.has('visits')){
    const vs=wb.addWorksheet('الزيارات',{views:[{state:'frozen',ySplit:1,rightToLeft:true}]});
    vs.columns=VISIT_COLS.map(c=>({header:c[0],key:c[1],width:Math.max(16,Math.min(30,c[0].length+6))}));
    styleHeader(vs.getRow(1));
    ['date','next'].forEach(k=>{ const vi=VISIT_COLS.findIndex(c=>c[1]===k); if(vi>=0){ const L=colLtr(vi+1); vs.getColumn(vi+1).numFmt='yyyy-mm-dd';
      vs.dataValidations.add(`${L}2:${L}${BOTTOM}`,{ type:'date', operator:'greaterThanOrEqual', allowBlank:true, formulae:[new Date(1900,0,1)], showErrorMessage:true, errorStyle:'stop', errorTitle:'تاريخ غير صالح', error:'أدخل تاريخًا صحيحًا بالصيغة: سنة-شهر-يوم.' }); } });
  }

  // instructions / data dictionary
  const ins=wb.addWorksheet('التعليمات',{views:[{rightToLeft:true}]});
  ins.columns=[{header:'العمود',key:'c',width:24},{header:'القاعدة / القيم المسموحة',key:'n',width:56}];
  styleHeader(ins.getRow(1));
  cols.forEach(c=>{ const m=FIELD_META[c[1]];
    const note = (c[1]==='age'&&dobIdx>=0) ? 'يُحسب تلقائيًا من تاريخ الميلاد — يُترك فارغًا'
               : c[1]==='nat' ? 'اختر الجنسية من قائمة دول الوطن العربي'
               : c[1]==='city' ? 'اختر المدينة — تظهر مدن الدولة حسب الجنسية المختارة (اختر الجنسية أولًا)'
               : c[1]==='dob' ? 'تاريخ الميلاد (سنة-شهر-يوم) — يجب أن يعطي عمرًا منطقيًا'
               : m&&(m.t==='choice'||m.t==='soft') ? 'اختر من القائمة: '+m.opts.join('، ')
               : m&&m.t==='date' ? 'تاريخ بالصيغة: سنة-شهر-يوم'
               : m&&m.t==='name' ? 'نص (اسم) — لا يقبل رقمًا فقط'
               : m&&m.t==='num' ? ('رقم'+(m.min!=null?(m.max!=null?` (${m.min}–${m.max})`:` (≥ ${m.min})`):''))
               : NOTES[c[1]] || 'نص حر';
    ins.addRow({c:c[0],n:note});
  });

  const buf=await wb.xlsx.writeBuffer();
  downloadBlob(buf,'قالب_'+(BRANDING.name||'المؤسسة')+'.xlsx');
  toast('تم تنزيل القالب — قوائم منسدلة وتحقق رقمي مفعّلان');
}

/* ---------- import + detect + validate ---------- */
/* SQL edition: ONE-WAY import — the file is read once and its rows go to the DB.
 * No File System Access / write-back (that's the local edition's sync); a plain
 * file input works everywhere, including mobile. */
function connectExcel(){ xErr(''); hideReport(); $('#x-file').click(); }
/* logical helpers */
function pureNum(s){ return /^-?\d+([.,]\d+)?$/.test(String(s).trim()); }                    // a value that is only digits
function normDate(v){ if(v==null||v==='') return ''; if(v instanceof Date){ if(isNaN(v)) return ''; const y=v.getFullYear(),m=String(v.getMonth()+1).padStart(2,'0'),d=String(v.getDate()).padStart(2,'0'); return y+'-'+m+'-'+d; } return String(v).trim(); }
function ageFromDob(s){ const d=parseD(normDate(s)); if(!d||isNaN(d)) return null; let a=TODAY.getFullYear()-d.getFullYear(); const mm=TODAY.getMonth()-d.getMonth(); if(mm<0||(mm===0&&TODAY.getDate()<d.getDate())) a--; return (a>=0&&a<130)?a:null; }
function mapCells(cells){ const o={}; CASE_COLS.forEach(([ar,k,t])=>{ let v=cells[k]; if(v===''||v===undefined)v=null; o[k]=(t==='num')?(v===null?null:(isNaN(Number(v))?null:Number(v))):(v===null?null:(v instanceof Date?normDate(v):String(v).trim())); }); return o; }
async function importBuffer(buf){
  xErr(''); hideReport();
  let wb; try{ wb=XLSX.read(buf,{type:'array',cellDates:true}); }catch(e){ xErr('الملف غير صالح كملف Excel.'); return; }
  const os=wb.Sheets['الأيتام']||wb.Sheets[wb.SheetNames[0]];
  if(!os){ xErr('لم يُعثر على تبويب «الأيتام» في الملف.'); return; }
  const aoa=XLSX.utils.sheet_to_json(os,{header:1,defval:''});           // AoA → true row indices
  const hdrs=((aoa[0])||[]).map(h=>String(h).trim());
  const colIdx={}; hdrs.forEach((h,i)=>{ if(HDR2KEY[h]!==undefined) colIdx[HDR2KEY[h]]=i; });
  const presentKeys=Object.keys(colIdx);
  const rows=[];
  for(let r=1;r<aoa.length;r++){ const arr=aoa[r]||[]; if(arr.every(c=>c===''||c==null)) continue;
    const cells={}; presentKeys.forEach(k=>{ cells[k]=arr[colIdx[k]]; }); rows.push({row:r+1,cells}); }
  const vs=wb.Sheets['الزيارات']; const vraw= vs?XLSX.utils.sheet_to_json(vs,{defval:''}):[];
  const rep=validate(rows,presentKeys,vraw);
  // ALWAYS show the gatekeeper's verdict and require the explicit «رفع» click —
  // this writes to the shared DB, so no silent auto-proceed even on a clean file.
  showReport(rep, rep.blocks.length?null:()=>uploadImport(rep,vraw));
}

/* ---------- validator: row(identity) → cell → field → file, with a full details log ---------- */
function validate(rows, presentKeys, vraw){
  const rep={blocks:[],warnings:[],details:[],usable:new Set(),stats:{},validRows:[]}, total=rows.length;
  const D=(col,row,val,issue)=>rep.details.push({col,row,val:(val===''||val==null)?'(فارغة)':val,issue});
  if(!presentKeys.includes('id')) rep.blocks.push('عمود «رقم اليتيم» مفقود من الملف.');
  if(!(presentKeys.includes('first')||presentKeys.includes('family'))) rep.blocks.push('عمود «الاسم» مفقود من الملف.');
  if(!total) rep.blocks.push('التبويب «الأيتام» لا يحتوي على بيانات.');
  if(presentKeys.length<2) rep.blocks.push('الملف لا يطابق النموذج (لا توجد أعمدة معروفة).');
  if(rep.blocks.length) return rep;
  // --- ROW-LEVEL identity: every row must have an id + a name ---
  let noId=0,noName=0,dups=0,numName=0; const seen={};
  rows.forEach(rw=>{
    const idv=String(rw.cells.id||'').trim();
    const nm=(String(rw.cells.first||'').trim()||String(rw.cells.family||'').trim());
    if(!idv){ noId++; D('رقم اليتيم',rw.row,'','صف بلا رقم يتيم'); }
    else if(seen[idv]){ dups++; D('رقم اليتيم',rw.row,idv,'رقم مكرّر'); } else seen[idv]=1;
    if(!nm){ noName++; D('الاسم',rw.row,'','صف بلا اسم'); }
    else if(pureNum(nm)){ numName++; D('الاسم',rw.row,nm,'اسم رقمي غير صالح'); }   // a name can't be only digits
    if(idv) rep.validRows.push(rw);   // rows without an id can't be keyed → excluded
  });
  if(noId>=total){ rep.blocks.push('لا يوجد «رقم اليتيم» في أي صف — الملف غير صالح.'); return rep; }
  if(noName>=total){ rep.blocks.push('لا يوجد اسم في أي صف — الملف غير صالح.'); return rep; }
  if(noId/total>0.5){ rep.blocks.push('أكثر من نصف الصفوف بلا «رقم اليتيم» ('+noId+' من '+total+') — يلزم تصحيح الملف.'); return rep; }
  if(noId) rep.warnings.push({sev:'warn',field:'رقم اليتيم',msg:noId+' صف بلا رقم يتيم — استُبعدت من التحليل'});
  if(noName) rep.warnings.push({sev:'warn',field:'الاسم',msg:noName+' صف بلا اسم'});
  if(numName) rep.warnings.push({sev:'warn',field:'الاسم',msg:numName+' اسم رقمي غير صالح'});
  if(dups) rep.warnings.push({sev:'warn',field:'رقم اليتيم',msg:dups+' رقم مكرّر'});
  // --- CELL/FIELD validation on the valid (keyed) rows ---
  const vr=rep.validRows.length||1;
  presentKeys.forEach(k=>{
    if(['id','name','first','family'].includes(k)){ rep.usable.add(k); return; }
    if(k==='age' && presentKeys.includes('dob')) return;   // age is auto-computed from dob, not validated as manual input
    const meta=FIELD_META[k]||{t:'text'}, hdr=KEY2HDR[k];
    let filled=0, valid=0, badN=0;
    rep.validRows.forEach(rw=>{ let v=rw.cells[k]; if(v===''||v==null) return; filled++; const s=(v instanceof Date)?normDate(v):String(v).trim();
      if(meta.t==='num'){ const n=Number(s); if(s===''||isNaN(n)){ D(hdr,rw.row,s,'قيمة غير رقمية'); badN++; } else if((meta.min!=null&&n<meta.min)||(meta.max!=null&&n>meta.max)){ D(hdr,rw.row,s,'خارج المدى'); badN++; } else valid++; }
      else if(meta.t==='choice'||meta.t==='soft'){ if(meta.opts.includes(s)) valid++; else { D(hdr,rw.row,s,'قيمة غير معروفة'); badN++; } }
      else if(meta.t==='name'){ if(pureNum(s)){ D(hdr,rw.row,s,'قيمة رقمية في حقل نصّي'); badN++; } else valid++; }
      else if(meta.t==='date'){ const p=String(s).split(/[-/]/), pd=parseD(s);
        const ok=pd&&!isNaN(pd.getTime())&&p.length>=3&&+p[1]>=1&&+p[1]<=12&&+p[2]>=1&&+p[2]<=31;   // reject rollover dates (13/40)
        if(!ok){ D(hdr,rw.row,s,'تاريخ غير صالح'); badN++; } else valid++; }
      else valid++;
    });
    const comp=Math.round(filled/vr*100), rate=filled?valid/filled:0;
    rep.stats[k]={filled,valid,comp};
    if(filled===0){ rep.warnings.push({sev:'info',field:hdr,msg:'حزمة مختارة لكنها فارغة — لن تظهر مؤشراتها.'}); return; }
    if((meta.t==='choice'||meta.t==='num') && rate<0.5){ rep.warnings.push({sev:'warn',field:hdr,msg:'أكثر من نصف القيم غير صالحة — عُطِّل المؤشر حتى التصحيح'}); return; }
    rep.usable.add(k);
    if(badN) rep.warnings.push({sev:'warn',field:hdr,msg:badN+' خلية بها مشكلة'});
    if(comp<80) rep.warnings.push({sev:'info',field:hdr,msg:comp+'% مكتمل فقط (يُحسب المؤشر على المتوفّر)'});
  });
  if(rep.usable.has('dob')) rep.usable.add('age');   // dob present → age is derived, so its chart is available
  // group the details by column type (schema order), then by row — so same-type issues sit together like the summary
  const ORD={}; CASE_COLS.forEach((c,i)=>ORD[c[0]]=i); ORD['الاسم']=CASE_COLS.findIndex(c=>c[1]==='first');
  rep.details.sort((a,b)=>((ORD[a.col]??900)-(ORD[b.col]??900))||(a.row-b.row));
  return rep;
}
function showReport(rep, proceedFn){   // renders inside the import modal (#x-report)
  const el=$('#x-report'), blocked=rep.blocks.length>0, hasNotes=rep.warnings.length||rep.details.length;
  const cls= blocked?'block':(hasNotes?'warn':'ok');
  const head= blocked?'⛔ لا يمكن المتابعة — يلزم إصلاح الملف':(hasNotes?'الملف مقبول مع ملاحظات':'الملف سليم');
  let lines='';
  rep.blocks.forEach(b=>lines+=`<div class="r-line err"><span class="ic">⛔</span><div>${b}</div></div>`);
  rep.warnings.forEach(w=>{ const info=w.sev==='info'; lines+=`<div class="r-line ${info?'info':'warn'}"><span class="ic">${info?'ℹ':'⚠'}</span><div><b>${w.field}</b> — ${w.msg}</div></div>`; });
  if(!lines) lines=`<div class="r-line info"><span class="ic">✓</span><div>لا ملاحظات — جميع الأعمدة سليمة.</div></div>`;
  const td='padding:5px 8px;border-top:1px solid var(--border2)';
  const details = rep.details.length? `<div id="r-details" style="display:none;margin-top:8px;border-top:1px solid var(--border);padding-top:6px">
    <table style="width:100%;font-size:11.5px"><thead><tr>
      <th style="text-align:start;padding:5px 8px;color:var(--muted)">العمود</th><th style="text-align:start;padding:5px 8px;color:var(--muted)">الصف</th><th style="text-align:start;padding:5px 8px;color:var(--muted)">القيمة</th><th style="text-align:start;padding:5px 8px;color:var(--muted)">المشكلة</th></tr></thead>
    <tbody>${rep.details.map(d=>`<tr><td style="${td}">${d.col}</td><td style="${td}" class="tnum">${d.row}</td><td style="${td}">${d.val}</td><td style="${td};color:#b8860b">${d.issue}</td></tr>`).join('')}</tbody></table></div>`:'';
  const toggle = rep.details.length? `<button class="btn ghost sm" id="r-toggle" style="margin-inline-start:auto">عرض التفاصيل (${rep.details.length})</button>`:'';
  el.className='report '+cls;
  el.innerHTML=`<div class="r-h">${head}${toggle}</div><div class="r-body">${lines}${details}</div>`+
    (blocked?'':`<div class="r-foot"><span class="msg">تُرفع الصفوف الصالحة فقط إلى قاعدة البيانات (${rep.validRows.length} حالة).</span><button class="btn primary sm" id="r-proceed">رفع إلى قاعدة البيانات ⤴</button></div>`);
  el.style.display='block';
  const tg=$('#r-toggle'); if(tg) tg.addEventListener('click',()=>{ const d=$('#r-details'); const on=d.style.display!=='none'; d.style.display=on?'none':'block'; tg.textContent=on?('عرض التفاصيل ('+rep.details.length+')'):'إخفاء التفاصيل'; });
  if(!blocked && proceedFn) $('#r-proceed').addEventListener('click',()=>{ $('#r-proceed').disabled=true; proceedFn(); });
}
function hideReport(){ const el=$('#x-report'); if(el) el.style.display='none'; }

/* ---------- bulk upload → Supabase (chunked) ----------
 * Rule (agreed): UPSERT by «رقم اليتيم» — an existing id is UPDATED with the file's
 * row, a new id is ADDED. Visits (no id of their own) are INSERT-only, deduped
 * against the DB's rows. Chunking is for delivery safety (payload size / statement
 * timeout / progress feedback) — cost is size-based, not per-request.
 * Idempotent: re-running the same file is safe, so a failed run can just be retried. */
const CHUNK=400;   // rows per request — comfortable margin under payload/timeout limits
function xErr(msg){ const b=$('#x-err'); if(b){ b.innerHTML=msg||''; b.style.display=msg?'block':'none'; } }
async function uploadImport(rep, vraw){
  if(!canEdit()){ xErr('صلاحيتك للعرض فقط — الرفع متاح للمحرّر والمدير.'); return; }
  // orphans → DB shape; duplicate ids inside the file collapse to the LAST occurrence
  // (one upsert can't touch the same row twice — and "the file's latest wins" matches the rule)
  const byId=new Map();
  rep.validRows.forEach(rw=>{ const r=pickCols(mapCells(rw.cells)); byId.set(String(r.id).trim(), r); });
  const recs=[...byId.values()];
  // visits: keep only rows keyed to an orphan and not already in the DB (exact-row match)
  const vKey=v=>['oid','date','result','next','worker'].map(k=>v[k]==null?'':String(v[k]).trim()).join('|');
  const haveV=new Set(VISITS.map(vKey)), seenV=new Set(), newVisits=[];
  vraw.map(r=>mapRow(r,VISIT_COLS)).forEach(v=>{
    if(!v.oid||!String(v.oid).trim()) return;
    const k=vKey(v); if(haveV.has(k)||seenV.has(k)) return;
    seenV.add(k); newVisits.push(v);
  });
  const total=recs.length+newVisits.length;
  if(!total){ xErr('لا صفوف جديدة للرفع — كل ما في الملف موجود مسبقًا.'); return; }
  const prog=$('#x-prog'), fill=$('#x-prog-fill'), txt=$('#x-prog-txt');
  prog.style.display='block'; xErr(''); let done=0;
  const step=w=>{ txt.textContent=w; fill.style.width=Math.round(done/total*100)+'%'; };
  try{
    for(let i=0;i<recs.length;i+=CHUNK){                       // cases: chunked UPSERT
      const part=recs.slice(i,i+CHUNK);
      step(`رفع الحالات… ${done} / ${recs.length}`);
      const { error }=await sb.from('orphans').upsert(part); if(error) throw error;
      done+=part.length; step(`رفع الحالات… ${done} / ${recs.length}`);
    }
  }catch(e){
    xErr( permErr(e)
      ? '⛔ رفضته قاعدة البيانات — صلاحيتك للعرض فقط.'
      : `⚠ توقّف الرفع بعد ${done} من ${recs.length} حالة (${(e&&e.message)||e}).<br>أعد المحاولة بالملف نفسه — الرفع آمن للتكرار (تحديث بالرقم، لا تكرار).`);
    txt.textContent='توقّف الرفع.'; return;
  }
  // visits ride separately: a visits failure must NOT void the already-landed cases.
  // (e.g. the DB may lack write policies on `visits` — cases succeed, visits get reported)
  let vDone=0, vFail=null;
  try{
    for(let i=0;i<newVisits.length;i+=CHUNK){                  // visits: chunked INSERT (new only)
      const part=newVisits.slice(i,i+CHUNK);
      step(`رفع الزيارات… ${vDone} / ${newVisits.length}`);
      const { error }=await sb.from('visits').insert(part); if(error) throw error;
      vDone+=part.length; done+=part.length;
    }
  }catch(e){ vFail=(e&&e.message)||String(e); }
  step('✓ اكتمل الرفع — جارٍ تحديث اللوحة…'); fill.style.width='100%';
  await refreshFromDb();                                       // pull the merged truth back from the DB
  if(vFail){
    xErr(`✓ رُفعت ${recs.length} حالة بنجاح — لكن تعذّر رفع الزيارات (${vDone} من ${newVisits.length}).<br>السبب غالبًا: جدول «visits» بلا سياسة كتابة (RLS) — أضِف سياسة insert للمحرّر/المدير ثم أعد ربط الملف نفسه (آمن للتكرار).`);
    txt.textContent='اكتملت الحالات — الزيارات بحاجة سياسة كتابة.';
    toast(`✓ رُفعت ${recs.length} حالة — تعذّرت الزيارات`);
    return;
  }
  closeImport();
  toast(`✓ رُفعت ${recs.length} حالة${newVisits.length?` و${newVisits.length} زيارة`:''} إلى قاعدة البيانات`);
}

/* ---------- bulk-import modal wiring (the «إضافة حالات من Excel» button) ---------- */
function openImport(){
  if(!canEdit()){ toast('صلاحيتك للعرض فقط'); return; }        // convenience — RLS is the real guard
  SELECTED=new Set(PACKAGES.map(p=>p.id));                     // the SQL mould is ALWAYS the full model (no picker)
  xErr(''); hideReport();
  const p=$('#x-prog'); p.style.display='none'; $('#x-prog-fill').style.width='0%';
  $('#ximp').classList.add('on');
}
function closeImport(){ $('#ximp').classList.remove('on'); }
$('#t-import').addEventListener('click', openImport);
$('#x-x').addEventListener('click', closeImport);
$('#ximp').addEventListener('click', e=>{ if(e.target.id==='ximp') closeImport(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && $('#ximp').classList.contains('on')) closeImport(); });
$('#x-template').addEventListener('click', downloadTemplate);
$('#x-connect').addEventListener('click', connectExcel);
$('#x-file').addEventListener('change', async e=>{
  const f=e.target.files[0]; if(!f) return; e.target.value='';   // reset so re-picking the same file re-fires
  try{ await importBuffer(await f.arrayBuffer()); }catch(_){ xErr('تعذّرت قراءة الملف.'); }
});

async function loadSample(){
  const [c,v]=await Promise.all([fetch('sample/cases.json').then(r=>r.json()),fetch('sample/visits.json').then(r=>r.json())]);
  DATA=c; VISITS=v; HAS_VISITS=true; fileName='(بيانات نموذجية)'; fileHandle=null;
  AVAIL=new Set(CASE_COLS.map(c=>c[1])); AVAIL.add('__visits__');
  derive(); startApp();
}
function derive(){ DATA.forEach(d=>{ if(!d.name) d.name=[d.first,d.father,d.family].filter(Boolean).join(' '); if('dob' in d){ const a=ageFromDob(d.dob); if(a!=null) d.age=a; } }); }

/* ---------- Excel write / sync / export ---------- */
function buildWorkbook(){
  const cell=v=>(v===null||v===undefined)?'':v;
  const cols=CASE_COLS.filter(c=>AVAIL.has(c[1]));
  const oAoa=[cols.map(c=>c[0])].concat(DATA.map(d=>cols.map(c=>cell(d[c[1]]))));
  const wb=XLSX.utils.book_new();
  const os=XLSX.utils.aoa_to_sheet(oAoa); os['!views']=[{RTL:true}]; XLSX.utils.book_append_sheet(wb,os,'الأيتام');
  if(HAS_VISITS){ const vAoa=[VISIT_COLS.map(c=>c[0])].concat(VISITS.map(d=>VISIT_COLS.map(c=>cell(d[c[1]])))); const vs=XLSX.utils.aoa_to_sheet(vAoa); vs['!views']=[{RTL:true}]; XLSX.utils.book_append_sheet(wb,vs,'الزيارات'); }
  return wb;
}
async function ensureWritePerm(){
  if(!fileHandle||!fileHandle.queryPermission) return true;
  if(await fileHandle.queryPermission({mode:'readwrite'})==='granted') return true;
  return await fileHandle.requestPermission({mode:'readwrite'})==='granted';
}
async function saveToExcel(silent){
  const out=XLSX.write(buildWorkbook(),{bookType:'xlsx',type:'array'});
  if(fileHandle){
    try{
      if(!await ensureWritePerm()){ toast('لم يُمنح إذن الكتابة على الملف — اسمح بالوصول ثم أعد المحاولة'); return false; }
      const w=await fileHandle.createWritable(); await w.write(out); await w.close();
      if(!silent)toast('✓ حُفظ في الملف المحلي'); return true;
    }catch(e){ toast('⚠ لم يُحفظ في الملف — أغلق الملف في Excel ثم أعد المحاولة'); return false; }
  }
  downloadBlob(out,(fileName||'بيانات').replace(/\.xlsx$/,'')+'_محدّث.xlsx'); return true;
}
/* export a formatted report (ExcelJS): styled headers, borders, auto-fit widths + a statistics summary */
async function exportReport(){
  if(!DATA.length){ toast('لا توجد بيانات للتصدير'); return; }
  if(!window.ExcelJS){ toast('محرّك التصدير غير متاح'); return; }
  const wb=new ExcelJS.Workbook();
  const _ax=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().replace('#','');   // match each version's theme
  const HEAD=/^[0-9a-fA-F]{6}$/.test(_ax)?('FF'+_ax.toUpperCase()):'FF184F95', WHITE='FFFFFFFF', LINE='FFDDDDDD', TINT='FFF1F3F5';
  const bd={top:{style:'thin',color:{argb:LINE}},bottom:{style:'thin',color:{argb:LINE}},left:{style:'thin',color:{argb:LINE}},right:{style:'thin',color:{argb:LINE}}};
  const headRow=row=>{ row.height=20; row.eachCell(c=>{ c.fill={type:'pattern',pattern:'solid',fgColor:{argb:HEAD}}; c.font={bold:true,color:{argb:WHITE}}; c.alignment={horizontal:'center',vertical:'middle'}; c.border=bd; }); };
  const fit=(ws,headers,rows)=>{ headers.forEach((h,i)=>{ let mx=String(h).length; rows.forEach(r=>{ const v=r[i]; if(v!=null&&v!=='') mx=Math.max(mx,String(v).length); }); ws.getColumn(i+1).width=Math.max(9,Math.min(42,mx+3)); }); };
  const dataSheet=(name,colsDef,src)=>{
    const aoa=src.map(d=>colsDef.map(c=>{const v=d[c[1]];return v==null?'':v;}));
    const ws=wb.addWorksheet(name,{views:[{state:'frozen',ySplit:1,rightToLeft:true}]});
    ws.addRow(colsDef.map(c=>c[0])); aoa.forEach(r=>ws.addRow(r));
    headRow(ws.getRow(1)); fit(ws, colsDef.map(c=>c[0]), aoa);
    ws.eachRow((row,rn)=>{ if(rn===1)return; row.eachCell(c=>{ c.border=bd; c.alignment={vertical:'middle',horizontal:'right'}; }); });
  };
  dataSheet('الأيتام', CASE_COLS.filter(c=>AVAIL.has(c[1])), DATA);
  if(HAS_VISITS && VISITS.length) dataSheet('الزيارات', VISIT_COLS, VISITS);

  // ---- statistics summary (formatted) ----
  const sum=wb.addWorksheet('ملخص إحصائي',{views:[{rightToLeft:true}]});
  sum.columns=[{width:40},{width:20}];
  const t=sum.addRow(['ملخص إحصائي — '+(BRANDING.name||'الأيتام'),'']); sum.mergeCells('A1:B1');
  t.getCell(1).font={bold:true,size:14,color:{argb:HEAD}}; t.getCell(1).alignment={horizontal:'center',vertical:'middle'}; t.height=26;
  const dr=sum.addRow(['تاريخ التقرير', normDate(TODAY)]); dr.getCell(1).font={bold:true}; dr.getCell(2).alignment={horizontal:'left'};
  sum.addRow([]); headRow(sum.addRow(['المؤشر','القيمة']));
  const kv=(k,v)=>{ const r=sum.addRow([k,v]); r.getCell(1).border=bd; r.getCell(2).border=bd; r.getCell(2).font={bold:true}; r.getCell(2).alignment={horizontal:'left'}; };
  const sec=t=>{ sum.addRow([]); const r=sum.addRow([t,'']); sum.mergeCells(`A${r.number}:B${r.number}`); const c=r.getCell(1); c.font={bold:true,color:{argb:HEAD}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:TINT}}; c.alignment={horizontal:'center'}; c.border=bd; };
  kv('إجمالي الأيتام', DATA.length);
  if(has('famId')) kv('عدد الأسر', new Set(DATA.map(d=>d.famId).filter(Boolean)).size);
  if(has('spStatus')){ const sp=DATA.filter(d=>d.spStatus==='مكفول').length; kv('نسبة تغطية الكفالة', pct(sp,DATA.length)+'%'); kv('بحاجة كفالة', DATA.filter(d=>d.spStatus==='غير مكفول'||d.spStatus==='منتهية').length); }
  if(has('priority')){ kv('أولوية عالية/حرجة', DATA.filter(d=>d.priority==='حرجة'||d.priority==='عالية').length); kv('حالات حرجة', DATA.filter(d=>d.priority==='حرجة').length); }
  if(has('vuln')){ const v=DATA.map(d=>d.vuln).filter(x=>typeof x==='number'); if(v.length){ kv('متوسط مؤشر الهشاشة', Math.round(v.reduce((a,b)=>a+b,0)/v.length)); kv('وسيط مؤشر الهشاشة', median(v)); } }
  const distSec=(title,key,order)=>{ if(!has(key))return; const c=countBy(DATA,key); const keys=order?order.filter(k=>c[k]):Object.keys(c).sort((a,b)=>c[b]-c[a]); if(!keys.length)return; sec('— '+title+' —'); keys.forEach(k=>kv(k,c[k])); };
  distSec('أولوية التدخل','priority',['حرجة','عالية','متوسطة','منخفضة']);
  distSec('حالة الكفالة','spStatus',['مكفول','غير مكفول','قيد الدراسة','منتهية']);
  distSec('التوزيع الجغرافي','city'); distSec('فئة الدخل','income',['لا يوجد دخل ثابت','أقل من 250,000','250,000-500,000','أكثر من 500,000']); distSec('نوع السكن','housing');
  if(has('spAmount')&&has('spStatus')){ const paid=DATA.filter(d=>d.spStatus==='مكفول'); const actual=paid.reduce((s,d)=>s+(typeof d.spAmount==='number'?d.spAmount:0),0); const nPaid=paid.filter(d=>typeof d.spAmount==='number').length; const avg=nPaid?Math.round(actual/nPaid):0; const need=DATA.filter(d=>d.spStatus==='غير مكفول'||d.spStatus==='منتهية').length; sec('— الوضع المالي (شهري) —'); kv('المصروف الفعلي (المكفولون)', actual); if(avg)kv('متوسط الكفالة للحالة', avg); if(avg&&need)kv('تكلفة تغطية الفجوة (تقديري)', avg*need); }

  downloadBlob(await wb.xlsx.writeBuffer(), 'تقرير_'+String(BRANDING.name||'الأيتام').replace(/\s+/g,'_')+'.xlsx');
  toast('✓ تم تصدير التقرير المنسّق');
}
function downloadBlob(out,name){const b=new Blob([out],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name||'export.xlsx';a.click();}

/* ---------- start ---------- */
function startApp(){
  applyBrand();                       // fixed Daleel name / logo / tagline / date / footer / watermark
  $('#gate').style.display='none'; $('#app').style.display='block';
  applyRoleUI();                      // role → gate add/edit/delete + mask names for viewers + show data source
  state.page=0; buildFilters(); renderAll();
}
/* session persistence removed for the live edition — the source of truth is the Sheet,
 * and orphan data is NOT cached in localStorage (only the last-used email is remembered). */
function saveSession(){} function clearSession(){}

/* ============================ measure helpers ============================ */
function uniq(k){return [...new Set(DATA.map(d=>d[k]).filter(Boolean))];}
function countBy(arr,k){const m={};arr.forEach(d=>{const v=d[k];if(v!=null&&v!=='')m[v]=(m[v]||0)+1;});return m;}
function mean(arr,k){const v=arr.map(d=>d[k]).filter(x=>typeof x==='number');return v.length?v.reduce((a,b)=>a+b,0)/v.length:0;}
function median(v){if(!v.length)return 0;const s=v.slice().sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:Math.round((s[m-1]+s[m])/2*10)/10;}
function computeVisitStats(f){
  const ids=new Set(f.map(d=>d.id)); const byOid={}; VISITS.forEach(v=>{(byOid[v.oid]=byOid[v.oid]||[]).push(v);});
  const emer=new Set(); let overdue=0;
  VISITS.forEach(v=>{ if(ids.has(v.oid)&&v.result==='طارئة') emer.add(v.oid); });
  Object.keys(byOid).forEach(oid=>{ if(!ids.has(oid))return; const l=byOid[oid].slice().sort((a,b)=>parseD(b.date)-parseD(a.date))[0]; const nx=parseD(l&&l.next); if(nx&&nx<TODAY) overdue++; });
  return {emergencyCases:emer.size, overdue};
}

/* ============================ FILTERS (only available dims) ============================ */
function buildFilters(){
  const sel=(id,label,vals,all)=>`<label>${label}</label><select data-f="${id}"><option value="">${all}</option>`+vals.map(v=>`<option value="${v}">${v}</option>`).join('')+`</select>`;
  let h=`<input class="search" data-f="q" autocomplete="off" placeholder="بحث بالاسم أو الرقم…">`;
  if(has('city')) h+=sel('city','المحافظة',uniq('city').sort(),'الكل');
  if(has('priority')) h+=sel('priority','الأولوية',['حرجة','عالية','متوسطة','منخفضة'],'الكل');
  if(has('spStatus')) h+=sel('sp','الكفالة',['مكفول','غير مكفول','قيد الدراسة','منتهية'],'الكل');
  if(has('gender')) h+=sel('gender','الجنس',['ذكر','أنثى'],'الكل');
  h+=`<button class="reset showall" id="f-showall">عرض كل الحالات</button>`;
  $('#filters').innerHTML=h;
  $$('#filters [data-f]').forEach(el=>el.addEventListener(el.tagName==='INPUT'?'input':'change',e=>{state[e.target.dataset.f]=e.target.value;state.page=0;renderAll();}));
  $('#f-showall').addEventListener('click', resetView);
  const si=$('#filters .search');
  if(si) acAttach(si, ()=>DATA.map(d=>({label:(d.name||'—')+' — '+d.id, name:d.name||d.id})), it=>{ si.value=it.name; state.q=it.name; state.page=0; renderAll(); });   // match name OR id (so typing a number works too)
}
function rebuildSearchLists(){}   // (kept as no-op; search now uses live autocomplete)
/* ---------- gentle custom search suggestions ---------- */
let _ac=null,_acFor=null,_acHi=-1;
function acHide(){ if(_ac){_ac.style.display='none';_ac._items=null;} _acFor=null; _acHi=-1; }
function _acPos(){ if(!_ac||!_acFor)return; const r=_acFor.getBoundingClientRect(); _ac.style.left=r.left+'px'; _ac.style.top=(r.bottom+4)+'px'; _ac.style.width=Math.max(r.width,220)+'px'; }
function _acHiSet(i){ _acHi=i; if(!_ac)return; [..._ac.children].forEach((el,j)=>el.classList.toggle('on',j===i)); if(_ac.children[i]) _ac.children[i].scrollIntoView({block:'nearest'}); }
function acAttach(input, itemsFn, onPick){
  const show=()=>{
    const q=input.value.trim().toLowerCase();
    let items=itemsFn(); if(q) items=items.filter(it=>String(it.label).toLowerCase().includes(q));
    items=items.slice(0,50);
    if(!items.length){ acHide(); return; }
    if(!_ac){ _ac=document.createElement('div'); _ac.className='ac-panel';
      _ac.addEventListener('mousedown',e=>e.preventDefault());   // clicking / scrolling the list must NOT blur the input (was the disappearing bug)
      document.body.appendChild(_ac); }
    _acFor=input; _ac._items=items; _acHi=-1;
    _ac.innerHTML=items.map((it,i)=>`<div class="ac-item" data-i="${i}">${escA(it.label)}</div>`).join('');
    _acPos(); _ac.style.display='block';
    [..._ac.children].forEach((el,i)=>{ el.onmouseenter=()=>_acHiSet(i); el.onclick=()=>{ onPick(items[i]); acHide(); }; });
  };
  input.addEventListener('input',show);
  input.addEventListener('focus',show);
  input.addEventListener('keydown',e=>{
    if(!_ac||_ac.style.display==='none'||_acFor!==input) return;
    const n=_ac.children.length;
    if(e.key==='ArrowDown'){ e.preventDefault(); _acHiSet((_acHi+1)%n); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); _acHiSet((_acHi-1+n)%n); }
    else if(e.key==='Enter'){ if(_acHi>=0&&_ac._items&&_ac._items[_acHi]){ e.preventDefault(); onPick(_ac._items[_acHi]); acHide(); } }
    else if(e.key==='Escape'){ acHide(); }
  });
}
document.addEventListener('mousedown',e=>{ if(_ac&&_ac.style.display!=='none'&&!_ac.contains(e.target)&&e.target!==_acFor) acHide(); });
window.addEventListener('scroll',e=>{ if(_ac&&_ac.style.display!=='none'){ if(_ac.contains(e.target)) return; _acPos(); } },true);   // scrolling INSIDE the list is ignored; page scroll just repositions
window.addEventListener('resize',()=>{ if(_ac&&_ac.style.display!=='none') _acPos(); });

/* ============================ KPI measures (gated) ============================ */
function renderKPIs(f){
  const cards=[];
  cards.push({lab:'إجمالي الأيتام',val:fmt(f.length),sub: has('famId')?`ضمن <b>${fmt(new Set(f.map(d=>d.famId).filter(Boolean)).size)}</b> أسرة`:'&nbsp;'});
  if(has('spStatus')){ const sponsored=f.filter(d=>d.spStatus==='مكفول').length, gap=f.filter(d=>d.spStatus==='غير مكفول'||d.spStatus==='منتهية').length, cov=pct(sponsored,f.length);
    cards.push({lab:'تغطية الكفالة',val:cov+'%',bar:[['var(--good)',cov],['var(--grid)',100-cov]],sub:`<span class="k-tag warn">${fmt(gap)} بحاجة كفالة</span>`}); }
  if(has('priority')){ const high=f.filter(d=>d.priority==='عالية'||d.priority==='حرجة').length, crit=f.filter(d=>d.priority==='حرجة').length;
    cards.push({lab:'أولوية عالية/حرجة',val:fmt(high),sub: crit?`<span class="k-tag crit">${fmt(crit)} حرجة</span>`:'لا حالات حرجة'}); }
  if(has('__visits__')){ const vs=computeVisitStats(f);
    cards.push({lab:'حالات تحتاج تدخّلاً عاجلاً',val:fmt(vs.emergencyCases),sub: vs.overdue?`<span class="k-tag warn">${fmt(vs.overdue)} متابعة مستحقّة</span>`:'لا متابعات متأخرة'}); }
  if(has('vuln')){ const av=Math.round(mean(f,'vuln'));
    cards.push({lab:'متوسط مؤشر الهشاشة',val:av+'<small>/100</small>',bar:[['var(--b400)',av],['var(--grid)',100-av]],sub:`الوسيط ${median(f.map(d=>d.vuln).filter(x=>typeof x==='number'))}`}); }
  $('#kpis').innerHTML=cards.map(k=>`<div class="kpi"><div class="k-lab">${k.lab}</div><div class="k-val tnum">${k.val}</div>${k.bar?`<div class="mini-bar">${k.bar.map(b=>`<span style="width:${b[1]}%;background:${b[0]}"></span>`).join('')}</div>`:''}<div class="k-sub">${k.sub||''}</div></div>`).join('');
}

/* ============================ CHART measures (gated + reflow) ============================ */
const CHARTS=[
  {id:'coverage',span:6,title:'تغطية الكفالة',hint:'نسبة المكفولين والفجوة',need:()=>has('spStatus'),render:renderCoverage},
  {id:'vuln',span:6,title:'توزيع مؤشر الهشاشة',hint:'شدّة الحاجة عبر الحالات',need:()=>has('vuln'),render:renderVuln},
  {id:'covcity',span:8,title:'تغطية الكفالة حسب المحافظة',hint:'مؤشر مركّب',need:()=>has('spStatus')&&has('city'),render:renderCovByCity},
  {id:'priority',span:4,title:'أولوية التدخل',hint:'',need:()=>has('priority'),render:renderPriority},
  {id:'geo',span:4,title:'التوزيع الجغرافي',hint:'حسب المحافظة',need:()=>has('city'),render:renderGeo},
  {id:'age',span:4,title:'الفئات العمرية',hint:'',need:()=>has('age'),render:renderAge},
  {id:'income',span:4,title:'فئات الدخل',hint:'',need:()=>has('income'),render:renderIncome},
  {id:'housing',span:4,title:'نوع السكن',hint:'',need:()=>has('housing'),render:renderHousing},
  {id:'visits',span:8,title:'نشاط الزيارات عبر الزمن',hint:'عدد الزيارات شهريًا',need:()=>has('__visits__'),render:renderVisits},
  {id:'outcomes',span:4,title:'نتائج الزيارات',hint:'',need:()=>has('__visits__'),render:renderOutcomes},
];
function renderCharts(f){
  const host=$('#charts'); host.innerHTML='';
  CHARTS.filter(c=>c.need()).forEach(c=>{
    const card=document.createElement('div'); card.className='card'; card.style.gridColumn='span '+c.span;
    card.innerHTML=`<div class="card-h"><h3>${c.title}</h3>${c.hint?`<span class="hint">${c.hint}</span>`:''}</div><div class="body"></div>`;
    host.appendChild(card); c.render(card.querySelector('.body'),f);
  });
}

/* ---- renderers (into a passed element) ---- */
function renderCoverage(el,f){
  const order=[['مكفول','var(--good)'],['قيد الدراسة','var(--b300)'],['غير مكفول','var(--warning)'],['منتهية','var(--critical)']];
  const c=countBy(f,'spStatus'), total=f.length||1;
  const segs=order.map(([k,col])=>({k,col,p:(c[k]||0)/total*100})).filter(s=>s.p>0);
  const cov=pct(c['مكفول']||0,total);
  el.innerHTML=`<div style="font-size:34px;font-weight:750;line-height:1" class="tnum">${cov}<span style="font-size:17px;color:var(--muted)">%</span></div>
    <div style="font-size:12px;color:var(--muted);margin:2px 0 16px">من الحالات مكفولة</div>
    <div class="cover-bar">${segs.map(s=>`<div style="width:${s.p}%;background:${s.col}" data-tip="${s.k}: ${c[s.k]} (${Math.round(s.p)}%)">${s.p>9?Math.round(s.p)+'%':''}</div>`).join('')}</div>
    <div class="cover-legend">${order.filter(([k])=>c[k]).map(([k,col])=>`<span class="leg"><span class="sw" style="background:${col}"></span>${k} <b class="tnum">${c[k]}</b></span>`).join('')}</div>`;
  tipAll(el);
}
function tipAll(el){ [...el.querySelectorAll('[data-tip]')].forEach(x=>{x.addEventListener('mousemove',e=>showTip(x.dataset.tip,e));x.addEventListener('mouseleave',hideTip);}); }
function renderVuln(el,f){
  const vals=f.map(d=>d.vuln).filter(x=>typeof x==='number');
  const bins=Array.from({length:10},(_,i)=>({lo:i*10,hi:i*10+10,n:0})); vals.forEach(v=>{bins[Math.min(9,Math.floor(v/10))].n++;});
  const med=median(vals), rawMax=Math.max(1,...bins.map(b=>b.n)), niceMax=Math.max(4,Math.ceil(rawMax/4)*4);
  const W=462,H=190,pl=30,pt=26,pb=22,iw=W-pl-10,ih=H-pt-pb,bw=iw/10;
  const y=n=>pt+ih-(n/niceMax)*ih;
  let grid=''; for(let i=0;i<=4;i++){ const val=Math.round(niceMax*i/4), yy=y(val);   // y-axis: count gridlines + labels
    grid+=`<line x1="${pl}" x2="${pl+iw}" y1="${yy}" y2="${yy}" style="stroke:var(--grid);stroke-width:1"></line><text class="axis-tick" x="${pl-7}" y="${yy+3}" text-anchor="end">${val}</text>`; }
  const bars=bins.map((b,i)=>`<rect x="${pl+i*bw+2.5}" y="${y(b.n)}" width="${bw-5}" height="${Math.max(0,pt+ih-y(b.n))}" rx="3" style="fill:var(--b400)" data-tip="${b.lo}–${b.hi}: ${b.n} حالة"></rect>`).join('');
  const ticks=[0,20,40,60,80,100].map(t=>`<text class="axis-tick" x="${pl+(t/100)*iw}" y="${H-6}" text-anchor="middle">${t}</text>`).join('');
  const mx=pl+(med/100)*iw, chipW=66,chipH=17,cx=Math.max(pl+chipW/2,Math.min(W-10-chipW/2,mx));
  const chip=`<line class="med-line" x1="${mx}" x2="${mx}" y1="${pt}" y2="${pt+ih}"></line>`+
    `<rect x="${cx-chipW/2}" y="3" width="${chipW}" height="${chipH}" rx="8.5" style="fill:var(--critical)"></rect>`+
    `<text x="${cx}" y="${chipH-1}" text-anchor="middle" style="fill:#fff;font-size:11px;font-weight:700">الوسيط ${med}</text>`;
  el.className='body chart'; el.innerHTML=`<svg viewBox="0 0 ${W} ${H}">${grid}${bars}${chip}${ticks}</svg>`;
  tipAll(el);
}
function hbars(el,rows,base){
  const b=base||Math.max(1,...rows.map(r=>r.val));
  el.innerHTML=`<div class="hbars">${rows.map(r=>`<div class="hbar"><span class="lab" title="${r.lab}">${r.lab}</span><span class="track"><span class="fill" style="width:${Math.max(2,(r.val/b)*100)}%;background:${r.col}" data-tip="${r.lab}: ${r.val}"></span></span><span class="val tnum">${fmt(r.val)}</span></div>`).join('')}</div>`;
  tipAll(el);
}
function renderPriority(el,f){ hbars(el,[['حرجة','var(--b700)'],['عالية','var(--b500)'],['متوسطة','var(--b300)'],['منخفضة','var(--b100)']].map(([k,col])=>({lab:k,val:f.filter(d=>d.priority===k).length,col}))); }
function renderGeo(el,f){ const c=countBy(f,'city'); hbars(el,Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,n])=>({lab:k,val:n,col:'var(--b400)'}))); }
function renderIncome(el,f){ const ord=['لا يوجد دخل ثابت','أقل من 250,000','250,000-500,000','أكثر من 500,000']; const c=countBy(f,'income'); hbars(el,ord.filter(k=>c[k]).map(k=>({lab:k,val:c[k],col:'var(--b400)'}))); }
function renderHousing(el,f){ const c=countBy(f,'housing'); hbars(el,Object.entries(c).sort((a,b)=>b[1]-a[1]).map(([k,n])=>({lab:k,val:n,col:'var(--b400)'}))); }
function renderAge(el,f){
  const ages=f.map(d=>d.age).filter(x=>typeof x==='number'), lo=4,hi=18, bins=Array.from({length:hi-lo+1},(_,i)=>({a:lo+i,n:0}));
  ages.forEach(a=>bins[Math.max(0,Math.min(bins.length-1,a-lo))].n++);
  const rawMax=Math.max(1,...bins.map(b=>b.n)), niceMax=Math.max(4,Math.ceil(rawMax/4)*4);
  const W=462,H=176,pl=28,pt=10,pb=22,iw=W-pl-10,ih=H-pt-pb,bw=iw/bins.length;
  const y=n=>pt+ih-(n/niceMax)*ih;
  let grid=''; for(let i=0;i<=4;i++){ const val=Math.round(niceMax*i/4), yy=y(val);   // y-axis: count gridlines + labels
    grid+=`<line x1="${pl}" x2="${pl+iw}" y1="${yy}" y2="${yy}" style="stroke:var(--grid);stroke-width:1"></line><text class="axis-tick" x="${pl-6}" y="${yy+3}" text-anchor="end">${val}</text>`; }
  const bars=bins.map((b,i)=>{const h=Math.max(0,pt+ih-y(b.n));return `<rect x="${pl+i*bw+2}" y="${y(b.n)}" width="${bw-4}" height="${h}" rx="3" style="fill:var(--b400)" data-tip="${b.a} سنة: ${b.n}"></rect>`;}).join('');
  const ticks=bins.filter((_,i)=>i%2===0).map(b=>{const i=b.a-lo;return `<text class="axis-tick" x="${pl+i*bw+bw/2}" y="${H-6}" text-anchor="middle">${b.a}</text>`;}).join('');
  el.className='body chart'; el.innerHTML=`<svg viewBox="0 0 ${W} ${H}">${grid}${bars}${ticks}</svg>`; tipAll(el);
}
function renderCovByCity(el,f){
  const cities=Object.entries(countBy(f,'city')).sort((a,b)=>b[1]-a[1]).slice(0,18).map(x=>x[0]);   // show every governorate present (was 7 → silently hid the rest)
  const order=[['مكفول','var(--good)'],['قيد الدراسة','var(--b300)'],['غير مكفول','var(--warning)'],['منتهية','var(--critical)']];
  el.innerHTML=`<div class="hbars">${cities.map(ct=>{
    const rows=f.filter(d=>d.city===ct), tot=rows.length||1;
    const segs=order.map(([k,col])=>({col,p:rows.filter(d=>d.spStatus===k).length/tot*100,n:rows.filter(d=>d.spStatus===k).length,k}));
    return `<div class="hbar"><span class="lab">${ct}</span><span class="track" style="display:flex">${segs.map(s=>`<span style="width:${s.p}%;height:100%;background:${s.col}" data-tip="${ct} · ${s.k}: ${s.n}"></span>`).join('')}</span><span class="val tnum">${pct(rows.filter(d=>d.spStatus==='مكفول').length,tot)}%</span></div>`;
  }).join('')}</div><div class="cover-legend">${order.map(([k,col])=>`<span class="leg"><span class="sw" style="background:${col}"></span>${k}</span>`).join('')}</div>`;
  tipAll(el);
}
function renderVisits(el,f){
  const mo={}; VISITS.forEach(v=>{const d=String(v.date||'');if(d.length>=7)mo[d.slice(0,7)]=(mo[d.slice(0,7)]||0)+1;});
  const keys=Object.keys(mo).sort(); if(!keys.length){el.innerHTML='<div style="color:var(--muted);font-size:12px">لا زيارات</div>';return;}
  const pts=keys.map(k=>({k,n:mo[k]})),W=580,H=190,pl=48,pt=14,pb=26,gx1=W-16,ih=H-pt-pb;
  const xStart=pl+14, iw=gx1-xStart;   // inset the plot so the first point/area sits clear of the axis labels
  const rawMax=Math.max(1,...pts.map(p=>p.n)), niceMax=Math.max(4,Math.ceil(rawMax/4)*4);
  const x=i=>xStart+(pts.length===1?iw/2:i/(pts.length-1)*iw),y=n=>pt+ih-(n/niceMax)*ih;
  // gentle y-axis: gridlines + count labels in a clear left gutter
  let grid=''; for(let i=0;i<=4;i++){ const val=Math.round(niceMax*i/4), yy=y(val);
    grid+=`<line x1="${pl}" x2="${gx1}" y1="${yy}" y2="${yy}" style="stroke:var(--grid);stroke-width:1"></line><text class="axis-tick" x="${pl-11}" y="${yy+3.5}" text-anchor="end">${val}</text>`; }
  const line=pts.map((p,i)=>`${i?'L':'M'}${x(i)},${y(p.n)}`).join(' ');
  const area=`M${x(0)},${pt+ih} `+pts.map((p,i)=>`L${x(i)},${y(p.n)}`).join(' ')+` L${x(pts.length-1)},${pt+ih} Z`;
  const dots=pts.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p.n)}" r="3.2" style="fill:var(--b500)" data-tip="${p.k}: ${p.n}"></circle>`).join('');
  const step=Math.ceil(pts.length/7), labs=pts.map((p,i)=>(i%step===0||i===pts.length-1)?`<text class="axis-tick" x="${x(i)}" y="${H-7}" text-anchor="middle">${p.k.slice(2)}</text>`:'').join('');
  el.className='body chart'; el.innerHTML=`<svg viewBox="0 0 ${W} ${H}">${grid}<path d="${area}" style="fill:var(--b100);opacity:.38"></path><path d="${line}" style="fill:none;stroke:var(--b500);stroke-width:2" stroke-linejoin="round" stroke-linecap="round"></path>${dots}${labs}</svg>`;
  tipAll(el);
}
function renderOutcomes(el,f){
  const ids=new Set(f.map(d=>d.id)), rel=VISITS.filter(v=>ids.has(v.oid)), c=countBy(rel,'result');
  hbars(el,[['مستقرة','var(--good)'],['تحتاج متابعة','var(--warning)'],['طارئة','var(--critical)'],['بيانات غير مكتملة','var(--muted)']].map(([k,col])=>({lab:k,val:c[k]||0,col})));
}

/* ============================ TABLE (present columns) ============================ */
let PAGE_SIZE=25;
const escA=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
function renderTable(f){
  const all=[['name','اسم اليتيم'],['id','الرقم'],['city','المحافظة'],['age','العمر'],['priority','الأولوية'],['vuln','الهشاشة'],['spStatus','الكفالة'],['guardian','المعيل'],['dataStatus','البيانات']];
  const cols=all.filter(c=>c[0]==='name'||c[0]==='id'||AVAIL.has(c[0]));
  const {k,dir}=state.sort;
  const base = state.tq ? f.filter(d=>{const t=state.tq.toLowerCase();return String(d.name||'').toLowerCase().includes(t)||String(d.id||'').toLowerCase().includes(t);}) : f;   // table-only search
  const sorted=base.slice().sort((a,b)=>{let x=a[k],y=b[k];if(typeof x==='number')return((x||0)-(y||0))*dir;return String(x||'').localeCompare(String(y||''),'ar')*dir;});
  const total=sorted.length, pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  state.page=Math.min(Math.max(0,state.page),pages-1);
  const start=state.page*PAGE_SIZE, rows=sorted.slice(start,start+PAGE_SIZE);
  const pri={'حرجة':'crit','عالية':'warn'}, sp={'مكفول':'good','غير مكفول':'warn','منتهية':'crit'};
  $('#tbl-count').textContent=`${fmt(total)} حالة`;
  $('#c-table').innerHTML=`<table><thead><tr>${cols.map(c=>`<th data-k="${c[0]}">${c[1]}${k===c[0]?(dir>0?' ▲':' ▼'):''}</th>`).join('')}<th>إجراءات</th></tr></thead><tbody>${rows.map(d=>`<tr>${cols.map(c=>{
    const v=d[c[0]];
    if(c[0]==='priority'&&v) return `<td><span class="pill k-tag ${pri[v]||''}" style="${pri[v]?'':'background:var(--plane);color:var(--ink2)'}">${v}</span></td>`;
    if(c[0]==='spStatus'&&v) return `<td><span class="pill k-tag ${sp[v]||''}" style="${sp[v]?'':'background:var(--plane);color:var(--ink2)'}">${v}</span></td>`;
    return `<td class="${typeof v==='number'?'tnum':''}">${v==null?'':v}</td>`;
  }).join('')}<td class="act"><button class="iconbtn edit" data-ed="${escA(d.id)}">تعديل</button><button class="iconbtn del" data-del="${escA(d.id)}">حذف</button></td></tr>`).join('')}</tbody></table>`;
  $$('#c-table th[data-k]').forEach(th=>th.addEventListener('click',()=>{const key=th.dataset.k;state.sort=key===state.sort.k?{k:key,dir:-state.sort.dir}:{k:key,dir:1};state.page=0;renderTable(getFiltered());}));
  $$('#c-table [data-ed]').forEach(b=>b.addEventListener('click',()=>openEditor(b.dataset.ed)));
  $$('#c-table [data-del]').forEach(b=>b.addEventListener('click',()=>deleteCase(b.dataset.del)));
  const s=total?start+1:0, e=Math.min(total,start+PAGE_SIZE);
  $('#tbl-foot').innerHTML=`<button id="pg-prev" ${state.page<=0?'disabled':''}>السابق</button>`+
    `<span class="info">${fmt(s)}–${fmt(e)} من ${fmt(total)}</span>`+
    `<button id="pg-next" ${state.page>=pages-1?'disabled':''}>التالي</button>`+
    `<span class="info">صفحة ${state.page+1} من ${pages}</span>`+
    `<select id="pg-size">${[10,25,50,100].map(n=>`<option value="${n}" ${n===PAGE_SIZE?'selected':''}>${n} لكل صفحة</option>`).join('')}</select>`;
  $('#pg-prev').onclick=()=>{state.page--;renderTable(getFiltered());};
  $('#pg-next').onclick=()=>{state.page++;renderTable(getFiltered());};
  $('#pg-size').onchange=ev=>{PAGE_SIZE=+ev.target.value;state.page=0;renderTable(getFiltered());};
}

/* ============================ GOVERNANCE (gated) ============================ */
function renderGov(f){
  const g=[];
  if(has('dataStatus')){ g.push({v:pct(f.filter(d=>d.dataStatus==='مكتملة').length,f.length)+'%',l:'اكتمال البيانات'});
    g.push({v:fmt(f.filter(d=>d.dataStatus==='تحتاج تحديث'||d.dataStatus==='ناقصة').length),l:'سجلات بحاجة تحديث'}); }
  if(has('famId')) g.push({v:fmt(new Set(f.map(d=>d.famId).filter(Boolean)).size),l:'عدد الأسر'});
  if(has('spAmount')){
    if(has('spStatus')){
      const paid=f.filter(d=>d.spStatus==='مكفول');
      const actual=paid.reduce((s,d)=>s+(typeof d.spAmount==='number'?d.spAmount:0),0);
      const nPaid=paid.filter(d=>typeof d.spAmount==='number').length;
      const avg=nPaid?Math.round(actual/nPaid):0;
      const need=f.filter(d=>d.spStatus==='غير مكفول'||d.spStatus==='منتهية').length;   // same set as "بحاجة كفالة"
      g.push({v:fmt(actual)+' د.ع',l:'المصروف الشهري الفعلي (المكفولون)'});
      if(avg) g.push({v:fmt(avg)+' د.ع',l:'متوسط الكفالة للحالة'});
      if(avg&&need) g.push({v:fmt(avg*need)+' د.ع',l:'تكلفة تغطية الفجوة (تقديري)'});
    } else {
      g.push({v:fmt(f.reduce((s,d)=>s+(typeof d.spAmount==='number'?d.spAmount:0),0))+' د.ع',l:'إجمالي المبالغ المسجّلة'});
    }
  }
  $('#gov').innerHTML=g.map(x=>`<div class="g"><div class="v tnum">${x.v}</div><div class="l">${x.l}</div></div>`).join('');
}

/* ============================ render all ============================ */
function renderAll(){ const f=getFiltered(); renderKPIs(f); renderCharts(f); renderTable(f); renderGov(f); }

/* ============================ editing: add / edit / delete ============================ */
let autoSave=false, dirty=false, editId=null, ORIGINAL_DATA=[], ORIGINAL_VISITS=[];
const MANDATORY=['id','first'];                                                   // must be filled — blocks save
const RECOMMEND=['gender','dob','city','vuln','priority','spStatus','income','housing','dataStatus'];  // warn (drive the graphs)
function validDate(s){ const p=String(s).split(/[-/]/), pd=parseD(s); return !!(pd&&!isNaN(pd.getTime())&&p.length>=3&&+p[1]>=1&&+p[1]<=12&&+p[2]>=1&&+p[2]<=31); }
function setDirty(v){ dirty=v; const el=$('#dirty-ind'); if(el) el.style.display=v?'inline-flex':'none'; }
async function persistChange(msg){
  if(autoSave && fileHandle){ const ok=await saveToExcel(true); if(ok){ setDirty(false); toast('✓ '+msg+' — حُفظ في الملف'); return; } setDirty(true); return; }   // save failed → keep dirty, saveToExcel already warned
  setDirty(true); toast(msg);
}
function fieldInput(k, cur){
  const meta=FIELD_META[k]||{t:'text'}, hdr=KEY2HDR[k]||k, id='ef_'+k, v=(cur==null?'':cur);
  const star=MANDATORY.includes(k)?'<span class="req">*</span>':'';
  let inner;
  if(k==='age' && AVAIL.has('dob')) inner=`<input id="${id}" disabled value="${escA(v)}" placeholder="يُحسب تلقائيًا من الميلاد">`;
  else if(k==='city') inner=`<select id="${id}"></select>`;  // populated from the chosen nationality (dependent list)
  else if(meta.t==='choice'||meta.t==='soft') inner=`<select id="${id}"><option value="">—</option>${meta.opts.map(o=>`<option ${o==v?'selected':''}>${o}</option>`).join('')}</select>`;  // same lists as the mould, dropdown-only
  else if(meta.t==='num') inner=`<input id="${id}" type="text" inputmode="decimal" autocomplete="off" value="${escA(v)}">`;   // text (not number) so letters are captured & flagged, not silently dropped
  else if(meta.t==='date') inner=`<input id="${id}" type="date" value="${escA(v)}">`;
  else inner=`<input id="${id}" value="${escA(v)}">`;
  return `<div class="fld" data-fk="${k}"><label>${hdr}${star}</label>${inner}<span class="err"></span></div>`;
}
function openEditor(id){
  editId=id||null;
  const rec=id?(DATA.find(d=>d.id===id)||{}):{};
  $('#m-title').textContent=id?('تعديل حالة — '+(rec.name||id)):'إضافة حالة جديدة';
  let html='';
  PACKAGES.forEach(p=>{ if(p.id==='visits') return;
    const present=p.fields.filter(k=>AVAIL.has(k)&&k!=='name');
    if(!present.length) return;
    html+=`<div class="fsec"><div class="t">${p.label}</div><div class="fgrid">${present.map(k=>fieldInput(k,rec[k])).join('')}</div></div>`;
  });
  $('#m-body').innerHTML=html; $('#m-err').textContent=''; $('#m-warn').style.display='none';
  if(id){ const idInp=document.getElementById('ef_id'); if(idInp) idInp.disabled=true; }
  const dob=document.getElementById('ef_dob'), age=document.getElementById('ef_age');
  if(dob&&age) dob.addEventListener('input',()=>{ const a=ageFromDob(dob.value); age.value=a==null?'':a; });
  // dependent city dropdown: cities follow the chosen nationality
  const natSel=document.getElementById('ef_nat');
  if(document.getElementById('ef_city')) populateCity(rec.nat, rec.city);
  if(natSel) natSel.addEventListener('change',()=>populateCity(natSel.value, document.getElementById('ef_city')?.value));
  $('#modal').classList.add('on');
}
function populateCity(natVal, cityVal){
  const sel=document.getElementById('ef_city'); if(!sel) return;
  const cities=(natVal && NAT_CITIES[natVal]) ? NAT_CITIES[natVal] : ALL_CITIES;
  sel.innerHTML=`<option value="">—</option>`+cities.map(c=>`<option ${c===cityVal?'selected':''}>${escA(c)}</option>`).join('');
}
function closeModal(){ $('#modal').classList.remove('on'); editId=null; }
function collectEditor(){   // returns {rec, firstBad} after hard validation (types + mandatory + id unique)
  const rec=editId?{...DATA.find(d=>d.id===editId)}:{};
  let firstBad=null;
  $$('#m-body .fld').forEach(f=>{f.classList.remove('bad');f.querySelector('.err').textContent='';});
  const bad=(k,msg)=>{ const f=document.querySelector(`#m-body .fld[data-fk="${k}"]`); if(f){f.classList.add('bad');f.querySelector('.err').textContent=msg;} if(!firstBad)firstBad=k; };
  $$('#m-body [data-fk]').forEach(f=>{
    const k=f.dataset.fk, inp=f.querySelector('input,select'); if(!inp) return;
    if(k==='age'&&AVAIL.has('dob')) return;               // derived from dob
    const meta=FIELD_META[k]||{t:'text'}, v=String(inp.value).trim();
    if(v===''){ if(MANDATORY.includes(k)) bad(k,'حقل إلزامي'); rec[k]=(meta.t==='num')?null:''; return; }
    if(meta.t==='num'){ const n=Number(v); if(isNaN(n))return bad(k,'أرقام فقط — لا يقبل حروفًا'); if((meta.min!=null&&n<meta.min)||(meta.max!=null&&n>meta.max))return bad(k,`القيمة بين ${meta.min} و ${meta.max}`); rec[k]=n; }
    else if(meta.t==='choice'||meta.t==='soft'){ if(!meta.opts.includes(v))return bad(k,'اختر من القائمة'); rec[k]=v; }
    else if(meta.t==='date'){ if(!validDate(v))return bad(k,'تاريخ غير صالح (سنة-شهر-يوم)'); rec[k]=v; }
    else if(meta.t==='name'){ if(pureNum(v))return bad(k,'اسم — لا يقبل رقمًا فقط'); rec[k]=v; }
    else rec[k]=v;
  });
  if(!editId && String(rec.id||'').trim() && DATA.some(d=>d.id===String(rec.id).trim())) bad('id','هذا الرقم مستخدم مسبقًا');
  // logical age: a birthdate must yield an orphan-plausible age (0..max)
  if(AVAIL.has('dob') && rec.dob){ const a=ageFromDob(rec.dob), mx=(FIELD_META.age&&FIELD_META.age.max)||30;
    if(a==null) bad('dob','تاريخ ميلاد غير صالح');
    else if(a<0||a>mx) bad('dob',`تاريخ غير منطقي — العمر الناتج (${a}) يجب أن يكون بين 0 و ${mx}`); }
  return {rec, firstBad};
}
function saveEditor(force){
  const {rec, firstBad}=collectEditor();
  const miss=RECOMMEND.filter(k=>document.querySelector(`#m-body .fld[data-fk="${k}"]`) && !String(rec[k]==null?'':rec[k]).trim());
  // both notices coexist (no overwrite): hard-error message + incomplete-fields banner
  $('#m-err').textContent = firstBad ? 'صحّح الحقول المميّزة بالأحمر أولًا' : '';
  if(miss.length && !force) showEditorWarn(miss, !!firstBad); else $('#m-warn').style.display='none';
  if(firstBad){ const el=document.querySelector(`#m-body .fld[data-fk="${firstBad}"] input,#m-body .fld[data-fk="${firstBad}"] select`); if(el)el.focus(); return; }
  if(miss.length && !force) return;   // no hard errors, but waiting on the user's choice in the banner
  rec.name=[rec.first,rec.father,rec.family].filter(Boolean).join(' ');
  if(editId){ const i=DATA.findIndex(d=>d.id===editId); DATA[i]={...DATA[i],...rec}; }
  else DATA.push(rec);
  derive(); closeModal(); renderAll(); rebuildSearchLists(); apiUpsert(rec);   // write-through to the Google Sheet
}
function showEditorWarn(miss, blocked){
  const names=miss.map(k=>KEY2HDR[k]||k);
  $('#m-warn').innerHTML=`<b>حقول لم تُدخَل بعد:</b> ${names.join('، ')}.
    <div class="sub">${blocked
      ? 'صحّح أولًا الحقول المميّزة بالأحمر أعلاه — بعدها يمكنك حفظ الحالة مع بقاء هذه الحقول ناقصة (لن تُحتسب في الرسوم حتى تُكمّلها).'
      : 'تستطيع حفظ الحالة الآن — لكن ستبقى ناقصة في هذه المؤشرات فلن تُحتسب ضمنها في الرسوم البيانية حتى تُكمِل بياناتها لاحقًا.'}</div>
    <div class="act"><button class="btn sm ghost" id="mw-back">الرجوع للإكمال</button>${blocked?'':'<button class="btn sm primary" id="mw-go">حفظ رغم النقص</button>'}</div>`;
  $('#m-warn').style.display='block';
  const back=$('#mw-back'); if(back) back.onclick=()=>{ $('#m-warn').style.display='none'; };
  const go=$('#mw-go'); if(go) go.onclick=()=>{ $('#m-warn').style.display='none'; saveEditor(true); };
}
function deleteCase(id){
  const rec=DATA.find(d=>d.id===id); if(!rec) return;
  if(!confirm(`حذف الحالة «${rec.name||id}» (${id})؟\nلا يمكن التراجع.`)) return;
  DATA=DATA.filter(d=>d.id!==id); derive(); renderAll(); rebuildSearchLists(); apiDelete(id);   // delete from the Google Sheet
}

/* ============================ toolbar ============================ */
/* sync button removed — the API is the live source (reads are fresh on sign-in, writes go straight through). */
$('#t-export').addEventListener('click', exportReport);
$('#t-theme').addEventListener('click', ()=>{ const r=document.documentElement; r.dataset.theme=r.dataset.theme==='dark'?'':'dark'; renderAll(); });
$('#t-add').addEventListener('click', ()=>openEditor(null));
$('#m-x').addEventListener('click', closeModal);
$('#m-cancel').addEventListener('click', closeModal);
$('#m-save').addEventListener('click', ()=>saveEditor());
$('#modal').addEventListener('click', e=>{ if(e.target.id==='modal') closeModal(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && $('#modal').classList.contains('on')) closeModal(); });
/* autosave toggle + page-nav (home/back) removed — no local file, and sign-in/logout replace the gate round-trip. */
/* table search → filter the table to the chosen orphan (user edits/deletes from its row); typing filters live */
{ const _ts=$('#tbl-search');
  acAttach(_ts, ()=>DATA.map(d=>({label:(d.name||'—')+' — '+d.id, name:d.name||d.id})), it=>{ _ts.value=it.name; state.tq=it.name; state.page=0; renderTable(getFiltered()); });
  _ts.addEventListener('input', ()=>{ state.tq=_ts.value.trim(); state.page=0; renderTable(getFiltered()); }); }
/* clear dashboard data (never touches the file): revert edits OR empty everything */
function resetView(){   // clear all search + filters → show every case again (does NOT touch data)
  Object.assign(state,{q:'',tq:'',city:'',priority:'',sp:'',gender:'',page:0});
  const ts=$('#tbl-search'); if(ts) ts.value='';
  buildFilters(); renderAll(); toast('عُرضت كل الحالات');
}
/* clear-board modal removed — the source of truth is the live Sheet, not a local view to empty. */

/* ============================================================================
 * DATA LAYER — Supabase AUTH + Postgres, RLS-enforced   [SQL version · option b]
 *   • REAL login: email + password via supabase-js signInWithPassword — inside OUR
 *     gate (no redirect). Auth issues a signed token used on every request.
 *   • The DATABASE enforces access (RLS keyed on the logged-in identity + `users`):
 *     signed-in & listed → read;  role editor/admin → write.  No public free-for-all.
 *   • Session persists + auto-refreshes (supabase-js). Client role UI = convenience;
 *     the real guard is RLS, so a raw request without a valid token is refused.
 * ========================================================================== */
const SUPA_URL='https://owkjpndzwwgrbkfeonzk.supabase.co';
const SUPA_KEY='sb_publishable_pnrw9NPTw2iLo1ts6WEb4g_a6cf8KQZ';
/* storage that can NEVER throw — mobile browsers block localStorage on file:// (and in
 * private mode); without this, supabase-js init throws and the whole script dies silently. */
const _memStore={};
const safeStorage={
  getItem:k=>{ try{ return localStorage.getItem(k); }catch(_){ return (k in _memStore)?_memStore[k]:null; } },
  setItem:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(_){ _memStore[k]=v; } },
  removeItem:k=>{ try{ localStorage.removeItem(k); }catch(_){ delete _memStore[k]; } }
};
const sb = window.supabase.createClient(SUPA_URL, SUPA_KEY, { auth:{ persistSession:true, autoRefreshToken:true, storageKey:'daleel_sql_auth', storage:safeStorage } });
let MY_EMAIL='', MY_ROLE=null, DATA_SRC='db';
const CASE_KEYS=new Set(CASE_COLS.map(c=>c[1]));   // only real columns go to the DB (strip derived 'name')
function pickCols(rec){ const o={}; Object.keys(rec).forEach(k=>{ if(CASE_KEYS.has(k)) o[k]=(rec[k]===''?null:rec[k]); }); return o; }
function normRole(r){ return String(r||'').trim().toLowerCase() || 'viewer'; }   // tolerate 'Admin','admin ','admin\n', empty→viewer
const permErr=e=>/(row-level|permission|denied|policy|not authorized|401|403)/i.test((e&&e.message)||String(e));

function ingest(cases,visits){
  DATA=(cases||[]).map(d=>({...d})); VISITS=(visits||[]).map(v=>({...v})); HAS_VISITS=VISITS.length>0;
  AVAIL=new Set(CASE_COLS.map(c=>c[1])); if(HAS_VISITS) AVAIL.add('__visits__');
  derive(); startApp();
}
/* after Auth succeeds: read my role (RLS lets me see my own users row), load data, open dashboard */
async function loadAfterAuth(email){
  MY_EMAIL=email;
  const { data:urow, error:uerr } = await sb.from('users').select('role').ilike('email', email).maybeSingle();
  if(uerr) throw uerr;
  if(!urow){ gateErr('⛔ حسابك مُسجَّل للدخول لكن بلا صلاحية بعد. تواصل مع مسؤول النظام لإضافة دورك.'); await sb.auth.signOut(); return false; }
  MY_ROLE=normRole(urow.role);
  const [cy, vy] = await Promise.all([ sb.from('orphans').select('*'), sb.from('visits').select('*') ]);
  if(cy.error) throw cy.error; if(vy.error) throw vy.error;
  ingest(cy.data, vy.data);
  return true;
}
async function signIn(email, pass){
  gateErr(''); email=String(email||'').trim(); pass=String(pass||'');
  if(!email||!pass){ gateErr('أدخل البريد الإلكتروني وكلمة المرور.'); return; }
  const btn=$('#g-signin'); btn.disabled=true; btn.textContent='جارٍ الدخول…';
  try{
    const { error } = await sb.auth.signInWithPassword({ email, password:pass });   // real Auth — verified by Supabase
    if(error){ gateErr(/invalid|credential/i.test(error.message)?'⛔ بريد إلكتروني أو كلمة مرور غير صحيحة.':('تعذّر الدخول: '+error.message)); return; }
    await loadAfterAuth(email);
  }catch(e){ gateErr('تعذّر الاتصال: '+((e&&e.message)||e)); }
  finally{ btn.disabled=false; btn.textContent='تسجيل الدخول ›'; }
}
async function apiUpsert(rec){    // engine's saveEditor → RLS allows only editor/admin
  try{ const { error } = await sb.from('orphans').upsert(pickCols(rec)); if(error) throw error;
    toast('✓ حُفظ في قاعدة البيانات (Supabase)');
  }catch(e){ toast('⚠ لم يُحفظ: '+(permErr(e)?'صلاحيتك للعرض فقط — رفَضته قاعدة البيانات':'تحقّق من الاتصال')); }
}
async function apiDelete(id){     // engine's deleteCase → RLS allows only editor/admin
  try{ const { error } = await sb.from('orphans').delete().eq('id', id); if(error) throw error;
    toast('✓ حُذفت من قاعدة البيانات (Supabase)');
  }catch(e){ toast('⚠ لم يُحذف: '+(permErr(e)?'صلاحيتك للعرض فقط — رفَضته قاعدة البيانات':'تحقّق من الاتصال')); }
}
/* pull the latest from the DB (also re-reads my role) — no reload, keeps filters */
async function refreshFromDb(){
  const btn=$('#t-refresh'); if(btn){ btn.disabled=true; btn.textContent='… تحديث'; }
  try{
    const { data:urow } = await sb.from('users').select('role').ilike('email', MY_EMAIL).maybeSingle();
    if(urow) MY_ROLE=normRole(urow.role);
    const [cy,vy]=await Promise.all([ sb.from('orphans').select('*'), sb.from('visits').select('*') ]);
    if(cy.error) throw cy.error; if(vy.error) throw vy.error;
    DATA=cy.data.map(d=>({...d})); VISITS=vy.data.map(v=>({...v})); HAS_VISITS=VISITS.length>0;
    AVAIL=new Set(CASE_COLS.map(c=>c[1])); if(HAS_VISITS) AVAIL.add('__visits__');
    derive(); applyRoleUI(); renderAll();
    toast('✓ حُدّثت البيانات من قاعدة البيانات');
  }catch(e){ toast('⚠ تعذّر الاتصال بقاعدة البيانات'); }
  finally{ if(btn){ btn.disabled=false; btn.textContent='⟳ تحديث'; } }
}
function canEdit(){ return MY_ROLE==='admin'||MY_ROLE==='editor'; }
function applyRoleUI(){
  const labels={admin:'مدير النظام',editor:'محرّر',viewer:'مشاهد (عرض فقط)'};
  const rb=$('#role-badge'); if(rb){ rb.textContent=labels[MY_ROLE]||'—'; rb.classList.toggle('viewer',!canEdit()); }
  document.body.classList.toggle('role-viewer', !canEdit());   // CSS hides add/edit/delete + blurs names for viewers
  const st=$('#src-txt'), sd=$('#src-dot');
  if(st) st.textContent='قاعدة البيانات (Supabase)';
  if(sd) sd.className='dot';
}
function applyBrand(){
  const L='assets/logo.png'; BRANDING.name='مركز الدليل';
  const set=(id,fn)=>{ const el=document.getElementById(id); if(el) fn(el); };
  set('b-name',e=>e.textContent='مركز الدليل');
  set('b-logo',e=>e.innerHTML='<img src="'+L+'" alt="مركز الدليل">');
  set('dl-hero-img',e=>e.src=L); set('dl-foot-logo',e=>e.src=L); set('dl-wm-logo',e=>e.src=L);
  const role=document.querySelector('.topbar .brand .role'); if(role) role.textContent='تحليل ودعم القرار';
  set('dl-date',e=>{ try{ e.textContent=new Date().toLocaleDateString('ar',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); }catch(_){}} );
}

/* gate hero logo + sign-in wiring (this script runs at end of body → elements exist) */
(function(){ const h=document.getElementById('dl-hero-img'); if(h) h.src='assets/logo.png'; })();
async function doSignIn(){ await signIn($('#g-email').value, $('#g-pass').value); }
$('#g-signin').addEventListener('click', doSignIn);
$('#g-email').addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); $('#g-pass').focus(); } });
$('#g-pass').addEventListener('keydown', e=>{ if(e.key==='Enter') doSignIn(); });
$('#t-logout').addEventListener('click', async ()=>{ try{ await sb.auth.signOut(); }catch(_){} location.reload(); });
$('#t-refresh').addEventListener('click', refreshFromDb);
/* auto-resume: supabase-js persists the session → if still valid, skip the login screen */
(async()=>{ try{ const { data:{ session } }=await sb.auth.getSession(); if(session && session.user && session.user.email){ await loadAfterAuth(session.user.email); } }catch(_){} })();
