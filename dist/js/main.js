var currentLang='mn';
var currentRating=5;
var _pollTimer=null;
var _pollCount=0;
var _POLL_MAX=200; // 200 × 3s = 10 минут

// ---- Хэл тохиргоо ----
function setLang(l){
  currentLang=l;
  if(typeof window._logLang==='function') window._logLang(l);
  document.querySelectorAll('.lb').forEach(function(b){b.classList.remove('active');});
  var btnId=l==='ko'?'bk':l==='mn'?'bn':'be';
  var btn=document.getElementById(btnId);
  if(btn) btn.classList.add('active');
  document.querySelectorAll('.t').forEach(function(el){
    var v=el.getAttribute('data-'+l);
    if(v) el.innerHTML=v;
  });
}

// ---- Modal үнэ ----
var UNIT_PRICE=61900, DELIVERY_FEE=7000;
function updateModalPrice(){
  var qty=Math.max(1,Number(document.getElementById('o_qty').value)||1);
  var productTotal=UNIT_PRICE*qty;
  var grandTotal=productTotal+DELIVERY_FEE;
  var qtyEl=document.getElementById('modalQtyLabel');
  if(qtyEl) qtyEl.textContent=qty>1?'(×'+qty+')':'';
  var ppEl=document.getElementById('modalProductPrice');
  if(ppEl) ppEl.textContent=productTotal.toLocaleString()+'₮';
  var totEl=document.getElementById('modalPriceTotal');
  if(totEl) totEl.textContent=grandTotal.toLocaleString()+'₮';
}

// ---- Auth menu ----
function toggleAuthMenu(){
  var m=document.getElementById('authMenu');
  m.style.display=m.style.display==='none'?'block':'none';
}
document.addEventListener('click',function(e){
  var btn=document.getElementById('authBtn');
  var menu=document.getElementById('authMenu');
  if(menu&&btn&&!btn.contains(e.target)&&!menu.contains(e.target))
    menu.style.display='none';
});

// ---- Захиалгын modal ----
function openOrderModal(){
  document.getElementById('orderModal').style.display='flex';
  document.body.style.overflow='hidden';
  updateModalPrice();
}
function closeOrderModal(){
  _stopPolling();
  document.getElementById('orderModal').style.display='none';
  document.body.style.overflow='';
  document.getElementById('orderForm').reset();
  document.getElementById('orderResult').innerHTML='';
  document.querySelectorAll('.shade-btn').forEach(function(b){b.classList.remove('active');});
  document.getElementById('o_shade').value='';
  document.getElementById('shadeError').style.display='none';
  document.getElementById('orderForm').style.display='';
  updateModalPrice();
}

// ---- Bank deep link товчнууд ----
var BANK_META={
  'qpay wallet':      {color:'#C41230',abbr:'QP'},
  'khan bank':        {color:'#1A56DB',abbr:'ХБ'},
  'khanbank':         {color:'#1A56DB',abbr:'ХБ'},
  'state bank':       {color:'#16A34A',abbr:'ТБ'},
  'xac bank':         {color:'#C41230',abbr:'ХС'},
  'xas bank':         {color:'#C41230',abbr:'ХС'},
  'tdb':              {color:'#1D4ED8',abbr:'ТД'},
  'trade and development bank':{color:'#1D4ED8',abbr:'ТД'},
  'social pay':       {color:'#7C3AED',abbr:'SP'},
  'most money':       {color:'#EA580C',abbr:'MM'},
  'national investment bank':{color:'#0369A1',abbr:'НИ'},
  'chinggis khaan bank':{color:'#92400E',abbr:'ЧХ'},
  'capitron bank':    {color:'#0891B2',abbr:'КП'},
  'bogd bank':        {color:'#6D28D9',abbr:'БГ'},
  'trans bank':       {color:'#065F46',abbr:'ТР'},
  'm bank':           {color:'#BE185D',abbr:'МБ'},
  'ard app':          {color:'#1D4ED8',abbr:'АД'},
  'toki app':         {color:'#0284C7',abbr:'ТК'},
  'toki':             {color:'#0284C7',abbr:'ТК'},
  'arig bank':        {color:'#B45309',abbr:'АР'},
  'monpay':           {color:'#DC2626',abbr:'МП'},
  'hipay':            {color:'#7C3AED',abbr:'ХП'},
  'happy pay':        {color:'#16A34A',abbr:'HP'},
  'golomt bank':      {color:'#C41230',abbr:'ГЛ'},
  'lendmn':           {color:'#0369A1',abbr:'LN'},
};

