var currentLang='ko';
var currentRating=5;

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
function updateModalPrice(){
  var qty=Number(document.getElementById('o_qty').value)||1;
  var total=62010*qty;
  document.getElementById('modalPriceTotal').innerHTML='Нийт: <strong>'+total.toLocaleString()+'₮</strong>';
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
  document.getElementById('orderModal').style.display='none';
  document.body.style.overflow='';
  document.getElementById('orderForm').reset();
  document.getElementById('orderResult').innerHTML='';
  updateModalPrice();
}

// ---- Захиалга илгээх ----
async function submitOrder(e){
  e.preventDefault();
  var btn=document.getElementById('orderSubmitBtn');
  btn.disabled=true; btn.textContent='...';
  var data={
    name:document.getElementById('o_name').value.trim(),
    phone:document.getElementById('o_phone').value.trim(),
    address:document.getElementById('o_address').value.trim(),
    quantity:Number(document.getElementById('o_qty').value),
    include_vat:false,
    uid:window._currentUid||null
  };
  var res=document.getElementById('orderResult');
  try{
    var r=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    var json=await r.json();
    if(!r.ok) throw new Error(json.error||'Алдаа гарлаа');
    if(json.qpay&&json.qpay.qr_image){
      res.innerHTML='<div class="qr-wrap"><p class="or-no">Захиалга №'+json.order_no+'</p><img src="data:image/png;base64,'+json.qpay.qr_image+'" class="qr-img" alt="QPay QR"><p class="qr-hint">QPay апп-аар уншуулан төлнө үү</p><p class="qr-amt">'+json.amount.toLocaleString()+'₮</p></div>';
    } else {
      res.innerHTML='<div class="or-success"><p class="or-no">Захиалга №'+json.order_no+' бүртгэгдлээ!</p><p>Бид тантай удахгүй холбоо барих болно.</p>'+(json.warning?'<p class="or-warn">'+json.warning+'</p>':'')+'</div>';
    }
    document.getElementById('orderForm').style.display='none';
    if(typeof window._logOrder==='function') window._logOrder(json.order_no, json.amount);
  } catch(err){
    res.innerHTML='<p class="or-err">'+err.message+'</p>';
  } finally{
    btn.disabled=false;
    btn.textContent={mn:'Захиалах',ko:'주문하기',en:'Order'}[currentLang]||'주문하기';
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

// ---- Сэтгэгдэл ачаалах ----
async function loadReviews(){
  try{
    var r=await fetch('/api/reviews');
    var list=await r.json();
    var container=document.getElementById('reviewsList');
    if(!list.length){
      container.innerHTML='<div style="text-align:center;color:var(--md);font-size:12px;padding:2rem;grid-column:1/-1">'
        +{ko:'아직 리뷰가 없습니다. 첫 번째 리뷰를 남겨주세요!',mn:'Одоогоор сэтгэгдэл байхгүй. Анхны сэтгэгдэлээ үлдээгээрэй!',en:'No reviews yet. Be the first to leave one!'}[currentLang]
        +'</div>';
      return;
    }
    container.innerHTML=list.map(function(rv){
      var stars='★'.repeat(rv.rating)+'☆'.repeat(5-rv.rating);
      var date=new Date(rv.created_at).toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'});
      return '<div class="review-card"><p class="review-stars">'+stars+'</p><p class="review-name">'+esc(rv.name)+' · '+date+'</p><p class="review-comment">'+esc(rv.comment)+'</p></div>';
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
  try{
    var r=await fetch('/api/reviews',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        name:document.getElementById('rv_name').value.trim(),
        rating:currentRating,
        comment:document.getElementById('rv_comment').value.trim()
      })
    });
    var json=await r.json();
    if(!r.ok) throw new Error(json.error||'Алдаа');
    res.innerHTML='<span style="color:#6b9e6b">'+{ko:'리뷰가 등록되었습니다 감사합니다!',mn:'Сэтгэгдэл амжилттай илгээгдлээ!',en:'Review submitted, thank you!'}[currentLang]+'</span>';
    document.getElementById('reviewForm').reset();
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
    var json=await r.json();
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

function esc(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ---- Эхлүүлэх ----
document.addEventListener('DOMContentLoaded',function(){
  setRating(5);
  setLang('ko');
  loadReviews();
});
