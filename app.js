/* ===================================================================
   WALLACE POS — Plataforma SaaS multiempresa
   HTML + JS puro. Sin compilar. Guardado local (luego Firebase).
   =================================================================== */

/* ---------- CAPA DE DATOS (local + Firebase en la nube) ---------- */
const CACHE = {};
let FB_READY = false, fbDB = null;

const DB = {
  get(k){ if(k in CACHE) return CACHE[k];
    try{ const v=localStorage.getItem('w_'+k); CACHE[k]=v?JSON.parse(v):null; }catch(e){ CACHE[k]=null; }
    return CACHE[k];
  },
  set(k,v){ CACHE[k]=v;
    try{ localStorage.setItem('w_'+k, JSON.stringify(v)); }catch(e){}
    if(FB_READY && fbDB){ try{ fbDB.ref('data/'+k).set(v===undefined?null:v); }catch(e){ console.warn('FB set',e); } }
  },
};

/* ---------- Conexión a Firebase (si hay llaves configuradas) ---------- */
function initFirebase(){
  const cfg = window.FIREBASE_CONFIG;
  if(!cfg || !cfg.apiKey || cfg.apiKey.indexOf('PEGA_AQUI')===0){
    console.log('Wallace: modo local (sin Firebase). Pega tus llaves en firebase-config.js para activar la nube.');
    return false;
  }
  if(typeof firebase === 'undefined'){ console.warn('Firebase no cargó'); return false; }
  try{
    firebase.initializeApp(cfg);
    fbDB = firebase.database();
    FB_READY = true;
    // Escuchar cambios en la nube y refrescar la pantalla en tiempo real
    fbDB.ref('data').on('value', (snap)=>{
      const data = snap.val();
      if(data){
        Object.keys(data).forEach(k=>{ CACHE[k]=data[k]; try{ localStorage.setItem('w_'+k, JSON.stringify(data[k])); }catch(e){} });
        // si ya hay sesión abierta, refrescar la vista actual
        if(STATE.user){ try{ STATE.user.rol==='superadmin'?renderPortal():renderShell(); }catch(e){} }
      } else {
        // primera vez: subir los datos locales (semilla) a la nube
        ['empresas','usuarios','categorias','productos','mesas','clientes','ventas','caja','domicilios','init']
          .forEach(k=>{ if(DB.get(k)!=null) fbDB.ref('data/'+k).set(DB.get(k)); });
      }
    });
    console.log('Wallace: conectado a Firebase (nube activa).');
    return true;
  }catch(e){ console.warn('Error Firebase:',e); return false; }
}

/* ---------- HELPERS ---------- */
const $ = (id) => document.getElementById(id);
const ic = (id) => `<svg class="ic"><use href="#${id}"/></svg>`;
const money = (n) => '$' + (Math.round(n)||0).toLocaleString('es-CO');
const uid = () => '_'+Math.random().toString(36).substr(2,9);
const nowISO = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0,10);
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});
const fmtDate = (iso) => new Date(iso).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'});
const esc = (s) => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- CATÁLOGOS ---------- */
const ROLES = {
  superadmin:{nombre:'Super Admin',color:'#B58DB6'},
  admin:{nombre:'Administrador',color:'#C38D5F'},
  gerente:{nombre:'Gerente',color:'#7BA7BC'},
  cajero:{nombre:'Cajero',color:'#6BAF92'},
  mesero:{nombre:'Mesero',color:'#E8A87C'},
};
const PLANES = {
  Starter:{color:'#7BA7BC',precio:89000,modulos:['pos','caja','config']},
  Pro:{color:'#C38D5F',precio:189000,modulos:['dashboard','pos','caja','inventario','domicilios','clientes','reportes','config']},
  Premium:{color:'#B58DB6',precio:349000,modulos:['dashboard','pos','caja','inventario','domicilios','clientes','reportes','config','ia']},
};
const PERMISOS = {
  superadmin:['portal'],
  admin:['dashboard','pos','caja','inventario','domicilios','clientes','reportes','config','ia'],
  gerente:['dashboard','inventario','reportes','clientes','ia'],
  cajero:['pos','caja','domicilios','clientes'],
  mesero:['pos'],
};
const NAV = [
  {id:'dashboard',label:'Resumen',icon:'i-dash'},
  {id:'pos',label:'POS / Mesas',icon:'i-cart'},
  {id:'caja',label:'Caja',icon:'i-wallet'},
  {id:'inventario',label:'Inventario',icon:'i-box'},
  {id:'domicilios',label:'Domicilios',icon:'i-bike'},
  {id:'clientes',label:'Clientes',icon:'i-users'},
  {id:'reportes',label:'Reportes',icon:'i-chart'},
  {id:'ia',label:'Asistente IA',icon:'i-coffee'},
  {id:'config',label:'Configuración',icon:'i-settings'},
];

/* ---------- ESTADO ---------- */
const STATE = { user:null, empresaId:null, page:'dashboard', mesaActiva:null, pedido:null, catSel:null };

/* ---------- SEED (primera vez) ---------- */
function initData(){
  if(DB.get('init')) return;
  DB.set('empresas',[
    {id:'e1',nombre:'Restaurante La Sazón',nit:'900.123.456-7',tel:'607 555 8080',dir:'Floridablanca, Santander',
     plan:'Premium',estado:'activa',prefijo:'FAC',consecutivo:1,logo:'🍽️',logoImg:'',numMesas:9},
    {id:'e2',nombre:'Café del Parque',nit:'901.222.333-4',tel:'607 555 9090',dir:'Bucaramanga, Santander',
     plan:'Pro',estado:'activa',prefijo:'CAF',consecutivo:1,logo:'☕',logoImg:'',numMesas:6},
  ]);
  DB.set('usuarios',[
    {id:'u0',empresa_id:null,nombre:'Wallace (Tú)',usuario:'wallace',pass:'wallace123',rol:'superadmin',activo:true},
    {id:'u1',empresa_id:'e1',nombre:'Ana Admin',usuario:'ana',pass:'ana123',rol:'admin',activo:true},
    {id:'u2',empresa_id:'e1',nombre:'Luis Cajero',usuario:'luis',pass:'luis123',rol:'cajero',activo:true},
    {id:'u3',empresa_id:'e1',nombre:'Sara Mesera',usuario:'sara',pass:'sara123',rol:'mesero',activo:true},
    {id:'u4',empresa_id:'e2',nombre:'Pedro Admin',usuario:'pedro',pass:'pedro123',rol:'admin',activo:true},
  ]);
  DB.set('categorias',{
    e1:[{id:'c1',nombre:'Entradas'},{id:'c2',nombre:'Platos fuertes'},{id:'c3',nombre:'Bebidas'},{id:'c4',nombre:'Postres'}],
    e2:[{id:'c5',nombre:'Café'},{id:'c6',nombre:'Panadería'},{id:'c7',nombre:'Fríos'}],
  });
  DB.set('productos',{
    e1:[
      {id:'p1',cat:'c1',nombre:'Empanadas (x3)',precio:9000,costo:3500,stock:40,area:'cocina',activo:true},
      {id:'p2',cat:'c1',nombre:'Patacón con hogao',precio:12000,costo:4500,stock:25,area:'cocina',activo:true},
      {id:'p3',cat:'c2',nombre:'Bandeja paisa',precio:28000,costo:12000,stock:20,area:'cocina',activo:true},
      {id:'p4',cat:'c2',nombre:'Churrasco 300g',precio:35000,costo:16000,stock:15,area:'cocina',activo:true},
      {id:'p5',cat:'c2',nombre:'Mojarra frita',precio:32000,costo:14000,stock:12,area:'cocina',activo:true},
      {id:'p6',cat:'c3',nombre:'Limonada de coco',precio:8000,costo:2500,stock:50,area:'bar',activo:true},
      {id:'p7',cat:'c3',nombre:'Cerveza nacional',precio:6000,costo:2800,stock:80,area:'bar',activo:true},
      {id:'p8',cat:'c3',nombre:'Gaseosa',precio:4500,costo:1800,stock:60,area:'bar',activo:true},
      {id:'p9',cat:'c4',nombre:'Tres leches',precio:11000,costo:4000,stock:18,area:'cocina',activo:true},
      {id:'p10',cat:'c4',nombre:'Flan de café',precio:9500,costo:3200,stock:16,area:'cocina',activo:true},
    ],
    e2:[
      {id:'p11',cat:'c5',nombre:'Café americano',precio:4000,costo:1200,stock:100,area:'bar',activo:true},
      {id:'p12',cat:'c5',nombre:'Capuchino',precio:6500,costo:2000,stock:100,area:'bar',activo:true},
      {id:'p13',cat:'c6',nombre:'Croissant',precio:5000,costo:1800,stock:30,area:'cocina',activo:true},
      {id:'p14',cat:'c7',nombre:'Frappé',precio:9000,costo:3000,stock:40,area:'bar',activo:true},
    ],
  });
  DB.set('mesas',{
    e1:Array.from({length:9},(_,i)=>({id:'m'+(i+1),nombre:'Mesa '+(i+1),estado:'libre',pedido:null})),
    e2:Array.from({length:6},(_,i)=>({id:'t'+(i+1),nombre:'Mesa '+(i+1),estado:'libre',pedido:null})),
  });
  DB.set('clientes',{e1:[
    {id:'cl1',nombre:'María González',tel:'300 555 1010',dir:'Cra 27 #15-40',visitas:8,total:240000},
    {id:'cl2',nombre:'Carlos Pérez',tel:'311 555 2020',dir:'Cll 9 #22-15',visitas:3,total:96000},
  ],e2:[]});
  DB.set('ventas',{e1:[],e2:[]});
  DB.set('caja',{e1:null,e2:null});
  DB.set('domicilios',{e1:[],e2:[]});
  DB.set('init',true);
}

/* ---------- TOAST ---------- */
let toastT;
function toast(msg,type='ok'){
  const t=$('toast'); t.innerHTML=ic('i-check')+' '+esc(msg);
  t.style.background = type==='err'?'#c0392b':'#2e2a26'; t.style.display='flex';
  clearTimeout(toastT); toastT=setTimeout(()=>t.style.display='none',2600);
}