function _bankIcon(u){
  if(u.logo){
    return '<img src="'+esc(u.logo)+'" alt="" onerror="this.style.display=\'none\'">';
  }
  var key=(u.name||u.description||'').toLowerCase();
  var meta=BANK_META[key];
  if(!meta){
    for(var k in BANK_META){ if(key.indexOf(k)>=0||k.indexOf(key.split(' ')[0])>=0){ meta=BANK_META[k]; break; } }
  }
  var color=(meta&&meta.color)||'#6b5f5a';
  var abbr=(meta&&meta.abbr)||(u.name||'?').slice(0,2).toUpperCase();
  return '<span class="bank-icon-svg" style="background:'+color+'">'+abbr+'</span>';
}

function _renderBankLinks(urls){
  if(!urls||!urls.length) return '';
  var btns=urls.map(function(u){
    var label=u.name||u.description||'Bank';
    var link=u.link||u.deeplink||'#';
    return '<a href="'+esc(link)+'" target="_blank" rel="noopener" class="bank-btn">'
      +_bankIcon(u)+esc(label)+'</a>';
  }).join('');
  return '<div class="bank-links-wrap">'
    +'<p class="bank-links-title">Банкны апп-аар төлөх</p>'
    +'<div class="bank-links">'+btns+'</div>'
    +'</div>';
}

// ---- Polling эхлүүлэх ----
function _startPolling(invoice_id, order_no, amount){
  _pollCount=0;
  _stopPolling();
  _updatePollStatus('waiting');
  _pollTimer=setInterval(async function(){
    _pollCount++;
    if(_pollCount>_POLL_MAX){
      _stopPolling();
      _updatePollStatus('timeout');
      return;
    }
    try{
      var r=await fetch('/api/qpay/check/'+invoice_id);
      if(!r.ok) return;
      var j=await r.json();
      if(j.paid){
        _stopPolling();
        _showPaymentSuccess(order_no, amount);
      }
    }catch(e){}
  },3000);
}

function _stopPolling(){
  if(_pollTimer){ clearInterval(_pollTimer); _pollTimer=null; }
}

function _updatePollStatus(state){
  var el=document.getElementById('qpay-poll-status');
  if(!el) return;
  if(state==='waiting'){
    el.innerHTML='<span class="poll-dot"></span> Төлбөр хүлээж байна...';
  } else if(state==='timeout'){
    el.innerHTML='<span style="color:#c0392b">Хугацаа дууслаа. Хэрэв төлсөн бол бид тантай холбогдох болно.</span>';
  }
}

function _showPaymentSuccess(order_no, amount){
  var res=document.getElementById('orderResult');
  res.innerHTML='<div class="qpay-success">'
    +'<div class="success-icon">✓</div>'
    +'<p class="success-title">Төлбөр амжилттай!</p>'
    +'<p class="or-no" style="margin-top:.5rem">Захиалга №'+order_no+'</p>'
    +'<p style="font-size:11px;color:#6b5f5a;margin-top:.3rem">'+Number(amount).toLocaleString()+'₮ төлөгдлөө</p>'
    +'<p style="font-size:12px;color:#2a2420;font-weight:500;margin-top:.8rem;letter-spacing:.3px">Танд маш их баярлалаа — Femmora Beauty</p>'
    +'<p style="font-size:10px;color:#6b5f5a;margin-top:.5rem">🚚 Хүргэлт 24–48 цагийн дотор очно</p>'
    +'</div>';
}

