(function(){
  var PAGES=['index.html','authors.html','books.html','about.html','media.html','contact.html'];
  var KEY='d26-needed-highlight';
  var page=location.pathname.split('/').pop()||'index.html';
  var pi=PAGES.indexOf(page);
  var find=/\[[^\[\]]+\]/g;
  var has=/\[[^\[\]]+\]/;

  var nodes=[];
  var walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode:function(n){
    var tag=n.parentNode.nodeName;
    if(tag==='SCRIPT'||tag==='STYLE'||tag==='TEXTAREA')return NodeFilter.FILTER_REJECT;
    if(tag==='MARK'&&n.parentNode.classList.contains('needed'))return NodeFilter.FILTER_REJECT;
    return has.test(n.nodeValue)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP;
  }});
  while(walk.nextNode())nodes.push(walk.currentNode);
  nodes.forEach(function(n){
    var t=n.nodeValue,frag=document.createDocumentFragment(),last=0,m;
    find.lastIndex=0;
    while((m=find.exec(t))){
      if(m.index>last)frag.appendChild(document.createTextNode(t.slice(last,m.index)));
      var mk=document.createElement('mark');
      mk.className='needed';
      mk.textContent=m[0];
      frag.appendChild(mk);
      last=m.index+m[0].length;
    }
    if(last<t.length)frag.appendChild(document.createTextNode(t.slice(last)));
    n.parentNode.replaceChild(frag,n);
  });
  [].forEach.call(document.querySelectorAll('[placeholder]'),function(el){
    if(has.test(el.getAttribute('placeholder')))el.classList.add('needed-field');
  });

  var all=[].slice.call(document.querySelectorAll('mark.needed,.needed-field'));
  all.forEach(function(el){
    var id=el.getAttribute('data-need');
    if(id)el.setAttribute('title','Copy sheet: '+id);
  });
  var cur=-1;

  var bar=document.createElement('div');
  bar.className='needbar';
  bar.setAttribute('role','region');
  bar.setAttribute('aria-label','Needed copy');
  bar.innerHTML='<button type="button" class="nb-toggle" aria-pressed="true" title="Highlight needed copy"><span class="nb-dot"></span><span class="nb-label">Needed copy</span></button>'+
    '<button type="button" class="nb-prev" aria-label="Previous needed copy" title="Previous ( [ key )">&lsaquo;</button>'+
    '<span class="nb-count" aria-live="polite"><b class="nb-id"></b><small class="nb-pos"></small></span>'+
    '<button type="button" class="nb-next" aria-label="Next needed copy" title="Next ( ] key )">&rsaquo;</button>';
  document.body.appendChild(bar);
  var tog=bar.querySelector('.nb-toggle'),prev=bar.querySelector('.nb-prev'),next=bar.querySelector('.nb-next'),idEl=bar.querySelector('.nb-id'),posEl=bar.querySelector('.nb-pos');

  function visible(){return all.filter(function(el){return el.getClientRects().length>0})}

  function setOn(on){
    document.body.classList.toggle('show-needed',on);
    tog.setAttribute('aria-pressed',on?'true':'false');
    try{localStorage.setItem(KEY,on?'1':'0')}catch(e){}
  }

  function label(){
    var v=visible();
    var el=cur<0?null:v[cur];
    idEl.textContent=el?(el.getAttribute('data-need')||'Not on sheet'):'Copy sheet';
    posEl.textContent=(cur<0?'–':cur+1)+' of '+v.length+' on this page';
    var atEnd=cur>=v.length-1,atStart=cur<=0;
    next.innerHTML=atEnd?'Next page &rsaquo;':'&rsaquo;';
    prev.innerHTML=atStart&&cur>-1?'&lsaquo; Prev page':'&lsaquo;';
    next.setAttribute('aria-label',atEnd?'Next page':'Next needed copy');
    prev.setAttribute('aria-label',atStart&&cur>-1?'Previous page':'Previous needed copy');
  }

  function go(i){
    var v=visible();
    if(!v.length)return;
    cur=Math.max(0,Math.min(i,v.length-1));
    all.forEach(function(el){el.classList.remove('is-current')});
    v[cur].classList.add('is-current');
    v[cur].scrollIntoView({behavior:'smooth',block:'center'});
    label();
  }

  function hop(step){
    var to=PAGES[(pi+step+PAGES.length)%PAGES.length];
    location.href=to+(step>0?'#needed-first':'#needed-last');
  }

  function forward(){
    var v=visible();
    if(cur<v.length-1)go(cur+1);else hop(1);
  }
  function back(){
    var v=visible();
    if(cur>0)go(cur-1);else if(cur<0&&v.length)go(v.length-1);else hop(-1);
  }

  var stored=null;
  try{stored=localStorage.getItem(KEY)}catch(e){}
  setOn(stored!=='0');

  tog.addEventListener('click',function(){setOn(tog.getAttribute('aria-pressed')!=='true')});
  next.addEventListener('click',forward);
  prev.addEventListener('click',back);
  document.addEventListener('keydown',function(e){
    var t=e.target.nodeName;
    if(t==='INPUT'||t==='TEXTAREA'||e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.key===']'){e.preventDefault();forward()}
    else if(e.key==='['){e.preventDefault();back()}
  });

  label();
  if(location.hash==='#needed-first'||location.hash==='#needed-last'){
    var first=location.hash==='#needed-first';
    history.replaceState(null,'',location.pathname+location.search);
    setTimeout(function(){go(first?0:visible().length-1)},60);
  }
})();