/* ---------- AUTH ---------- */
function doLogin(){
  const u=$('login-user').value.trim(), p=$('login-pass').value;
  const user=(DB.get('usuarios')||[]).find(x=>x.usuario===u && x.pass===p && x.activo);
  const err=$('login-err');
  if(!user){ err.textContent='Usuario o contraseña incorrectos.'; err.style.display='block'; return; }
  err.style.display='none'; $('login-pass').value='';
  STATE.user=user;
  if(user.rol==='superadmin'){ STATE.empresaId=null; STATE.page='portal'; }
  else { STATE.empresaId=user.empresa_id; STATE.page=PERMISOS[user.rol][0]; }
  $('login').style.display='none'; $('app').style.display='block';
  renderShell();
}
function doLogout(){
  STATE.user=null; STATE.empresaId=null;
  $('app').style.display='none'; $('login').style.display='flex';
  $('login-user').value=''; $('login-pass').value='';
}

/* ---------- helpers de empresa ---------- */
const empresaActual = () => (DB.get('empresas')||[]).find(e=>e.id===STATE.empresaId);
const modsPermitidos = () => {
  const u=STATE.user; if(u.rol==='superadmin') return ['portal'];
  const emp=empresaActual(); const plan=PLANES[emp.plan].modulos;
  return PERMISOS[u.rol].filter(m=>plan.includes(m)||m==='dashboard');
};

/* ---------- SHELL ---------- */
function renderShell(){
  const u=STATE.user;
  if(u.rol==='superadmin'){ renderPortal(); return; }
  const emp=empresaActual();
  // sidebar
  $('side-emp').textContent=emp.nombre;
  $('side-plan').innerHTML=`<span class="plan-dot" style="background:${PLANES[emp.plan].color}"></span> Plan ${emp.plan}`;
  $('side-logo').innerHTML = emp.logoImg ? `<img src="${emp.logoImg}">` : emp.logo;
  $('user-name').textContent=u.nombre;
  $('user-role').textContent=ROLES[u.rol].nombre;
  $('user-avatar').textContent=u.nombre[0];
  $('user-avatar').style.background=ROLES[u.rol].color;
  // nav
  const mods=modsPermitidos();
  $('nav').innerHTML = NAV.filter(n=>mods.includes(n.id)).map(n=>
    `<button class="nav-item ${STATE.page===n.id?'on':''}" onclick="goto('${n.id}')">${ic(n.icon)} <span>${n.label}</span></button>`
  ).join('');
  renderPage();
}
function goto(page){ STATE.page=page; STATE.mesaActiva=null; renderShell(); }

function renderPage(){
  const m=$('main'); const p=STATE.page;
  if(p==='dashboard') m.innerHTML=viewDashboard();
  else if(p==='pos') renderPOS();
  else if(p==='caja') m.innerHTML=viewCaja();
  else if(p==='inventario') m.innerHTML=viewInventario();
  else if(p==='domicilios') m.innerHTML=viewDomicilios();
  else if(p==='clientes') m.innerHTML=viewClientes();
  else if(p==='reportes') m.innerHTML=viewReportes();
  else if(p==='ia') m.innerHTML=viewIA();
  else if(p==='config') m.innerHTML=viewConfig();
}

function head(title,sub,right){
  return `<div class="page-head"><div><h1>${esc(title)}</h1>${sub?`<div class="sub">${esc(sub)}</div>`:''}</div>${right||''}</div>`;
}
function empty(msg){ return `<div class="empty">${ic('i-box')}<div style="margin-top:8px">${esc(msg)}</div></div>`; }

/* =====================================================
   VISTAS
   ===================================================== */

/* ---------- DASHBOARD ---------- */
function viewDashboard(){
  const eid=STATE.empresaId;
  const ventas=(DB.get('ventas')[eid]||[]).filter(v=>v.fecha.slice(0,10)===today());
  const total=ventas.reduce((s,v)=>s+v.total,0);
  const propinas=ventas.reduce((s,v)=>s+(v.propina||0),0);
  const ticket=ventas.length?total/ventas.length:0;
  const util=ventas.reduce((s,v)=>s+v.items.reduce((a,it)=>a+(it.precio-(it.costo||0))*it.cant,0),0);
  const mesas=DB.get('mesas')[eid]||[];
  const occ=mesas.filter(m=>m.estado!=='libre').length;
  const top={}; ventas.forEach(v=>v.items.forEach(it=>top[it.nombre]=(top[it.nombre]||0)+it.cant));
  const topArr=Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const cards=[
    {l:'Ventas de hoy',v:money(total),s:ventas.length+' ventas'},
    {l:'Ticket promedio',v:money(ticket),s:'por venta'},
    {l:'Propinas',v:money(propinas),s:'hoy'},
    {l:'Utilidad estimada',v:money(util),s:'venta − costo'},
  ];
  return `<div class="page">${head('Resumen del día',fmtDate(nowISO()))}
    <div class="card-grid">${cards.map(c=>`<div class="stat"><div class="val">${c.v}</div><div class="lbl">${c.l}</div><div class="sub">${c.s}</div></div>`).join('')}</div>
    <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:18px;margin-top:18px">
      <div class="panel"><div class="panel-title">Productos más vendidos hoy</div>
        ${topArr.length?topArr.map((t,i)=>`<div class="trow"><div style="display:flex;gap:10px;align-items:center;flex:1"><span style="width:22px;height:22px;border-radius:6px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px">${i+1}</span>${esc(t[0])}</div><b>${t[1]}</b></div>`).join(''):empty('Aún no hay ventas hoy.')}
      </div>
      <div class="panel"><div class="panel-title">Estado del salón</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
        ${mesas.map(m=>`<div style="aspect-ratio:1;border-radius:9px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;background:${m.estado==='libre'?'#eef5ef':'#fdf0e6'};color:${m.estado==='libre'?'#6BAF92':'#C38D5F'}">${m.nombre.replace('Mesa ','M')}</div>`).join('')}</div>
        <div style="margin-top:12px;font-size:13px;color:var(--mut)">${occ} ocupadas · ${mesas.length-occ} libres</div>
        <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="goto('pos')">Ir al POS</button>
      </div>
    </div></div>`;
}

/* ---------- POS ---------- */
function renderPOS(){
  if(STATE.mesaActiva){ renderMesaEditor(); return; }
  const eid=STATE.empresaId; const mesas=DB.get('mesas')[eid]||[];
  $('main').innerHTML=`<div class="page">${head('POS / Mesas','Toca una mesa para tomar el pedido')}
    <div class="mesa-grid">
      ${mesas.map(m=>{ const occ=m.estado!=='libre'; const tot=m.pedido?m.pedido.items.reduce((s,it)=>s+it.precio*it.cant,0):0;
        return `<button class="mesa ${occ?'occ':''}" onclick="abrirMesa('${m.id}')">
          <div class="name">${esc(m.nombre)}</div>
          <div class="st" style="color:${occ?'#C38D5F':'#6BAF92'}"><span class="dot" style="background:${occ?'#C38D5F':'#6BAF92'}"></span>${occ?'Ocupada':'Libre'}</div>
          ${occ?`<div class="tot">${money(tot)}</div><div style="font-size:12px;color:var(--mut)">${m.pedido.items.length} ítems · ${fmtTime(m.pedido.abierta)}</div>`:''}
        </button>`;}).join('')}
      <button class="mesa llevar" onclick="abrirMesa('llevar')">${ic('i-truck')}<div class="name" style="margin-top:8px">Para llevar</div><div style="font-size:12.5px;color:var(--mut)">Venta rápida sin mesa</div></button>
    </div></div>`;
}
function abrirMesa(id){
  STATE.mesaActiva=id;
  if(id==='llevar'){ STATE.pedido={items:[],abierta:nowISO(),mesero:STATE.user.nombre}; }
  else { const m=(DB.get('mesas')[STATE.empresaId]||[]).find(x=>x.id===id);
    STATE.pedido=m.pedido?JSON.parse(JSON.stringify(m.pedido)):{items:[],abierta:nowISO(),mesero:STATE.user.nombre}; }
  const cats=DB.get('categorias')[STATE.empresaId]||[];
  STATE.catSel=cats[0]?cats[0].id:null;
  renderMesaEditor();
}
function cerrarMesa(){ STATE.mesaActiva=null; STATE.pedido=null; renderPOS(); }

