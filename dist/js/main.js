var isVat=false;
var currentLang='mn';

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

// Захиалгын modal нээх
function openOrderModal(){
  document.getElementById('orderModal').style.display='flex';
  document.body.style.overflow='hidden';
}
function closeOrderModal(){
  document.getElementById('orderModal').style.display='none';
  document.body.style.overflow='';
  document.getElementById('orderForm').reset();
  document.getElementById('orderResult').innerHTML='';
}

// Захиалга илгээх
async function submitOrder(e){
  e.preventDefault();
  var btn=document.getElementById('orderSubmitBtn');
  btn.disabled=true;
  btn.textContent='...';
  var data={
    name:document.getElementById('o_name').value.trim(),
    phone:document.getElementById('o_phone').value.trim(),
    address:document.getElementById('o_address').value.trim(),
    quantity:Number(document.getElementById('o_qty').value),
    include_vat:isVat,
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
    btn.textContent={mn:'Захиалах',ko:'주문하기',en:'Order'}[currentLang]||'Захиалах';
  }
}
function showVat(v){
  isVat=v;
  document.getElementById('vatBtn').classList.toggle('active',v);
  document.getElementById('novatBtn').classList.toggle('active',!v);
  document.getElementById('priceDisplay').textContent=v?'67,900₮':'61,110₮';
  var l=document.querySelector('.lb.active').id;
  l=l==='bn'?'mn':l==='bk'?'ko':'en';
  var n={mn:[' НӨЭТ-гүй үнэ','НӨЭТ-тэй үнэ'],ko:['부가세 제외 가격','부가세 포함 가격'],en:['Price excl. VAT','Price incl. VAT']};
  document.getElementById('priceNote').textContent=n[l][v?1:0];
}
function setLang(l){
  currentLang=l;
  if(typeof window._logLang==='function') window._logLang(l);
  document.querySelectorAll('.lb').forEach(function(b){b.classList.remove('active');});
  document.getElementById(l==='mn'?'bn':l==='ko'?'bk':'be').classList.add('active');
  document.querySelectorAll('.t').forEach(function(el){var v=el.getAttribute('data-'+l);if(v)el.innerHTML=v;});
  var n={mn:[' НӨЭТ-гүй үнэ','НӨЭТ-тэй үнэ'],ko:['부가세 제외 가격','부가세 포함 가격'],en:['Price excl. VAT','Price incl. VAT']};
  document.getElementById('priceNote').textContent=n[l][isVat?1:0];
}