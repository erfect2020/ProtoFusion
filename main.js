/* Evidence from the current manuscript. All interactions run locally. */
(() => {
  'use strict';
  const D = window.PROTO_DATA;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const metrics = ['IAA', 'IQA', 'ISTA', 'Overall'];
  const budget = D.budget;
  const componentDescriptions = {
    'Human Prompt':'A manually crafted prompt provides the reference setting before a structured protocol is introduced.',
    'Initial Protocol':'The initial structured protocol, before offline refinement.',
    'Principles Only':'Grounding principles alone, without the complementary environment state cards and style profile.',
    'w/o State Cards':'Removing environment state cards weakens source-conditioned guidance. The complete protocol adapts to source conditions and modality reliability.',
    'w/o Style Profile':'Removing the style profile weakens explicit control over the intended visible-light appearance.',
    'Full PGPR':'All three protocol slots, refined offline with T = 6. The optimized protocol stays fixed during inference; model weights remain frozen.',
  };
  const components = D.components;
  const errorRates = D.errorRates;
  const errorMethods = ['Human Prompt','PGPR','PGPR + SBC'];
  const excerpts = [
    ['… Increase luminance/contrast of pedestrian regions for saliency while preserving visible realism. …',
     '… Enhance luminance and contrast of <mark>pedestrian shapes from IR</mark> while preserving their VIS geometry …',
     '… prioritize IR for defining sharp, crisp boundaries of the pedestrians. <mark>Inject IR saliency into luminance and contrast.</mark>'],
    ['… <mark>Overlay thermal saliency from the IR image to highlight pedestrians</mark> and vehicles as bright, crisp shapes …',
     '… Night urban street scene with <mark>rain</mark> …',
     'View Mode: enhanced reality. Preserve IR target shapes and boundaries; <mark>avoid turning targets into blobs</mark> …'],
  ];
  const protocolSlots = [
    {label:'Environment state cards',code:'E',title:'Read the conditions before composing the prompt.',description:'Image-specific variables describe illumination, source quality, target types and reliability. Lighting is judged from the visible image.',excerpt:'Lighting_Condition: Day / Dusk / Evening / Night / Artificial_Light\nVis_Quality: High_Fidelity / Overexposed / Low_Light_Noise\nIR_Targets: None / Pedestrians / Vehicles / Machinery\nInformation_Dominance: Balanced / Vis_Lead / IR_Lead\nVis_Edge_Reliability: Reliable / Unreliable\nChroma_Bleed_Risk: Low / High\nAlignment_Risk: Low / High'},
    {label:'Grounding principles',code:'P',title:'Specify how complementary evidence should be used.',description:'The initial principles address night robustness, thermal saliency, texture preservation and boundary alignment.',excerpt:'Principle B — Thermal Saliency with Color Discipline\n\nIf IR targets exist:\nMake IR targets easier to spot by increasing luminance/contrast of the target regions (saliency), while keeping Vis realism.\n\nIf Chroma_Bleed_Risk is High: lock chroma to Vis; inject IR only into luminance/contrast (avoid colored thermal halos).'},
    {label:'Style profile',code:'S',title:'Keep the intended appearance explicit.',description:'Appearance guidance is a separate protocol slot. The style profile remains fixed during the structured refinement edits.',excerpt:'View Mode: Realistic Night Vision / Enhanced Reality\nColor Palette: Natural Vis colors\nClarity: 4K Resolution, Sharp Edges'},
  ];

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function animateBars(root,selector,axis){
    if(reducedMotion.matches)return;
    $$(selector,root).forEach((bar,i)=>bar.animate([{transform:`scale${axis}(0)`},{transform:`scale${axis}(1)`}],{duration:550,delay:i*18,easing:'cubic-bezier(.2,.75,.2,1)',fill:'backwards'}));
  }
  function image(src, alt, eager = false) {
    const img = el('img');
    img.src = src; img.alt = alt; img.loading = eager ? 'eager' : 'lazy'; img.decoding = 'async';
    const size = D.sizes?.[src];
    if (size) { img.width = size[0]; img.height = size[1]; }
    return img;
  }
  function segments(target, options, initial, label, change) {
    const root = typeof target === 'string' ? $(target) : target;
    const group = el('div','seg'); group.setAttribute('role','group'); group.setAttribute('aria-label',label);
    const buttons = options.map(option => {
      const value = typeof option === 'string' ? option : option.value;
      const text = typeof option === 'string' ? option : option.label;
      const btn = el('button','',text); btn.type = 'button'; btn.dataset.value = value;
      btn.setAttribute('aria-pressed',String(value === initial));
      btn.addEventListener('click',() => { set(value); change(value); }); group.append(btn); return btn;
    });
    group.addEventListener('keydown',event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      const at = buttons.indexOf(document.activeElement); if (at < 0) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length-1 : (at + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus(); buttons[next].click();
    });
    root.replaceChildren(group);
    function set(value) { buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value === String(value)))); }
    return {set,group};
  }
  function caseStrip(target, cases, thumbnail, change) {
    const root = $(target); root.setAttribute('role','group'); root.setAttribute('aria-label','Choose an example');
    cases.forEach((item,i)=>{
      const button = el('button','case-button'); button.setAttribute('aria-pressed',String(i===0));
      button.setAttribute('aria-label',item.name);
      button.append(image(thumbnail(item),''),el('span','',item.name));
      button.addEventListener('click',()=>{ $$('button',root).forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j))); change(i); });
      root.append(button);
    });
  }
  let zoomTrigger;
  const dialog = $('#image-dialog');
  function zoom(src,label,trigger) {
    zoomTrigger=trigger; $('#dialog-title').textContent=label; $('#dialog-image').src=src; $('#dialog-image').alt=label; dialog.showModal();
  }
  $('#close-dialog').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog) { const r=dialog.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) dialog.close(); }});
  dialog.addEventListener('close',()=>zoomTrigger?.focus());
  function panel(src,label,detail='') {
    const figure=el('figure','image-panel'); const stage=el('div','image-stage'); const img=image(src,label);
    const button=el('button','zoom-button','↗'); button.setAttribute('aria-label','Enlarge '+label); button.addEventListener('click',()=>zoom(src,label,button));
    stage.append(img,button); const caption=el('figcaption'); caption.append(el('b','',label),el('span','',detail)); figure.append(stage,caption); return figure;
  }
  function compare(a,b,labelA,labelB) {
    const root=el('div','comparison-widget');
    const sizeA=D.sizes?.[a],sizeB=D.sizes?.[b];
    const ratioA=sizeA?sizeA[0]/sizeA[1]:4/3,ratioB=sizeB?sizeB[0]/sizeB[1]:4/3;
    const side=el('div','side-by-side'); side.append(panel(a,labelA),panel(b,labelB));
    root.append(side);
    if(Math.abs(ratioA/ratioB-1)>0.005) {
      root.append(el('p','compare-note','Full images · original proportions preserved.')); return root;
    }
    const overlayView=el('div','overlay-view');overlayView.hidden=true;
    const legend=el('div','compare-legend'); legend.append(el('span','',labelA),el('strong','',labelB));
    const frame=el('div','compare'); frame.style.aspectRatio=String(ratioB);
    const back=image(b,labelB); const overlay=el('div','compare-overlay'); overlay.append(image(a,labelA));
    const line=el('div','compare-line');
    const range=el('input'); range.type='range'; range.min='0';range.max='100';range.value='50';range.step='1'; range.setAttribute('aria-label',`Reveal ${labelA} versus ${labelB}`);
    range.setAttribute('aria-valuetext',`50% ${labelA}, 50% ${labelB}`);
    range.addEventListener('input',()=>{ const n=Number(range.value); overlay.style.clipPath=`inset(0 ${100-n}% 0 0)`;line.style.left=n+'%';range.setAttribute('aria-valuetext',`${n}% ${labelA}, ${100-n}% ${labelB}`); });
    frame.append(back,overlay,line,range);
    overlayView.append(legend,frame);
    const note=el('div','compare-note'),hint=el('span','','Both results shown in full');
    const toggle=el('button','text-button','Use overlay slider ↔');toggle.setAttribute('aria-pressed','false');
    toggle.addEventListener('click',()=>{
      const useOverlay=overlayView.hidden;overlayView.hidden=!useOverlay;side.hidden=useOverlay;
      toggle.setAttribute('aria-pressed',String(useOverlay));toggle.textContent=useOverlay?'Show both full images ↗':'Use overlay slider ↔';
      hint.textContent=useOverlay?'Drag or use arrow keys to compare':'Both results shown in full';
    });
    note.append(hint,toggle);root.append(overlayView,note);return root;
  }

  function triptych(scene,eager=false){
    const root=el('div','fusion-triptych');
    [['VIS','Visible','Color & texture','vis'],['IR','Infrared','Thermal evidence','ir'],['ProtoFusion','Fusion','ProtoFusion','fusion']].forEach(([key,label,detail,kind])=>{
      const figure=panel(scene.images[key],label,detail);figure.classList.add('fusion-panel','modality-'+kind);
      const img=$('img',figure);img.alt=`${scene.name} · ${label}`;img.loading=eager?'eager':'lazy';root.append(figure);
    });return root;
  }
  function initHero() {
    const root=$('#hero-triptych'),choices=$('#hero-scenes');let selected=0,requested=0,requestId=0;
    D.hero.forEach((scene,i)=>{
      const button=el('button','hero-scene-choice');button.setAttribute('aria-label',`Show ${scene.name}`);
      button.append(image(scene.images.ProtoFusion,''),el('span','',scene.name));button.addEventListener('click',()=>show(i));choices.append(button);
    });
    function render(){
      const scene=D.hero[selected];root.replaceChildren(...triptych(scene,true).children);
      $('#hero-index').textContent=`${String(selected+1).padStart(2,'0')} / 06`;$('#hero-scene-title').textContent=scene.name;
      $$('button',choices).forEach((b,i)=>b.setAttribute('aria-pressed',String(i===selected)));
      if(choices.scrollWidth>choices.clientWidth){const active=choices.children[selected];choices.scrollTo({left:Math.max(0,active.offsetLeft-choices.offsetLeft-choices.clientWidth/2+active.offsetWidth/2),behavior:reducedMotion.matches?'instant':'smooth'});}
      $('#hero-status').textContent=`${scene.name} · VIS + IR → Fusion`;
      root.classList.remove('scene-arrive');requestAnimationFrame(()=>root.classList.add('scene-arrive'));
      window.dispatchEvent(new CustomEvent('proto:scenechange',{detail:{index:selected}}));
    }
    async function show(index){
      requested=(index+D.hero.length)%D.hero.length;const next=requested,token=++requestId;
      $('#hero-demo').setAttribute('aria-busy','true');$('#hero-status').textContent='Loading scene…';
      try{
        // Decode all three images before committing a new scene, so a fast click
        // cannot leave sources from one example beside the result of another.
        await Promise.all(Object.values(D.hero[next].images).map(src=>{const img=new Image();img.src=src;return img.decode();}));
        if(token!==requestId)return;selected=next;render();
      }catch{if(token===requestId)$('#hero-status').textContent='This scene could not load. Please choose another scene.';}
      finally{if(token===requestId)$('#hero-demo').setAttribute('aria-busy','false');}
    }
    $('#hero-prev').addEventListener('click',()=>show(requested-1));$('#hero-next').addEventListener('click',()=>show(requested+1));
    choices.addEventListener('keydown',event=>{
      const buttons=$$('button',choices),at=buttons.indexOf(document.activeElement);
      if(at<0||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?5:(at+(event.key==='ArrowRight'?1:-1)+6)%6;
      buttons[next].focus();show(next);
    });render();
  }

  function initResults() {
    let selected=0,baseline='CDDFuse',baselineOpen=false;const grid=$('#scene-grid');
    D.scenes.forEach((scene,i)=>{
      const btn=el('button','scene-choice');btn.setAttribute('aria-pressed',String(i===0)); btn.setAttribute('aria-label',`Compare scene ${i+1}: ${scene.name}`);
      const img=image(scene.images.ProtoFusion,''); const label=el('span'); label.append(el('b','',String(i+1).padStart(2,'0')),document.createTextNode(scene.name));btn.append(img,label);
      btn.addEventListener('click',()=>{selected=i;$$('button',grid).forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));render();if(window.innerWidth<720)$('#scene-detail').scrollIntoView({behavior:reducedMotion.matches?'instant':'smooth',block:'start'});});grid.append(btn);
    });
    function render(){
      const s=D.scenes[selected],root=$('#scene-detail');root.replaceChildren();
      const header=el('div','detail-header'); const title=el('div');title.append(el('h3','',`${String(selected+1).padStart(2,'0')} / ${s.name}`),el('p','',`${s.condition} · Figure ${s.figure}, row ${s.row}`));
      header.append(title);root.append(header,triptych(s),el('p','caption',s.annotation));
      const fold=el('details','fold baseline-fold');fold.open=baselineOpen;fold.append(el('summary','','Compare with other fusion methods'));
      fold.addEventListener('toggle',()=>{baselineOpen=fold.open;});
      const controls=el('div','control-row'),label=el('label','select-label','Method');const select=el('select');select.setAttribute('aria-label','Comparison method');
      ['VIS','CDDFuse','DDFM','Text-IF','C2RF','DCEvo','Deno-IF','LUT-Fuse'].forEach(method=>{const o=el('option','',method);o.value=method;o.selected=baseline===method;select.append(o);});
      label.append(select);controls.append(label);const comparison=el('div','baseline-comparison');comparison.append(compare(s.images[baseline],s.images.ProtoFusion,baseline,'ProtoFusion'));fold.append(controls,comparison);root.append(fold);
      select.addEventListener('change',()=>{baseline=select.value;comparison.replaceChildren(compare(s.images[baseline],s.images.ProtoFusion,baseline,'ProtoFusion'));});
      window.dispatchEvent(new CustomEvent('proto:comparisonchange',{detail:{root:'scene-detail'}}));
    }render();
  }

  function initInfrared(){
    let selected=0;
    caseStrip('#ir-cases',D.irCases,s=>s.images['IR+VIS'],i=>{selected=i;render();});
    function render(){
      const s=D.irCases[selected],root=$('#ir-detail');root.replaceChildren();
      const sources=el('div','ir-sources');
      sources.append(panel(s.images.VIS,'Visible','Fixed in all three settings'),panel(s.images['Shuffled IR'],'Shuffled infrared','An unrelated scene'),panel(s.images.IR,'Paired infrared','Same scene'));
      const outputs=el('div','fusion-triptych ir-results');
      outputs.append(panel(s.images['VIS-only'],'VIS only','No infrared input'),panel(s.images['Shuffled IR+VIS'],'Shuffled IR + VIS','Unrelated infrared input'),panel(s.images['IR+VIS'],'Paired IR + VIS','Original infrared input'));
      root.append(sources,outputs,el('p','evidence-hover-hint','Hover over the outputs for linked 2.5× detail'));
      const fold=el('details','fold evidence-details');fold.append(el('summary','','Inspect the original highlighted details'));
      const crops=el('div','crop-row ir-detail-crops');s.insets.forEach((src,i)=>crops.append(panel(src,['VIS-only detail','Paired IR + VIS detail'][i])));fold.append(crops);root.append(fold);
      window.dispatchEvent(new CustomEvent('proto:comparisonchange',{detail:{root:'ir-detail'}}));
    }render();
  }

  function initRefinement(){
    let selected=0;
    segments('#trajectory-cases',D.trajectories.map((t,i)=>({value:String(i),label:t.name})),'0','Refinement example',v=>{selected=Number(v);render();});
    function render(){
      const s=D.trajectories[selected],root=$('#trajectory-detail');root.replaceChildren();
      const inputs=el('div','trajectory-sources');inputs.append(panel(s.inputs[1],'Visible input'),panel(s.inputs[0],'Infrared input'),el('p','','The same image pair. Three displayed candidates and their corresponding prompt excerpts.'));
      const candidates=el('div','candidate-grid');s.candidates.forEach((src,i)=>{const item=el('article','candidate');const figure=panel(src,`Displayed candidate ${i+1}`);const excerpt=el('p','prompt-excerpt');excerpt.innerHTML=excerpts[selected][i];item.append(figure,excerpt);candidates.append(item);});root.append(inputs,candidates);window.dispatchEvent(new Event('proto:candidateschange'));
    }render();
    let metric='Overall';
    segments('#budget-metrics',metrics,metric,'Refinement budget metric',v=>{metric=v;renderBudget();});
    function renderBudget(){const i=metrics.indexOf(metric),root=$('#budget-chart'),best=Math.max(...budget.map(b=>b.values[i]));root.replaceChildren();root.setAttribute('aria-label',`Refinement budget: ${metric}`);budget.forEach(b=>{const col=el('div','budget-column');const bar=el('div','budget-bar'+(b.values[i]===best?' best':''));bar.style.height=(b.values[i]/60*100)+'%';bar.append(el('span','budget-value',b.values[i].toFixed(4)));col.append(bar,el('span','budget-label',b.label));root.append(col);});animateBars(root,'.budget-bar','Y');}renderBudget();
    components.forEach((c,i)=>{const button=el('button','',c.label);button.setAttribute('aria-pressed',String(i===5));button.addEventListener('click',()=>{ $$('#component-options button').forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));renderComponent(i);});$('#component-options').append(button);});
    function renderComponent(i){const c=components[i],root=$('#component-result'),values=el('div','metric-values');root.replaceChildren();c.values.forEach((v,j)=>{const metric=el('div');metric.append(el('span','',metrics[j]+' ↑'),el('strong','',v.toFixed(4)));values.append(metric);});root.append(values,el('p','',componentDescriptions[c.label]));}renderComponent(5);
    let promptMetric='Overall';
    segments('#prompt-metrics',metrics,promptMetric,'Prompt optimization metric',v=>{promptMetric=v;renderPrompt();});
    function renderPrompt(){const i=metrics.indexOf(promptMetric);$('#prompt-comparison').setAttribute('aria-label',`Prompt optimization: ${promptMetric}`);barChart($('#prompt-comparison'),D.promptComparison,i,60);}
    renderPrompt();
    $('#prompt-table').append(table(D.promptComparison,metrics.map(m=>m+' ↑'),'FMB · prompt optimization and SBC',4));
  }

  function initCorrection(){
    caseStrip('#sbc-cases',D.sbc,s=>s.images.SBC,render);
    function render(i){
      const s=D.sbc[i],root=$('#sbc-detail'),board=evidenceBoard(s.images.VIS,s.images.IR),results=compare(s.images.PGPR,s.images.SBC,'PGPR','PGPR + SBC');
      results.classList.add('evidence-results');
      $$('.side-by-side figcaption span',results).forEach((caption,j)=>{caption.textContent=j?'After source correction':'Before source correction';});
      board.append(results);root.replaceChildren(board,el('p','evidence-hover-hint','Hover to explore corresponding details · 2.5× linked zoom'));
      if(s.insets){const fold=el('details','fold evidence-details');fold.append(el('summary','','Inspect the annotated details'));const crops=el('div','crop-row');s.insets.forEach((src,j)=>crops.append(panel(src,['IR detail','VIS detail','PGPR detail','PGPR + SBC detail'][j])));fold.append(crops);root.append(fold);}
      window.dispatchEvent(new CustomEvent('proto:comparisonchange',{detail:{root:'sbc-detail'}}));
    }render(0);
    function renderError(){const category=$('#error-category').value,root=$('#error-chart');root.replaceChildren();errorRates[category].forEach((v,i)=>{const item=el('div','error-item'),num=el('strong','',v.toFixed(2)),track=el('div','error-track'),bar=el('span');num.append(el('small','','%'));bar.style.width=v+'%';track.append(bar);item.append(num,el('span','',errorMethods[i]),track);root.append(item);});animateBars(root,'.error-track span','X');}$('#error-category').addEventListener('change',renderError);renderError();
    const rows=Object.entries(errorRates).map(([method,values])=>({method,values}));$('#error-table').append(table(rows,['Human Prompt ↓','PGPR ↓','PGPR + SBC ↓'],'FMB error rates (%)',2,[],false));$('#error-table thead th').textContent='Error category';
  }

  function initMethod(){
    segments('#stage-modes',['Offline learning','Inference'],'Offline learning','Protocol stage',renderFlow);
    function renderFlow(stage){
      $('#method-flow').dataset.stage=stage;
      $('#stage-caption').textContent=stage==='Offline learning'?'Mechanism illustration. Protocol refinement uses the FMB training split; all model parameters remain frozen. This diagram does not depict recorded optimization logs.':'The learned protocol is shared across benchmarks and fixed at inference. The composed prompt remains image-specific. PGPR is not rerun for each test image.';
      window.dispatchEvent(new Event('proto:methodstage'));
    }renderFlow('Offline learning');
    segments('#protocol-tabs',protocolSlots.map((s,i)=>({value:String(i),label:s.code+' · '+s.label})),'0','Protocol slot',v=>renderSlot(Number(v)));
    function renderSlot(i){const s=protocolSlots[i],root=$('#protocol-panel');root.replaceChildren(el('span','eyebrow','Initial protocol · Appendix excerpt'),el('h4','',s.title),el('p','',s.description),el('pre','',s.excerpt));}renderSlot(0);
  }

  function table(rows,headers,caption,precision=4,lowColumns=[],ranked=true) {
    const t=el('table');t.append(el('caption','',caption));const head=el('thead'),tr=el('tr');
    const venues=rows.some(row=>'venue' in row);
    ['Method',...(venues?['Venue']:[]),...headers].forEach(h=>{const cell=el('th','',h);cell.scope='col';tr.append(cell);});head.append(tr);t.append(head);const body=el('tbody');
    const ranks=headers.map((_,j)=>[...new Set(rows.map(r=>r.values[j]))].sort((a,b)=>lowColumns.includes(j)?a-b:b-a));
    rows.forEach(row=>{const tr=el('tr',['ProtoFusion','PGPR+SBC'].includes(row.method)?'ours':'');const name=el('th','',row.method);name.scope='row';tr.append(name);if(venues)tr.append(el('td','venue-cell',row.venue||'—'));row.values.forEach((v,j)=>{const rank=ranked?ranks[j].indexOf(v):-1;tr.append(el('td',rank===0?'best':rank===1?'second':'',v.toFixed(precision)));});body.append(tr);});t.append(body);return t;
  }
  function wrapTable(table,label){const wrap=el('div','table-wrap');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',label);wrap.append(table);return wrap;}
  function barChart(root,rows,index,maximum){
    root.replaceChildren();rows.forEach(r=>{const row=el('div','benchmark-row'+(['ProtoFusion','PGPR+SBC'].includes(r.method)?' ours':'')),track=el('div','bar-track'),bar=el('div','bar-fill');bar.style.width=r.values[index]/maximum*100+'%';track.append(bar);row.append(el('span','bar-label',r.method),track,el('span','bar-value',r.values[index].toFixed(4)));root.append(row);});animateBars(root,'.bar-fill','X');
  }
  function initEvaluation(){
    let dataset='FMB',metric='Overall',family='UniPercept';
    const sourceLabels=['CE','Q_AB/F','VIF'];
    segments('#eval-families',['UniPercept','Source-referenced'],family,'Evaluation family',v=>{family=v;metric=v==='UniPercept'?'Overall':'Q_AB/F';metricControls();render();});
    segments('#eval-datasets',D.datasets,dataset,'Evaluation dataset',v=>{dataset=v;render();});
    function metricControls(){segments('#eval-metrics',family==='UniPercept'?metrics:sourceLabels,metric,'Evaluation metric',v=>{metric=v;render();});}metricControls();
    function render(){
      const isUni=family==='UniPercept',rows=(isUni?D.uni:D.sourceResults)[dataset],i=(isUni?metrics:sourceLabels).indexOf(metric);
      $('#benchmark-title').textContent=`${family} · ${dataset} · ${metric}`;
      $('#benchmark-direction').textContent=metric==='CE'?'Lower is better ↓':'Higher is better ↑';
      $('#benchmark-caption').textContent=isUni?'ProtoFusion uses PGPR + SBC on all three benchmarks. UniPercept reports image aesthetics (IAA), image quality (IQA), structure and texture (ISTA) and its aggregate Overall score. All methods and values are retained below.':'CE measures source discrepancy; Q_AB/F measures edge transfer; VIF measures visual information fidelity. ProtoFusion leads Q_AB/F on all three datasets; CE and VIF rankings vary. This appendix comparison includes APTP and DPOFusion.';
      barChart($('#benchmark-chart'),rows,i,isUni?60:Math.ceil(Math.max(...rows.map(r=>r.values[i]))*10)/10);
    }render();
    D.datasets.forEach(d=>{$('#uni-tables').append(wrapTable(table(D.uni[d],metrics.map(m=>m+' ↑'),d),d+' UniPercept results'));$('#main-tables').append(wrapTable(table(D.main[d],D.mainMetrics,d,4,[4]),d+' image-quality results'));$('#source-tables').append(wrapTable(table(D.sourceResults[d],D.sourceMetrics,d,4,[0]),d+' source-referenced results'));});
    $('#seg-table').append(table(D.seg,['mIoU ↑','mAcc ↑',...['Road','Building','Sky','Car','Truck','Bus','Veg.','Pole'].flatMap(c=>[c+' IoU ↑',c+' Acc ↑'])],'FMB · frozen CLIPer · eight reported classes',3));
    const ours=D.seg.find(r=>r.method==='ProtoFusion'),competitors=D.seg.filter(r=>r.method!=='ProtoFusion');
    ['iou','acc'].forEach((key,i)=>{const best=competitors.reduce((a,b)=>a.values[i]>=b.values[i]?a:b);$('#seg-'+key).textContent=ours.values[i].toFixed(3);$('#seg-'+key+'-baseline').textContent=`${best.method}: ${best.values[i].toFixed(3)}`;});
  }
  function initGenerators(){
    caseStrip('#generator-cases',D.transfer,s=>s.images['GPT Image 2'],render);
    function render(i){
      const s=D.transfer[i],root=$('#generator-detail'),board=evidenceBoard(s.images.VIS,s.images.IR),outputs=el('div','evidence-output-grid evidence-results');
      outputs.append(panel(s.images['Qwen-Image-Edit'],'ProtoFusion (Qwen)','Qwen-Image-Edit'),panel(s.images['GPT Image 2'],'ProtoFusion (GPT)','GPT-Image-2'));
      board.append(outputs);root.replaceChildren(board,el('p','evidence-hover-hint','Hover to explore corresponding details · 2.5× linked zoom'));
      window.dispatchEvent(new CustomEvent('proto:comparisonchange',{detail:{root:'generator-detail'}}));
    }render(0);
  }

  function evidenceBoard(visible,infrared){
    const board=el('div','evidence-board'),inputs=el('div','evidence-source-pair');
    const vis=panel(visible,'Visible'),ir=panel(infrared,'Infrared');vis.classList.add('source-visible');ir.classList.add('source-infrared');inputs.append(vis,ir);board.append(inputs);return board;
  }

  // Load large original figures only when their disclosure is opened.
  $$('figure[data-figure]').forEach(figure=>{
    const key=figure.dataset.figure,details=figure.closest('details');let loaded=false;
    function load(){if(loaded)return;loaded=true;const button=el('button','figure-link');const label=$('figcaption',figure).textContent;button.setAttribute('aria-label','Enlarge '+label);const img=image(D.figures[key],label);img.className='original-figure';button.append(img);button.addEventListener('click',()=>zoom(D.figures[key],label,button));figure.prepend(button);}
    if(details)details.addEventListener('toggle',()=>{if(details.open)load();});else load();
  });
  const sectionInitializers={results:initResults,infrared:initInfrared,refinement:initRefinement,correction:initCorrection,method:initMethod,evaluation:initEvaluation,generators:initGenerators};
  // Build stable section heights immediately. Native image lazy loading keeps
  // off-screen media deferred, while anchor navigation never races layout shifts.
  Object.values(sectionInitializers).forEach(initialize=>initialize());
  initHero();
  const navLinks=$$('.rail a');let ticking=false;
  function track(){ticking=false;const y=window.innerHeight*.3;let active='abstract';$$('main .section').forEach(section=>{if(section.getBoundingClientRect().top<=y)active=section.id;});navLinks.forEach(link=>link.setAttribute('aria-current',String(link.getAttribute('href')==='#'+active)));}
  window.addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(track);}},{passive:true});track();
  $$('.mobile-toc a').forEach(link=>link.addEventListener('click',()=>{$('.mobile-toc').open=false;}));
  const themeButton=$('#theme');let theme='auto';try{theme=localStorage.getItem('proto-theme')||'auto';}catch{}
  function applyTheme(){if(theme==='auto')document.documentElement.removeAttribute('data-theme');else document.documentElement.dataset.theme=theme;$('span',themeButton).textContent=theme[0].toUpperCase()+theme.slice(1);themeButton.setAttribute('aria-label',`Color theme: ${theme}. Switch theme.`);}
  themeButton.addEventListener('click',()=>{theme=theme==='auto'?'light':theme==='light'?'dark':'auto';applyTheme();try{localStorage.setItem('proto-theme',theme);}catch{}});applyTheme();
})();