function renderMesaEditor(){
  const eid=STATE.empresaId; const esLlevar=STATE.mesaActiva==='llevar';
  const nombre=esLlevar?'Para llevar':(DB.get('mesas')[eid]||[]).find(m=>m.id===STATE.mesaActiva).nombre;
  const cats=DB.get('categorias')[eid]||[];
  const prods=(DB.get('productos')[eid]||[]).filter(p=>p.activo && p.cat===STATE.catSel);
  const ped=STATE.pedido;
  const subtotal=ped.items.reduce((s,it)=>s+it.precio*it.cant,0);
  $('main').innerHTML=`<div class="page">
    ${head(nombre,esLlevar?'Venta para llevar':'Mesero: '+esc(STATE.user.nombre),`<button class="btn btn-ghost" onclick="cerrarMesa()">← Mesas</button>`)}
    <div class="pos-layout">
      <div>
        <div class="cat-tabs">${cats.map(c=>`<button class="cat-tab ${STATE.catSel===c.id?'on':''}" onclick="selCat('${c.id}')">${esc(c.nombre)}</button>`).join('')}</div>
        <div class="prod-grid">${prods.map(p=>`<button class="prod" onclick="addItem('${p.id}')" ${p.stock<=0?'disabled':''}>
          <div class="pn">${esc(p.nombre)}</div><div class="pp">${money(p.precio)}</div>
          <div class="ps" style="color:${p.stock<=5?'#c0392b':'var(--mut)'}">${p.stock<=0?'Agotado':'Stock: '+p.stock}</div></button>`).join('')}</div>
      </div>
      <div class="cuenta">
        <div class="cuenta-head"><b>Cuenta</b><span style="font-size:13px;color:var(--mut)">${ped.items.length} ítems</span></div>
        <div class="cuenta-items">
          ${ped.items.length?ped.items.map(it=>`<div class="li">
            <div style="flex:1;min-width:0"><div class="ln">${esc(it.nombre)}</div><div class="lp">${money(it.precio)} c/u</div></div>
            <div class="stepper"><button class="step" onclick="chgItem('${it.id}',-1)">${ic('i-minus')}</button><span style="width:22px;text-align:center;font-weight:700">${it.cant}</span><button class="step" onclick="chgItem('${it.id}',1)">${ic('i-plus')}</button></div>
            <div style="font-weight:700;font-size:13.5px;width:64px;text-align:right">${money(it.precio*it.cant)}</div>
            <button class="icon-btn" onclick="delItem('${it.id}')" style="color:#c9a9a0">${ic('i-trash')}</button>
          </div>`).join(''):'<div class="empty">Toca productos para agregarlos.</div>'}
        </div>
        <div class="cuenta-foot">
          <div class="trow"><span>Subtotal</span><b>${money(subtotal)}</b></div>
          <div style="display:flex;gap:6px;margin:10px 0">
            ${!esLlevar?`<button class="btn btn-ghost btn-sm" style="flex:1" onclick="modalMover()" ${!ped.items.length?'disabled':''}>${ic('i-move')} Mover</button>`:''}
            <button class="btn btn-ghost btn-sm" style="flex:1" onclick="modalDividir()" ${ped.items.length<2?'disabled':''}>${ic('i-split')} Dividir</button>
            <button class="btn btn-ghost btn-sm" style="flex:1" onclick="enviarComanda()" ${!ped.items.length?'disabled':''}>${ic('i-chef')} Comanda</button>
          </div>
          <div style="display:flex;gap:10px">
            <button class="btn btn-ghost" style="flex:1" onclick="guardarPedido()">Guardar</button>
            <button class="btn btn-primary" style="flex:2" onclick="modalCobro()" ${!ped.items.length?'disabled':''}>Cobrar · ${money(subtotal)}</button>
          </div>
        </div>
      </div>
    </div></div>`;
}
function selCat(id){ STATE.catSel=id; renderMesaEditor(); }
function addItem(pid){
  const p=(DB.get('productos')[STATE.empresaId]||[]).find(x=>x.id===pid);
  const ex=STATE.pedido.items.find(i=>i.producto_id===pid);
  if(ex) ex.cant++; else STATE.pedido.items.push({id:uid(),producto_id:pid,nombre:p.nombre,precio:p.precio,costo:p.costo,cant:1,area:p.area});
  renderMesaEditor();
}
function chgItem(id,d){ const it=STATE.pedido.items.find(i=>i.id===id); if(!it)return; it.cant+=d; if(it.cant<=0) STATE.pedido.items=STATE.pedido.items.filter(i=>i.id!==id); renderMesaEditor(); }
function delItem(id){ STATE.pedido.items=STATE.pedido.items.filter(i=>i.id!==id); renderMesaEditor(); }

function guardarPedido(msg){
  const eid=STATE.empresaId;
  if(STATE.mesaActiva!=='llevar'){
    const mesas=DB.get('mesas'); mesas[eid]=mesas[eid].map(m=>m.id===STATE.mesaActiva
      ?{...m,estado:STATE.pedido.items.length?'ocupada':'libre',pedido:STATE.pedido.items.length?STATE.pedido:null}:m);
    DB.set('mesas',mesas);
  }
  toast(msg||'Pedido guardado'); cerrarMesa();
}
function enviarComanda(){
  const emp=empresaActual();
  const cocina=STATE.pedido.items.filter(i=>i.area==='cocina');
  const bar=STATE.pedido.items.filter(i=>i.area==='bar');
  const nombre=STATE.mesaActiva==='llevar'?'Para llevar':(DB.get('mesas')[STATE.empresaId]||[]).find(m=>m.id===STATE.mesaActiva).nombre;
  if(cocina.length) abrirTicket({tipo:'comanda',titulo:'COMANDA COCINA',emp,mesa:nombre,items:cocina,hora:nowISO(),mesero:STATE.user.nombre});
  else if(bar.length) abrirTicket({tipo:'comanda',titulo:'COMANDA BAR',emp,mesa:nombre,items:bar,hora:nowISO(),mesero:STATE.user.nombre});
  guardarPedido('Comanda enviada');
}

/* ---------- MODAL genérico ---------- */
function openModal(html,wide){ $('modal-root').innerHTML=`<div class="modal-bg" onclick="if(event.target===this)closeModal()"><div class="modal ${wide?'wide':''}">${html}</div></div>`; }
function closeModal(){ $('modal-root').innerHTML=''; }
function modalHead(title){ return `<div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" onclick="closeModal()">${ic('i-x')}</button></div>`; }

/* ---------- COBRO ---------- */
let cobroState={propPct:0,metodo:'efectivo',recibido:'',domicilio:0};
function modalCobro(){
  cobroState={propPct:0,metodo:'efectivo',recibido:'',domicilio:0};
  renderCobro();
}
function renderCobro(){
  const esLlevar=STATE.mesaActiva==='llevar';
  const subtotal=STATE.pedido.items.reduce((s,it)=>s+it.precio*it.cant,0);
  const prop=Math.round(subtotal*cobroState.propPct/100);
  const total=subtotal+prop+Number(cobroState.domicilio||0);
  const cambio=cobroState.metodo==='efectivo'&&cobroState.recibido!==''?Number(cobroState.recibido)-total:0;
  openModal(`${modalHead('Cobrar cuenta')}<div class="modal-body">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:22px">
      <div>
        <label class="label">Propina</label>
        <div style="display:flex;gap:8px;margin-bottom:16px">${[0,5,10,15].map(p=>`<button class="chip ${cobroState.propPct===p?'on':''}" onclick="cobroSet('propPct',${p})">${p===0?'Sin':p+'%'}</button>`).join('')}</div>
        ${esLlevar?`<label class="label">Domicilio</label><input type="number" value="${cobroState.domicilio||''}" placeholder="0" oninput="cobroSet('domicilio',this.value)" style="margin-bottom:16px">`:''}
        <label class="label">Método de pago</label>
        <div style="display:flex;gap:8px;margin-bottom:16px">${[['efectivo','Efectivo'],['tarjeta','Tarjeta'],['transfer','Transfer.']].map(m=>`<button class="chip ${cobroState.metodo===m[0]?'on':''}" style="flex:1;justify-content:center" onclick="cobroSet('metodo','${m[0]}')">${m[1]}</button>`).join('')}</div>
        ${cobroState.metodo==='efectivo'?`<label class="label">Efectivo recibido</label><input type="number" value="${cobroState.recibido}" placeholder="${total}" oninput="cobroSet('recibido',this.value)">`:''}
      </div>
      <div style="background:var(--bg);border-radius:14px;padding:20px">
        <div class="trow"><span>Subtotal</span><span>${money(subtotal)}</span></div>
        ${prop>0?`<div class="trow"><span>Propina (${cobroState.propPct}%)</span><span>${money(prop)}</span></div>`:''}
        ${Number(cobroState.domicilio)>0?`<div class="trow"><span>Domicilio</span><span>${money(Number(cobroState.domicilio))}</span></div>`:''}
        <div class="t-dash"></div>
        <div class="trow" style="font-size:26px"><b>Total</b><b style="color:var(--acc)">${money(total)}</b></div>
        ${cobroState.metodo==='efectivo'&&cobroState.recibido!==''?`<div class="trow" style="margin-top:10px;color:${cambio>=0?'#6BAF92':'#c0392b'}"><span>Cambio</span><b>${money(cambio)}</b></div>`:''}
        <button class="btn btn-primary btn-block" style="margin-top:18px;padding:14px;font-size:16px" onclick="confirmarCobro()" ${cobroState.metodo==='efectivo'&&cobroState.recibido!==''&&cambio<0?'disabled':''}>${ic('i-check')} Confirmar e imprimir</button>
      </div>
    </div></div>`,true);
}
function cobroSet(k,v){ cobroState[k]=v; renderCobro(); }
function confirmarCobro(){
  const eid=STATE.empresaId; const esLlevar=STATE.mesaActiva==='llevar';
  const subtotal=STATE.pedido.items.reduce((s,it)=>s+it.precio*it.cant,0);
  const prop=Math.round(subtotal*cobroState.propPct/100);
  const total=subtotal+prop+Number(cobroState.domicilio||0);
  const recibido=Number(cobroState.recibido||total);
  const empresas=DB.get('empresas'); const emp=empresas.find(e=>e.id===eid);
  const num=`${emp.prefijo}-${String(emp.consecutivo).padStart(6,'0')}`; emp.consecutivo++; DB.set('empresas',empresas);
  const nombre=esLlevar?'Para llevar':(DB.get('mesas')[eid]||[]).find(m=>m.id===STATE.mesaActiva).nombre;
  const venta={id:uid(),numero:num,fecha:nowISO(),mesa:nombre,mesero:STATE.user.nombre,items:STATE.pedido.items,
    subtotal,propina:prop,domicilio:Number(cobroState.domicilio||0),total,metodo:cobroState.metodo,cajero:STATE.user.nombre};
  const ventas=DB.get('ventas'); ventas[eid]=[venta,...(ventas[eid]||[])]; DB.set('ventas',ventas);
  // stock
  const prods=DB.get('productos'); STATE.pedido.items.forEach(it=>{ const p=prods[eid].find(x=>x.id===it.producto_id); if(p)p.stock=Math.max(0,p.stock-it.cant); }); DB.set('productos',prods);
  // caja
  const caja=DB.get('caja'); if(caja[eid]&&caja[eid].estado==='abierta'){ caja[eid].movimientos.push({id:uid(),tipo:'venta',valor:total,desc:'Venta '+num,hora:nowISO()}); DB.set('caja',caja); }
  // liberar mesa
  if(!esLlevar){ const mesas=DB.get('mesas'); mesas[eid]=mesas[eid].map(m=>m.id===STATE.mesaActiva?{...m,estado:'libre',pedido:null}:m); DB.set('mesas',mesas); }
  closeModal();
  abrirTicket({tipo:'factura',titulo:'FACTURA DE VENTA',emp,numero:num,...venta,recibido,cambio:recibido-total});
  toast('Venta '+num+' registrada');
  cerrarMesa();
}