// ---- Өнгө сонгох ----
function selectShade(shade,btn){
  document.querySelectorAll('.shade-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  document.getElementById('o_shade').value=shade;
  document.getElementById('shadeError').style.display='none';
}

// ---- Захиалга илгээх ----
async function submitOrder(e){
  e.preventDefault();
  var shade=document.getElementById('o_shade').value;
  if(!shade){
    document.getElementById('shadeError').style.display='block';
    return;
  }
  var btn=document.getElementById('orderSubmitBtn');
  btn.disabled=true; btn.textContent='...';
  var emailEl=document.getElementById('o_email');
  var data={
    name:document.getElementById('o_name').value.trim(),
    phone:document.getElementById('o_phone').value.trim(),
    email:emailEl?emailEl.value.trim():'',
    address:document.getElementById('o_address').value.trim(),
    quantity:Number(document.getElementById('o_qty').value),
    shade:shade,
    include_vat:false,
    uid:window._currentUid||null
  };
  var res=document.getElementById('orderResult');
  try{
    var r=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    var json=await r.json();
    if(!r.ok) throw new Error(json.error||'Алдаа гарлаа');

    document.getElementById('orderForm').style.display='none';
    if(typeof window._logOrder==='function') window._logOrder(json.order_no, json.amount);

    if(json.qpay&&json.qpay.qr_image){
      // QPay бүрэн UI
      res.innerHTML='<div class="qr-wrap">'
        +'<p style="font-size:11px;color:#6b5f5a;line-height:1.7;margin-bottom:.8rem;padding:.7rem 1rem;background:#f9f5ee;border:.5px solid #e2dbd7">Таны төлбөр төлөгдсөний дараа захиалга үүсч хүргэлтэнд гарахыг анхаарна уу. Баярлалаа 🙏</p>'
        +'<p class="or-no">Захиалга №'+json.order_no+'</p>'
        +'<img src="data:image/png;base64,'+json.qpay.qr_image+'" class="qr-img" alt="QPay QR">'
        +'<p class="qr-amt">'+json.amount.toLocaleString()+'₮</p>'
        +'<p class="qr-hint">QPay апп-аар уншуулан төлнө үү</p>'
        +_renderBankLinks(json.qpay.urls)
        +'<div id="qpay-poll-status" class="poll-status"></div>'
        +'</div>';
      _startPolling(json.qpay.invoice_id, json.order_no, json.amount);
    } else {
      // QPay байхгүй үед (fallback)
      res.innerHTML='<div class="or-success">'
        +'<p class="or-no">Захиалга №'+json.order_no+' бүртгэгдлээ!</p>'
        +'<p style="font-size:12px;color:#2a2420;font-weight:500;margin-top:.8rem">Танд маш их баярлалаа — Femmora Beauty</p>'
        +'<p style="font-size:10px;color:#6b5f5a;margin-top:.5rem">🚚 Хүргэлт 24–48 цагийн дотор очно</p>'
        +(json.warning?'<p class="or-warn">'+json.warning+'</p>':'')
        +'</div>';
    }
  } catch(err){
    res.innerHTML='<p class="or-err">'+err.message+'</p>';
    document.getElementById('orderForm').style.display='';
  } finally{
    btn.disabled=false;
    btn.textContent={mn:'Захиалах',ko:'주문하기',en:'Order'}[currentLang]||'Захиалах';
  }
}

// ---- Одны үнэлгээ ----
function setRating(v){
  currentRating=v;
  document.getElementById('rv_rating').value=v;
  document.querySelectorAll('.star-btn').forEach(function(s){
    s.style.color=Number(s.getAttribute('data-v'))<=v?'#c8a96e':'#e2dbd7';
  });
}

// ---- JSON-г аюулгүй уншина ----
async function safeJson(r){
  var text='';
  try{ text=await r.text(); }
  catch(e){ throw new Error('Сүлжээний алдаа. Интернэт холболтоо шалгана уу.'); }
  text=text.replace(/^﻿/,'').trim();
  if(!text) throw new Error('Сервер хариу буцаасангүй ('+r.status+')');
  try{ return JSON.parse(text); }
  catch(e){
    if(text.includes('"error"')){ try{ return JSON.parse(text.slice(text.indexOf('{'))); }catch(_){} }
    throw new Error('Серверийн алдаа ('+r.status+'). Дахин оролдоно уу.');
  }
}

// ---- Зургийг Canvas-аар compress хийж base64 болгоно ----
function compressImage(file, maxPx, quality){
  maxPx=maxPx||700; quality=quality||0.70;
  return new Promise(function(resolve){
    var reader=new FileReader();
    reader.onload=function(e){
      var img=new Image();
      img.onload=function(){
        var w=img.width, h=img.height;
        if(w>maxPx||h>maxPx){
          if(w>h){ h=Math.round(h*maxPx/w); w=maxPx; }
          else   { w=Math.round(w*maxPx/h); h=maxPx; }
        }
        var canvas=document.createElement('canvas');
        canvas.width=w; canvas.height=h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        resolve(canvas.toDataURL('image/jpeg',quality));
      };
      img.src=e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ---- Зураг preview ----
function previewReviewImg(input){
  var preview=document.getElementById('rvImgPreview');
  var thumb=document.getElementById('rvImgThumb');
  var text=document.getElementById('rvImgText');
  if(input.files&&input.files[0]){
    var reader=new FileReader();
    reader.onload=function(e){
      thumb.src=e.target.result;
      preview.style.display='block';
      text.textContent={mn:'Зураг сонгогдлоо ✓',ko:'사진 선택됨 ✓',en:'Photo selected ✓'}[currentLang]||'Зураг сонгогдлоо ✓';
    };
    reader.readAsDataURL(input.files[0]);
  }
}
function clearReviewImg(){
  document.getElementById('rv_image').value='';
  document.getElementById('rvImgPreview').style.display='none';
  document.getElementById('rvImgThumb').src='';
  var text=document.getElementById('rvImgText');
  if(text) text.textContent={mn:'Зураг сонгох...',ko:'사진 선택...',en:'Choose photo...'}[currentLang]||'Зураг сонгох...';
}

// ---- Сэтгэгдэл ачаалах ----
async function loadReviews(){
  try{
    var r=await fetch('/api/reviews');
    var list=await safeJson(r);
    var good=list.filter(function(rv){ return rv.rating>=4; });
    var container=document.getElementById('reviewsList');
    if(!good.length){
      container.innerHTML='<div style="text-align:center;color:var(--md);font-size:12px;padding:2rem;grid-column:1/-1" class="t" data-mn="Одоогоор сэтгэгдэл байхгүй. Анхны сэтгэгдэлээ үлдээгээрэй!" data-ko="아직 리뷰가 없습니다. 첫 번째 리뷰를 남겨주세요!" data-en="No reviews yet. Be the first to leave one!">Одоогоор сэтгэгдэл байхгүй. Анхны сэтгэгдэлээ үлдээгээрэй!</div>';
      return;
    }
    container.innerHTML=good.map(function(rv){
      var stars='★'.repeat(rv.rating)+'☆'.repeat(5-rv.rating);
      var d=new Date(rv.created_at);
      var monthYear=d.toLocaleDateString('mn-MN',{year:'numeric',month:'long'});
      var imgHtml=rv.imageUrl
        ?'<div style="margin-bottom:.8rem;overflow:hidden;border:.5px solid #e2dbd7"><img src="'+esc(rv.imageUrl)+'" style="width:100%;height:160px;object-fit:cover;display:block" loading="lazy" onerror="this.parentNode.style.display=\'none\'"></div>'
        :'';
      return '<div class="review-card">'
        +imgHtml
        +'<p class="review-stars">'+stars+'</p>'
        +'<p class="review-name">'+esc(rv.name)+' · '+monthYear+'</p>'
        +'<p class="review-comment">'+esc(rv.comment)+'</p>'
        +'</div>';
    }).join('');
  } catch(e){
    document.getElementById('reviewsList').innerHTML='';
  }
}

// ---- Сэтгэгдэл илгээх ----
async function submitReview(e){
  e.preventDefault();
  var btn=document.getElementById('reviewSubmitBtn');
  btn.disabled=true;
  var res=document.getElementById('reviewResult');
  res.innerHTML='<span style="color:#a09890">'+{mn:'Илгээж байна...',ko:'업로드 중...',en:'Submitting...'}[currentLang]+'</span>';
  try{
    var imgFile=document.getElementById('rv_image').files[0];
    var imageData=null;
    if(imgFile) imageData=await compressImage(imgFile);

    var r=await fetch('/api/reviews',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        name:    document.getElementById('rv_name').value.trim(),
        rating:  currentRating,
        comment: document.getElementById('rv_comment').value.trim(),
        imageData: imageData,
      })
    });
    var json=await safeJson(r);
    if(!r.ok) throw new Error(json.error||'Алдаа');
    res.innerHTML='<span style="color:#6b9e6b">'+{ko:'리뷰가 등록되었습니다 감사합니다!',mn:'Сэтгэгдэл амжилттай илгээгдлээ!',en:'Review submitted, thank you!'}[currentLang]+'</span>';
    document.getElementById('reviewForm').reset();
    clearReviewImg();
    setRating(5);
    setTimeout(loadReviews, 800);
  } catch(err){
    res.innerHTML='<span style="color:#c06">'+err.message+'</span>';
  } finally{
    btn.disabled=false;
  }
}

// ---- B2B илгээх ----
async function submitB2B(e){
  e.preventDefault();
  var btn=document.getElementById('b2bSubmitBtn');
  btn.disabled=true; btn.textContent='...';
  var res=document.getElementById('b2bResult');
  try{
    var r=await fetch('/api/b2b',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        company:document.getElementById('b2b_company').value.trim(),
        contact_name:document.getElementById('b2b_name').value.trim(),
        phone:document.getElementById('b2b_phone').value.trim(),
        email:document.getElementById('b2b_email').value.trim(),
        message:document.getElementById('b2b_message').value.trim()
      })
    });
    var json=await safeJson(r);
    if(!r.ok) throw new Error(json.error||'Алдаа');
    res.innerHTML='<span style="color:rgba(255,255,255,.8)">'+{ko:'문의가 접수되었습니다. 48시간 이내에 연락드리겠습니다.',mn:'Таны хүсэлт хүлээн авлаа. 48 цагийн дотор холбогдох болно.',en:'Your inquiry has been received. We\'ll contact you within 48 hours.'}[currentLang]+'</span>';
    document.getElementById('b2bForm').reset();
  } catch(err){
    res.innerHTML='<span style="color:#f99">'+err.message+'</span>';
  } finally{
    btn.disabled=false;
    btn.textContent={ko:'문의하기',mn:'Илгээх',en:'Send Inquiry'}[currentLang];
  }
}

