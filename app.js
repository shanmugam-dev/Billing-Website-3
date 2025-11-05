const config = {
  shopName: "My Restaurant",
  shopAddress: "123, Main Road, City",
  upiId: "shanmugam786358-1@okaxis",
  taxRatePercent: 0,
};

const storageKeys = {
  menu: "restaurant.menu",
  cart: "restaurant.cart",
  sales: "restaurant.sales",
  version: "restaurant.version",
  settings: "restaurant.settings",
};

const DATA_VERSION = 2; // bump when changing seed data (e.g., image URLs)

function $(sel){return document.querySelector(sel)}
function $all(sel){return Array.from(document.querySelectorAll(sel))}

function showToast(message){
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"), 1200);
}

function loadFromStorage(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch(e){ return fallback }
}
function saveToStorage(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

function loadSettings(){
  const s = loadFromStorage(storageKeys.settings, null);
  return s || { upiId: config.upiId, qrUrl: null };
}
function saveSettings(s){ saveToStorage(storageKeys.settings, s); }


function seedDefaultMenu(){
  const existing = loadFromStorage(storageKeys.menu, null);
  const currentVersion = loadFromStorage(storageKeys.version, 0);
  if(existing && currentVersion === DATA_VERSION){
    return existing;
  }
  const seeded = [
    { id: crypto.randomUUID(), name: "Idly", price: 20, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4f/Idli_Sambar.jpg", isAvailable: true },
    { id: crypto.randomUUID(), name: "Dosa", price: 40, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5f/Masala_dosa.jpg", isAvailable: true },
    { id: crypto.randomUUID(), name: "Poori", price: 35, imageUrl: "https://i.pinimg.com/564x/1c/be/ac/1cbeacdf93d762cba6b5fafda2e317ee.jpg", isAvailable: true },
    { id: crypto.randomUUID(), name: "Vada", price: 15, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/9/9b/Medu_Vada.jpg", isAvailable: true },
    { id: crypto.randomUUID(), name: "Pongal", price: 30, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/89/Ven_Pongal.jpg", isAvailable: true },
    { id: crypto.randomUUID(), name: "Coffee", price: 20, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/45/A_South_Indian_filter_coffee.jpg", isAvailable: true },
    { id: crypto.randomUUID(), name: "Puttu", price: 45, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/2/26/Puttu_with_kadala_curry.jpg", isAvailable: true },
  ];
  if(!existing){
    saveToStorage(storageKeys.menu, seeded);
    saveToStorage(storageKeys.version, DATA_VERSION);
    return seeded;
  }
  // Migration: update image URLs for known items by name
  const nameToImg = new Map(seeded.map(s=>[s.name.toLowerCase(), s.imageUrl]));
  existing.forEach(item=>{
    const newImg = nameToImg.get(String(item.name||"").toLowerCase());
    if(newImg){ item.imageUrl = newImg; }
  });
  saveToStorage(storageKeys.menu, existing);
  saveToStorage(storageKeys.version, DATA_VERSION);
  return existing;
}

function getMenu(){
  return loadFromStorage(storageKeys.menu, []);
}
function saveMenu(menu){
  saveToStorage(storageKeys.menu, menu);
}

function getCart(){
  return loadFromStorage(storageKeys.cart, { items: [], subtotal:0, tax:0, total:0 });
}
function saveCart(cart){
  saveToStorage(storageKeys.cart, cart);
}
function clearCart(){
  saveToStorage(storageKeys.cart, { items: [], subtotal:0, tax:0, total:0 });
  renderCart();
}

function appendSale(sale){
  const sales = loadFromStorage(storageKeys.sales, []);
  sales.push(sale);
  saveToStorage(storageKeys.sales, sales);
}

function recalcTotals(cart){
  const subtotal = cart.items.reduce((sum, li)=> sum + li.qty * li.price, 0);
  const tax = Math.round(subtotal * (config.taxRatePercent/100) * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  cart.subtotal = subtotal;
  cart.tax = tax;
  cart.total = total;
}

function addToCart(itemId){
  const menu = getMenu();
  const item = menu.find(m=>m.id===itemId);
  if(!item || !item.isAvailable) return;
  const cart = getCart();
  const existing = cart.items.find(li=>li.itemId===itemId);
  if(existing){ existing.qty += 1; }
  else { cart.items.push({ itemId, name:item.name, qty:1, price:item.price }); }
  recalcTotals(cart);
  saveCart(cart);
  renderCart();
  showToast(`${item.name} added`);
}
function updateQty(itemId, delta){
  const cart = getCart();
  const li = cart.items.find(x=>x.itemId===itemId);
  if(!li) return;
  li.qty += delta;
  if(li.qty <= 0){ cart.items = cart.items.filter(x=>x.itemId!==itemId); }
  recalcTotals(cart);
  saveCart(cart);
  renderCart();
}
function removeFromCart(itemId){
  const cart = getCart();
  cart.items = cart.items.filter(x=>x.itemId!==itemId);
  recalcTotals(cart);
  saveCart(cart);
  renderCart();
}

function renderMenu(){
  const grid = $("#menuGrid");
  const q = $("#menuSearch").value.trim().toLowerCase();
  const onlyAvail = $("#onlyAvailable").checked;
  const menu = getMenu().filter(m => {
    if(onlyAvail && !m.isAvailable) return false;
    return m.name.toLowerCase().includes(q);
  });
  grid.innerHTML = menu.map(m => `
    <div class="menu-card" data-id="${m.id}">
      <img src="${m.imageUrl}" alt="${m.name}" loading="lazy" onerror="this.onerror=null;this.src="assets/menu/placeholder.svg">
      <div class="meta">
        <div>
          <div>${m.name}</div>
          <div class="badge">${m.isAvailable?"Available":"Sold out"}</div>
        </div>
        <div class="price">₹${m.price.toFixed(2)}</div>
      </div>
    </div>
  `).join("");

  $all(".menu-card").forEach(card=>{
    card.addEventListener("click", ()=> addToCart(card.dataset.id));
  });
}

function renderCart(){
  const cart = getCart();
  const wrap = $("#cartItems");
  if(cart.items.length===0){
    wrap.innerHTML = `<div style="padding:12px;color:#94a3b8">Cart is empty</div>`;
  }else{
    wrap.innerHTML = cart.items.map(li => `
      <div class="cart-line" data-id="${li.itemId}">
        <div>${li.name}</div>
        <div class="qty">
          <button class="dec">-</button>
          <span>${li.qty}</span>
          <button class="inc">+</button>
        </div>
        <div>₹${li.price.toFixed(2)}</div>
        <div class="line-total">₹${(li.qty*li.price).toFixed(2)}</div>
      </div>
    `).join("");
  }
  $("#subtotal").textContent = `₹${cart.subtotal.toFixed(2)}`;
  $("#tax").textContent = `₹${cart.tax.toFixed(2)}`;
  $("#grandTotal").textContent = `₹${cart.total.toFixed(2)}`;

  $all(".cart-line").forEach(line=>{
    const id = line.dataset.id;
    line.querySelector(".inc").addEventListener("click", ()=> updateQty(id, +1));
    line.querySelector(".dec").addEventListener("click", ()=> updateQty(id, -1));
  });
}

function openQrModal(){
  const modal = $("#qrModal");
  const img = $("#upiQrImg");
  const s = loadSettings();
  const upiId = (s.upiId || config.upiId).trim();
  const payeeName = encodeURIComponent(config.shopName || "");
  const upiDeepLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${payeeName}`;
  const generatedQr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiDeepLink)}`;
  const chosen = (s.qrUrl && s.qrUrl.trim()) ? s.qrUrl.trim() : generatedQr;
  img.onerror = () => { img.onerror = null; img.src = "assets/qr/upi.svg"; };
  img.src = chosen;
  $("#upiIdModal").textContent = upiId;
  if(!modal.open) modal.showModal();
}
function closeQrModal(){
  const modal = $("#qrModal");
  if(modal.open) modal.close();
}

function fillReceipt(){
  $("#receiptShopName").textContent = config.shopName;
  $("#receiptShopAddress").textContent = config.shopAddress;
  $("#receiptDate").textContent = new Date().toLocaleString();
  const cart = getCart();
  const body = cart.items.map(li=>
    `<div class="row"><span>${li.name} x ${li.qty}</span><span>₹${(li.qty*li.price).toFixed(2)}</span></div>`
  ).join("");
  $("#receiptBody").innerHTML = body;
  $("#receiptSubtotal").textContent = `₹${cart.subtotal.toFixed(2)}`;
  $("#receiptTax").textContent = `₹${cart.tax.toFixed(2)}`;
  $("#receiptTotal").textContent = `₹${cart.total.toFixed(2)}`;
}

function printReceipt(){
  fillReceipt();
  window.print();
}

function completeSale(){
  const cart = getCart();
  if(cart.items.length === 0){ showToast("Cart is empty"); return; }
  const sale = {
    id: crypto.randomUUID(),
    timestampISO: new Date().toISOString(),
    items: cart.items,
    subtotal: cart.subtotal,
    tax: cart.tax,
    total: cart.total,
    paymentMethod: "UPI",
  };
  appendSale(sale);
  clearCart();
  showToast("Sale recorded");
}

function getMonthlySales(year, month /* 0-11 */){
  const sales = loadFromStorage(storageKeys.sales, []);
  return sales.filter(s => {
    const d = new Date(s.timestampISO);
    return d.getFullYear()===year && d.getMonth()===month;
  });
}
function renderReport(){
  const y = parseInt($("#reportYear").value, 10);
  const m = parseInt($("#reportMonth").value, 10);
  const sales = getMonthlySales(y, m);
  const byDay = new Map();
  let totalRevenue = 0;
  sales.forEach(s=>{
    totalRevenue += s.total;
    const d = new Date(s.timestampISO); const key = d.toISOString().slice(0,10);
    const cur = byDay.get(key) || { orders:0, revenue:0 };
    cur.orders += 1; cur.revenue += s.total;
    byDay.set(key, cur);
  });
  const tbody = $("#reportTable tbody");
  const rows = Array.from(byDay.entries()).sort((a,b)=>a[0]>b[0]?1:-1).map(([day, data])=>
    `<tr><td>${day}</td><td>${data.orders}</td><td>${data.revenue.toFixed(2)}</td></tr>`
  ).join("");
  tbody.innerHTML = rows;
  $("#reportSummary").innerHTML = `
    <div class="summary-card">Orders: <strong>${sales.length}</strong></div>
    <div class="summary-card">Revenue: <strong>₹${totalRevenue.toFixed(2)}</strong></div>
  `;
}

function exportMonthlyCsv(){
  const y = parseInt($("#reportYear").value, 10);
  const m = parseInt($("#reportMonth").value, 10);
  const sales = getMonthlySales(y, m);
  const header = ["id","timestamp","items","subtotal","tax","total","paymentMethod"];
  const lines = [header.join(",")];
  sales.forEach(s=>{
    const itemsStr = s.items.map(i=>`${i.name} x${i.qty}@${i.price}`).join(";");
    lines.push([s.id, s.timestampISO, '"'+itemsStr+'"', s.subtotal, s.tax, s.total, s.paymentMethod].join(","));
  });
  const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `sales-${y}-${String(m+1).padStart(2,'0')}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function refreshAdminTable(){
  const menu = getMenu();
  const tbody = $("#adminTable tbody");
  const q = ($("#adminSearch")?.value || "").trim().toLowerCase();
  const filtered = q ? menu.filter(m=> m.name.toLowerCase().includes(q)) : menu;
  tbody.innerHTML = filtered.map(m=> `
    <tr data-id="${m.id}">
      <td><img src="${m.imageUrl}" alt="${m.name}"></td>
      <td>${m.name}</td>
      <td>₹${m.price.toFixed(2)}</td>
      <td><input type="checkbox" class="toggleAvail" ${m.isAvailable?"checked":""}></td>
      <td>
        <span class="action-group">
          <button class="action edit">Edit</button>
          <button class="action delete">Delete</button>
        </span>
      </td>
    </tr>
  `).join("");

  $all("#adminTable tbody tr").forEach(row=>{
    const id = row.dataset.id;
    row.querySelector(".toggleAvail").addEventListener("change", (e)=>{
      const menu = getMenu();
      const it = menu.find(x=>x.id===id); if(!it) return;
      it.isAvailable = e.target.checked; saveMenu(menu); renderMenu();
    });
    row.querySelector(".edit").addEventListener("click", ()=>{
      openEditItem(id);
    });
    row.querySelector(".delete").addEventListener("click", ()=>{
      openDeleteConfirm(id);
    });
  });
}

function openEditItem(id){
  const menu = getMenu();
  const it = menu.find(x=>x.id===id);
  if(!it) return;
  $("#editItemId").value = it.id;
  $("#itemName").value = it.name;
  $("#itemPrice").value = String(it.price);
  $("#itemImageUrl").value = it.imageUrl;
  $("#itemAvailable").checked = !!it.isAvailable;
  window.scrollTo({top:0, behavior:'smooth'});
}

let pendingDeleteId = null;
function openDeleteConfirm(id){
  pendingDeleteId = id;
  $("#confirmModal").showModal();
}
function closeDeleteConfirm(){
  pendingDeleteId = null; $("#confirmModal").close();
}
function confirmDelete(){
  if(!pendingDeleteId) return closeDeleteConfirm();
  const menu = getMenu().filter(x=>x.id!==pendingDeleteId);
  saveMenu(menu); pendingDeleteId = null; closeDeleteConfirm();
  renderMenu(); refreshAdminTable();
}

function readFileAsDataURL(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function saveItem(e){
  e.preventDefault();
  const id = $("#editItemId").value || null;
  const name = $("#itemName").value.trim();
  const price = parseFloat($("#itemPrice").value);
  const urlInput = $("#itemImageUrl").value.trim();
  const fileInput = $("#itemImageFile");
  const file = fileInput ? fileInput.files[0] : null;
  let imageUrl = urlInput;
  if(file){ try{ imageUrl = await readFileAsDataURL(file); }catch(_){} }
  if(!imageUrl) imageUrl = "assets/menu/placeholder.svg";
  const isAvailable = $("#itemAvailable").checked;
  if(!name || Number.isNaN(price)) return;
  const menu = getMenu();
  if(id){
    const it = menu.find(x=>x.id===id); if(!it) return;
    it.name = name; it.price = price; it.imageUrl = imageUrl || it.imageUrl; it.isAvailable = isAvailable;
  }else{
    menu.push({ id: crypto.randomUUID(), name, price, imageUrl, isAvailable });
  }
  saveMenu(menu);
  $("#addItemForm").reset(); $("#editItemId").value = "";
  if($("#itemImagePreview")) $("#itemImagePreview").src = "assets/menu/placeholder.svg";
  renderMenu(); refreshAdminTable(); showToast("Saved");
}

function switchTab(targetSel){
  $all('.panel').forEach(p=>p.classList.remove('active'));
  $all('.tab').forEach(t=>t.classList.remove('active'));
  const btn = $all('.tab').find(b=>b.dataset.target===targetSel);
  const panel = document.querySelector(targetSel);
  if(btn) btn.classList.add('active');
  if(panel) panel.classList.add('active');
}

function initSelectors(){
  const now = new Date();
  const monthSel = $("#reportMonth");
  const yearSel = $("#reportYear");
  monthSel.innerHTML = Array.from({length:12},(_,i)=>`<option value="${i}" ${i===now.getMonth()?"selected":""}>${i+1}</option>`).join("");
  const curYear = now.getFullYear();
  yearSel.innerHTML = Array.from({length:6},(_,i)=>curYear-4+i).map(y=>`<option value="${y}" ${y===curYear?"selected":""}>${y}</option>`).join("");
}

function hydrateHeader(){
  const s = loadSettings();
  $("#shopName").textContent = config.shopName;
  $("#upiIdLabel").textContent = s.upiId || config.upiId;
  $("#upiIdModal").textContent = s.upiId || config.upiId;
}

function init(){
  seedDefaultMenu();
  hydrateHeader();
  initSelectors();
  renderMenu();
  renderCart();
  refreshAdminTable();

  // Tabs
  $all('.tab').forEach(btn=> btn.addEventListener('click', ()=> switchTab(btn.dataset.target)) );
  // Menu search/filter
  $("#menuSearch").addEventListener("input", renderMenu);
  $("#onlyAvailable").addEventListener("change", renderMenu);
  // Cart actions
  $("#clearCartBtn").addEventListener("click", ()=> { clearCart(); showToast("Cart cleared"); });
  $("#payNowBtn").addEventListener("click", openQrModal);
  $("#printBtn").addEventListener("click", printReceipt);
  $("#completeSaleBtn").addEventListener("click", completeSale);
  // QR modal
  $("#closeQrBtn").addEventListener("click", closeQrModal);
  // Admin
  $("#addItemForm").addEventListener("submit", saveItem);
  $("#resetItemBtn").addEventListener("click", (e)=> { e.preventDefault(); $("#addItemForm").reset(); $("#editItemId").value=""; });
  $("#cancelDeleteBtn").addEventListener("click", closeDeleteConfirm);
  $("#confirmDeleteBtn").addEventListener("click", confirmDelete);
  // Admin tabs
  $all('.admin-tab').forEach(btn=> btn.addEventListener('click', ()=>{
    $all('.admin-tab').forEach(b=>b.classList.remove('active'));
    $all('.admin-pane').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    const pane = document.querySelector(btn.dataset.adminTarget);
    if(pane) pane.classList.add('active');
  }));
  // Payment settings form
  const upiForm = $("#upiForm");
  if(upiForm){
    const s = loadSettings();
    $("#adminUpiId").value = s.upiId || "";
    $("#adminQrUrl").value = s.qrUrl || "";
    upiForm.addEventListener("submit", (e)=>{
      e.preventDefault();
      const upiId = $("#adminUpiId").value.trim();
      const qrUrl = $("#adminQrUrl").value.trim();
      saveSettings({ upiId: upiId || config.upiId, qrUrl: qrUrl || null });
      hydrateHeader();
      showToast("Payment settings saved");
    });
  }
  // Reports
  $("#runReportBtn").addEventListener("click", renderReport);
  $("#exportCsvBtn").addEventListener("click", exportMonthlyCsv);
  // Admin search
  const adminSearch = $("#adminSearch");
  if(adminSearch){ adminSearch.addEventListener("input", refreshAdminTable); }
  const fileIn = $("#itemImageFile");
  if(fileIn){
    fileIn.addEventListener("change", async (e)=>{
      const file = e.target.files && e.target.files[0];
      if(!file) return;
      try{ $("#itemImagePreview").src = await readFileAsDataURL(file); }catch(_){}
    });
  }
  const applyBtn = $("#applyImageBtn");
  if(applyBtn){
    applyBtn.addEventListener("click", async ()=>{
      const file = $("#itemImageFile").files && $("#itemImageFile").files[0];
      if(!file){ showToast("Choose an image first"); return; }
      try{
        const dataUrl = await readFileAsDataURL(file);
        $("#itemImagePreview").src = dataUrl;
        $("#itemImageUrl").value = dataUrl;
        const editId = $("#editItemId").value;
        if(editId){
          const menu = getMenu();
          const it = menu.find(x=>x.id===editId);
          if(it){ it.imageUrl = dataUrl; saveMenu(menu); renderMenu(); refreshAdminTable(); showToast("Image applied"); }
        } else {
          showToast("Image ready to save");
        }
      }catch(_){ showToast("Failed to apply image"); }
    });
  }
}

document.addEventListener('DOMContentLoaded', init);