/* ---------- DIVIDIR ---------- */
let divN=2;
function modalDividir(){ divN=2; renderDividir(); }
function renderDividir(){
  const subtotal=STATE.pedido.items.reduce((s,it)=>s+it.precio*it.cant,0);
  const por=Math.ceil(subtotal/divN);
  openModal(`${modalHead('Dividir cuenta')}<div class="modal-body">
    <label class="label">¿Entre cuántas personas?</label>
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:22px">
      <button class="btn btn-ghost" onclick="setDiv(-1)" style="width:46px;height:46px;padding:0">${ic('i-minus')}</button>
      <div style="font-size:40px;font-weight:800;width:70px;text-align:center">${divN}</div>
      <button class="btn btn-ghost" onclick="setDiv(1)" style="width:46px;height:46px;padding:0">${ic('i-plus')}</button>
    </div>
    <div style="background:var(--bg);border-radius:14px;padding:20px">
      <div class="trow"><span>Total cuenta</span><b>${money(subtotal)}</b></div><div class="t-dash"></div>
      <div class="trow" style="font-size:24px"><span>Cada persona paga</span><b style="color:var(--acc)">${money(por)}</b></div>
    </div></div>`);
}
function setDiv(d){ divN=Math.max(2,divN+d); renderDividir(); }

