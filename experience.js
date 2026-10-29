/* Presentation and inspection, separate from the manuscript's scientific data. */
(() => {
  'use strict';
  const $ = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const node = (tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const clamp = v=>Math.max(0,Math.min(100,v));

  function initHoverInspection(){
    const cleanups=new Map(),zoom=2.5;
    const bound=(value,low,high)=>Math.max(low,Math.min(high,value));
    function bind(id){
      cleanups.get(id)?.();
      const root=document.getElementById(id);
      const board=$('.evidence-board',root)||$('.fusion-triptych',root)||root;
      const hint=$('.compare-note > span',board),overlay=$('.overlay-view',board);
      const inspectToggle=id==='hero-triptych'?$('#inspect-toggle'):null;
      const fullHint=hint?.textContent;
      let frame=0,pointer=null;
      const items=$$('.image-stage',board).map(stage=>{
        const img=$(':scope > img',stage),context=Boolean(stage.closest('.evidence-source-pair'));
        const region=node('span',context?'hover-context-region':'hover-map-region');
        const decorations=[];
        if(context){stage.append(region);decorations.push(region);}
        else{
          const map=node('div','hover-map'),thumbnail=node('img'),badge=node('span','hover-zoom-badge','2.5×');
          map.setAttribute('aria-hidden','true');badge.setAttribute('aria-hidden','true');
          map.style.aspectRatio=`${img.getAttribute('width')} / ${img.getAttribute('height')}`;
          thumbnail.src=img.src;thumbnail.alt='';map.append(thumbnail,region);stage.append(map,badge);decorations.push(map,badge);
        }
        return {stage,img,context,region,decorations};
      });
      board.classList.add('linked-hover');
      function reset(){
        cancelAnimationFrame(frame);frame=0;pointer=null;board.classList.remove('is-hovering');
        items.forEach(({img})=>{img.style.transform='';});
        if(hint&&overlay.hidden)hint.textContent=fullHint;
      }
      function geometry(item){
        const {stage,img}=item,w=stage.clientWidth,h=stage.clientHeight;
        const ratio=(img.naturalWidth||Number(img.getAttribute('width')))/(img.naturalHeight||Number(img.getAttribute('height')));
        const cw=Math.min(w,h*ratio),ch=cw/ratio;
        return {w,h,cw,ch,ox:(w-cw)/2,oy:(h-ch)/2};
      }
      function paint(){
        frame=0;if(!pointer)return;
        const {item,x,y}=pointer,g=geometry(item),rect=item.stage.getBoundingClientRect();
        const nx=bound((x-rect.left-item.stage.clientLeft-g.ox)/g.cw,0,1);
        const ny=bound((y-rect.top-item.stage.clientTop-g.oy)/g.ch,0,1);
        const reference=item.context?items.find(candidate=>!candidate.context):item;
        const ref=geometry(reference),rw=ref.w/(ref.cw*zoom),rh=ref.h/(ref.ch*zoom);
        board.classList.add('is-hovering');
        if(hint)hint.textContent='Move away to restore both full images';
        items.forEach(current=>{
          const {w,h,cw,ch,ox,oy}=geometry(current);
          if(current.context){
            Object.assign(current.region.style,{left:`${ox+bound(nx-rw/2,0,1-rw)*cw}px`,top:`${oy+bound(ny-rh/2,0,1-rh)*ch}px`,width:`${cw*rw}px`,height:`${ch*rh}px`});
          }else{
            // Translate the fitted image, including its letterbox, without stretching it.
            const left=bound(w/2-nx*cw*zoom,w-cw*zoom,0),top=bound(h/2-ny*ch*zoom,h-ch*zoom,0);
            current.img.style.transform=`translate(${left-ox*zoom}px,${top-oy*zoom}px) scale(${zoom})`;
            Object.assign(current.region.style,{left:`${-left/(cw*zoom)*100}%`,top:`${-top/(ch*zoom)*100}%`,width:`${w/(cw*zoom)*100}%`,height:`${h/(ch*zoom)*100}%`});
          }
        });
      }
      function move(event){
        if(event.pointerType!=='mouse'||event.target.closest('button')||board.closest('.inspecting')||(overlay&&!overlay.hidden)){reset();return;}
        const item=items.find(candidate=>candidate.stage.contains(event.target));
        if(!item){reset();return;}
        pointer={item,x:event.clientX,y:event.clientY};if(!frame)frame=requestAnimationFrame(paint);
      }
      board.addEventListener('pointermove',move);board.addEventListener('pointerleave',reset);
      board.addEventListener('focusin',reset);inspectToggle?.addEventListener('click',reset);
      window.addEventListener('scroll',reset,{passive:true});window.addEventListener('resize',reset);
      cleanups.set(id,()=>{
        reset();board.classList.remove('linked-hover');items.forEach(item=>item.decorations.forEach(element=>element.remove()));
        board.removeEventListener('pointermove',move);board.removeEventListener('pointerleave',reset);
        board.removeEventListener('focusin',reset);inspectToggle?.removeEventListener('click',reset);
        window.removeEventListener('scroll',reset);window.removeEventListener('resize',reset);
      });
    }
    ['hero-triptych','scene-detail','ir-detail','sbc-detail','generator-detail'].forEach(bind);
    window.addEventListener('proto:scenechange',()=>bind('hero-triptych'));
    window.addEventListener('proto:comparisonchange',event=>bind(event.detail.root));
  }

  function initInspector(){
    const exhibit=$('#hero-demo'),root=$('#hero-inspector'),toggle=$('#inspect-toggle'),guide=$('#inspect-guide');
    const xRange=$('#inspect-x'),yRange=$('#inspect-y');
    let scene=0,open=false,x=50,y=50,frame=0,started=0;
    function position(px,py){
      x=clamp(px);y=clamp(py);xRange.value=String(Math.round(x));yRange.value=String(Math.round(y));
      exhibit.style.setProperty('--roi-left',`${x*2/3}%`);exhibit.style.setProperty('--roi-top',`${y*2/3}%`);
      exhibit.style.setProperty('--detail-left',`${-x*2}%`);exhibit.style.setProperty('--detail-top',`${-y*2}%`);
    }
    function stop(){cancelAnimationFrame(frame);frame=0;guide.setAttribute('aria-pressed','false');guide.textContent='▶ Play detail tour';}
    function draw(time){
      if(!started)started=time;
      const phase=(time-started)/12000;
      if(phase>=1){stop();return;}
      position(50+32*Math.sin(phase*Math.PI*2),58+25*Math.sin(phase*Math.PI*2+.6));
      frame=requestAnimationFrame(draw);
    }
    function sync(){
      const data=window.PROTO_DATA.hero[scene],loupes=$('#detail-loupes');loupes.replaceChildren();
      ['VIS','IR','ProtoFusion'].forEach((key,i)=>{
        const figure=node('figure'),windowEl=node('div','detail-window'),img=node('img');img.src=data.images[key];img.alt=`${data.name} · ${key} detail`;windowEl.append(img);figure.append(windowEl,node('figcaption','', ['Visible · 3×','Infrared · 3×','Fusion · 3×'][i]));loupes.append(figure);
      });
      $$('#hero-triptych .image-stage').forEach(stage=>{
        stage.append(node('span','inspect-region'));
        function inspect(event){
          if(!open||event.target.closest('button'))return;
          stop();const bounds=stage.getBoundingClientRect();
          position(((event.clientX-bounds.left)/bounds.width-1/6)*150,((event.clientY-bounds.top)/bounds.height-1/6)*150);
        }
        stage.addEventListener('pointermove',inspect);stage.addEventListener('pointerdown',inspect);
      });position(x,y);
    }
    toggle.addEventListener('click',()=>{open=!open;root.hidden=!open;toggle.setAttribute('aria-expanded',String(open));exhibit.classList.toggle('inspecting',open);toggle.lastChild.textContent=open?' Close detail view':' Inspect together';if(!open)stop();});
    [xRange,yRange].forEach(range=>range.addEventListener('input',()=>{stop();position(Number(xRange.value),Number(yRange.value));}));
    guide.addEventListener('click',()=>{
      // An explicit Play action opts into this bounded tour, even when passive
      // page motion is reduced. Nothing starts automatically.
      if(frame){stop();return;}started=0;guide.textContent='Ⅱ Pause detail tour';guide.setAttribute('aria-pressed','true');frame=requestAnimationFrame(draw);
    });
    window.addEventListener('proto:scenechange',event=>{scene=event.detail.index;sync();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
    new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)stop();},{threshold:0}).observe(exhibit);
    reduced.addEventListener('change',stop);sync();stop();
  }

  function initFilm(){
    const video=$('#project-film'),button=$('#film-play'),toggle=$('#film-toggle'),clock=$('#film-clock'),chapters=$$('.film-chapters button');
    let inView=false,wantsPlayback=!reduced.matches;
    async function play(){try{await video.play();}catch{button.hidden=false;}}
    button.addEventListener('click',()=>{wantsPlayback=true;play();});
    $('.film-link').addEventListener('click',()=>{wantsPlayback=true;play();});
    toggle.addEventListener('click',()=>{if(video.paused){wantsPlayback=true;play();}else{wantsPlayback=false;video.pause();}});
    video.addEventListener('play',()=>{button.hidden=true;toggle.textContent='Ⅱ Pause film';toggle.setAttribute('aria-pressed','true');if(inView)wantsPlayback=true;});
    video.addEventListener('pause',()=>{button.hidden=video.currentTime>.15;toggle.textContent='▶ Play film';toggle.setAttribute('aria-pressed','false');if(inView&&!document.hidden)wantsPlayback=false;});
    video.addEventListener('timeupdate',()=>{const current=Math.min(3,Math.floor(video.currentTime/8));chapters.forEach((b,i)=>b.setAttribute('aria-pressed',String(current===i)));clock.textContent=`00:${String(Math.floor(video.currentTime)).padStart(2,'0')} / 00:32`;});
    chapters.forEach(b=>b.addEventListener('click',()=>{video.currentTime=Number(b.dataset.time);wantsPlayback=true;play();}));
    new IntersectionObserver(entries=>{
      inView=entries[0].isIntersecting;
      if(inView&&wantsPlayback&&!document.hidden)play();else if(!inView)video.pause();
    },{threshold:.25}).observe(video);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();else if(inView&&wantsPlayback)play();});
    reduced.addEventListener('change',()=>{if(reduced.matches){wantsPlayback=false;video.pause();}});
  }

  let methodCleanup=()=>{};
  function renderMethod(){
    methodCleanup();
    const root=$('#method-flow'),offline=root.dataset.stage==='Offline learning';
    const steps=offline?[
      ['p','Compose','Read the pair','Compose a grounded instruction','The protocol combines environment state cards, grounding principles and a style profile with evidence from this image pair.','source pair + protocol → prompt'],
      ['y','Generate','Frozen generator','Generate a fusion candidate','The image generator follows the composed prompt using both source modalities. The generator’s weights remain unchanged.','visible + infrared + prompt → candidate'],
      ['c','Diagnose','Multimodal evidence','Check the result against its sources','A multimodal critic identifies inconsistencies and assigns a score. Fatal candidates are rejected even when their numerical score is high.','sources + candidate → critique + score'],
      ['Δ','Revise','Validate & retain','Update the protocol under constraints','Validate a structured edit. Worse or fatal proposals do not replace the best non-fatal state. Environment cards and principles can change; the style profile stays fixed.','validated edit → next protocol · retain best-so-far'],
    ]:[
      ['Π','Protocol','Shared & fixed','Reuse the learned protocol','The protocol is learned offline and held fixed at test time. The same protocol is shared across the reported benchmarks.','offline learning → one fixed protocol'],
      ['p','Compose','Image-specific','Adapt the prompt to this image pair','Qwen3-VL-8B-Instruct reads the infrared and visible images under the fixed protocol and composes an image-specific instruction.','new source pair + fixed protocol → new prompt'],
      ['y','Generate','Frozen weights','Fuse the complementary evidence','Qwen-Image-Edit uses the paired images and composed prompt to generate a fusion output. Offline PGPR is not rerun for the test image.','visible + infrared + prompt → fusion'],
      ['b','Correct','Optional SBC','Apply a conservative correction','SBC organizes source reliability, region evidence and conflicts. A valid scoped prompt edit permits at most one extra generation; otherwise the previous result is retained.','source evidence → scoped correction → final output'],
    ];
    let active=0,frame=0,last=0,elapsed=0;
    root.replaceChildren();
    const top=node('div','mechanism-top'),play=node('button','motion-play','▶ Play explanation');play.setAttribute('aria-pressed','false');
    top.append(node('p','',offline?'Offline protocol learning':'Inference with a fixed protocol'),play);
    const nodes=node('div','mechanism-nodes');nodes.setAttribute('role','group');nodes.setAttribute('aria-label','Method steps');
    const buttons=steps.map((s,i)=>{const button=node('button','mechanism-node');button.setAttribute('aria-label',`Step ${i+1}: ${s[1]}`);button.append(node('span','mechanism-glyph',s[0]),node('strong','',s[1]),node('small','',s[2]));button.addEventListener('click',()=>{pause();show(i);});nodes.append(button);return button;});
    const packet=node('span','mechanism-packet');packet.setAttribute('aria-hidden','true');nodes.append(packet);
    const loop=node('div','mechanism-return',offline?'Repeat with the validated protocol · T = 6':'A new image pair, the same learned protocol');
    const detail=node('div','mechanism-detail');detail.setAttribute('aria-live','polite');
    const controls=node('div','mechanism-controls'),range=node('input');range.type='range';range.min='0';range.max='3';range.step='1';range.value='0';range.setAttribute('aria-label','Method explanation step');
    const count=node('output','','01 / 04'),track=node('div','mechanism-progress'),progress=node('i');track.append(progress);controls.append(range,count);
    root.append(top,nodes,loop,detail,controls,track);
    function show(index){
      active=index;elapsed=0;range.value=String(index);range.setAttribute('aria-valuetext',`Step ${index+1}: ${steps[index][1]}`);count.textContent=`0${index+1} / 04`;
      buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
      const s=steps[index],copy=node('div');copy.append(node('h4','',s[3]),node('p','',s[4]),node('span','mechanism-formula',s[5]));detail.replaceChildren(node('span','mechanism-number',`0${index+1}`),copy);progress.style.width='0%';
      if(!reduced.matches){copy.classList.add('scene-arrive');}
    }
    function pause(){cancelAnimationFrame(frame);frame=0;last=0;nodes.classList.remove('is-playing');play.textContent='▶ Play explanation';play.setAttribute('aria-pressed','false');}
    function tick(time){
      if(last)elapsed+=time-last;last=time;
      if(elapsed>=4200)show((active+1)%4);
      progress.style.width=`${elapsed/42}%`;packet.style.left=`${12.5+25*Math.min(active+elapsed/4200,3)}%`;frame=requestAnimationFrame(tick);
    }
    play.addEventListener('click',()=>{if(frame){pause();return;}last=0;nodes.classList.add('is-playing');play.textContent='Ⅱ Pause explanation';play.setAttribute('aria-pressed','true');frame=requestAnimationFrame(tick);});
    range.addEventListener('input',()=>{pause();show(Number(range.value));});
    nodes.addEventListener('keydown',event=>{const at=buttons.indexOf(document.activeElement);if(at<0||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?3:(at+(event.key==='ArrowRight'?1:-1)+4)%4;buttons[next].focus();buttons[next].click();});
    const observer=new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)pause();},{threshold:0});observer.observe(root);
    const hide=()=>{if(document.hidden)pause();};document.addEventListener('visibilitychange',hide);
    methodCleanup=()=>{pause();observer.disconnect();document.removeEventListener('visibilitychange',hide);};show(0);
  }

  let candidateCleanup=()=>{};
  function initCandidateTour(){
    candidateCleanup();const root=$('#trajectory-detail'),cards=$$('.candidate',root);if(!cards.length)return;
    const toolbar=node('div','candidate-focus'),label=node('p','','Follow the prompt excerpts · all candidates stay visible');
    const group=node('div','seg'),play=node('button','text-button','▶ Play prompt tour');play.setAttribute('aria-pressed','false');
    let active=-1,frame=0,start=0;const buttons=cards.map((_,i)=>{const b=node('button','',String(i+1));b.setAttribute('aria-label',`Focus displayed candidate ${i+1}`);b.addEventListener('click',()=>{stop();focus(i);});group.append(b);return b;});
    toolbar.append(label,group,play);$('.candidate-grid',root).before(toolbar);
    const currentPrompt=node('div','candidate-current-prompt');currentPrompt.setAttribute('aria-live','polite');$('.candidate-grid',root).after(currentPrompt);
    function focus(i){if(i===active)return;active=i;cards.forEach((card,j)=>card.classList.toggle('is-focused',i===j));buttons.forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));currentPrompt.replaceChildren(node('span','eyebrow',`Prompt excerpt · displayed candidate ${i+1}`),$('.prompt-excerpt',cards[i]).cloneNode(true));}
    function stop(){cancelAnimationFrame(frame);frame=0;play.textContent='▶ Play prompt tour';play.setAttribute('aria-pressed','false');}
    function tick(time){if(!start)start=time;const passed=time-start;if(passed>=12000){stop();return;}focus(Math.floor(passed/4000));frame=requestAnimationFrame(tick);}
    play.addEventListener('click',()=>{if(frame){stop();return;}start=0;play.textContent='Ⅱ Pause prompt tour';play.setAttribute('aria-pressed','true');frame=requestAnimationFrame(tick);});
    const observer=new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)stop();},{threshold:0});observer.observe(root);
    const hide=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',hide);
    candidateCleanup=()=>{stop();observer.disconnect();document.removeEventListener('visibilitychange',hide);};focus(0);stop();
  }

  function initReadingMotion(){
    if(reduced.matches)return;
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('in-view');observer.unobserve(entry.target);}}),{threshold:.12});
    $$('main .section>h2, main .section>.lede, .comparison-intro, .film-heading').forEach(element=>{element.classList.add('reveal-ready');observer.observe(element);});
    reduced.addEventListener('change',()=>{if(reduced.matches){$$('.reveal-ready').forEach(e=>e.classList.add('in-view'));observer.disconnect();}});
  }
  window.addEventListener('proto:methodstage',renderMethod);
  window.addEventListener('proto:candidateschange',initCandidateTour);
  initInspector();initHoverInspection();initFilm();renderMethod();initCandidateTour();initReadingMotion();
})();