// ── SHADE FINDER ──
var _sfTone = null;

var SF_RECOMMEND = {
  1: {cool:'21', neutral:'21', warm:'21'},
  2: {cool:'21', neutral:'21', warm:'22'},
  3: {cool:'21', neutral:'22', warm:'22'},
  4: {cool:'22', neutral:'22', warm:'23'},
  5: {cool:'22', neutral:'23', warm:'23'},
};

var SF_SHADES = {
  '21': {
    color: '#F5DBCA',
    num: 'No. 21',
    name: {mn:'Цайвар',   ko:'라이트',       en:'Light'},
    desc: {
      mn: 'Маш цайвар болон цайвар арьстай хэрэглэгчдэд зориулагдсан. Байгалийн нарийн бүрхэлт нь арьсны гэрэлтэй тунгалаг өнгийг онцолж, тухтай мэдрэмж үлдээнэ.',
      ko: '매우 밝고 화사한 피부 톤에 어울리는 쉐이드. 자연스러운 커버력으로 맑고 투명한 피부 표현.',
      en: 'Designed for very fair to fair skin. Provides natural, lightweight coverage that enhances skin\'s natural luminosity.',
    },
  },
  '22': {
    color: '#E8C49A',
    num: 'No. 22',
    name: {mn:'Байгалийн', ko:'내추럴',       en:'Natural'},
    desc: {
      mn: 'Дундаж цайвар арьстай хэрэглэгчдэд тохирно. Арьсны байгалийн өнгийг хадгалж, жигд нарийн бүрхэлт үзүүлнэ. Өдөр тутмын хамгийн алдартай shade.',
      ko: '밝은~중간 피부 톤에 어울리는 베스트셀러 쉐이드. 자연스러운 피부색을 살리며 균일한 커버력 제공.',
      en: 'Best-seller for light to medium skin. Maintains your natural skin colour with even, buildable coverage.',
    },
  },
  '23': {
    color: '#D4AA78',
    num: 'No. 23',
    name: {mn:'Байгалийн Беж', ko:'내추럴 베이지', en:'Natural Beige'},
    desc: {
      mn: 'Дунд болон дулаан undertone-тэй арьстай хэрэглэгчдэд зориулагдсан. Гүнзгий тэгш бүрхэлт, байгалийн дулаан шаргал өнгийг нэмж, нүдэнд хүрэхуйц дүрс бүтээнэ.',
      ko: '중간~어두운 피부 톤에 어울리는 쉐이드. 깊고 균일한 커버력에 따뜻한 베이지 피니시.',
      en: 'Ideal for medium to tan skin with warm undertones. Rich, even coverage with a warm beige finish.',
    },
  },
};