/* ---------- MOVER ---------- */
function modalMover(){
  const eid=STATE.empresaId; const libres=(DB.get('mesas')[eid]||[]).filter(m=>m.estado==='libre'&&m.id!==STATE.mesaActiva);
  openModal(`${modalHead('Mover pedido')}<div class="modal-body">
    <label class="label">Elige la mesa destino</label>
    ${libres.length?`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">${libres.map(m=>`<button class="btn btn-ghost" onclick="moverA('${m.id}')">${esc(m.nombre)}</button>`).join('')}</div>`:'<div class="empty">No hay mesas libres.</div>'}
    </div>`);
}
function moverA(destId){
  const eid=STATE.empresaId; const mesas=DB.get('mesas');
  mesas[eid]=mesas[eid].map(m=>{ if(m.id===STATE.mesaActiva)return{...m,estado:'libre',pedido:null}; if(m.id===destId)return{...m,estado:'ocupada',pedido:STATE.pedido}; return m; });
  DB.set('mesas',mesas); closeModal(); toast('Pedido movido'); cerrarMesa();
}

/* ---------- CAJA ---------- */
function viewCaja(){
  const eid=STATE.empresaId; const caja=DB.get('caja')[eid];
  if(!caja){
    return `<div class="page">${head('Caja','No hay caja abierta')}
      <div class="panel" style="max-width:400px;margin:40px auto;text-align:center;padding:36px">
        ${ic('i-wallet')}<h3 style="margin:14px 0 6px">Abrir caja del turno</h3>
        <p style="color:var(--mut);margin-bottom:20px">Ingresa la base inicial.</p>
        <label class="label">Base inicial</label>
        <input type="number" id="caja-base" placeholder="0" style="font-size:22px;text-align:center">
        <button class="btn btn-primary btn-block" style="margin-top:16px;padding:14px" onclick="abrirCaja()">Abrir caja</button>
      </div></div>`;
  }
  const movs=caja.movimientos||[];
  const ventas=movs.filter(m=>m.tipo==='venta').reduce((s,m)=>s+m.valor,0);
  const ent=movs.filter(m=>m.tipo==='entrada').reduce((s,m)=>s+m.valor,0);
  const sal=movs.filter(m=>m.tipo==='salida').reduce((s,m)=>s+m.valor,0);
  const esperado=caja.base+ventas+ent-sal;
  const nV=movs.filter(m=>m.tipo==='venta').length;
  const movColor={venta:'#C38D5F',entrada:'#6BAF92',salida:'#c0392b'};
  return `<div class="page">${head('Caja abierta','Por '+esc(caja.cajero)+' · '+fmtTime(caja.abierta),`<button class="btn btn-danger" onclick="cerrarCaja()">${ic('i-lock')} Cerrar caja</button>`)}
    <div class="card-grid">
      <div class="stat"><div class="val">${money(caja.base)}</div><div class="lbl">Base inicial</div></div>
      <div class="stat"><div class="val">${money(ventas)}</div><div class="lbl">Ventas</div><div class="sub">${nV} ventas</div></div>
      <div class="stat"><div class="val">${money(ent)} / ${money(sal)}</div><div class="lbl">Entradas / Salidas</div></div>
      <div class="stat"><div class="val">${money(esperado)}</div><div class="lbl">Efectivo esperado</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1.3fr;gap:18px;margin-top:18px">
      <div class="panel"><div class="panel-title">Registrar movimiento</div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button class="chip on" id="mt-ent" style="flex:1;justify-content:center" onclick="movTipo('entrada')">Entrada</button>
          <button class="chip" id="mt-sal" style="flex:1;justify-content:center" onclick="movTipo('salida')">Salida</button>
        </div>
        <input type="number" id="mov-val" placeholder="Valor" style="margin-bottom:10px">
        <input id="mov-desc" placeholder="Descripción" style="margin-bottom:12px">
        <button class="btn btn-primary btn-block" onclick="addMov()">Registrar</button>
      </div>
      <div class="panel"><div class="panel-title">Movimientos del turno</div>
        <div style="max-height:320px;overflow-y:auto">
        ${movs.length?[...movs].reverse().map(m=>`<div style="display:flex;align-items:center;gap:12px;padding:11px 4px;border-bottom:1px solid var(--bg)">
          <span class="tag" style="background:${movColor[m.tipo]}22;color:${movColor[m.tipo]}">${m.tipo}</span>
          <div style="flex:1"><div style="font-weight:600;font-size:14px">${esc(m.desc)}</div><div style="font-size:12px;color:var(--mut)">${fmtTime(m.hora)}</div></div>
          <b style="color:${m.tipo==='salida'?'#c0392b':'#6BAF92'}">${m.tipo==='salida'?'−':'+'}${money(m.valor)}</b></div>`).join(''):'<div class="empty">Sin movimientos.</div>'}
        </div>
      </div>
    </div></div>`;
}
let movTipoSel='entrada';
function movTipo(t){ movTipoSel=t; $('mt-ent').classList.toggle('on',t==='entrada'); $('mt-sal').classList.toggle('on',t==='salida'); }
function abrirCaja(){
  const base=Number($('caja-base').value||0); const eid=STATE.empresaId;
  const caja=DB.get('caja'); caja[eid]={id:uid(),estado:'abierta',base,abierta:nowISO(),cajero:STATE.user.nombre,movimientos:[]};
  DB.set('caja',caja); toast('Caja abierta'); renderPage();
}
function addMov(){
  const val=Number($('mov-val').value||0); if(!val){toast('Ingresa un valor','err');return;}
  const eid=STATE.empresaId; const caja=DB.get('caja');
  caja[eid].movimientos.push({id:uid(),tipo:movTipoSel,valor:val,desc:$('mov-desc').value||(movTipoSel==='entrada'?'Ingreso':'Gasto'),hora:nowISO()});
  DB.set('caja',caja); toast('Movimiento registrado'); renderPage();
}
function cerrarCaja(){
  const eid=STATE.empresaId; const caja=DB.get('caja'); const c=caja[eid];
  const movs=c.movimientos||[];
  const ventas=movs.filter(m=>m.tipo==='venta').reduce((s,m)=>s+m.valor,0);
  const ent=movs.filter(m=>m.tipo==='entrada').reduce((s,m)=>s+m.valor,0);
  const sal=movs.filter(m=>m.tipo==='salida').reduce((s,m)=>s+m.valor,0);
  abrirTicket({tipo:'cierre',titulo:'CIERRE DE CAJA',emp:empresaActual(),caja:c,
    resumen:{ventas,entradas:ent,salidas:sal,esperado:c.base+ventas+ent-sal,nVentas:movs.filter(m=>m.tipo==='venta').length},cajero:STATE.user.nombre});
  caja[eid]=null; DB.set('caja',caja); toast('Caja cerrada'); renderPage();
}

/* ---------- INVENTARIO ---------- */
function viewInventario(){
  const eid=STATE.empresaId; const prods=DB.get('productos')[eid]||[]; const cats=DB.get('categorias')[eid]||[];
  const puede=['admin','gerente'].includes(STATE.user.rol);
  const catName=id=>(cats.find(c=>c.id===id)||{}).nombre||'—';
  const bajos=prods.filter(p=>p.stock<=5);
  return `<div class="page">${head('Inventario',prods.length+' productos',puede?`<button class="btn btn-primary" onclick="modalProducto()">${ic('i-plus')} Nuevo producto</button>`:'')}
    ${bajos.length?`<div style="display:flex;align-items:center;gap:8px;padding:12px 16px;background:#fdf6ec;border:1px solid #f0dcc0;border-radius:11px;color:#a8761f;font-size:13.5px;font-weight:600;margin-bottom:16px">⚠ ${bajos.length} producto(s) con stock bajo: ${esc(bajos.map(b=>b.nombre).join(', '))}</div>`:''}
    <div class="table-wrap"><table>
      <thead><tr>${['Producto','Categoría','Área','Precio','Costo','Margen','Stock',''].map(h=>`<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${prods.map(p=>{ const m=p.precio?Math.round((1-p.costo/p.precio)*100):0;
        return `<tr><td><b>${esc(p.nombre)}</b></td><td>${esc(catName(p.cat))}</td>
        <td><span class="badge" style="background:var(--bg);color:#6a6058;text-transform:capitalize">${p.area}</span></td>
        <td>${money(p.precio)}</td><td>${money(p.costo)}</td>
        <td><span style="color:${m>50?'#6BAF92':'#E8A87C'}">${m}%</span></td>
        <td><span class="badge" style="background:${p.stock<=5?'#fbe9e7':'#eef5ef'};color:${p.stock<=5?'#c0392b':'#6BAF92'}">${p.stock}</span></td>
        <td>${puede?`<button class="icon-btn" onclick="modalProducto('${p.id}')">${ic('i-settings')}</button>`:''}</td></tr>`;}).join('')}</tbody>
    </table></div></div>`;
}
function modalProducto(id){
  const eid=STATE.empresaId; const cats=DB.get('categorias')[eid]||[];
  const p=id?(DB.get('productos')[eid]||[]).find(x=>x.id===id):{nombre:'',cat:cats[0]?cats[0].id:'',precio:0,costo:0,stock:0,area:'cocina',activo:true};
  openModal(`${modalHead(id?'Editar producto':'Nuevo producto')}<div class="modal-body">
    <div class="field"><label class="label">Nombre</label><input id="pr-nombre" value="${esc(p.nombre)}"></div>
    <div class="row">
      <div class="field"><label class="label">Categoría</label><select id="pr-cat">${cats.map(c=>`<option value="${c.id}" ${p.cat===c.id?'selected':''}>${esc(c.nombre)}</option>`).join('')}</select></div>
      <div class="field"><label class="label">Área impresión</label><select id="pr-area"><option value="cocina" ${p.area==='cocina'?'selected':''}>Cocina</option><option value="bar" ${p.area==='bar'?'selected':''}>Bar</option></select></div>
    </div>
    <div class="row">
      <div class="field"><label class="label">Precio</label><input id="pr-precio" type="number" value="${p.precio}"></div>
      <div class="field"><label class="label">Costo</label><input id="pr-costo" type="number" value="${p.costo}"></div>
      <div class="field"><label class="label">Stock</label><input id="pr-stock" type="number" value="${p.stock}"></div>
    </div>
    <button class="btn btn-primary btn-block" onclick="guardarProducto('${id||''}')">Guardar producto</button>
  </div>`);
}
function guardarProducto(id){
  const eid=STATE.empresaId; const nombre=$('pr-nombre').value.trim(); if(!nombre){toast('Falta el nombre','err');return;}
  const prods=DB.get('productos');
  const data={cat:$('pr-cat').value,area:$('pr-area').value,nombre,precio:Number($('pr-precio').value||0),costo:Number($('pr-costo').value||0),stock:Number($('pr-stock').value||0),activo:true};
  if(id){ prods[eid]=prods[eid].map(x=>x.id===id?{...x,...data}:x); } else { prods[eid].push({id:uid(),...data}); }
  DB.set('productos',prods); closeModal(); toast(id?'Producto actualizado':'Producto creado'); renderPage();
}

/* ---------- DOMICILIOS ---------- */
function viewDomicilios(){
  const eid=STATE.empresaId; const peds=DB.get('domicilios')[eid]||[];
  const colorEst={pendiente:'#E8A87C',preparando:'#7BA7BC','en camino':'#C38D5F',entregado:'#6BAF92'};
  return `<div class="page">${head('Domicilios',peds.filter(p=>p.estado!=='entregado').length+' activos',`<button class="btn btn-primary" onclick="modalDomicilio()">${ic('i-plus')} Nuevo domicilio</button>`)}
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">
    ${peds.length?peds.map(p=>`<div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center"><b>${esc(p.cliente)}</b><span class="tag" style="background:${colorEst[p.estado]}22;color:${colorEst[p.estado]}">${p.estado}</span></div>
      <div style="font-size:13px;color:var(--mut);margin:6px 0">${esc(p.tel)}</div>
      <div style="font-size:13px;color:#5a5048">📍 ${esc(p.dir)}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">
        <div><b style="font-size:18px">${money(p.total)}</b> <span style="font-size:12px;color:var(--mut)">+ ${money(p.envio)} envío</span></div>
        ${p.estado!=='entregado'?`<button class="btn btn-ghost btn-sm" onclick="avanzarDom('${p.id}')">Avanzar →</button>`:''}
      </div></div>`).join(''):empty('No hay domicilios.')}
    </div></div>`;
}
function modalDomicilio(){
  openModal(`${modalHead('Nuevo domicilio')}<div class="modal-body">
    <div class="field"><label class="label">Cliente</label><input id="do-cli"></div>
    <div class="row"><div class="field"><label class="label">Teléfono</label><input id="do-tel"></div>
      <div class="field"><label class="label">Costo envío</label><input id="do-envio" type="number" value="5000"></div></div>
    <div class="field"><label class="label">Dirección</label><input id="do-dir"></div>
    <div class="field"><label class="label">Total pedido</label><input id="do-total" type="number" value="0"></div>
    <button class="btn btn-primary btn-block" onclick="guardarDomicilio()">Crear domicilio</button></div>`);
}
function guardarDomicilio(){
  const cli=$('do-cli').value.trim(), dir=$('do-dir').value.trim(); if(!cli||!dir){toast('Faltan datos','err');return;}
  const eid=STATE.empresaId; const doms=DB.get('domicilios');
  doms[eid]=[{id:uid(),cliente:cli,tel:$('do-tel').value,dir,envio:Number($('do-envio').value||0),total:Number($('do-total').value||0),estado:'pendiente',hora:nowISO()},...(doms[eid]||[])];
  DB.set('domicilios',doms); closeModal(); toast('Domicilio creado'); renderPage();
}
function avanzarDom(id){
  const estados=['pendiente','preparando','en camino','entregado']; const eid=STATE.empresaId; const doms=DB.get('domicilios');
  doms[eid]=doms[eid].map(p=>{ if(p.id!==id)return p; const i=estados.indexOf(p.estado); return{...p,estado:estados[Math.min(3,i+1)]}; });
  DB.set('domicilios',doms); renderPage();
}

/* ---------- CLIENTES ---------- */
function viewClientes(){
  const eid=STATE.empresaId; const cls=DB.get('clientes')[eid]||[];
  return `<div class="page">${head('Clientes',cls.length+' registrados',`<button class="btn btn-primary" onclick="modalCliente()">${ic('i-plus')} Nuevo cliente</button>`)}
    <div class="table-wrap"><table>
      <thead><tr>${['Cliente','Teléfono','Dirección','Visitas','Gasto total'].map(h=>`<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${cls.length?cls.map(c=>`<tr><td><b>${esc(c.nombre)}</b></td><td>${esc(c.tel)}</td><td>${esc(c.dir)}</td><td>${c.visitas}</td><td><b style="color:var(--acc)">${money(c.total)}</b></td></tr>`).join(''):`<tr><td colspan="5">${empty('Aún no hay clientes.')}</td></tr>`}</tbody>
    </table></div></div>`;
}
function modalCliente(){
  openModal(`${modalHead('Nuevo cliente')}<div class="modal-body">
    <div class="field"><label class="label">Nombre</label><input id="cl-nombre"></div>
    <div class="field"><label class="label">Teléfono</label><input id="cl-tel"></div>
    <div class="field"><label class="label">Dirección</label><input id="cl-dir"></div>
    <button class="btn btn-primary btn-block" onclick="guardarCliente()">Guardar cliente</button></div>`);
}
function guardarCliente(){
  const nombre=$('cl-nombre').value.trim(); if(!nombre){toast('Falta el nombre','err');return;}
  const eid=STATE.empresaId; const cls=DB.get('clientes');
  cls[eid]=[{id:uid(),nombre,tel:$('cl-tel').value,dir:$('cl-dir').value,visitas:0,total:0},...(cls[eid]||[])];
  DB.set('clientes',cls); closeModal(); toast('Cliente agregado'); renderPage();
}

/* ---------- REPORTES ---------- */
let repRango='hoy';
function viewReportes(){
  const eid=STATE.empresaId; let vs=DB.get('ventas')[eid]||[];
  if(repRango==='hoy') vs=vs.filter(v=>v.fecha.slice(0,10)===today());
  else if(repRango==='semana'){ const w=new Date(); w.setDate(w.getDate()-7); vs=vs.filter(v=>new Date(v.fecha)>=w); }
  const total=vs.reduce((s,v)=>s+v.total,0);
  const prop=vs.reduce((s,v)=>s+(v.propina||0),0);
  const util=vs.reduce((s,v)=>s+v.items.reduce((a,it)=>a+(it.precio-(it.costo||0))*it.cant,0),0);
  const porMet={}; vs.forEach(v=>porMet[v.metodo]=(porMet[v.metodo]||0)+v.total);
  const prodC={}; vs.forEach(v=>v.items.forEach(it=>prodC[it.nombre]=(prodC[it.nombre]||0)+it.cant));
  const top=Object.entries(prodC).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const rangos=[['hoy','Hoy'],['semana','7 días'],['todo','Todo']];
  return `<div class="page">${head('Reportes','Análisis de ventas',`<div style="display:flex;gap:6px">${rangos.map(r=>`<button class="chip ${repRango===r[0]?'on':''}" onclick="setRango('${r[0]}')">${r[1]}</button>`).join('')}</div>`)}
    <div class="card-grid">
      <div class="stat"><div class="val">${money(total)}</div><div class="lbl">Ventas totales</div><div class="sub">${vs.length} ventas</div></div>
      <div class="stat"><div class="val">${money(prop)}</div><div class="lbl">Propinas</div></div>
      <div class="stat"><div class="val">${money(util)}</div><div class="lbl">Utilidad bruta</div></div>
      <div class="stat"><div class="val">${money(vs.length?total/vs.length:0)}</div><div class="lbl">Ticket promedio</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:18px;margin-top:18px">
      <div class="panel"><div class="panel-title">Productos más vendidos</div>
        ${top.length?top.map((t,i)=>`<div class="trow"><div style="display:flex;gap:10px;align-items:center;flex:1"><span style="width:22px;height:22px;border-radius:6px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px">${i+1}</span>${esc(t[0])}</div><b>${t[1]}</b></div>`).join(''):empty('Sin ventas.')}
      </div>
      <div class="panel"><div class="panel-title">Por método de pago</div>
        ${Object.keys(porMet).length?Object.entries(porMet).map(([m,v])=>`<div class="trow"><span style="text-transform:capitalize">${m}</span><b>${money(v)} <span style="color:var(--mut);font-weight:400;font-size:12px">(${Math.round(v/total*100)}%)</span></b></div>`).join(''):empty('Sin datos.')}
      </div>
    </div>
    <div class="panel" style="margin-top:18px"><div class="panel-title">Últimas ventas</div>
      <div style="max-height:280px;overflow-y:auto">
      ${vs.length?vs.slice(0,30).map(v=>`<div style="display:flex;align-items:center;gap:12px;padding:11px 4px;border-bottom:1px solid var(--bg)">
        <span style="font-family:monospace;font-size:12px;font-weight:700;color:var(--acc);background:var(--bg);padding:4px 8px;border-radius:6px">${v.numero}</span>
        <div style="flex:1"><div style="font-weight:600;font-size:14px">${esc(v.mesa)} · ${v.items.length} ítems</div><div style="font-size:12px;color:var(--mut)">${fmtTime(v.fecha)} · ${v.metodo}</div></div>
        <b style="color:var(--acc)">${money(v.total)}</b></div>`).join(''):empty('Sin ventas.')}
      </div>
    </div></div>`;
}
function setRango(r){ repRango=r; renderPage(); }

/* ---------- IA ---------- */
let iaMsgs=null;
function viewIA(){
  const emp=empresaActual();
  if(!iaMsgs) iaMsgs=[{rol:'ia',txt:`Hola, soy el asistente de ${emp.nombre}. Pregúntame por tus ventas, tu producto más vendido o tu utilidad.`}];
  return `<div class="page">${head('Asistente IA','Pregunta sobre tu negocio en lenguaje natural')}
    <div class="panel" style="max-width:720px">
      <div id="ia-body" style="min-height:280px;max-height:380px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;margin-bottom:14px">
        ${iaMsgs.map(m=>`<div style="max-width:75%;padding:11px 15px;border-radius:14px;font-size:14px;line-height:1.4;${m.rol==='user'?'background:var(--acc);color:#fff;align-self:flex-end;border-bottom-right-radius:4px':'background:var(--bg);align-self:flex-start;border-bottom-left-radius:4px'}">${esc(m.txt)}</div>`).join('')}
      </div>
      <div style="display:flex;gap:10px">
        <input id="ia-input" placeholder="¿Qué vendí hoy?" onkeydown="if(event.key==='Enter')iaSend()">
        <button class="btn btn-primary" onclick="iaSend()">Enviar</button>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        ${['¿Qué vendí hoy?','¿Producto más vendido?','¿Cuánto en propinas?','¿Mi utilidad?'].map(s=>`<button class="chip" onclick="iaQuick('${s}')">${s}</button>`).join('')}
      </div>
    </div></div>`;
}
function iaResp(q){
  const eid=STATE.empresaId; const ventas=DB.get('ventas')[eid]||[]; const t=q.toLowerCase();
  const hoy=ventas.filter(v=>v.fecha.slice(0,10)===today());
  if(t.includes('más vendido')||t.includes('mas vendido')||t.includes('top')){
    const c={}; ventas.forEach(v=>v.items.forEach(it=>c[it.nombre]=(c[it.nombre]||0)+it.cant));
    const top=Object.entries(c).sort((a,b)=>b[1]-a[1])[0];
    return top?`Tu producto más vendido es "${top[0]}" con ${top[1]} unidades.`:'Aún no tienes ventas.';
  }
  if(t.includes('hoy')||t.includes('venta')){ const tot=hoy.reduce((s,v)=>s+v.total,0); return `Hoy llevas ${hoy.length} ventas por ${money(tot)}. Ticket promedio: ${money(hoy.length?tot/hoy.length:0)}.`; }
  if(t.includes('propina')){ const p=ventas.reduce((s,v)=>s+(v.propina||0),0); return `Las propinas suman ${money(p)}.`; }
  if(t.includes('utilidad')||t.includes('ganancia')){ const u=ventas.reduce((s,v)=>s+v.items.reduce((a,it)=>a+(it.precio-(it.costo||0))*it.cant,0),0); return `Tu utilidad bruta es ${money(u)}.`; }
  return 'Puedo responderte sobre ventas de hoy, producto más vendido, propinas o utilidad.';
}
function iaSend(){ const inp=$('ia-input'); const q=inp.value.trim(); if(!q)return; iaMsgs.push({rol:'user',txt:q},{rol:'ia',txt:iaResp(q)}); renderPage(); setTimeout(()=>{const b=$('ia-body');if(b)b.scrollTop=b.scrollHeight;},50); }
function iaQuick(s){ $('ia-input').value=s; iaSend(); }

/* ---------- CONFIG ---------- */
function viewConfig(){
  const emp=empresaActual(); const puede=STATE.user.rol==='admin';
  return `<div class="page">${head('Configuración','Datos de la empresa y facturación')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
      <div class="panel"><div class="panel-title">Logo del negocio</div>
        <div style="display:flex;gap:18px;align-items:center">
          <div style="width:90px;height:90px;border-radius:16px;background:var(--bg);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0" id="logo-box">
            ${emp.logoImg?`<img src="${emp.logoImg}" style="max-width:100%;max-height:100%;object-fit:contain">`:`<span style="font-size:40px">${emp.logo}</span>`}
          </div>
          <div style="flex:1">
            <div style="font-size:13px;color:var(--mut);margin-bottom:10px">Sube el logo de tu negocio (aparece en la factura). PNG/JPG, máx 1MB.</div>
            ${puede?`<div style="display:flex;gap:8px">
              <label class="btn btn-primary" style="cursor:pointer">${ic('i-print')} Subir logo<input type="file" accept="image/*" style="display:none" onchange="subirLogo(event)"></label>
              ${emp.logoImg?`<button class="btn btn-ghost" onclick="quitarLogo()">Quitar</button>`:''}
            </div>`:''}
          </div>
        </div>
      </div>
      <div class="panel"><div class="panel-title">Datos de la empresa</div>
        <div class="field"><label class="label">Nombre comercial</label><input id="cf-nombre" value="${esc(emp.nombre)}" ${puede?'':'disabled'}></div>
        <div class="row"><div class="field"><label class="label">NIT</label><input id="cf-nit" value="${esc(emp.nit)}" ${puede?'':'disabled'}></div>
          <div class="field"><label class="label">Teléfono</label><input id="cf-tel" value="${esc(emp.tel)}" ${puede?'':'disabled'}></div></div>
        <div class="field"><label class="label">Dirección</label><input id="cf-dir" value="${esc(emp.dir)}" ${puede?'':'disabled'}></div>
        <div class="row"><div class="field"><label class="label">Prefijo factura</label><input id="cf-prefijo" value="${esc(emp.prefijo)}" ${puede?'':'disabled'}></div>
          <div class="field"><label class="label">Próximo consecutivo</label><input id="cf-cons" type="number" value="${emp.consecutivo}" ${puede?'':'disabled'}></div></div>
      </div>
    </div>
    ${puede?`<button class="btn btn-primary" style="margin-top:18px" onclick="guardarConfig()">Guardar cambios</button>`:''}
    ${puede?panelEmpleados():''}
    <div style="max-width:460px;margin-top:18px">${panelCambiarPass()}</div>
  </div>`;
}
function subirLogo(e){
  const f=e.target.files[0]; if(!f)return;
  if(f.size>1024*1024){toast('Máx 1MB','err');return;}
  const r=new FileReader(); r.onload=()=>{ const emps=DB.get('empresas'); emps.find(x=>x.id===STATE.empresaId).logoImg=r.result; DB.set('empresas',emps); toast('Logo actualizado'); renderShell(); }; r.readAsDataURL(f);
}
function quitarLogo(){ const emps=DB.get('empresas'); emps.find(x=>x.id===STATE.empresaId).logoImg=''; DB.set('empresas',emps); renderShell(); }
function guardarConfig(){
  const emps=DB.get('empresas'); const e=emps.find(x=>x.id===STATE.empresaId);
  e.nombre=$('cf-nombre').value; e.nit=$('cf-nit').value; e.tel=$('cf-tel').value; e.dir=$('cf-dir').value;
  e.prefijo=$('cf-prefijo').value.toUpperCase(); e.consecutivo=Number($('cf-cons').value||1);
  DB.set('empresas',emps); toast('Configuración guardada'); renderShell();
}
function panelEmpleados(){
  const emps=DB.get('usuarios').filter(u=>u.empresa_id===STATE.empresaId);
  return `<div class="panel" style="margin-top:18px"><div class="panel-title">Empleados del negocio</div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button class="btn btn-primary" onclick="modalEmpleado()">${ic('i-plus')} Nuevo empleado</button></div>
    <div class="table-wrap"><table><thead><tr>${['Empleado','Usuario','Rol','Estado',''].map(h=>`<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${emps.map(u=>`<tr><td><b>${esc(u.nombre)}</b></td><td><code>${esc(u.usuario)}</code></td>
      <td><span class="badge" style="background:${ROLES[u.rol].color}22;color:${ROLES[u.rol].color}">${ROLES[u.rol].nombre}</span></td>
      <td><span class="tag" style="background:${(u.activo?'#6BAF92':'#c0392b')}22;color:${u.activo?'#6BAF92':'#c0392b'}">${u.activo?'activo':'inactivo'}</span></td>
      <td><div style="display:flex;gap:4px"><button class="icon-btn" onclick="modalEmpleado('${u.id}')">${ic('i-settings')}</button>${u.rol!=='admin'?`<button class="icon-btn" onclick="toggleEmpleado('${u.id}')">${ic('i-lock')}</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>
  </div>`;
}
function modalEmpleado(id){
  const u=id?DB.get('usuarios').find(x=>x.id===id):{nombre:'',usuario:'',pass:'',rol:'cajero'};
  openModal(`${modalHead(id?'Editar empleado':'Nuevo empleado')}<div class="modal-body">
    <div class="field"><label class="label">Nombre completo</label><input id="em-nombre" value="${esc(u.nombre)}"></div>
    <div class="row"><div class="field"><label class="label">Usuario (para entrar)</label><input id="em-user" value="${esc(u.usuario)}"></div>
      <div class="field"><label class="label">Contraseña</label><input id="em-pass" value="${esc(u.pass)}"></div></div>
    <div class="field"><label class="label">Rol</label><select id="em-rol">${['gerente','cajero','mesero'].map(r=>`<option value="${r}" ${u.rol===r?'selected':''}>${ROLES[r].nombre}</option>`).join('')}</select></div>
    <button class="btn btn-primary btn-block" onclick="guardarEmpleado('${id||''}')">${id?'Guardar':'Crear empleado'}</button></div>`);
}
function guardarEmpleado(id){
  const nombre=$('em-nombre').value.trim(), usuario=$('em-user').value.trim(), pass=$('em-pass').value.trim();
  if(!nombre||!usuario||!pass){toast('Completa nombre, usuario y contraseña','err');return;}
  const us=DB.get('usuarios');
  if(us.find(x=>x.usuario===usuario && x.id!==id)){toast('Ese usuario ya existe','err');return;}
  if(id){ us.forEach(x=>{ if(x.id===id){ x.nombre=nombre; x.usuario=usuario; x.pass=pass; x.rol=$('em-rol').value; } }); }
  else { us.push({id:uid(),empresa_id:STATE.empresaId,nombre,usuario,pass,rol:$('em-rol').value,activo:true}); }
  DB.set('usuarios',us); closeModal(); toast(id?'Empleado actualizado':'Empleado creado'); renderPage();
}
function toggleEmpleado(id){ const us=DB.get('usuarios'); us.forEach(x=>{if(x.id===id)x.activo=!x.activo;}); DB.set('usuarios',us); toast('Estado cambiado'); renderPage(); }

function panelCambiarPass(){
  return `<div class="panel"><div class="panel-title">Cambiar mi contraseña</div>
    <div class="field"><label class="label">Contraseña actual</label><input id="pw-act" type="password"></div>
    <div class="field"><label class="label">Nueva contraseña</label><input id="pw-new" type="password"></div>
    <div class="field"><label class="label">Confirmar nueva</label><input id="pw-conf" type="password"></div>
    <button class="btn btn-primary btn-block" onclick="cambiarPass()">Cambiar contraseña</button></div>`;
}
function cambiarPass(){
  const act=$('pw-act').value, nw=$('pw-new').value, cf=$('pw-conf').value;
  if(act!==STATE.user.pass){toast('Contraseña actual incorrecta','err');return;}
  if(nw.length<4){toast('Mínimo 4 caracteres','err');return;}
  if(nw!==cf){toast('No coinciden','err');return;}
  const us=DB.get('usuarios'); us.forEach(x=>{if(x.id===STATE.user.id)x.pass=nw;}); DB.set('usuarios',us); STATE.user.pass=nw;
  toast('Contraseña cambiada'); $('pw-act').value='';$('pw-new').value='';$('pw-conf').value='';
}

/* ---------- PORTAL SUPER ADMIN ---------- */
let portalTab='empresas', portalVerEmp=null;
function renderPortal(){
  // adaptar sidebar a modo oscuro portal
  document.querySelector('.sidebar').style.background='#1a1614';
  $('side-logo').style.background='#B58DB6'; $('side-logo').innerHTML='W';
  $('side-emp').textContent='Wallace System'; $('side-emp').style.color='#fff';
  $('side-plan').innerHTML=`${ic('i-shield')} Portal admin`; $('side-plan').style.color='#B58DB6';
  $('user-name').textContent=STATE.user.nombre; $('user-name').style.color='#fff';
  $('user-role').textContent='Super Admin'; $('user-avatar').textContent='W'; $('user-avatar').style.background='#B58DB6';
  const tabs=[['empresas','Empresas','i-building'],['usuarios','Usuarios','i-users'],['planes','Planes','i-tag'],['resumen','Resumen','i-chart'],['perfil','Mi cuenta','i-settings']];
  $('nav').innerHTML=tabs.map(t=>`<button class="nav-item ${portalTab===t[0]?'on':''}" style="${portalTab===t[0]?'background:#2a221e;color:#fff':'color:#bdb0a4'}" onclick="portalGoto('${t[0]}')">${ic(t[2])} <span>${t[1]}</span></button>`).join('');
  renderPortalPage();
}
function portalGoto(t){ portalTab=t; if(t!=='usuarios')portalVerEmp=null; renderPortal(); }
function renderPortalPage(){
  const m=$('main'); const empresas=DB.get('empresas'); const usuarios=DB.get('usuarios');
  if(portalTab==='empresas'){
    const totalV=Object.values(DB.get('ventas')||{}).flat().reduce((s,v)=>s+v.total,0);
    const mrr=empresas.reduce((s,e)=>s+(PLANES[e.plan].precio||0),0);
    m.innerHTML=`<div class="page">${head('Empresas en la plataforma',empresas.length+' clientes',`<button class="btn btn-primary" onclick="modalEmpresa()">${ic('i-plus')} Nueva empresa</button>`)}
      <div class="card-grid">
        <div class="stat"><div class="val">${empresas.length}</div><div class="lbl">Empresas</div></div>
        <div class="stat"><div class="val">${money(mrr)}</div><div class="lbl">Ingreso mensual (MRR)</div></div>
        <div class="stat"><div class="val">${money(totalV)}</div><div class="lbl">Ventas procesadas</div></div>
        <div class="stat"><div class="val">${usuarios.filter(u=>u.rol!=='superadmin').length}</div><div class="lbl">Usuarios</div></div>
      </div>
      <div style="margin-top:18px">${empresas.map(e=>{ const nu=usuarios.filter(u=>u.empresa_id===e.id).length; const nv=(DB.get('ventas')[e.id]||[]).length;
        return `<div style="display:flex;align-items:center;gap:14px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 18px;margin-bottom:10px">
          <div class="side-logo" style="font-size:22px">${e.logoImg?`<img src="${e.logoImg}">`:e.logo}</div>
          <div style="flex:1"><div style="font-weight:700">${esc(e.nombre)}</div><div style="font-size:13px;color:var(--mut)">${esc(e.nit)} · ${esc(e.dir)}</div></div>
          <span class="badge" style="background:${PLANES[e.plan].color}22;color:${PLANES[e.plan].color}">${e.plan}</span>
          <div style="text-align:center;min-width:60px"><div style="font-weight:700">${nu}</div><div style="font-size:12px;color:var(--mut)">usuarios</div></div>
          <div style="text-align:center;min-width:50px"><div style="font-weight:700">${nv}</div><div style="font-size:12px;color:var(--mut)">ventas</div></div>
          <button class="btn btn-ghost btn-sm" onclick="verUsuariosDe('${e.id}')">Ver usuarios</button>
        </div>`;}).join('')}</div></div>`;
  }
  else if(portalTab==='usuarios'){
    const lista=usuarios.filter(u=>u.rol!=='superadmin'&&(!portalVerEmp||u.empresa_id===portalVerEmp));
    m.innerHTML=`<div class="page">${head('Usuarios y empleados',portalVerEmp?'Empresa: '+esc((empresas.find(e=>e.id===portalVerEmp)||{}).nombre):'Todos los empleados',`<div style="display:flex;gap:8px">${portalVerEmp?`<button class="btn btn-ghost" onclick="portalVerEmp=null;renderPortal()">Ver todas</button>`:''}<button class="btn btn-primary" onclick="modalUsuarioPortal()">${ic('i-plus')} Nuevo usuario</button></div>`)}
      <div class="table-wrap"><table><thead><tr>${['Empleado','Empresa','Usuario','Rol','Estado',''].map(h=>`<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${lista.map(u=>`<tr><td><b>${esc(u.nombre)}</b></td><td>${esc((empresas.find(e=>e.id===u.empresa_id)||{}).nombre||'—')}</td>
        <td><code>${esc(u.usuario)}</code></td><td><span class="badge" style="background:${ROLES[u.rol].color}22;color:${ROLES[u.rol].color}">${ROLES[u.rol].nombre}</span></td>
        <td><span class="tag" style="background:${(u.activo?'#6BAF92':'#c0392b')}22;color:${u.activo?'#6BAF92':'#c0392b'}">${u.activo?'activo':'inactivo'}</span></td>
        <td><div style="display:flex;gap:4px"><button class="icon-btn" onclick="modalUsuarioPortal('${u.id}')">${ic('i-settings')}</button><button class="icon-btn" onclick="togglePortalUser('${u.id}')">${ic('i-lock')}</button></div></td></tr>`).join('')}</tbody></table></div></div>`;
  }
  else if(portalTab==='planes'){
    const planes=[
      {n:'Starter',f:['POS y mesas','Caja','Hasta 5 usuarios']},
      {n:'Pro',f:['Todo Starter','Inventario','Reportes','Domicilios','Clientes']},
      {n:'Premium',f:['Todo Pro','Asistente IA','WhatsApp','Automatizaciones']},
    ];
    m.innerHTML=`<div class="page">${head('Planes comerciales','Lo que ofreces a tus clientes')}
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px">${planes.map(p=>`<div class="panel" style="border-top:4px solid ${PLANES[p.n].color}">
        <div style="font-weight:800;font-size:20px">${p.n}</div>
        <div style="font-size:22px;color:${PLANES[p.n].color};font-weight:800;margin:6px 0">${money(PLANES[p.n].precio)}/mes</div>
        ${p.f.map(x=>`<div style="display:flex;align-items:center;gap:8px;font-size:13.5px;padding:5px 0;color:#5a5048">${ic('i-check')} ${x}</div>`).join('')}
      </div>`).join('')}</div></div>`;
  }
  else if(portalTab==='resumen'){
    const max=Math.max(1,...empresas.map(e=>(DB.get('ventas')[e.id]||[]).reduce((s,v)=>s+v.total,0)));
    m.innerHTML=`<div class="page">${head('Resumen global','Toda la plataforma')}
      <div class="panel"><div class="panel-title">Ventas por empresa</div>
      ${empresas.map(e=>{ const tot=(DB.get('ventas')[e.id]||[]).reduce((s,v)=>s+v.total,0);
        return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0"><div style="width:26px">${e.logo}</div><div style="flex:1">${esc(e.nombre)}</div>
        <div style="flex:1;height:8px;background:var(--bg);border-radius:4px;overflow:hidden;max-width:200px"><div style="height:100%;width:${tot/max*100}%;background:${PLANES[e.plan].color}"></div></div>
        <b style="width:90px;text-align:right">${money(tot)}</b></div>`;}).join('')}</div></div>`;
  }
  else if(portalTab==='perfil'){
    m.innerHTML=`<div class="page">${head('Mi cuenta','Tu perfil de Super Admin')}<div style="max-width:460px">${panelCambiarPass()}</div></div>`;
  }
}
function verUsuariosDe(eid){ portalVerEmp=eid; portalTab='usuarios'; renderPortal(); }
function togglePortalUser(id){ const us=DB.get('usuarios'); us.forEach(x=>{if(x.id===id)x.activo=!x.activo;}); DB.set('usuarios',us); toast('Estado cambiado'); renderPortalPage(); }

function modalEmpresa(){
  openModal(`${modalHead('Nueva empresa (cliente)')}<div class="modal-body">
    <div style="font-weight:700;margin-bottom:12px;color:var(--acc)">Datos del negocio</div>
    <div class="field"><label class="label">Nombre del negocio</label><input id="ne-nombre" placeholder="Ej. Pizzería Don Luigi"></div>
    <div class="row"><div class="field"><label class="label">NIT</label><input id="ne-nit"></div><div class="field"><label class="label">Teléfono</label><input id="ne-tel"></div></div>
    <div class="field"><label class="label">Dirección</label><input id="ne-dir"></div>
    <div class="row">
      <div class="field"><label class="label">Plan</label><select id="ne-plan"><option>Starter</option><option selected>Pro</option><option>Premium</option></select></div>
      <div class="field"><label class="label">Prefijo factura</label><input id="ne-prefijo" value="FAC"></div>
      <div class="field"><label class="label">N° mesas</label><input id="ne-mesas" type="number" value="6"></div>
    </div>
    <div style="font-weight:700;margin:20px 0 12px;color:var(--acc)">Administrador del negocio</div>
    <div class="field"><label class="label">Nombre del administrador</label><input id="ne-aname"></div>
    <div class="row"><div class="field"><label class="label">Usuario</label><input id="ne-auser"></div><div class="field"><label class="label">Contraseña</label><input id="ne-apass"></div></div>
    <button class="btn btn-primary btn-block" onclick="guardarEmpresa()">Crear empresa y administrador</button></div>`,true);
}
function guardarEmpresa(){
  const nombre=$('ne-nombre').value.trim(), aname=$('ne-aname').value.trim(), auser=$('ne-auser').value.trim(), apass=$('ne-apass').value.trim();
  if(!nombre||!aname||!auser||!apass){toast('Completa nombre del negocio y datos del administrador','err');return;}
  if(DB.get('usuarios').find(u=>u.usuario===auser)){toast('Ese usuario ya existe','err');return;}
  const id='e'+uid();
  const empresas=DB.get('empresas');
  empresas.push({id,nombre,nit:$('ne-nit').value,tel:$('ne-tel').value,dir:$('ne-dir').value,plan:$('ne-plan').value,estado:'activa',prefijo:$('ne-prefijo').value.toUpperCase()||'FAC',consecutivo:1,logo:'🏪',logoImg:'',numMesas:Number($('ne-mesas').value||6)});
  DB.set('empresas',empresas);
  const cats=DB.get('categorias'); cats[id]=[]; DB.set('categorias',cats);
  const prods=DB.get('productos'); prods[id]=[]; DB.set('productos',prods);
  const mesas=DB.get('mesas'); mesas[id]=Array.from({length:Number($('ne-mesas').value||6)},(_,i)=>({id:'m'+uid(),nombre:'Mesa '+(i+1),estado:'libre',pedido:null})); DB.set('mesas',mesas);
  const cls=DB.get('clientes'); cls[id]=[]; DB.set('clientes',cls);
  const ven=DB.get('ventas'); ven[id]=[]; DB.set('ventas',ven);
  const caja=DB.get('caja'); caja[id]=null; DB.set('caja',caja);
  const doms=DB.get('domicilios'); doms[id]=[]; DB.set('domicilios',doms);
  const us=DB.get('usuarios'); us.push({id:'u'+uid(),empresa_id:id,nombre:aname,usuario:auser,pass:apass,rol:'admin',activo:true}); DB.set('usuarios',us);
  closeModal(); toast('Empresa "'+nombre+'" creada'); renderPortalPage();
}
function modalUsuarioPortal(id){
  const empresas=DB.get('empresas');
  const u=id?DB.get('usuarios').find(x=>x.id===id):{nombre:'',usuario:'',pass:'',rol:'cajero',empresa_id:portalVerEmp||empresas[0].id};
  openModal(`${modalHead(id?'Editar usuario':'Nuevo usuario')}<div class="modal-body">
    <div class="field"><label class="label">Nombre completo</label><input id="pu-nombre" value="${esc(u.nombre)}"></div>
    <div class="field"><label class="label">Empresa</label><select id="pu-emp" ${id?'disabled':''}>${empresas.map(e=>`<option value="${e.id}" ${u.empresa_id===e.id?'selected':''}>${esc(e.nombre)}</option>`).join('')}</select></div>
    <div class="row"><div class="field"><label class="label">Usuario</label><input id="pu-user" value="${esc(u.usuario)}"></div><div class="field"><label class="label">Contraseña</label><input id="pu-pass" value="${esc(u.pass)}"></div></div>
    <div class="field"><label class="label">Rol</label><select id="pu-rol">${['admin','gerente','cajero','mesero'].map(r=>`<option value="${r}" ${u.rol===r?'selected':''}>${ROLES[r].nombre}</option>`).join('')}</select></div>
    <button class="btn btn-primary btn-block" onclick="guardarUsuarioPortal('${id||''}')">${id?'Guardar':'Crear usuario'}</button></div>`);
}
function guardarUsuarioPortal(id){
  const nombre=$('pu-nombre').value.trim(), usuario=$('pu-user').value.trim(), pass=$('pu-pass').value.trim();
  if(!nombre||!usuario||!pass){toast('Completa los datos','err');return;}
  const us=DB.get('usuarios');
  if(us.find(x=>x.usuario===usuario && x.id!==id)){toast('Ese usuario ya existe','err');return;}
  if(id){ us.forEach(x=>{ if(x.id===id){ x.nombre=nombre; x.usuario=usuario; x.pass=pass; x.rol=$('pu-rol').value; } }); }
  else { us.push({id:uid(),empresa_id:$('pu-emp').value,nombre,usuario,pass,rol:$('pu-rol').value,activo:true}); }
  DB.set('usuarios',us); closeModal(); toast(id?'Usuario actualizado':'Usuario creado'); renderPortalPage();
}

/* ---------- IMPRESIÓN ---------- */
function abrirTicket(job){
  let body='';
  const e=job.emp;
  body+=`<div class="t-c">${e.logoImg?`<img src="${e.logoImg}" style="max-width:120px;max-height:60px;object-fit:contain;margin-bottom:4px">`:`<div style="font-size:28px">${e.logo}</div>`}<div style="font-weight:800;font-size:15px">${esc(e.nombre)}</div>`;
  if(job.tipo!=='comanda') body+=`<div style="font-size:11px">NIT ${esc(e.nit)}</div><div style="font-size:11px">${esc(e.dir)}</div><div style="font-size:11px">Tel: ${esc(e.tel)}</div>`;
  body+=`</div><div class="t-dash"></div><div class="t-c" style="font-weight:700;letter-spacing:1px">${job.titulo}</div>`;
  if(job.numero) body+=`<div class="t-c" style="font-size:11px">${job.numero}</div>`;
  body+=`<div class="t-dash"></div>`;
  if(job.tipo==='comanda'){
    body+=`<div style="font-size:11px">Mesa: ${esc(job.mesa)} · ${fmtTime(job.hora)}</div><div style="font-size:11px">Mesero: ${esc(job.mesero)}</div><div class="t-dash"></div>`;
    body+=job.items.map(it=>`<div class="t-line" style="font-size:14px;font-weight:700"><span>${it.cant}x ${esc(it.nombre)}</span></div>`).join('');
  } else if(job.tipo==='factura'){
    body+=`<div style="font-size:11px">${fmtDate(job.fecha)} ${fmtTime(job.fecha)}</div><div style="font-size:11px">${esc(job.mesa)} · Atendió: ${esc(job.mesero)}</div><div class="t-dash"></div>`;
    body+=job.items.map(it=>`<div class="t-line"><span>${it.cant}x ${esc(it.nombre)}</span><span>${money(it.precio*it.cant)}</span></div>`).join('');
    body+=`<div class="t-dash"></div><div class="t-line"><span>Subtotal</span><span>${money(job.subtotal)}</span></div>`;
    if(job.propina>0) body+=`<div class="t-line"><span>Propina</span><span>${money(job.propina)}</span></div>`;
    if(job.domicilio>0) body+=`<div class="t-line"><span>Domicilio</span><span>${money(job.domicilio)}</span></div>`;
    body+=`<div class="t-line" style="font-size:16px;font-weight:800;margin-top:4px"><span>TOTAL</span><span>${money(job.total)}</span></div><div class="t-dash"></div>`;
    body+=`<div class="t-line"><span>Pago (${job.metodo})</span><span>${money(job.recibido)}</span></div>`;
    if(job.cambio>0) body+=`<div class="t-line"><span>Cambio</span><span>${money(job.cambio)}</span></div>`;
  } else if(job.tipo==='cierre'){
    body+=`<div style="font-size:11px">${fmtDate(nowISO())} ${fmtTime(nowISO())}</div><div style="font-size:11px">Cajero: ${esc(job.cajero)}</div><div class="t-dash"></div>`;
    body+=`<div class="t-line"><span>Base inicial</span><span>${money(job.caja.base)}</span></div>`;
    body+=`<div class="t-line"><span>Ventas (${job.resumen.nVentas})</span><span>${money(job.resumen.ventas)}</span></div>`;
    body+=`<div class="t-line"><span>Entradas</span><span>${money(job.resumen.entradas)}</span></div>`;
    body+=`<div class="t-line"><span>Salidas</span><span>−${money(job.resumen.salidas)}</span></div><div class="t-dash"></div>`;
    body+=`<div class="t-line" style="font-size:16px;font-weight:800"><span>EFECTIVO ESPERADO</span><span>${money(job.resumen.esperado)}</span></div>`;
  }
  body+=`<div class="t-dash"></div><div class="t-c" style="font-size:11px;margin-top:6px">${job.tipo==='factura'?'¡Gracias por su compra!':'Wallace POS'}</div><div class="t-c" style="font-size:10px;color:#999;margin-top:4px">Generado por Wallace POS</div>`;
  openModal(`<div class="modal-head no-print"><h3>Vista previa de impresión</h3><div style="display:flex;gap:8px"><button class="btn btn-primary" onclick="window.print()">${ic('i-print')} Imprimir</button><button class="icon-btn" onclick="closeModal()">${ic('i-x')}</button></div></div>
    <div style="background:#e9e4dc;padding:18px"><div class="ticket" id="ticket-print">${body}</div></div>`);
}

/* ---------- ARRANQUE ---------- */
initData();
initFirebase();