function sfGoStep(n) {
  document.getElementById('sf-step1').style.display = n===1?'':'none';
  document.getElementById('sf-step2').style.display = n===2?'':'none';
  document.getElementById('sf-result').style.display = n==='r'?'':'none';
  ['sfi-1','sfi-2','sfi-r'].forEach(function(id,i){
    var el=document.getElementById(id);
    el.classList.remove('active','done');
    if(i+1===n) el.classList.add('active');
    else if(i+1<n||(n==='r')) el.classList.add('done');
  });
  if(n==='r'){
    document.getElementById('sfi-r').classList.remove('done');
    document.getElementById('sfi-r').classList.add('active');
    document.getElementById('sfi-1').classList.add('done');
    document.getElementById('sfi-2').classList.add('done');
  }
  document.getElementById('sf').scrollIntoView({behavior:'smooth',block:'center'});
}

function sfSelectTone(t) {
  _sfTone = t;
  document.querySelectorAll('.sf-skin').forEach(function(el){
    el.classList.toggle('selected', Number(el.getAttribute('data-tone'))===t);
  });
  setTimeout(function(){ sfGoStep(2); }, 320);
}

function sfSelectUndertone(ut) {
  if(!_sfTone) return;
  document.querySelectorAll('.sf-ut').forEach(function(el){
    el.classList.toggle('selected', el.getAttribute('data-ut')===ut);
  });
  var shadeNum = SF_RECOMMEND[_sfTone][ut];
  var s = SF_SHADES[shadeNum];
  var lang = typeof currentLang!=='undefined' ? currentLang : 'mn';

  document.getElementById('sfResultSwatch').style.background = s.color;
  document.getElementById('sfResultNum').textContent = s.num;
  document.getElementById('sfResultName').textContent = s.name[lang]||s.name.mn;
  document.getElementById('sfResultDesc').textContent = s.desc[lang]||s.desc.mn;

  // "Мөн … тохирч болно" hint
  var alsoMap = {cool:'Хүйтэн',neutral:'Дундаж',warm:'Дулаан'};
  var toneMap = {1:'маш цайвар',2:'цайвар',3:'дундаж цайвар',4:'дунд',5:'дунд боровтор'};
  var alsoEl = document.getElementById('sfResultAlso');
  alsoEl.textContent = toneMap[_sfTone]+', '+alsoMap[ut]+' undertone — '+s.num;

  setTimeout(function(){ sfGoStep('r'); }, 280);
}

function sfReset() {
  _sfTone = null;
  document.querySelectorAll('.sf-skin').forEach(function(el){ el.classList.remove('selected'); });
  document.querySelectorAll('.sf-ut').forEach(function(el){ el.classList.remove('selected'); });
  document.getElementById('sfi-1').classList.remove('done');
  document.getElementById('sfi-2').classList.remove('done','active');
  document.getElementById('sfi-r').classList.remove('done','active');
  sfGoStep(1);
}

function esc(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ---- Эхлүүлэх ----
document.addEventListener('DOMContentLoaded',function(){
  setRating(5);
  setLang('mn');
  loadReviews();
});
