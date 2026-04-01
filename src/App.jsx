import { useState, useMemo, useRef, useEffect } from "react";
import { auth, db, storage } from "./firebase";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  doc,
  query,
  orderBy,
  setDoc,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

const GREEN = "#1D9E75";
const USERS = ["Nk", "Ak"];
const EXPENSE_CATS = ["飛行機", "電車", "その他交通費", "食事", "宿泊", "体験", "その他"];
const TRANSPORT_CATS = ["飛行機", "電車", "その他交通費"];
const USER_COLORS = { Nk: "#D4537E", Ak: "#378ADD", Natsuki: "#D4537E", Akira: "#378ADD" };
const EMAIL_TO_USER = {
  "na2kimu@gmail.com": "Nk",
  "marcosmini1@gmail.com": "Ak",
};
const getUserName = (email) => EMAIL_TO_USER[email] || "Nk";
const getPartnerName = (myName) => myName === "Nk" ? "Ak" : "Nk";
const toDisplayUser = (u) => {
  if (!u) return u;
  const s = String(u).trim();
  if (s === "Natsuki" || s.toUpperCase() === "NK") return "Nk";
  if (s === "Akira"   || s.toUpperCase() === "AK") return "Ak";
  return s;
};

// ★ カテゴリ選択肢：チェックイン/チェックアウトを直接表記
const SCHEDULE_CATS = ["行き", "帰り", "移動", "食事・カフェ", "買い物", "自由記述", "チェックイン", "チェックアウト", "宿泊"];
// ★ 移動手段に911・飛行機・自由記述を追加
const MOVE_METHODS  = ["電車", "徒歩", "車", "911", "飛行機", "自由記述"];
const CAT_DISPLAY   = {};
const catDisplay    = (cat) => cat;

const makeRow   = (id) => ({ id, cat: "食事", note: "", amount: "", paidBy: "Nk" });
const makeSpot  = (id) => ({ id, name: "", address: "", lat: "", lng: "" });
// ★ makeSched に nkRoutes/akRoutes（乗り換え対応）・移動の出発着地・moveMethodFree を追加
const makeSched = (id) => ({
  id,
  cat: "食事・カフェ",
  content: "",
  budget: "",
  time: "",
  place: "",
  spotName: "",
  address: "",
  lat: "",
  lng: "",
  dayOffset: 0,
  moveMethod: "電車",
  moveMethodFree: "",
  depTime: "",
  depPlace: "",
  depAddress: "",
  depLat: "",
  depLng: "",
  arrTime: "",
  arrPlace: "",
  arrAddress: "",
  arrLat: "",
  arrLng: "",
  // 行き・帰り：複数ルート対応
  nkRoutes: [makeRoute("nk-1")],
  akRoutes: [makeRoute("ak-1")],
});
const makeRoute = (id) => ({
  id,
  depTime: "",
  depPlace: "",
  arrTime: "",
  arrPlace: "",
  moveMethod: "電車",
  moveMethodFree: "",
});
const makeCheckItem = (id) => ({ id, text: "", checked: false });
const makeShopItem  = (id) => ({ id, text: "", checked: false });
const makeLink      = (id) => ({ id, label: "", url: "" });
const makeFutureSpot = (id) => ({ id, name: "", memo: "", address: "", lat: "", lng: "" });

const totalOf    = (items) => items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
const budgetOf   = (rows)  => rows.reduce((s, r) => isTransportCatSched(r.cat) ? s + routesBudget(r) : s + (Number(r.budget)||0), 0);
const routesBudget = (r) => 0; // 行き帰りに予算フィールドは現状なし
const paidByUser = (items, u) => items.filter(i => toDisplayUser(i.paidBy) === u).reduce((s, i) => s + (Number(i.amount)||0), 0);
const fmt        = (n) => `¥${Number(n).toLocaleString()}`;
const getYM      = (d) => d.slice(0, 7);
const getY       = (d) => d.slice(0, 4);
const itemLabel  = (item) => item.cat === "その他" && item.note ? item.note : item.cat + (item.note && item.cat !== "その他" ? `（${item.note}）` : "");
const isTransportCatSched = (cat) => cat === "行き" || cat === "帰り";
const isMoveCat   = (cat) => cat === "移動";

const ALL_MONTHS = ["すべて","01月","02月","03月","04月","05月","06月","07月","08月","09月","10月","11月","12月"];
const TABS = ["ホーム", "記録", "計画", "費用", "みらい"];
const CS  = { background:"#fff", borderRadius:12, border:"1px solid #eee", padding:"1rem 1.25rem", marginBottom:10 };
const INP = { boxSizing:"border-box", padding:"9px 12px", borderRadius:8, border:"1px solid #ddd", fontSize:14, width:"100%", fontFamily:"sans-serif" };
const SI  = { padding:"7px 10px", borderRadius:7, border:"1px solid #ddd", fontSize:13, fontFamily:"sans-serif", boxSizing:"border-box" };

// ── Login Screen ──
function LoginScreen({ onLogin, error, loading }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#f7faf9",padding:"1.5rem"}}>
      <div style={{width:"100%",maxWidth:360,background:"#fff",borderRadius:20,padding:"2rem 1.75rem",boxShadow:"0 4px 24px rgba(0,0,0,0.08)"}}>
        <p style={{margin:"0 0 4px",fontWeight:700,fontSize:22,color:GREEN,textAlign:"center"}}>AkNk プラン</p>
        <p style={{margin:"0 0 2rem",fontSize:13,color:"#aaa",textAlign:"center"}}>2人の記録・計画アプリ</p>
        <label style={{fontSize:12,color:"#888",display:"block",marginBottom:4}}>メールアドレス</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="例: natsuki@aknk.app"
          style={{...INP,marginBottom:12}} onKeyDown={e=>e.key==="Enter"&&onLogin(email,password)}/>
        <label style={{fontSize:12,color:"#888",display:"block",marginBottom:4}}>パスワード</label>
        <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="パスワード"
          style={{...INP,marginBottom:16}} onKeyDown={e=>e.key==="Enter"&&onLogin(email,password)}/>
        {error && <p style={{color:"#E24B4A",fontSize:13,marginBottom:12,textAlign:"center"}}>{error}</p>}
        <button onClick={()=>onLogin(email,password)} disabled={loading}
          style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:GREEN,color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer",opacity:loading?0.7:1}}>
          {loading ? "ログイン中..." : "ログイン"}
        </button>
      </div>
    </div>
  );
}

// ── Map ──
function SpotMap({ spots }) {
  const ref = useRef(null), inst = useRef(null);
  const allNamed = spots.filter(s => s.name);
  const withCoords = spots.filter(s => s.lat && s.lng && s.name);

  useEffect(() => {
    if (!ref.current || !withCoords.length) return;
    const init = () => {
      try {
        if (inst.current) { inst.current.remove(); inst.current = null; }
        if (!ref.current) return;
        ref.current._leaflet_id = null;
        const L = window.L;
        const cx = withCoords.length === 1
          ? [withCoords[0].lat, withCoords[0].lng]
          : [withCoords.reduce((s,sp)=>s+Number(sp.lat),0)/withCoords.length, withCoords.reduce((s,sp)=>s+Number(sp.lng),0)/withCoords.length];
        const map = L.map(ref.current).setView(cx, withCoords.length===1?15:13);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OSM"}).addTo(map);
        withCoords.forEach((sp) => {
          const idx = allNamed.findIndex(s => s.id === sp.id || s.name === sp.name);
          const num = idx >= 0 ? idx + 1 : "•";
          const icon = L.divIcon({ html:`<div style="background:${GREEN};color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.25)">${num}</div>`, className:"", iconSize:[28,28], iconAnchor:[14,14] });
          const gmapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sp.address||sp.name)}`;
          L.marker([Number(sp.lat),Number(sp.lng)],{icon}).addTo(map)
           .bindPopup(`<b>${sp.name}</b><br><a href="${gmapUrl}" target="_blank" style="color:${GREEN};font-size:12px">Googleマップで開く</a>`);
        });
        if (withCoords.length > 1) map.fitBounds(L.latLngBounds(withCoords.map(sp=>[Number(sp.lat),Number(sp.lng)])),{padding:[30,30]});
        inst.current = map;
      } catch(e) { console.error("Map init error:", e); }
    };
    if (!document.getElementById("lf-css")) { const lk=document.createElement("link");lk.id="lf-css";lk.rel="stylesheet";lk.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";document.head.appendChild(lk); }
    window.L ? init() : (() => { if (!document.getElementById("lf-js")) { const sc=document.createElement("script");sc.id="lf-js";sc.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";sc.onload=()=>setTimeout(init,50);document.head.appendChild(sc); } else setTimeout(init,200); })();
    return () => { try { if (inst.current) { inst.current.remove(); inst.current=null; } } catch(e){} };
  }, [JSON.stringify(withCoords)]);

  if (!allNamed.length) return null;

  const toQuery = (sp) => encodeURIComponent(sp.address || sp.name);
  const routeUrl = allNamed.length === 1
    ? `https://www.google.com/maps/search/?api=1&query=${toQuery(allNamed[0])}`
    : `https://www.google.com/maps/dir/${allNamed.map(toQuery).join("/")}`;

  return (
    <div>
      {withCoords.length > 0 && (
        <div ref={ref} style={{width:"100%",height:220,borderRadius:10,overflow:"hidden",border:"1px solid #eee",marginBottom:8}}/>
      )}
      <a href={routeUrl} target="_blank" rel="noreferrer"
        style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:"100%",padding:"9px",borderRadius:10,background:"#e8f5f0",border:`1px solid ${GREEN}33`,color:GREEN,fontWeight:700,fontSize:13,textDecoration:"none",marginBottom:8,boxSizing:"border-box"}}>
        <span>{allNamed.length === 1 ? "Googleマップで開く" : `${allNamed.length}ヶ所のルートをGoogleマップで開く`}</span>
      </a>
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        {allNamed.map((sp,i) => (
          <a key={i} href={`https://www.google.com/maps/search/?api=1&query=${toQuery(sp)}`} target="_blank" rel="noreferrer"
            style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#333",textDecoration:"none",padding:"5px 8px",borderRadius:7,background:"#f7f7f7"}}>
            <span style={{background:sp.lat?GREEN:"#bbb",color:"#fff",borderRadius:"50%",width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{i+1}</span>
            <span style={{flex:1}}>{sp.name}</span>
            <span style={{fontSize:11,color:GREEN}}>Gマップ</span>
          </a>
        ))}
      </div>
    </div>
  );
}

async function geocode(q) {
  const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms));
  const fetchWithTimeout = async (url, ms = 8000) => Promise.race([fetch(url), timeout(ms)]);

  const zipMatch = q.replace(/[〒\s　]/g, "").match(/(\d{3})-?(\d{4})/);
  if (zipMatch) {
    try {
      const r = await fetchWithTimeout(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zipMatch[1]+zipMatch[2]}`, 5000);
      if (r.ok) {
        const d = await r.json();
        if (d?.results?.[0]) {
          const base = d.results[0].address1 + d.results[0].address2 + d.results[0].address3;
          const after = q.replace(/[〒\s　]/g,"").replace(/\d{3}-?\d{4}/, "").trim();
          q = base + after;
        }
      }
    } catch {}
  }

  try {
    const r = await fetchWithTimeout(`https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(q)}`, 6000);
    if (r.ok) {
      const d = await r.json();
      if (d?.[0]?.geometry?.coordinates) {
        const [lng, lat] = d[0].geometry.coordinates;
        return { lat, lng };
      }
    }
  } catch {}

  try {
    const r = await fetchWithTimeout(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=10&lang=ja&bbox=122,24,154,46`, 7000);
    if (r.ok) {
      const d = await r.json();
      const jp = d?.features?.find(f => f.properties?.country === "Japan" || f.properties?.country === "日本");
      const f = jp || d?.features?.[0];
      if (f) return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
    }
  } catch {}

  const qShort = q.replace(/\d+番(地|丁目)?/, "").replace(/[-－]\d+$/, "").trim();
  if (qShort !== q) {
    try {
      const r = await fetchWithTimeout(`https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(qShort)}`, 6000);
      if (r.ok) {
        const d = await r.json();
        if (d?.[0]?.geometry?.coordinates) {
          const [lng, lat] = d[0].geometry.coordinates;
          return { lat, lng };
        }
      }
    } catch {}
  }

  return null;
}

function RowEditor({ rows, onUpdate, onAdd, onRemove, defaultPaidBy }) {
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"80px 1fr 80px 46px 18px",gap:3,marginBottom:4}}>
        {["カテゴリ","内容","金額","払者",""].map((h,i)=><span key={i} style={{fontSize:11,color:"#aaa"}}>{h}</span>)}
      </div>
      {rows.map(row => (
        <div key={row.id} style={{display:"grid",gridTemplateColumns:"80px 1fr 80px 46px 18px",gap:3,marginBottom:5,alignItems:"center"}}>
          <select value={row.cat} onChange={e=>onUpdate(row.id,"cat",e.target.value)} style={{...SI,padding:"7px 4px"}}>
            {EXPENSE_CATS.map(c=><option key={c}>{c}</option>)}
          </select>
          <input value={row.note} placeholder={row.cat==="その他"?"内容を入力":"補足（任意）"} onChange={e=>onUpdate(row.id,"note",e.target.value)}
            style={{...SI,background:row.cat==="その他"?"#fffbe6":"#fff",borderColor:row.cat==="その他"&&!row.note?"#f0c040":"#ddd"}}/>
          <input type="number" value={row.amount} placeholder="0" onChange={e=>onUpdate(row.id,"amount",e.target.value)} style={{...SI,textAlign:"right"}}/>
          <select value={row.paidBy} onChange={e=>onUpdate(row.id,"paidBy",e.target.value)} style={{...SI,padding:"7px 2px",color:USER_COLORS[row.paidBy],fontSize:12}}>
            {USERS.map(u=><option key={u}>{u}</option>)}
          </select>
          <button onClick={()=>onRemove(row.id)} style={{background:"none",border:"none",color:"#ccc",fontSize:16,cursor:"pointer",padding:0}}>×</button>
        </div>
      ))}
      <button onClick={()=>onAdd(defaultPaidBy||"Nk")} style={{width:"100%",padding:"7px",borderRadius:8,border:"1px dashed #ddd",background:"transparent",cursor:"pointer",fontSize:12,color:"#888",marginTop:2}}>+ 行を追加</button>
    </div>
  );
}

function SpotEditor({ spots, onUpdate, onGeocode, onAdd, onRemove, onMove }) {
  return (
    <div style={{width:"100%",minWidth:0}}>
      {spots.map((spot,i) => (
        <div key={spot.id} style={{background:"#f9f9f9",borderRadius:10,padding:"10px 12px",marginBottom:8,border:"1px solid #eee"}}>
          <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:6}}>
            <div style={{display:"flex",flexDirection:"column",gap:1,flexShrink:0}}>
              <button onClick={()=>onMove(i,-1)} disabled={i===0} style={{background:"none",border:"none",color:i===0?"#ddd":"#aaa",cursor:i===0?"default":"pointer",padding:"0 2px",fontSize:12,lineHeight:1}}>▲</button>
              <button onClick={()=>onMove(i,1)} disabled={i===spots.length-1} style={{background:"none",border:"none",color:i===spots.length-1?"#ddd":"#aaa",cursor:i===spots.length-1?"default":"pointer",padding:"0 2px",fontSize:12,lineHeight:1}}>▼</button>
            </div>
            <span style={{background:GREEN,color:"#fff",borderRadius:"50%",width:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{i+1}</span>
            <input value={spot.name} placeholder="場所名（例: 近江町市場）" onChange={e=>onUpdate(spot.id,"name",e.target.value)} style={{...SI,flex:1}}/>
            {spots.length>1 && <button onClick={()=>onRemove(spot.id)} style={{background:"none",border:"none",color:"#ccc",fontSize:18,cursor:"pointer",padding:0,flexShrink:0}}>×</button>}
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center",paddingLeft:32}}>
            <input value={spot.address||""} placeholder="住所を入力すると地図にピンが立ちます" onChange={e=>onUpdate(spot.id,"address",e.target.value)} style={{...SI,flex:1}}/>
            <button onClick={()=>onGeocode(spot.id, spot.address||spot.name)} disabled={spot.searching||!spot.name}
              style={{padding:"7px 10px",borderRadius:7,border:"none",background:GREEN,color:"#fff",fontSize:12,cursor:(spot.searching||!spot.name)?"not-allowed":"pointer",whiteSpace:"nowrap",flexShrink:0,opacity:(spot.searching||!spot.name)?0.5:1}}>
              {spot.searching ? "検索中…" : spot.lat ? "再取得" : "地図取得"}
            </button>
          </div>
          {spot.lat && <p style={{margin:"4px 0 0",fontSize:11,color:GREEN,paddingLeft:32}}>✓ 取得済</p>}
          {spot.geoError && !spot.lat && <p style={{margin:"4px 0 0",fontSize:11,color:"#E24B4A",paddingLeft:32}}>取得できませんでした。住所を入力して再度お試しください。</p>}
        </div>
      ))}
      <button onClick={onAdd} style={{fontSize:12,padding:"4px 12px",borderRadius:20,border:"1px solid #ddd",background:"transparent",cursor:"pointer",marginTop:2}}>+ 場所を追加</button>
    </div>
  );
}

// ★ ScheduleEditor を全面刷新
function ScheduleEditor({ rows, onUpdate, onAdd, onRemove, onMove, onGeocode, onGeocodeMove, baseDate }) {
  const dayOptions = Array.from({length:7}, (_,i) => {
    if (!baseDate) return { value: i, label: `${i+1}日目` };
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    const m = d.getMonth()+1, day = d.getDate();
    return { value: i, label: `${i+1}日目（${m}/${day}）` };
  });

  const timeSelects = (value, onChange, step1min=false) => {
    const hVal = value ? value.split(":")[0] : "";
    const mVal = value ? value.split(":")[1]||"00" : "";
    const mins = step1min
      ? Array.from({length:60},(_,i)=>String(i).padStart(2,"0"))
      : ["00","15","30","45"];
    return (
      <div style={{display:"flex",gap:2,alignItems:"center",flexShrink:0}}>
        <select value={hVal} onChange={e=>{const m=mVal||"00";onChange(e.target.value?`${e.target.value}:${m}`:"");}}
          style={{...SI,width:52,padding:"7px 3px",boxSizing:"border-box",fontSize:13}}>
          <option value="">--</option>
          {Array.from({length:24},(_,i)=><option key={i} value={String(i).padStart(2,"0")}>{String(i).padStart(2,"0")}</option>)}
        </select>
        <span style={{fontSize:13,color:"#888"}}>:</span>
        <select value={mVal||""} onChange={e=>{const h=hVal||"00";onChange(hVal||e.target.value?`${h}:${e.target.value}`:"");}}
          style={{...SI,width:step1min?52:50,padding:"7px 3px",boxSizing:"border-box",fontSize:13}}>
          {!step1min&&<option value="">--</option>}
          {mins.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    );
  };

  // 移動手段セレクト（自由記述対応）
  const MoveMethodSelect = ({ value, freeValue, onChangeMethod, onChangeFree }) => (
    <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
      <select value={value||"電車"} onChange={e=>onChangeMethod(e.target.value)}
        style={{...SI,padding:"7px 6px"}}>
        {MOVE_METHODS.map(m=><option key={m}>{m}</option>)}
      </select>
      {value==="自由記述" && (
        <input value={freeValue||""} onChange={e=>onChangeFree(e.target.value)}
          placeholder="移動手段を入力" style={{...SI,flex:1,minWidth:80}}/>
      )}
    </div>
  );


// ── TransportPersonBlock（ScheduleEditorの外に定義・リマウント防止）──
function TransportPersonBlock({ row, who, label, color, onUpdateRoutes, SI, GREEN, MOVE_METHODS }) {
  const routes = row[`${who}Routes`] || [makeRoute(`${who}-1`)];
  const updateRoute = (routeId, field, val) => {
    onUpdateRoutes(routes.map(r => r.id === routeId ? {...r, [field]: val} : r));
  };
  const addRoute = () => {
    onUpdateRoutes([...routes, makeRoute(`${who}-${Date.now()}`)]);
  };
  const removeRoute = (routeId) => {
    const newRoutes = routes.filter(r => r.id !== routeId);
    onUpdateRoutes(newRoutes.length ? newRoutes : [makeRoute(`${who}-${Date.now()}`)]);
  };
  const hours = Array.from({length:24},(_,i)=>String(i).padStart(2,"0"));
  const mins1 = Array.from({length:60},(_,i)=>String(i).padStart(2,"0"));
  const timeSelects = (value, onChange) => {
    const hVal = value ? value.split(":")[0] : "";
    const mVal = value ? value.split(":")[1]||"00" : "";
    return (
      <div style={{display:"flex",gap:2,alignItems:"center",flexShrink:0}}>
        <select value={hVal} onChange={e=>{const m=mVal||"00";onChange(e.target.value?`${e.target.value}:${m}`:"");}}
          style={{...SI,width:52,padding:"7px 3px",boxSizing:"border-box",fontSize:13}}>
          <option value="">--</option>
          {hours.map(h=><option key={h} value={h}>{h}</option>)}
        </select>
        <span style={{fontSize:13,color:"#888"}}>:</span>
        <select value={mVal||""} onChange={e=>{const h=hVal||"00";onChange(hVal||e.target.value?`${h}:${e.target.value}`:"");}}
          style={{...SI,width:52,padding:"7px 3px",boxSizing:"border-box",fontSize:13}}>
          {mins1.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    );
  };
  return (
    <div style={{background:"#fff",borderRadius:8,padding:"10px 12px",border:`1px solid ${color}33`,marginBottom:10,boxSizing:"border-box"}}>
      <p style={{margin:"0 0 8px",fontSize:12,fontWeight:700,color}}>{label}</p>
      {routes.map((route, ri) => (
        <div key={route.id} style={{borderTop: ri>0 ? "1px dashed #eee" : "none", paddingTop: ri>0 ? 8 : 0, marginTop: ri>0 ? 8 : 0}}>
          {ri > 0 && (
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <span style={{fontSize:11,color:"#aaa"}}>乗り換え {ri}</span>
              <button onClick={()=>removeRoute(route.id)} style={{background:"none",border:"none",color:"#ccc",fontSize:13,cursor:"pointer",padding:0}}>× 削除</button>
            </div>
          )}
          <div style={{display:"flex",gap:4,alignItems:"center",marginBottom:5}}>
            {timeSelects(route.depTime||"", v=>updateRoute(route.id,"depTime",v))}
            <input key={route.id+"-dep"} defaultValue={route.depPlace||""} onBlur={e=>updateRoute(route.id,"depPlace",e.target.value)}
              placeholder="出発地" style={{...SI,flex:1,minWidth:0,boxSizing:"border-box"}}/>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:5,paddingLeft:4}}>
            <select value={route.moveMethod||"電車"} onChange={e=>updateRoute(route.id,"moveMethod",e.target.value)}
              style={{...SI,padding:"7px 6px"}}>
              {MOVE_METHODS.map(m=><option key={m}>{m}</option>)}
            </select>
            {(route.moveMethod||"電車")==="自由記述" && (
              <input key={route.id+"-free"} defaultValue={route.moveMethodFree||""} onBlur={e=>updateRoute(route.id,"moveMethodFree",e.target.value)}
                placeholder="移動手段を入力" style={{...SI,flex:1,minWidth:80}}/>
            )}
          </div>
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            {timeSelects(route.arrTime||"", v=>updateRoute(route.id,"arrTime",v))}
            <input key={route.id+"-arr"} defaultValue={route.arrPlace||""} onBlur={e=>updateRoute(route.id,"arrPlace",e.target.value)}
              placeholder="到着地" style={{...SI,flex:1,minWidth:0,boxSizing:"border-box"}}/>
          </div>
        </div>
      ))}
      <button onClick={addRoute}
        style={{width:"100%",padding:"6px",borderRadius:7,border:"1px dashed #ddd",background:"transparent",cursor:"pointer",fontSize:12,color:"#888",marginTop:8}}>
        + 乗り換えを追加
      </button>
    </div>
  );
}

  return (
    <div style={{width:"100%",minWidth:0}}>
      {rows.map((row,i) => {
        const isTrans = isTransportCatSched(row.cat);
        const isMove  = isMoveCat(row.cat);
        const dayOff  = row.dayOffset ?? 0;
        // 移動のGoogleマップルートURL
        const moveRouteUrl = (row.depLat && row.arrLat)
          ? `https://www.google.com/maps/dir/${row.depLat},${row.depLng}/${row.arrLat},${row.arrLng}`
          : (row.depPlace && row.arrPlace)
          ? `https://www.google.com/maps/dir/${encodeURIComponent(row.depPlace)}/${encodeURIComponent(row.arrPlace)}`
          : null;

        return (
          <div key={row.id} style={{background:"#f9f9f9",borderRadius:10,padding:"10px 12px",marginBottom:16,border:"1px solid #eee",minWidth:0,boxSizing:"border-box"}}>
            {/* 上段：並び替え／カテゴリ／内容／削除 */}
            <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:8,minWidth:0}}>
              <div style={{display:"flex",flexDirection:"column",gap:1,flexShrink:0}}>
                <button onClick={()=>onMove(i,-1)} disabled={i===0} style={{background:"none",border:"none",color:i===0?"#ddd":"#aaa",cursor:i===0?"default":"pointer",padding:"0 2px",fontSize:12,lineHeight:1}}>▲</button>
                <button onClick={()=>onMove(i,1)} disabled={i===rows.length-1} style={{background:"none",border:"none",color:i===rows.length-1?"#ddd":"#aaa",cursor:i===rows.length-1?"default":"pointer",padding:"0 2px",fontSize:12,lineHeight:1}}>▼</button>
              </div>
              <select value={row.cat} onChange={e=>onUpdate(row.id,"cat",e.target.value)} style={{...SI,padding:"7px 4px",flexShrink:0,maxWidth:110}}>
                {SCHEDULE_CATS.map(c=><option key={c}>{c}</option>)}
              </select>
              {/* 行き・帰り・自由記述は上段の内容欄不要 */}
              {!isTransportCatSched(row.cat) && row.cat !== "自由記述" && (
                <input value={row.content||""} onChange={e=>onUpdate(row.id,"content",e.target.value)} placeholder="内容" style={{...SI,flex:1,minWidth:0}}/>
              )}
              <button onClick={()=>onRemove(row.id)} style={{background:"none",border:"none",color:"#ccc",fontSize:16,cursor:"pointer",padding:0,flexShrink:0}}>×</button>
            </div>

            {/* 日付セレクト */}
            <div style={{paddingLeft:32,marginBottom:8}}>
              <select value={dayOff} onChange={e=>onUpdate(row.id,"dayOffset",Number(e.target.value))}
                style={{...SI,fontSize:12,padding:"5px 8px",background:"#fff",color:GREEN,fontWeight:600,border:`1px solid ${GREEN}44`}}>
                {dayOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* ★ 行き・帰り：Nk/Ak 縦並び */}
            {isTrans && (
              <div style={{display:"flex",flexDirection:"column",gap:0,width:"100%",boxSizing:"border-box"}}>
                <TransportPersonBlock key={row.id+"-nk"} row={row} who="nk" label="Nk" color={USER_COLORS.Nk} onUpdateRoutes={(routes)=>onUpdate(row.id,"nkRoutes",routes)} SI={SI} GREEN={GREEN} MOVE_METHODS={MOVE_METHODS}/>
                <TransportPersonBlock key={row.id+"-ak"} row={row} who="ak" label="Ak" color={USER_COLORS.Ak} onUpdateRoutes={(routes)=>onUpdate(row.id,"akRoutes",routes)} SI={SI} GREEN={GREEN} MOVE_METHODS={MOVE_METHODS}/>
              </div>
            )}

            {/* ★ 移動：手段＋出発着＋位置情報取得＋Googleマップルート */}
            {isMove && (
              <div style={{display:"flex",flexDirection:"column",gap:6,width:"100%",boxSizing:"border-box"}}>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{fontSize:12,color:"#888",flexShrink:0}}>移動手段</span>
                  <MoveMethodSelect
                    value={row.moveMethod||"電車"}
                    freeValue={row.moveMethodFree||""}
                    onChangeMethod={v=>onUpdate(row.id,"moveMethod",v)}
                    onChangeFree={v=>onUpdate(row.id,"moveMethodFree",v)}
                  />
                </div>
                {/* 出発 */}
                <div>
                  <p style={{fontSize:11,color:"#888",marginBottom:4}}>出発</p>
                  {timeSelects(row.depTime||"", v=>onUpdate(row.id,"depTime",v), true)}
                  <input value={row.depPlace||""} onChange={e=>onUpdate(row.id,"depPlace",e.target.value)}
                    placeholder="地名（例: 金沢駅）" style={{...SI,width:"100%",boxSizing:"border-box",marginTop:5}}/>
                  <div style={{display:"flex",gap:6,alignItems:"center",marginTop:5}}>
                    <input value={row.depAddress||""} onChange={e=>onUpdate(row.id,"depAddress",e.target.value)}
                      placeholder="住所（任意）" style={{...SI,flex:1,minWidth:0,boxSizing:"border-box"}}/>
                    <button onClick={()=>onGeocodeMove(row.id,"dep",row.depAddress||row.depPlace)}
                      disabled={row.depSearching||(!row.depAddress&&!row.depPlace)}
                      style={{padding:"7px 8px",borderRadius:7,border:"none",background:GREEN,color:"#fff",fontSize:11,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,opacity:(row.depSearching||(!row.depAddress&&!row.depPlace))?0.5:1}}>
                      {row.depSearching ? "検索中…" : row.depLat ? "再取得" : "地図取得"}
                    </button>
                  </div>
                  {row.depLat && <p style={{margin:"2px 0 0",fontSize:11,color:GREEN}}>✓ 取得済</p>}
                  {row.depGeoError && !row.depLat && <p style={{margin:"2px 0 0",fontSize:11,color:"#E24B4A"}}>取得できませんでした。住所を入力して再度お試しください。</p>}
                </div>
                {/* 到着 */}
                <div>
                  <p style={{fontSize:11,color:"#888",marginBottom:4}}>到着</p>
                  {timeSelects(row.arrTime||"", v=>onUpdate(row.id,"arrTime",v), true)}
                  <input value={row.arrPlace||""} onChange={e=>onUpdate(row.id,"arrPlace",e.target.value)}
                    placeholder="地名（例: 兼六園）" style={{...SI,width:"100%",boxSizing:"border-box",marginTop:5}}/>
                  <div style={{display:"flex",gap:6,alignItems:"center",marginTop:5}}>
                    <input value={row.arrAddress||""} onChange={e=>onUpdate(row.id,"arrAddress",e.target.value)}
                      placeholder="住所（任意）" style={{...SI,flex:1,minWidth:0,boxSizing:"border-box"}}/>
                    <button onClick={()=>onGeocodeMove(row.id,"arr",row.arrAddress||row.arrPlace)}
                      disabled={row.arrSearching||(!row.arrAddress&&!row.arrPlace)}
                      style={{padding:"7px 8px",borderRadius:7,border:"none",background:GREEN,color:"#fff",fontSize:11,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,opacity:(row.arrSearching||(!row.arrAddress&&!row.arrPlace))?0.5:1}}>
                      {row.arrSearching ? "検索中…" : row.arrLat ? "再取得" : "地図取得"}
                    </button>
                  </div>
                  {row.arrLat && <p style={{margin:"2px 0 0",fontSize:11,color:GREEN}}>✓ 取得済</p>}
                  {row.arrGeoError && !row.arrLat && <p style={{margin:"2px 0 0",fontSize:11,color:"#E24B4A"}}>取得できませんでした。住所を入力して再度お試しください。</p>}
                </div>
                {/* Googleマップルートリンク */}
                {moveRouteUrl && (
                  <a href={moveRouteUrl} target="_blank" rel="noreferrer"
                    style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"8px",borderRadius:8,background:"#e8f5f0",border:`1px solid ${GREEN}33`,color:GREEN,fontSize:12,textDecoration:"none",fontWeight:700}}>
                    Googleマップでルートを開く
                  </a>
                )}
              </div>
            )}

            {/* その他（食事・カフェ / 自由記述 / 買い物 / チェックイン / チェックアウト / 宿泊）：15分刻み */}
            {!isTrans && !isMove && (
              <div style={{display:"flex",flexDirection:"column",gap:6,minWidth:0}}>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  {timeSelects(row.time||"", v=>onUpdate(row.id,"time",v), false)}
                  {/* 自由記述は予算なし */}
                  {row.cat !== "自由記述" && (
                    <div style={{display:"flex",alignItems:"center",gap:3,flex:1,minWidth:0}}>
                      <span style={{fontSize:11,color:"#aaa",flexShrink:0}}>予算¥</span>
                      <input type="number" value={row.budget} onChange={e=>onUpdate(row.id,"budget",e.target.value)}
                        placeholder="0" style={{...SI,flex:1,minWidth:0,textAlign:"right",boxSizing:"border-box"}}/>
                    </div>
                  )}
                </div>
                {/* 自由記述：内容(content)・補足(place)・場所名・住所・地図取得 */}
                {row.cat === "自由記述" && (
                  <input value={row.content||""} onChange={e=>onUpdate(row.id,"content",e.target.value)}
                    placeholder="内容" style={{...SI,width:"100%",boxSizing:"border-box"}}/>
                )}
                {row.cat === "自由記述" && (
                  <input value={row.place||""} onChange={e=>onUpdate(row.id,"place",e.target.value)}
                    placeholder="補足（任意）" style={{...SI,width:"100%",boxSizing:"border-box"}}/>
                )}
                {/* 場所名・住所・地図取得：全カテゴリ共通（自由記述は場所名ラベルが変わる） */}
                <input value={row.spotName||""} onChange={e=>onUpdate(row.id,"spotName",e.target.value)}
                  placeholder={row.cat==="自由記述" ? "場所名（任意）" : "場所名"} style={{...SI,width:"100%",boxSizing:"border-box"}}/>
                <div style={{display:"flex",gap:6,alignItems:"center",minWidth:0}}>
                  <input value={row.address||""} onChange={e=>onUpdate(row.id,"address",e.target.value)}
                    placeholder="住所を入力すると地図にピンが立ちます" style={{...SI,flex:1,minWidth:0}}/>
                  <button onClick={()=>onGeocode(row.id, row.address||row.spotName||row.place||row.content)}
                    disabled={row.searching||(!row.spotName&&!row.place&&!row.content&&!row.address)}
                    style={{padding:"7px 8px",borderRadius:7,border:"none",background:GREEN,color:"#fff",fontSize:11,cursor:(row.searching||(!row.spotName&&!row.place&&!row.content&&!row.address))?"not-allowed":"pointer",whiteSpace:"nowrap",flexShrink:0,opacity:(row.searching||(!row.spotName&&!row.place&&!row.content&&!row.address))?0.5:1}}>
                    {row.searching ? "検索中…" : row.lat ? "再取得" : "地図取得"}
                  </button>
                </div>
                {row.lat && <p style={{margin:"2px 0 0",fontSize:11,color:GREEN}}>✓ 取得済</p>}
                {row.geoError && !row.lat && <p style={{margin:"2px 0 0",fontSize:11,color:"#E24B4A"}}>取得できませんでした。住所を入力して再度お試しください。</p>}
              </div>
            )}
          </div>
        );
      })}
      <button onClick={onAdd} style={{width:"100%",padding:"7px",borderRadius:8,border:"1px dashed #ddd",background:"transparent",cursor:"pointer",fontSize:12,color:"#888",marginTop:2}}>+ 行を追加</button>
    </div>
  );
}

// ── App ──
export default function App() {
  const [user,        setUser]        = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError,  setLoginError]  = useState("");
  const [loginLoading,setLoginLoading]= useState(false);

  const [activeTab,   setActiveTab]   = useState("ホーム");
  const [dates,       setDates]       = useState([]);
  const [plans,       setPlans]       = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [selDateId,   setSelDateId]   = useState(null);
  const [selPlanId,   setSelPlanId]   = useState(null);
  const [editDateId,  setEditDateId]  = useState(null);
  const [editPlanId,  setEditPlanId]  = useState(null);
  const [filterYear,  setFilterYear]  = useState("すべて");
  const [filterMonth, setFilterMonth] = useState("すべて");
  const [filterCat,   setFilterCat]   = useState("すべて");
  const [showAddDate, setShowAddDate] = useState(false);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [showBulk,    setShowBulk]    = useState(false);
  const [photoView,   setPhotoView]   = useState(null);
  const [saving,      setSaving]      = useState(false);

  const currentUserName = user ? getUserName(user.email) : "Nk";
  const partnerName = getPartnerName(currentUserName);
  const [partnerItems, setPartnerItems] = useState([]);

  const [ndTitle,  setNdTitle]  = useState("");
  const [ndDate,   setNdDate]   = useState("");
  const [ndMemo,   setNdMemo]   = useState("");
  const [ndItems,  setNdItems]  = useState(Array.from({length:5},(_,i)=>makeRow(i+1)));
  const [ndSpots,  setNdSpots]  = useState([makeSpot(1)]);
  const [ndPhotos, setNdPhotos] = useState([]);
  const photoRef = useRef(null);

  const [npTitle,  setNpTitle]  = useState("");
  const [npDate,   setNpDate]   = useState("");
  const [npMemo,   setNpMemo]   = useState("");
  const [npSched,  setNpSched]  = useState([makeSched(1)]);
  const [npChecks, setNpChecks] = useState({ Nk: [makeCheckItem(1)], Ak: [makeCheckItem(2)] });
  const [npShops,  setNpShops]  = useState([makeShopItem(3)]);
  const [npLinks,  setNpLinks]  = useState([makeLink(1)]);
  const [npPlanTab,setNpPlanTab]= useState("スケジュール");

  const [futureSpots, setFutureSpots] = useState([]);
  const [showAddFuture, setShowAddFuture] = useState(false);
  const [editFutureId, setEditFutureId] = useState(null);
  const [fsName,  setFsName]  = useState("");
  const [fsMemo,  setFsMemo]  = useState("");
  const [fsAddr,  setFsAddr]  = useState("");
  const [fsLat,   setFsLat]   = useState("");
  const [fsLng,   setFsLng]   = useState("");
  const [fsSearching, setFsSearching] = useState(false);

  const [budgets, setBudgets] = useState({});
  const [editBudgetYear, setEditBudgetYear] = useState(null);
  const [bulkRows, setBulkRows] = useState(Array.from({length:5},(_,i)=>makeRow(i+1)));

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setAuthLoading(false); });
    return unsub;
  }, []);

  const handleLogin = async (email, password) => {
    setLoginLoading(true); setLoginError("");
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch (e) { setLoginError("メールアドレスまたはパスワードが違います"); }
    setLoginLoading(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setDates([]); setPlans([]); setFutureSpots([]);
    setActiveTab("ホーム");
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      getDocs(query(collection(db, "dates"), orderBy("date","desc"))),
      getDocs(query(collection(db, "plans"), orderBy("date","asc"))),
      getDocs(collection(db, "futureSpots")),
      getDocs(collection(db, "budgets")),
    ]).then(([dateSnap, planSnap, futureSnap, budgetSnap]) => {
      setDates(dateSnap.docs.map(d => ({ ...d.data(), id: d.id })));
      setPlans(planSnap.docs.map(d => ({ ...d.data(), id: d.id })));
      setFutureSpots(futureSnap.docs.map(d => ({ ...d.data(), id: d.id })));
      const budgetData = {};
      budgetSnap.docs.forEach(d => { budgetData[d.id] = d.data(); });
      setBudgets(budgetData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  const selDate = dates.find(d => d.id === selDateId);
  const selPlan = plans.find(p => p.id === selPlanId);

  const allYears = useMemo(() => {
    const ys = Array.from(new Set(dates.map(d => getY(d.date)))).sort().reverse();
    return ["すべて", ...ys];
  }, [dates]);

  const filtered = useMemo(() => dates.filter(d => {
    const y = getY(d.date), m = d.date.slice(5,7)+"月";
    return (filterYear==="すべて"||y===filterYear) && (filterMonth==="すべて"||m===filterMonth);
  }), [dates, filterYear, filterMonth]);

  const totalAll    = dates.reduce((s,d)=>s+totalOf(d.items||[]),0);
  const filteredTot = filtered.reduce((s,d)=>s+totalOf(d.items||[]),0);

  const yearlySummary = useMemo(()=>{
    const map={};
    dates.forEach(d=>{const y=getY(d.date);if(!map[y])map[y]={total:0,count:0};map[y].total+=totalOf(d.items||[]);map[y].count++;});
    return Object.entries(map).sort((a,b)=>b[0].localeCompare(a[0]));
  },[dates]);

  const monthlySummary = useMemo(()=>{
    const map={};
    dates.forEach(d=>{const ym=getYM(d.date);map[ym]=(map[ym]||0)+totalOf(d.items||[]);});
    return Object.entries(map).sort((a,b)=>b[0].localeCompare(a[0]));
  },[dates]);

  const userTotals = useMemo(()=>{
    const res={Nk:0,Ak:0};
    dates.forEach(d=>(d.items||[]).forEach(i=>{
      const key = toDisplayUser(i.paidBy);
      res[key]=(res[key]||0)+(Number(i.amount)||0);
    }));
    return res;
  },[dates]);

  const isTransportCat = (cat) => TRANSPORT_CATS.includes(cat);

  const catSummary = useMemo(()=>{
    const map={};
    filtered.forEach(d=>(d.items||[]).forEach(i=>{
      if(filterCat==="交通費") { if(!isTransportCat(i.cat)) return; }
      else if(filterCat!=="すべて" && i.cat!==filterCat) return;
      map[i.cat]=(map[i.cat]||0)+(Number(i.amount)||0);
    }));
    return Object.entries(map).sort((a,b)=>b[1]-a[1]);
  },[filtered,filterCat]);

  const catFilteredTotal = useMemo(()=>{
    if(filterCat==="すべて") return filteredTot;
    if(filterCat==="交通費") return filtered.reduce((s,d)=>s+(d.items||[]).filter(i=>isTransportCat(i.cat)).reduce((ss,i)=>ss+(Number(i.amount)||0),0),0);
    return filtered.reduce((s,d)=>s+(d.items||[]).filter(i=>i.cat===filterCat).reduce((ss,i)=>ss+(Number(i.amount)||0),0),0);
  },[filtered,filterCat,filteredTot]);

  // planSpots：行き帰り・移動はマップ除外、自由記述はplace+latがあれば追加
  const planSpots = (plan) => {
    const spots = [];
    (plan.schedule||[]).forEach((s, i) => {
      if (isTransportCatSched(s.cat)) return;
      if (isMoveCat(s.cat)) return; // 移動はマップに追加しない
      if (s.spotName || s.place || s.content) {
        spots.push({ id: s.id||i, name: s.spotName||s.place||s.content||"スポット", address: s.address||"", lat: s.lat||"", lng: s.lng||"" });
      }
    });
    return spots;
  };

  // ── Date form ──
  const openAddDate = () => {
    setEditDateId(null); setNdTitle(""); setNdDate(""); setNdMemo("");
    setNdItems(Array.from({length:3},(_,i)=>({...makeRow(i+1),paidBy:currentUserName})));
    setPartnerItems([]);
    setNdSpots([makeSpot(1)]); setNdPhotos([]); setShowAddDate(true);
  };
  const openEditDate = (d) => {
    setEditDateId(d.id); setNdTitle(d.title); setNdDate(d.date); setNdMemo(d.memo||"");
    const allItems = (d.items||[]).map(it=>({...it, amount: String(it.amount), paidBy: toDisplayUser(it.paidBy)}));
    const myItems = allItems.filter(it => it.paidBy === currentUserName);
    const otherItems = allItems.filter(it => it.paidBy === partnerName);
    setNdItems(myItems.length ? myItems : Array.from({length:3},(_,i)=>({...makeRow(i+1),paidBy:currentUserName})));
    setPartnerItems(otherItems);
    setNdSpots((d.spots||[]).length ? d.spots.map(s=>({...s})) : [makeSpot(1)]);
    setNdPhotos(d.photos ? [...d.photos] : []);
    setShowAddDate(true);
  };

  const saveDate = async () => {
    if(!ndTitle||!ndDate) return;
    setSaving(true);
    const myValidItems = ndItems.filter(i => i.amount !== "" && Number(i.amount) > 0).map(i=>({...i,amount:Number(i.amount)}));
    const partnerValidItems = partnerItems.map(i=>({...i,amount:Number(i.amount)}));
    const validItems = [...myValidItems, ...partnerValidItems];
    const validSpots = ndSpots.filter(s => s.name);
    const data = { title:ndTitle, date:ndDate, memo:ndMemo, items:validItems, spots:validSpots, photos:ndPhotos };
    try {
      if(editDateId) {
        await updateDoc(doc(db,"dates",editDateId), data);
        setDates(p=>p.map(d=>d.id===editDateId?{...data,id:editDateId}:d));
      } else {
        const ref = await addDoc(collection(db,"dates"), data);
        setDates(p=>[{...data,id:ref.id},...p].sort((a,b)=>b.date.localeCompare(a.date)));
      }
      setPartnerItems([]);
    } catch(e) { alert("保存に失敗しました: "+e.message); }
    setSaving(false); setShowAddDate(false); setEditDateId(null);
  };

  const deleteDate = async (id) => {
    if(!window.confirm("このデート記録を削除しますか？\nこの操作は元に戻せません。")) return;
    try { await deleteDoc(doc(db,"dates",id)); setDates(p=>p.filter(d=>d.id!==id)); setSelDateId(null); }
    catch(e) { alert("削除に失敗しました: "+e.message); }
  };

  const deletePlan = async (id) => {
    if(!window.confirm("この計画を削除しますか？\nこの操作は元に戻せません。")) return;
    try { await deleteDoc(doc(db,"plans",id)); setPlans(p=>p.filter(pl=>pl.id!==id)); setSelPlanId(null); }
    catch(e) { alert("削除に失敗しました: "+e.message); }
  };

  const handlePhoto = async (e) => {
    const files = Array.from(e.target.files);
    for (const f of files) {
      const sRef = storageRef(storage, `photos/${Date.now()}_${f.name}`);
      await uploadBytes(sRef, f);
      const url = await getDownloadURL(sRef);
      setNdPhotos(p=>[...p,{id:Date.now()+Math.random(),url,name:f.name}]);
    }
  };

  const ndUpdRow  = (id,f,v) => setNdItems(p=>p.map(r=>r.id===id?{...r,[f]:v}:r));
  const ndUpdSpot = (id,field,val) => setNdSpots(p=>p.map(s=>s.id===id?{...s,[field]:val}:s));
  const ndGeoSpot = async(id,q) => {
    if(!q)return;
    setNdSpots(p=>p.map(s=>s.id===id?{...s,lat:"",lng:"",geoError:false,searching:true}:s));
    try {
      const r=await geocode(q);
      if(r) setNdSpots(p=>p.map(s=>s.id===id?{...s,lat:r.lat,lng:r.lng,geoError:false,searching:false}:s));
      else  setNdSpots(p=>p.map(s=>s.id===id?{...s,geoError:true,searching:false}:s));
    } catch { setNdSpots(p=>p.map(s=>s.id===id?{...s,geoError:true,searching:false}:s)); }
  };
  const ndMoveSpot = (i, dir) => setNdSpots(p => {
    const a=[...p], j=i+dir;
    if(j<0||j>=a.length)return p; [a[i],a[j]]=[a[j],a[i]]; return a;
  });

  // ── Plan form ──
  const npUpdSched = (id, field, val) => setNpSched(p => p.map(r => {
    if (r.id !== id) return r;
    return { ...r, [field]: val };
  }));

  const npGeoSched = async(id,q) => {
    if(!q)return;
    setNpSched(p=>p.map(s=>s.id===id?{...s,lat:"",lng:"",geoError:false,searching:true}:s));
    try {
      const r=await geocode(q);
      if(r) setNpSched(p=>p.map(s=>s.id===id?{...s,lat:r.lat,lng:r.lng,geoError:false,searching:false}:s));
      else  setNpSched(p=>p.map(s=>s.id===id?{...s,geoError:true,searching:false}:s));
    } catch { setNpSched(p=>p.map(s=>s.id===id?{...s,geoError:true,searching:false}:s)); }
  };

  // ★ 移動カテゴリの出発地・到着地Geocode
  const npGeoSchedMove = async(id, side, q) => {
    if(!q)return;
    const searchKey = side==="dep" ? "depSearching" : "arrSearching";
    const latKey    = side==="dep" ? "depLat"       : "arrLat";
    const lngKey    = side==="dep" ? "depLng"       : "arrLng";
    const errKey    = side==="dep" ? "depGeoError"  : "arrGeoError";
    setNpSched(p=>p.map(s=>s.id===id?{...s,[latKey]:"",[ lngKey]:"",[ errKey]:false,[searchKey]:true}:s));
    try {
      const r=await geocode(q);
      if(r) setNpSched(p=>p.map(s=>s.id===id?{...s,[latKey]:r.lat,[lngKey]:r.lng,[errKey]:false,[searchKey]:false}:s));
      else  setNpSched(p=>p.map(s=>s.id===id?{...s,[errKey]:true,[searchKey]:false}:s));
    } catch { setNpSched(p=>p.map(s=>s.id===id?{...s,[errKey]:true,[searchKey]:false}:s)); }
  };

  const npMoveSched = (i, dir) => setNpSched(p => {
    const a=[...p], j=i+dir;
    if(j<0||j>=a.length)return p; [a[i],a[j]]=[a[j],a[i]]; return a;
  });

  const openAddPlan = () => {
    setEditPlanId(null); setNpTitle(""); setNpDate(""); setNpMemo("");
    setNpSched([makeSched(1)]);
    setNpChecks({ Nk: [makeCheckItem(Date.now())], Ak: [makeCheckItem(Date.now()+1)] });
    setNpShops([makeShopItem(Date.now()+2)]);
    setNpLinks([makeLink(Date.now()+3)]);
    setNpPlanTab("スケジュール");
    setShowAddPlan(true);
  };

  // ★ 編集ボタン押下時に開いているタブを引き継ぐ
  const openEditPlan = (plan, currentDetailTab) => {
    setEditPlanId(plan.id); setNpTitle(plan.title); setNpDate(plan.date||""); setNpMemo(plan.memo||"");
    setNpSched((plan.schedule||[]).map(s=>({
      ...makeSched(s.id||Date.now()),
      ...s,
      nkRoutes: (s.nkRoutes||[]).length ? s.nkRoutes.map(r=>({...r})) : [makeRoute(`nk-${Date.now()}`)],
      akRoutes: (s.akRoutes||[]).length ? s.akRoutes.map(r=>({...r})) : [makeRoute(`ak-${Date.now()}`)],
    })));
    setNpChecks({
      Nk: (plan.checks?.Nk||[makeCheckItem(Date.now())]).map(c=>({...c})),
      Ak: (plan.checks?.Ak||[makeCheckItem(Date.now()+1)]).map(c=>({...c})),
    });
    setNpShops((plan.shops||[makeShopItem(Date.now()+2)]).map(s=>({...s})));
    setNpLinks((plan.links||[makeLink(Date.now()+3)]).map(l=>({...l})));
    // ★ 詳細タブが開いていればそのタブで編集画面を開く
    setNpPlanTab(currentDetailTab || "スケジュール");
    setShowAddPlan(true);
  };

  const savePlan = async () => {
    if(!npTitle) return;
    setSaving(true);
    const data = { title:npTitle, date:npDate, memo:npMemo, status:"計画中", schedule:npSched, checks:npChecks, shops:npShops, links:npLinks };
    try {
      if(editPlanId) {
        await updateDoc(doc(db,"plans",editPlanId), data);
        setPlans(p=>p.map(pl=>pl.id===editPlanId?{...data,id:editPlanId}:pl));
      } else {
        const ref = await addDoc(collection(db,"plans"), data);
        setPlans(p=>[...p,{...data,id:ref.id}].sort((a,b)=>(a.date||"").localeCompare(b.date||"")));
      }
    } catch(e) { alert("保存に失敗しました: "+e.message); }
    setSaving(false); setShowAddPlan(false); setEditPlanId(null);
  };

  const markDone = async (planId) => {
    await updateDoc(doc(db,"plans",planId), {status:"実行済み"});
    setPlans(p=>p.map(pl=>pl.id===planId?{...pl,status:"実行済み"}:pl));
  };

  const bkUpd = (id,f,v) => setBulkRows(p=>p.map(r=>r.id===id?{...r,[f]:v}:r));
  const saveBulk = async () => {
    const valid=bulkRows.filter(r=>r.amount!==""&&Number(r.amount)>0).map(r=>({...r,amount:Number(r.amount)}));
    if(!valid.length||!selDateId) return;
    setSaving(true);
    const target = dates.find(d=>d.id===selDateId);
    const newItems = [...(target.items||[]), ...valid.map(r=>({...r,id:Date.now()+Math.random()}))];
    try {
      await updateDoc(doc(db,"dates",selDateId), {items:newItems});
      setDates(p=>p.map(d=>d.id===selDateId?{...d,items:newItems}:d));
    } catch(e) { alert("保存に失敗しました"); }
    setSaving(false);
    setBulkRows(Array.from({length:5},(_,i)=>makeRow(i+1))); setShowBulk(false);
  };

  // ★ スケジュール並び順：行き→固定最初、帰り→固定最後、それ以外は時間順
  const sortedSchedule = (schedule) => {
    const iki    = schedule.filter(s => s.cat === "行き");
    const kaeri  = schedule.filter(s => s.cat === "帰り");
    const others = schedule.filter(s => s.cat !== "行き" && s.cat !== "帰り");
    const getTime = (s) => {
      if (isMoveCat(s.cat)) return s.depTime || s.time || "";
      return s.time || "";
    };
    const sorted = [...others].sort((a, b) => {
      const ta = getTime(a), tb = getTime(b);
      if (!ta && !tb) return 0;
      if (!ta) return 1;
      if (!tb) return -1;
      return ta.localeCompare(tb);
    });
    return [...iki, ...sorted, ...kaeri];
  };

  if (authLoading) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:GREEN,fontSize:16}}>読み込み中...</div>;
  if (!user) return <LoginScreen onLogin={handleLogin} error={loginError} loading={loginLoading}/>;

  return (
    <div style={{maxWidth:600,margin:"0 auto",fontFamily:"'Hiragino Kaku Gothic ProN','Hiragino Sans','Meiryo','Yu Gothic',sans-serif",minHeight:"100vh",display:"flex",flexDirection:"column",background:"#fafafa"}}>

      <div style={{background:"#fff",borderBottom:"1px solid #eee",padding:"14px 16px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <p onClick={()=>{setActiveTab("ホーム");setSelDateId(null);setSelPlanId(null);}} style={{margin:0,fontWeight:700,fontSize:16,color:GREEN,cursor:"pointer"}}>AkNk プラン</p>
          <button onClick={handleLogout} style={{fontSize:12,padding:"4px 12px",borderRadius:20,border:"1px solid #eee",background:"transparent",color:"#aaa",cursor:"pointer"}}>ログアウト</button>
        </div>
        <div style={{display:"flex"}}>
          {TABS.map(t=>(
            <button key={t} onClick={()=>{setActiveTab(t);setSelDateId(null);setSelPlanId(null);}} style={{flex:1,padding:"9px 4px",fontSize:13,fontWeight:activeTab===t?700:500,border:"none",background:activeTab===t?"#f0faf6":"transparent",borderBottom:activeTab===t?`2px solid ${GREEN}`:"2px solid transparent",color:activeTab===t?GREEN:"#555",cursor:"pointer"}}>{t}</button>
          ))}
        </div>
      </div>

      {loading && <div style={{padding:"2rem",textAlign:"center",color:"#aaa",fontSize:14}}>データを読み込み中...</div>}

      <div style={{flex:1,overflowY:"auto",paddingBottom:80}}>

        {/* HOME */}
        {activeTab==="ホーム"&&!loading&&(
          <div style={{padding:"1rem"}}>
            {(()=>{
              const nextPlan = [...plans].filter(p=>p.status==="計画中").sort((a,b)=>a.date.localeCompare(b.date))[0];
              if(!nextPlan) return null;
              const today = new Date(); today.setHours(0,0,0,0);
              const target = new Date(nextPlan.date); target.setHours(0,0,0,0);
              const diff = Math.round((target-today)/(1000*60*60*24));
              const dateLabel = `${target.getFullYear()}年${target.getMonth()+1}月${target.getDate()}日`;
              if(diff===1) {
                return (
                  <div onClick={()=>{setSelPlanId(nextPlan.id);setActiveTab("計画");}} style={{background:GREEN,borderRadius:12,padding:"16px 18px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}}>
                    <div><p style={{margin:"0 0 3px",fontSize:11,color:"rgba(255,255,255,0.75)"}}>次のデート</p><p style={{margin:"0 0 2px",fontSize:15,fontWeight:700,color:"#fff"}}>{nextPlan.title}</p><p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.75)"}}>{dateLabel}</p></div>
                    <div style={{textAlign:"right"}}><p style={{margin:0,fontSize:44,fontWeight:700,color:"#fff",lineHeight:1}}>{diff}</p><p style={{margin:"2px 0 0",fontSize:13,color:"rgba(255,255,255,0.85)"}}>日後</p></div>
                  </div>
                );
              } else if(diff===0) {
                return (
                  <div onClick={()=>{setSelPlanId(nextPlan.id);setActiveTab("計画");}} style={{background:"#fff",borderRadius:12,border:"1px solid #eee",padding:"16px 18px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}}>
                    <div><p style={{margin:"0 0 3px",fontSize:11,color:"#aaa"}}>次のデート</p><p style={{margin:"0 0 2px",fontSize:15,fontWeight:700,color:"#222"}}>{nextPlan.title}</p><p style={{margin:0,fontSize:12,color:"#888"}}>{dateLabel}</p></div>
                    <div style={{textAlign:"right"}}><p style={{margin:0,fontSize:44,fontWeight:700,color:"#222",lineHeight:1}}>{diff}</p><p style={{margin:"2px 0 0",fontSize:13,color:"#888"}}>日後</p></div>
                  </div>
                );
              } else if(diff>0) {
                return (
                  <div onClick={()=>{setSelPlanId(nextPlan.id);setActiveTab("計画");}} style={{background:"#e8f5f0",borderRadius:12,padding:"16px 18px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer"}}>
                    <div><p style={{margin:"0 0 3px",fontSize:11,color:GREEN,opacity:0.8}}>次のデート</p><p style={{margin:"0 0 2px",fontSize:15,fontWeight:700,color:GREEN}}>{nextPlan.title}</p><p style={{margin:0,fontSize:12,color:GREEN,opacity:0.75}}>{dateLabel}</p></div>
                    <div style={{textAlign:"right"}}><p style={{margin:0,fontSize:44,fontWeight:700,color:GREEN,lineHeight:1}}>{diff}</p><p style={{margin:"2px 0 0",fontSize:13,color:GREEN}}>日後</p></div>
                  </div>
                );
              }
              return null;
            })()}
            {yearlySummary.length>0&&<p style={{fontWeight:700,marginBottom:10,fontSize:14}}>年別サマリー</p>}
            {yearlySummary.map(([y,d])=>(
              <div key={y} style={{...CS,padding:"0.75rem 1rem",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <span style={{fontWeight:700,fontSize:15}}>{y}年</span>
                  <span style={{fontSize:12,color:"#888"}}>{d.count}回</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                  {[{l:"合計費用",v:fmt(d.total),c:"#888"},{l:"Nk",v:fmt(dates.filter(dt=>getY(dt.date)===y).reduce((s,dt)=>s+paidByUser(dt.items||[],"Nk"),0)),c:USER_COLORS.Nk},{l:"Ak",v:fmt(dates.filter(dt=>getY(dt.date)===y).reduce((s,dt)=>s+paidByUser(dt.items||[],"Ak"),0)),c:USER_COLORS.Ak}].map(s=>(
                    <div key={s.l} style={{background:"#f7f7f7",borderRadius:8,padding:"8px 10px"}}>
                      <p style={{margin:0,fontSize:10,color:s.c}}>{s.l}</p>
                      <p style={{margin:"3px 0 0",fontWeight:700,fontSize:14}}>{s.v}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {plans.filter(p=>p.status==="計画中").length>0&&(
              <>
                <p style={{fontWeight:700,marginBottom:8,fontSize:14,marginTop:"1rem"}}>次のデート計画</p>
                {[...plans].filter(p=>p.status==="計画中").sort((a,b)=>a.date.localeCompare(b.date)).slice(0,2).map(p=>(
                  <div key={p.id} onClick={()=>{setSelPlanId(p.id);setActiveTab("計画");}} style={{...CS,cursor:"pointer",padding:"0.75rem 1rem",borderLeft:`3px solid ${GREEN}`}}>
                    <div style={{display:"flex",justifyContent:"space-between"}}><p style={{margin:0,fontWeight:700,fontSize:14}}>{p.title}</p><span style={{fontSize:12,color:GREEN,fontWeight:700}}>{fmt(budgetOf(p.schedule||[]))}</span></div>
                    <p style={{margin:"3px 0 0",fontSize:12,color:"#888"}}>{p.date} · {(p.schedule||[]).length}件</p>
                  </div>
                ))}
              </>
            )}
            <p style={{fontWeight:700,marginBottom:8,fontSize:14,marginTop:"1rem"}}>最近のデート</p>
            {dates.length===0&&<p style={{color:"#aaa",fontSize:14,textAlign:"center",padding:"1rem"}}>まだ記録がありません</p>}
            {[...dates].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3).map(d=>(
              <div key={d.id} onClick={()=>{setSelDateId(d.id);setActiveTab("記録");}} style={{...CS,display:"flex",alignItems:"center",gap:12,cursor:"pointer",padding:"0.75rem 1rem"}}>
                {d.photos?.[0]?<img src={d.photos[0].url} alt="" style={{width:40,height:40,borderRadius:8,objectFit:"cover",flexShrink:0}}/>:<div style={{width:40,height:40,borderRadius:8,background:"#e8f5f0",flexShrink:0}}/>}
                <div style={{flex:1,minWidth:0}}><p style={{margin:0,fontWeight:600,fontSize:14}}>{d.title}</p><p style={{margin:0,fontSize:12,color:"#888"}}>{d.date}</p></div>
                <span style={{fontWeight:700,fontSize:14,color:GREEN,whiteSpace:"nowrap"}}>{fmt(totalOf(d.items||[]))}</span>
              </div>
            ))}
            <button onClick={openAddDate} style={{width:"100%",marginTop:"1rem",padding:"12px",borderRadius:10,border:"none",background:GREEN,color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer"}}>+ 新しいデートを記録</button>
          </div>
        )}

        {/* DATE LIST */}
        {activeTab==="記録"&&!selDate&&!loading&&(
          <div style={{padding:"1rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <p style={{margin:0,fontWeight:700}}>デート記録</p>
              <button onClick={openAddDate} style={{fontSize:13,padding:"4px 12px",borderRadius:20,border:"1px solid #ddd",background:"transparent",cursor:"pointer"}}>+ 追加</button>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <select value={filterYear}  onChange={e=>setFilterYear(e.target.value)}  style={{flex:1,...SI}}>{allYears.map(y=><option key={y}>{y}</option>)}</select>
              <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={{flex:1,...SI}}>{ALL_MONTHS.map(m=><option key={m}>{m}</option>)}</select>
              {(filterYear!=="すべて"||filterMonth!=="すべて")&&<button onClick={()=>{setFilterYear("すべて");setFilterMonth("すべて");}} style={{fontSize:12,padding:"6px 10px",borderRadius:8,border:"1px solid #ddd",background:"transparent",cursor:"pointer"}}>リセット</button>}
            </div>
            {filtered.length===0&&<p style={{color:"#aaa",fontSize:14,textAlign:"center",padding:"1rem"}}>記録がありません</p>}
            {filtered.map(d=>(
              <div key={d.id} onClick={()=>setSelDateId(d.id)} style={{...CS,cursor:"pointer"}}>
                {d.photos?.length>0&&<div style={{display:"flex",gap:4,marginBottom:8}}>{d.photos.slice(0,4).map(p=><img key={p.id} src={p.url} alt="" style={{width:56,height:56,borderRadius:6,objectFit:"cover",flexShrink:0}}/>)}</div>}
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><p style={{margin:0,fontWeight:700,fontSize:15}}>{d.title}</p><span style={{fontWeight:700,color:GREEN}}>{fmt(totalOf(d.items||[]))}</span></div>
                <p style={{margin:0,fontSize:12,color:"#888"}}>{d.date}{(d.spots||[]).length>0?` · ${d.spots.length}ヶ所`:""}{ (d.photos||[]).length>0?` · 写真${d.photos.length}枚`:""}</p>
              </div>
            ))}
          </div>
        )}

        {/* DATE DETAIL */}
        {activeTab==="記録"&&selDate&&(
          <div style={{padding:"1rem"}}>
            <button onClick={()=>setSelDateId(null)} style={{fontSize:13,color:"#888",background:"none",border:"none",cursor:"pointer",marginBottom:10,padding:0}}>← 一覧に戻る</button>
            <div style={CS}>
              <p style={{margin:"0 0 6px",fontWeight:700,fontSize:17}}>{selDate.title}</p>
              <p style={{margin:"0 0 6px",fontSize:13,color:"#888"}}>{selDate.date}</p>
              {selDate.memo&&<div style={{background:"#f7f7f7",borderRadius:8,padding:"8px 12px",fontSize:14}}>{selDate.memo}</div>}
            </div>
            {(selDate.photos||[]).length>0&&(
              <div style={{marginBottom:12}}>
                <p style={{fontWeight:700,fontSize:14,marginBottom:8}}>写真</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                  {selDate.photos.map(p=><div key={p.id} onClick={()=>setPhotoView(p.url)} style={{aspectRatio:"1",borderRadius:8,overflow:"hidden",border:"1px solid #eee",cursor:"pointer"}}><img src={p.url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>)}
                </div>
              </div>
            )}
            {(selDate.spots||[]).filter(s=>s.name).length>0&&(
              <div style={{marginBottom:12}}>
                <p style={{fontWeight:700,fontSize:14,marginBottom:8}}>訪れた場所</p>
                <SpotMap spots={selDate.spots.filter(s=>s.name)}/>
              </div>
            )}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <p style={{margin:0,fontWeight:700,fontSize:14}}>費用明細</p>
              <button onClick={()=>setShowBulk(true)} style={{fontSize:12,padding:"4px 12px",borderRadius:20,border:"1px solid #ddd",background:"transparent",cursor:"pointer"}}>+ 一括入力</button>
            </div>
            <div style={CS}>
              {(selDate.items||[]).map((item,i)=>{
                const displayUser = toDisplayUser(item.paidBy);
                return (
                  <div key={item.id||i} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:"4px 12px",padding:"7px 0",borderBottom:i<selDate.items.length-1?"1px solid #f0f0f0":"none",alignItems:"center"}}>
                    <span style={{fontSize:14}}>{itemLabel(item)}</span>
                    <span style={{fontSize:11,padding:"1px 7px",borderRadius:20,background:(USER_COLORS[displayUser]||"#888")+"22",color:USER_COLORS[displayUser]||"#888",whiteSpace:"nowrap"}}>{displayUser}</span>
                    <span style={{fontWeight:500,fontSize:14,textAlign:"right"}}>{fmt(item.amount)}</span>
                  </div>
                );
              })}
              <div style={{paddingTop:10,marginTop:6,borderTop:"2px solid #eee"}}>
                <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:16,marginBottom:6}}><span>合計</span><span style={{color:GREEN}}>{fmt(totalOf(selDate.items||[]))}</span></div>
                <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                  {["Nk","Ak"].map(u=>{const t=paidByUser(selDate.items||[],u);return t>0?<span key={u} style={{fontSize:12,color:USER_COLORS[u]}}>{u}: {fmt(t)}</span>:null;})}
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:"0.5rem"}}>
              <button onClick={()=>openEditDate(selDate)} style={{flex:1,padding:"12px",borderRadius:10,border:"1px solid #ddd",background:"#fff",color:"#555",fontWeight:700,fontSize:14,cursor:"pointer"}}>編集する</button>
              <button onClick={()=>deleteDate(selDate.id)} style={{padding:"12px 16px",borderRadius:10,border:"1px solid #ffcccc",background:"#fff8f8",color:"#E24B4A",fontWeight:700,fontSize:14,cursor:"pointer"}}>削除</button>
            </div>
          </div>
        )}

        {/* PLAN LIST */}
        {activeTab==="計画"&&!selPlan&&!loading&&(
          <div style={{padding:"1rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <p style={{margin:0,fontWeight:700}}>デート計画</p>
              <button onClick={openAddPlan} style={{fontSize:13,padding:"4px 12px",borderRadius:20,border:"1px solid #ddd",background:"transparent",cursor:"pointer"}}>+ 計画を追加</button>
            </div>
            {plans.length>0&&(()=>{
              const map={};
              plans.forEach(p=>{const ym=getYM(p.date);if(!map[ym])map[ym]={budget:0,count:0};map[ym].budget+=budgetOf(p.schedule||[]);map[ym].count++;});
              const entries=Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0]));
              return (
                <div style={{marginBottom:16}}>
                  <p style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:6}}>月別予算</p>
                  <div style={{...CS,padding:"0.75rem 1rem",marginBottom:0}}>
                    {entries.map(([ym,d],i)=>{
                      const [y,m]=ym.split("-");
                      return (
                        <div key={ym} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:i<entries.length-1?"1px solid #f0f0f0":"none"}}>
                          <div><span style={{fontSize:14,fontWeight:500}}>{y}年{m}月</span><span style={{fontSize:11,color:"#aaa",marginLeft:8}}>{d.count}件</span></div>
                          <span style={{fontWeight:700,color:GREEN,fontSize:15}}>{fmt(d.budget)}</span>
                        </div>
                      );
                    })}
                    <div style={{display:"flex",justifyContent:"space-between",padding:"9px 0 0",marginTop:4,borderTop:"2px solid #eee",fontWeight:700,fontSize:15}}>
                      <span>予算合計</span><span style={{color:GREEN}}>{fmt(plans.reduce((s,p)=>s+budgetOf(p.schedule||[]),0))}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
            {plans.length===0&&<p style={{color:"#aaa",fontSize:14,textAlign:"center",marginTop:40}}>計画がありません</p>}
            {["計画中","実行済み"].map(status=>{
              const list=plans.filter(p=>p.status===status).sort((a,b)=>a.date.localeCompare(b.date));
              if(!list.length)return null;
              return (
                <div key={status} style={{marginBottom:8}}>
                  <p style={{fontSize:12,fontWeight:700,color:status==="計画中"?GREEN:"#888",marginBottom:6}}>{status}</p>
                  {list.map(p=>(
                    <div key={p.id} onClick={()=>setSelPlanId(p.id)} style={{...CS,cursor:"pointer",borderLeft:`3px solid ${status==="計画中"?GREEN:"#ccc"}`,opacity:status==="実行済み"?0.7:1}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><p style={{margin:0,fontWeight:700,fontSize:15}}>{p.title}</p><span style={{fontWeight:700,color:status==="計画中"?GREEN:"#888"}}>{fmt(budgetOf(p.schedule||[]))}</span></div>
                      <p style={{margin:0,fontSize:12,color:"#888"}}>{p.date} · {(p.schedule||[]).length}件のスケジュール</p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* PLAN DETAIL */}
        {activeTab==="計画"&&selPlan&&(
          <div style={{padding:"1rem"}}>
            <button onClick={()=>setSelPlanId(null)} style={{fontSize:13,color:"#888",background:"none",border:"none",cursor:"pointer",marginBottom:10,padding:0}}>← 一覧に戻る</button>
            <div style={CS}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <p style={{margin:0,fontWeight:700,fontSize:17,flex:1}}>{selPlan.title}</p>
                <span style={{fontSize:12,padding:"2px 10px",borderRadius:20,background:selPlan.status==="計画中"?GREEN+"22":"#eee",color:selPlan.status==="計画中"?GREEN:"#888",flexShrink:0,marginLeft:8}}>{selPlan.status}</span>
              </div>
              {selPlan.date&&<p style={{margin:"0 0 6px",fontSize:13,color:"#888"}}>予定日: {selPlan.date}</p>}
              {selPlan.memo&&<div style={{background:"#f7f7f7",borderRadius:8,padding:"8px 12px",fontSize:14,marginTop:6}}>{selPlan.memo}</div>}
            </div>

            {(()=>{
              const detailTab = selPlan._detailTab||"スケジュール";
              const setDetailTab = (t) => setPlans(p=>p.map(pl=>pl.id===selPlan.id?{...pl,_detailTab:t}:pl));
              const hasChecks = ["Nk","Ak"].some(u=>(selPlan.checks?.[u]||[]).some(c=>c.text));
              const hasLinks  = (selPlan.links||[]).some(l=>l.url);
              const hasShops  = (selPlan.shops||[]).some(s=>s.text);
              // ★ スケジュール並び順を適用
              const displaySchedule = sortedSchedule(selPlan.schedule||[]);
              return (
                <>
                  <div style={{display:"flex",gap:0,background:"#fff",borderRadius:10,border:"1px solid #eee",marginBottom:10,overflow:"hidden"}}>
                    {["スケジュール","持ち物","参照URL","買い物"].map(t=>(
                      <button key={t} onClick={()=>setDetailTab(t)} style={{flex:1,padding:"8px 2px",fontSize:11,fontWeight:detailTab===t?700:400,border:"none",borderBottom:detailTab===t?`2px solid ${GREEN}`:"2px solid transparent",background:detailTab===t?"#f0faf6":"transparent",color:detailTab===t?GREEN:"#aaa",cursor:"pointer"}}>
                        {t}
                      </button>
                    ))}
                  </div>

                  {detailTab==="スケジュール"&&(
                    <>
                      {planSpots(selPlan).length>0&&(
                        <div style={{marginBottom:12}}>
                          <p style={{fontWeight:700,fontSize:14,marginBottom:8}}>訪れる場所</p>
                          <SpotMap spots={planSpots(selPlan)}/>
                        </div>
                      )}
                      <div style={CS}>
                        {(()=>{
                          const days = [...new Set(displaySchedule.map(s=>s.dayOffset??0))].sort((a,b)=>a-b);
                          return days.map(dayOff => {
                            const dayRows = displaySchedule.filter(s=>(s.dayOffset??0)===dayOff);
                            let dayLabel = `${dayOff+1}日目`;
                            if (selPlan.date) {
                              const d = new Date(selPlan.date);
                              d.setDate(d.getDate()+dayOff);
                              dayLabel = `${dayOff+1}日目（${d.getMonth()+1}/${d.getDate()}）`;
                            }
                            return (
                              <div key={dayOff} style={{marginBottom:dayOff<days[days.length-1]?16:0}}>
                                <div style={{display:"flex",alignItems:"center",gap:8,margin:"0 0 10px"}}>
                                  <div style={{flex:1,height:1,background:"#e0e0e0"}}/>
                                  <span style={{fontSize:13,fontWeight:700,color:"#fff",background:GREEN,padding:"3px 14px",borderRadius:20,flexShrink:0}}>{dayLabel}</span>
                                  <div style={{flex:1,height:1,background:"#e0e0e0"}}/>
                                </div>
                                {dayRows.map((s,i)=>{
                                  const isTrans = isTransportCatSched(s.cat);
                                  const isMove  = isMoveCat(s.cat);
                                  const isJiyuu = s.cat === "自由記述";
                                  const isLast  = i===dayRows.length-1;
                                  const showCatBig = !isTrans && !isMove && !isJiyuu;
                                  // 移動のGoogleマップルートURL
                                  const moveRouteUrl = (s.depLat && s.arrLat)
                                    ? `https://www.google.com/maps/dir/${s.depLat},${s.depLng}/${s.arrLat},${s.arrLng}`
                                    : (s.depAddress||s.depPlace) && (s.arrAddress||s.arrPlace)
                                    ? `https://www.google.com/maps/dir/${encodeURIComponent(s.depAddress||s.depPlace)}/${encodeURIComponent(s.arrAddress||s.arrPlace)}`
                                    : null;
                                  return (
                                    <div key={s.id||i} style={{padding:"8px 0",borderBottom:!isLast?"1px solid #f0f0f0":"none"}}>
                                      {isTrans&&(
                                        <div>
                                          <p style={{margin:"0 0 6px",fontSize:13,fontWeight:700,color:"#555"}}>{s.cat}{s.content?" "+s.content:""}</p>
                                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                                            {[["nk","Nk"],["ak","Ak"]].map(([who,label])=>{
                                              const routes = s[`${who}Routes`]||[];
                                              const hasData = routes.some(r=>r.depTime||r.depPlace||r.arrTime||r.arrPlace);
                                              return (
                                                <div key={who} style={{background:"#f7f7f7",borderRadius:8,padding:"8px 10px"}}>
                                                  <p style={{margin:"0 0 4px",fontSize:11,fontWeight:700,color:USER_COLORS[label]}}>{label}</p>
                                                  {hasData ? routes.map((route,ri)=>(
                                                    <div key={route.id||ri} style={{borderTop:ri>0?"1px dashed #eee":"none",paddingTop:ri>0?4:0,marginTop:ri>0?4:0}}>
                                                      {(route.depTime||route.depPlace)&&<p style={{margin:"0 0 1px",fontSize:12}}>{route.depTime||"--:--"} {route.depPlace}</p>}
                                                      <p style={{margin:"0 0 1px",fontSize:11,color:"#bbb"}}>↓ {route.moveMethod==="自由記述"?route.moveMethodFree||"":route.moveMethod||""}</p>
                                                      {(route.arrTime||route.arrPlace)&&<p style={{margin:0,fontSize:12}}>{route.arrTime||"--:--"} {route.arrPlace}</p>}
                                                    </div>
                                                  )) : <p style={{margin:0,fontSize:12,color:"#bbb"}}>未入力</p>}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                      {isMove&&(
                                        <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                                          <span style={{fontSize:13,color:"#888",fontWeight:500,minWidth:44,flexShrink:0}}>{s.depTime||"--:--"}</span>
                                          <div style={{flex:1}}>
                                            <div style={{display:"flex",justifyContent:"space-between"}}>
                                              <span style={{fontSize:14,fontWeight:500}}>
                                                {s.depPlace||s.depAddress}{((s.depPlace||s.depAddress)&&(s.arrPlace||s.arrAddress))?" → ":""}{s.arrPlace||s.arrAddress}
                                              </span>
                                            </div>
                                            <div style={{display:"flex",gap:8,alignItems:"center",marginTop:2,flexWrap:"wrap"}}>
                                              <span style={{fontSize:11,color:"#888"}}>{s.cat}{(s.moveMethod&&s.moveMethod!=="自由記述")?" · "+s.moveMethod:s.moveMethodFree?" · "+s.moveMethodFree:""}</span>
                                              {s.arrTime&&<span style={{fontSize:11,color:"#888"}}>到着 {s.arrTime}</span>}
                                            </div>
                                            {moveRouteUrl&&(
                                              <a href={moveRouteUrl} target="_blank" rel="noreferrer"
                                                style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,color:GREEN,textDecoration:"none",marginTop:3}}>
                                                Googleマップでルートを開く
                                              </a>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                      {/* ★ 自由記述：他カテゴリと同じサイズ、内容はグレー小文字 */}
                                      {/* 自由記述：contentをタイトル、placeを補足グレー小文字で表示 */}
                                      {isJiyuu&&(
                                        <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                                          <span style={{fontSize:13,color:"#888",fontWeight:500,minWidth:44,flexShrink:0}}>{s.time||"--:--"}</span>
                                          <div style={{flex:1}}>
                                            <span style={{fontSize:14,fontWeight:500}}>{s.content}</span>
                                            {s.place&&<p style={{margin:"2px 0 0",fontSize:12,color:"#888"}}>{s.place}</p>}
                                            {(s.spotName||s.lat)&&(<a href={s.lat?`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.spotName)}`} target="_blank" rel="noreferrer" style={{fontSize:11,color:GREEN,textDecoration:"none",display:"block",marginTop:2}}>{s.spotName||"地図"} →Gマップ</a>)}
                                          </div>
                                        </div>
                                      )}
                                      {showCatBig&&(
                                        <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                                          <span style={{fontSize:13,color:"#888",fontWeight:500,minWidth:44,flexShrink:0}}>{s.time||"--:--"}</span>
                                          <div style={{flex:1}}>
                                            <div style={{display:"flex",justifyContent:"space-between"}}>
                                              <span style={{fontSize:14,fontWeight:500}}>{catDisplay(s.cat)}</span>
                                              {s.budget&&<span style={{fontSize:13,color:GREEN,fontWeight:700}}>{fmt(s.budget)}</span>}
                                            </div>
                                            {s.content&&<p style={{margin:"2px 0 0",fontSize:12,color:"#888"}}>{s.content}</p>}
                                            {(s.place||s.lat)&&(<a href={s.lat?`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.place)}`} target="_blank" rel="noreferrer" style={{fontSize:11,color:GREEN,textDecoration:"none",display:"block",marginTop:2}}>{s.place||"地図"} →Gマップ</a>)}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          });
                        })()}
                        <div style={{paddingTop:10,marginTop:6,borderTop:"2px solid #eee",display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:15}}>
                          <span>予算合計</span><span style={{color:GREEN}}>{fmt(budgetOf(selPlan.schedule||[]))}</span>
                        </div>
                      </div>
                    </>
                  )}

                  {detailTab==="持ち物"&&(
                    hasChecks ? ["Nk","Ak"].map(u=>{
                      const items=(selPlan.checks?.[u]||[]).filter(c=>c.text);
                      if(!items.length) return null;
                      const isMe = u===currentUserName;
                      return (
                        <div key={u} style={{...CS,marginBottom:8}}>
                          <p style={{fontSize:13,fontWeight:700,color:USER_COLORS[u],marginBottom:8}}>{u}</p>
                          {items.map(item=>(
                            <div key={item.id} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:"1px solid #f5f5f5"}}>
                              <div onClick={()=>{
                                if(!isMe) return;
                                const updated={...selPlan.checks,[u]:selPlan.checks[u].map(c=>c.id===item.id?{...c,checked:!c.checked}:c)};
                                updateDoc(doc(db,"plans",selPlan.id),{checks:updated});
                                setPlans(p=>p.map(pl=>pl.id===selPlan.id?{...pl,checks:updated}:pl));
                              }} style={{width:20,height:20,borderRadius:5,border:`1.5px solid ${item.checked?USER_COLORS[u]:"#ddd"}`,background:item.checked?USER_COLORS[u]:"#fff",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:isMe?"pointer":"default",opacity:isMe?1:0.5}}>
                                {item.checked&&<svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </div>
                              <span style={{fontSize:14,color:item.checked?"#bbb":"#222",textDecoration:item.checked?"line-through":"none",flex:1}}>{item.text}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }) : <p style={{color:"#aaa",fontSize:14,textAlign:"center",padding:"2rem 0"}}>持ち物リストがありません</p>
                  )}

                  {detailTab==="参照URL"&&(
                    hasLinks ? (
                      <div style={CS}>
                        {(selPlan.links||[]).filter(l=>l.url).map((link,i,arr)=>(
                          <div key={link.id||i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:i<arr.length-1?"1px solid #f5f5f5":"none"}}>
                            {link.label&&<span style={{fontSize:13,fontWeight:600,color:"#555",minWidth:52,flexShrink:0}}>{link.label}</span>}
                            <a href={link.url} target="_blank" rel="noreferrer" style={{fontSize:13,color:GREEN,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{link.url}</a>
                          </div>
                        ))}
                      </div>
                    ) : <p style={{color:"#aaa",fontSize:14,textAlign:"center",padding:"2rem 0"}}>参照URLがありません</p>
                  )}

                  {detailTab==="買い物"&&(
                    hasShops ? (
                      <div style={CS}>
                        {(selPlan.shops||[]).filter(s=>s.text).map((item,i,arr)=>(
                          <div key={item.id||i} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:i<arr.length-1?"1px solid #f5f5f5":"none"}}>
                            <div onClick={()=>{
                              const updated=(selPlan.shops||[]).map(s=>s.id===item.id?{...s,checked:!s.checked}:s);
                              updateDoc(doc(db,"plans",selPlan.id),{shops:updated});
                              setPlans(p=>p.map(pl=>pl.id===selPlan.id?{...pl,shops:updated}:pl));
                            }} style={{width:20,height:20,borderRadius:5,border:`1.5px solid ${item.checked?GREEN:"#ddd"}`,background:item.checked?GREEN:"#fff",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                              {item.checked&&<svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                            <span style={{fontSize:14,color:item.checked?"#bbb":"#222",textDecoration:item.checked?"line-through":"none",flex:1}}>{item.text}</span>
                          </div>
                        ))}
                      </div>
                    ) : <p style={{color:"#aaa",fontSize:14,textAlign:"center",padding:"2rem 0"}}>買い物リストがありません</p>
                  )}
                </>
              );
            })()}

            <div style={{display:"flex",gap:10,marginTop:"1rem",flexWrap:"wrap"}}>
              {/* ★ 編集ボタン：現在の詳細タブを引き継いで openEditPlan へ */}
              <button onClick={()=>openEditPlan(selPlan, selPlan._detailTab)} style={{flex:1,padding:"12px",borderRadius:10,border:"1px solid #ddd",background:"#fff",color:"#555",fontWeight:700,fontSize:14,cursor:"pointer"}}>編集する</button>
              {selPlan.status==="計画中"&&<button onClick={()=>markDone(selPlan.id)} style={{flex:1,padding:"12px",borderRadius:10,border:`2px solid ${GREEN}`,background:"#fff",color:GREEN,fontWeight:700,fontSize:14,cursor:"pointer"}}>実行済みにする</button>}
              <button onClick={()=>deletePlan(selPlan.id)} style={{width:"100%",padding:"12px",borderRadius:10,border:"1px solid #ffcccc",background:"#fff8f8",color:"#E24B4A",fontWeight:700,fontSize:14,cursor:"pointer"}}>削除</button>
            </div>
          </div>
        )}

        {/* COST */}
        {activeTab==="費用"&&!loading&&(
          <div style={{padding:"1rem"}}>
            <p style={{margin:"0 0 10px",fontWeight:700}}>予算・費用</p>
            <p style={{fontWeight:700,fontSize:14,marginBottom:8,color:"#222"}}>予算</p>
            {(()=>{
              const currentYear = new Date().getFullYear();
              const years = Array.from(new Set([currentYear, ...yearlySummary.map(([y])=>Number(y))])).sort((a,b)=>b-a);
              return years.map(y=>{
                const ys = String(y);
                const nkB = budgets[ys]?.Nk||0, akB = budgets[ys]?.Ak||0;
                const yearlyBudget = (nkB+akB)*12;
                const yearActual = dates.filter(d=>getY(d.date)===ys).reduce((s,d)=>s+totalOf(d.items||[]),0);
                const yearPlanned = plans.filter(p=>p.status==="計画中"&&getY(p.date||"")===ys).reduce((s,p)=>s+budgetOf(p.schedule||[]),0);
                const saveBudget = async (field,val)=>{
                  const newYearBudget={...budgets[ys],[field]:Number(val)||0};
                  setBudgets(b=>({...b,[ys]:newYearBudget}));
                  try{ await setDoc(doc(db,"budgets",ys), newYearBudget); }
                  catch(e){ console.error("予算保存エラー",e); }
                };
                return (
                  <div key={ys} style={{...CS,marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <span style={{fontWeight:700,fontSize:15}}>{ys}年</span>
                      {editBudgetYear===ys
                        ?<button onClick={()=>setEditBudgetYear(null)} style={{fontSize:12,padding:"3px 12px",borderRadius:20,border:`1px solid ${GREEN}`,background:GREEN,color:"#fff",cursor:"pointer"}}>完了</button>
                        :<button onClick={()=>setEditBudgetYear(ys)} style={{fontSize:12,padding:"3px 12px",borderRadius:20,border:"1px solid #ddd",background:"transparent",color:"#888",cursor:"pointer"}}>月額予算を設定</button>
                      }
                    </div>
                    {editBudgetYear===ys&&(
                      <div style={{display:"flex",gap:8,marginBottom:10}}>
                        {["Nk","Ak"].map(u=>(
                          <div key={u} style={{flex:1,background:USER_COLORS[u]+"14",borderRadius:8,padding:"8px 10px"}}>
                            <p style={{margin:"0 0 4px",fontSize:11,color:USER_COLORS[u],fontWeight:700}}>{u} 月額 ¥</p>
                            <input type="number" value={budgets[ys]?.[u]||""} onChange={e=>saveBudget(u,e.target.value)}
                              placeholder="0" style={{...SI,width:"100%",textAlign:"right"}}/>
                          </div>
                        ))}
                      </div>
                    )}
                    {yearlyBudget>0?(
                      <div style={{display:"flex",flexDirection:"column",gap:5,fontSize:13}}>
                        <div style={{display:"flex",justifyContent:"space-between",color:"#555"}}>
                          <span>年間予算 <span style={{fontSize:11,color:"#aaa"}}>({fmt(nkB+akB)}/月)</span></span>
                          <span style={{fontWeight:700}}>{fmt(yearlyBudget)}</span>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",color:"#555"}}>
                          <span>実際の費用</span>
                          <span style={{fontWeight:700,color:"#E24B4A"}}>-{fmt(yearActual)}</span>
                        </div>
                        {yearPlanned>0&&<div style={{display:"flex",justifyContent:"space-between",color:"#555"}}>
                          <span>計画中の予算</span>
                          <span style={{fontWeight:700,color:"#f0a500"}}>-{fmt(yearPlanned)}</span>
                        </div>}
                        <div style={{display:"flex",justifyContent:"space-between",paddingTop:7,marginTop:2,borderTop:"2px solid #eee",fontWeight:700,fontSize:14}}>
                          <span>残高</span>
                          <span style={{color:yearlyBudget-yearActual>=0?GREEN:"#E24B4A"}}>{fmt(yearlyBudget-yearActual)}</span>
                        </div>
                        {yearPlanned>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#888"}}>
                          <span>計画込みの残高</span>
                          <span style={{color:yearlyBudget-yearActual-yearPlanned>=0?GREEN:"#E24B4A"}}>{fmt(yearlyBudget-yearActual-yearPlanned)}</span>
                        </div>}
                      </div>
                    ):(
                      <p style={{fontSize:12,color:"#aaa",margin:0}}>月額予算を設定すると残高が表示されます</p>
                    )}
                  </div>
                );
              });
            })()}

            <p style={{fontWeight:700,fontSize:14,margin:"14px 0 8px",color:"#222"}}>費用</p>
            <div style={{display:"flex",gap:8,marginBottom:"1.25rem",marginTop:0}}>
              {USERS.map(u=>{
                const currentYear = String(new Date().getFullYear());
                const monthlyB = budgets[currentYear]?.[u]||0;
                const yearlyB = monthlyB * 12;
                return (
                  <div key={u} style={{flex:1,background:USER_COLORS[u]+"18",borderRadius:10,padding:"0.65rem 0.75rem"}}>
                    <p style={{margin:0,fontSize:11,color:USER_COLORS[u]}}>{u}</p>
                    <p style={{margin:"3px 0 0",fontWeight:700,fontSize:15}}>{fmt(userTotals[u]||0)}</p>
                    {yearlyB>0&&<p style={{margin:"2px 0 0",fontSize:11,color:USER_COLORS[u],opacity:0.7}}>年間予算 {fmt(yearlyB)}</p>}
                  </div>
                );
              })}
            </div>
            <p style={{fontWeight:700,fontSize:13,margin:"1.25rem 0 8px",color:"#555"}}>月別合計</p>
            <div style={CS}>
              {monthlySummary.map(([ym,t],i)=>{
                const [y,m]=ym.split("-"), max=Math.max(...monthlySummary.map(([,v])=>v));
                const monthDates = filtered.filter(d=>getYM(d.date)===ym);
                const nkT = monthDates.reduce((s,d)=>s+paidByUser(d.items||[],"Nk"),0);
                const akT = monthDates.reduce((s,d)=>s+paidByUser(d.items||[],"Ak"),0);
                return (
                  <div key={ym} style={{padding:"7px 0",borderBottom:i<monthlySummary.length-1?"1px solid #f0f0f0":"none"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,fontSize:13}}><span>{y}年{m}月</span><span style={{fontWeight:700}}>{fmt(t)}</span></div>
                    <div style={{display:"flex",gap:10,marginBottom:4}}>{nkT>0&&<span style={{fontSize:11,color:USER_COLORS.Nk}}>Nk: {fmt(nkT)}</span>}{akT>0&&<span style={{fontSize:11,color:USER_COLORS.Ak}}>Ak: {fmt(akT)}</span>}</div>
                    <div style={{height:5,background:"#f0f0f0",borderRadius:3}}><div style={{height:"100%",width:`${Math.round(t/max*100)}%`,background:GREEN,borderRadius:3}}/></div>
                  </div>
                );
              })}
              {monthlySummary.length===0&&<p style={{color:"#aaa",fontSize:14,textAlign:"center"}}>データがありません</p>}
            </div>
            <p style={{fontWeight:700,fontSize:13,margin:"1.25rem 0 8px",color:"#555"}}>カテゴリ別・デート別</p>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <select value={filterYear}  onChange={e=>setFilterYear(e.target.value)}  style={{flex:1,...SI}}>{allYears.map(y=><option key={y}>{y}</option>)}</select>
              <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={{flex:1,...SI}}>{ALL_MONTHS.map(m=><option key={m}>{m}</option>)}</select>
              {(filterYear!=="すべて"||filterMonth!=="すべて")&&<button onClick={()=>{setFilterYear("すべて");setFilterMonth("すべて");}} style={{fontSize:12,padding:"6px 10px",borderRadius:8,border:"1px solid #ddd",background:"transparent",cursor:"pointer"}}>リセット</button>}
            </div>
            <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
              {["すべて","交通費",...EXPENSE_CATS].map(c=>(
                <button key={c} onClick={()=>setFilterCat(c)} style={{fontSize:12,padding:"4px 10px",borderRadius:20,border:`1px solid ${filterCat===c?GREEN:"#ddd"}`,background:filterCat===c?GREEN:"transparent",color:filterCat===c?"#fff":"#555",cursor:"pointer",whiteSpace:"nowrap"}}>{c}</button>
              ))}
            </div>
            {catSummary.length>0&&(
              <div style={{...CS,marginBottom:10}}>
                {(filterCat==="すべて"||filterCat==="交通費")&&(()=>{
                  const transportTotal = catSummary.filter(([cat])=>isTransportCat(cat)).reduce((s,[,t])=>s+t,0);
                  if(!transportTotal) return null;
                  return (
                    <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #f0f0f0",fontSize:13}}>
                      <span style={{fontWeight:700,color:"#333"}}>交通費</span>
                      <span style={{fontWeight:700,color:"#333"}}>{fmt(transportTotal)}</span>
                    </div>
                  );
                })()}
                {filterCat==="すべて"&&catSummary.filter(([cat])=>!isTransportCat(cat)).map(([cat,t],i,arr)=>(
                  <div key={cat} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<arr.length-1?"1px solid #f0f0f0":"none",fontSize:13}}>
                    <span style={{color:"#555"}}>{cat}</span>
                    <span style={{fontWeight:700,color:"#333"}}>{fmt(t)}</span>
                  </div>
                ))}
                {filterCat!=="すべて"&&filterCat!=="交通費"&&catSummary.map(([cat,t],i)=>(
                  <div key={cat} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<catSummary.length-1?"1px solid #f0f0f0":"none",fontSize:13}}>
                    <span style={{color:"#555"}}>{cat}</span>
                    <span style={{fontWeight:700,color:"#333"}}>{fmt(t)}</span>
                  </div>
                ))}
                <div style={{display:"flex",justifyContent:"space-between",padding:"9px 0 0",marginTop:4,borderTop:"2px solid #eee",fontWeight:700,fontSize:14}}>
                  <span>{filterCat==="すべて"?"合計":filterCat==="交通費"?"交通費合計":filterCat+"合計"}</span><span style={{color:GREEN}}>{fmt(catFilteredTotal)}</span>
                </div>
              </div>
            )}
            <div style={CS}>
              {filtered.map((d,i)=>{
                const dispItems = filterCat==="すべて" ? (d.items||[])
                  : filterCat==="交通費" ? (d.items||[]).filter(it=>isTransportCat(it.cat))
                  : (d.items||[]).filter(it=>it.cat===filterCat);
                const dispTotal=totalOf(dispItems);
                if(filterCat!=="すべて"&&dispTotal===0)return null;
                return (
                  <div key={d.id} style={{padding:"8px 0",borderBottom:i<filtered.length-1?"1px solid #f0f0f0":"none"}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:14}}><span style={{fontWeight:500}}>{d.title}</span><span style={{fontWeight:700}}>{fmt(dispTotal)}</span></div>
                    <div style={{display:"flex",gap:10,marginTop:3,flexWrap:"wrap"}}>
                      <span style={{fontSize:11,color:"#aaa"}}>{d.date}</span>
                      {filterCat==="すべて"&&["Nk","Ak"].map(u=>{const t=paidByUser(d.items||[],u);return t>0?<span key={u} style={{fontSize:11,color:USER_COLORS[u]}}>{u}: {fmt(t)}</span>:null;})}
                    </div>
                  </div>
                );
              })}
              <div style={{display:"flex",justifyContent:"space-between",padding:"9px 0 0",marginTop:4,borderTop:"2px solid #eee",fontWeight:700,fontSize:15}}><span>合計</span><span style={{color:GREEN}}>{fmt(catFilteredTotal)}</span></div>
            </div>
          </div>
        )}

        {/* みらい */}
        {activeTab==="みらい"&&!loading&&(
          <div style={{padding:"1rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <p style={{margin:0,fontWeight:700}}>行きたいとこリスト</p>
              <button onClick={()=>{setEditFutureId(null);setFsName("");setFsMemo("");setFsAddr("");setFsLat("");setFsLng("");setFsUrl("");setFsChecked(false);setShowAddFuture(true);}}
                style={{fontSize:13,padding:"4px 12px",borderRadius:20,border:"1px solid #ddd",background:"transparent",cursor:"pointer"}}>+ 追加</button>
            </div>
            {futureSpots.length>0&&(
              <div style={{marginBottom:12}}>
                <SpotMap spots={futureSpots.filter(f=>f.lat&&f.name).map(f=>({id:f.id,name:f.name,address:f.address||"",lat:f.lat,lng:f.lng}))}/>
              </div>
            )}
            {futureSpots.length===0&&<p style={{color:"#aaa",fontSize:14,textAlign:"center",marginTop:40}}>まだリストがありません</p>}
            {/* 未チェック：並び替えボタン付き */}
            {futureSpots.filter(fs=>!fs.checked).map((fs,i,arr)=>(
              <div key={fs.id} style={{...CS,cursor:"pointer",display:"flex",gap:8,alignItems:"flex-start"}}>
                {/* 並び替えボタン */}
                <div style={{display:"flex",flexDirection:"column",gap:2,flexShrink:0,paddingTop:2}}>
                  <button onClick={async(e)=>{e.stopPropagation();if(i===0)return;const a=[...futureSpots.filter(f=>!f.checked)];[a[i],a[i-1]]=[a[i-1],a[i]];const reordered=[...a,...futureSpots.filter(f=>f.checked)];setFutureSpots(reordered);try{await Promise.all(reordered.map((f,idx)=>updateDoc(doc(db,"futureSpots",f.id),{order:idx})));}catch(e){}}}
                    style={{background:"none",border:"none",color:i===0?"#ddd":"#aaa",cursor:i===0?"default":"pointer",padding:"0 2px",fontSize:11,lineHeight:1}}>▲</button>
                  <button onClick={async(e)=>{e.stopPropagation();if(i===arr.length-1)return;const a=[...futureSpots.filter(f=>!f.checked)];[a[i],a[i+1]]=[a[i+1],a[i]];const reordered=[...a,...futureSpots.filter(f=>f.checked)];setFutureSpots(reordered);try{await Promise.all(reordered.map((f,idx)=>updateDoc(doc(db,"futureSpots",f.id),{order:idx})));}catch(e){}}}
                    style={{background:"none",border:"none",color:i===arr.length-1?"#ddd":"#aaa",cursor:i===arr.length-1?"default":"pointer",padding:"0 2px",fontSize:11,lineHeight:1}}>▼</button>
                </div>
                <div style={{flex:1,minWidth:0}} onClick={()=>{setEditFutureId(fs.id);setFsName(fs.name);setFsMemo(fs.memo||"");setFsAddr(fs.address||"");setFsLat(fs.lat||"");setFsLng(fs.lng||"");setFsUrl(fs.url||"");setFsChecked(fs.checked||false);setShowAddFuture(true);}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{margin:"0 0 2px",fontWeight:700,fontSize:15}}>{fs.name}</p>
                      {fs.memo&&<p style={{margin:"0 0 3px",fontSize:13,color:"#888"}}>{fs.memo}</p>}
                      {fs.url&&<a href={fs.url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:12,color:GREEN,textDecoration:"none",display:"block",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fs.url}</a>}
                      {fs.lat&&<p style={{margin:0,fontSize:11,color:GREEN}}>位置情報あり</p>}
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0,marginLeft:8}}>
                      {fs.lat&&<a href={`https://www.google.com/maps/search/?api=1&query=${fs.lat},${fs.lng}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:12,color:GREEN,textDecoration:"none"}}>Gマップ</a>}
                      <button onClick={async(e)=>{e.stopPropagation();const updated={...fs,checked:true};try{await updateDoc(doc(db,"futureSpots",fs.id),{checked:true});setFutureSpots(p=>p.map(f=>f.id===fs.id?{...f,checked:true}:f));}catch(err){alert("更新に失敗しました");}}}
                        style={{fontSize:11,padding:"3px 10px",borderRadius:20,border:`1px solid ${GREEN}`,background:"transparent",color:GREEN,cursor:"pointer",whiteSpace:"nowrap"}}>行った</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {/* チェック済み：グレーアウトして下に表示 */}
            {futureSpots.filter(fs=>fs.checked).length>0&&(
              <p style={{fontSize:11,color:"#bbb",margin:"12px 0 6px"}}>行ったところ</p>
            )}
            {futureSpots.filter(fs=>fs.checked).map(fs=>(
              <div key={fs.id} style={{...CS,opacity:0.5,cursor:"pointer"}} onClick={()=>{setEditFutureId(fs.id);setFsName(fs.name);setFsMemo(fs.memo||"");setFsAddr(fs.address||"");setFsLat(fs.lat||"");setFsLng(fs.lng||"");setFsUrl(fs.url||"");setFsChecked(fs.checked||false);setShowAddFuture(true);}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{margin:"0 0 2px",fontWeight:700,fontSize:15,textDecoration:"line-through",color:"#aaa"}}>{fs.name}</p>
                    {fs.memo&&<p style={{margin:0,fontSize:13,color:"#bbb"}}>{fs.memo}</p>}
                  </div>
                  <button onClick={async(e)=>{e.stopPropagation();try{await updateDoc(doc(db,"futureSpots",fs.id),{checked:false});setFutureSpots(p=>p.map(f=>f.id===fs.id?{...f,checked:false}:f));}catch(err){alert("更新に失敗しました");}}}
                    style={{fontSize:11,padding:"3px 10px",borderRadius:20,border:"1px solid #ddd",background:"transparent",color:"#aaa",cursor:"pointer",flexShrink:0,marginLeft:8,whiteSpace:"nowrap"}}>戻す</button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* ADD/EDIT DATE MODAL */}
      {showAddDate&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"flex-end",zIndex:1000}}>
          <div style={{background:"#fff",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:600,margin:"0 auto",boxSizing:"border-box",overflow:"hidden",height:"88vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"1.25rem 1.25rem 1rem",borderBottom:"1px solid #eee",flexShrink:0}}>
              <p style={{margin:"0 0 0.75rem",fontWeight:700,fontSize:16}}>{editDateId?"デートを編集":"新しいデートを記録"}</p>
              <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                <div style={{flex:2,minWidth:0}}><label style={{fontSize:12,color:"#888",display:"block",marginBottom:3}}>タイトル *</label><input value={ndTitle} onChange={e=>setNdTitle(e.target.value)} placeholder="例: 梅田グルメデート" style={{...INP,minWidth:0}}/></div>
                <div style={{flexShrink:0,width:120}}><label style={{fontSize:12,color:"#888",display:"block",marginBottom:3}}>日付 *</label><input type="date" value={ndDate} onChange={e=>setNdDate(e.target.value)} style={{...INP,fontSize:13,padding:"9px 6px"}}/></div>
              </div>
            </div>
            <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"1rem 1.25rem 120px",width:"100%",boxSizing:"border-box"}}>
              <div style={{marginBottom:14}}><label style={{fontSize:12,color:"#888",display:"block",marginBottom:3}}>メモ</label><textarea value={ndMemo} onChange={e=>setNdMemo(e.target.value)} placeholder="思い出メモ..." style={{...INP,minHeight:56,resize:"vertical"}}/></div>
              <div style={{marginBottom:14}}>
                <p style={{margin:"0 0 6px",fontWeight:700,fontSize:14}}>訪れた場所</p>
                <SpotEditor spots={ndSpots} onUpdate={ndUpdSpot} onGeocode={ndGeoSpot} onAdd={()=>setNdSpots(p=>[...p,makeSpot(Date.now())])} onRemove={id=>setNdSpots(p=>p.filter(s=>s.id!==id))} onMove={ndMoveSpot}/>
              </div>
              <div style={{marginBottom:14}}>
                <p style={{fontWeight:700,fontSize:14,marginBottom:8}}>写真</p>
                <input type="file" accept="image/*" multiple ref={photoRef} style={{display:"none"}} onChange={handlePhoto}/>
                <button onClick={()=>photoRef.current?.click()} style={{width:"100%",padding:"10px",borderRadius:8,border:"1px dashed #ddd",background:"transparent",cursor:"pointer",fontSize:13,color:"#888",marginBottom:8}}>+ 写真を追加（複数可）</button>
                {ndPhotos.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>{ndPhotos.map(p=><div key={p.id} style={{aspectRatio:"1",borderRadius:8,overflow:"hidden",border:"1px solid #eee"}}><img src={p.url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>)}</div>}
              </div>
              <p style={{fontWeight:700,fontSize:14,marginBottom:8}}>費用明細</p>
              {partnerItems.length > 0 && (
                <div style={{background:"#f7f7f7",borderRadius:8,padding:"8px 10px",marginBottom:10,border:"1px solid #eee"}}>
                  <p style={{margin:"0 0 6px",fontSize:11,color:"#aaa"}}>{partnerName}の入力分（編集不可）</p>
                  {partnerItems.map((item,i) => (
                    <div key={item.id||i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:i<partnerItems.length-1?"1px solid #eee":"none",fontSize:13}}>
                      <span style={{color:"#555"}}>{itemLabel(item)}</span>
                      <span style={{fontWeight:600,color:USER_COLORS[item.paidBy]||"#888"}}>{fmt(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              <p style={{fontSize:11,color:"#aaa",marginBottom:4}}>{currentUserName}の入力分</p>
              <RowEditor rows={ndItems} onUpdate={ndUpdRow} onAdd={(paidBy)=>setNdItems(p=>[...p,{...makeRow(Date.now()),paidBy}])} onRemove={id=>setNdItems(p=>p.length>1?p.filter(r=>r.id!==id):p)} defaultPaidBy={currentUserName}/>
              <div style={{display:"flex",justifyContent:"flex-end",fontSize:14,fontWeight:700,color:GREEN,margin:"8px 0"}}>合計: {fmt(totalOf([...ndItems,...partnerItems]))}</div>
            </div>
            <div style={{padding:"0.75rem 1.25rem 2rem",borderTop:"1px solid #eee",flexShrink:0,display:"flex",gap:10}}>
              <button onClick={()=>{setShowAddDate(false);setEditDateId(null);}} style={{flex:1,padding:12,borderRadius:10,border:"1px solid #ddd",background:"transparent",cursor:"pointer"}}>キャンセル</button>
              <button onClick={saveDate} disabled={saving} style={{flex:1,padding:12,borderRadius:10,border:"none",background:GREEN,color:"#fff",fontWeight:700,cursor:"pointer",opacity:saving?0.7:1}}>{saving?"保存中...":(editDateId?"更新":"保存")}</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT PLAN MODAL */}
      {showAddPlan&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"flex-end",zIndex:1000}}>
          <div style={{background:"#fff",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:600,margin:"0 auto",boxSizing:"border-box",overflow:"hidden",height:"88vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"1.25rem 1.25rem 1rem",borderBottom:"1px solid #eee",flexShrink:0}}>
              <p style={{margin:"0 0 0.75rem",fontWeight:700,fontSize:16}}>{editPlanId?"計画を編集":"デート計画を追加"}</p>
              <div style={{display:"flex",gap:8,alignItems:"flex-end",marginBottom:10}}>
                <div style={{flex:2,minWidth:0}}><label style={{fontSize:12,color:"#888",display:"block",marginBottom:3}}>タイトル *</label><input value={npTitle} onChange={e=>setNpTitle(e.target.value)} placeholder="例: 金沢・兼六園デート" style={{...INP,minWidth:0}}/></div>
                <div style={{flexShrink:0,width:120}}><label style={{fontSize:12,color:"#888",display:"block",marginBottom:3}}>予定日</label><input type="date" value={npDate} onChange={e=>setNpDate(e.target.value)} style={{...INP,fontSize:13,padding:"9px 6px"}}/></div>
              </div>
              <div style={{display:"flex",gap:0,borderBottom:"1px solid #eee",marginBottom:-1}}>
                {["スケジュール","持ち物","参照URL","買い物"].map(t=>(
                  <button key={t} onClick={()=>setNpPlanTab(t)} style={{flex:1,padding:"7px 2px",fontSize:11,fontWeight:npPlanTab===t?700:400,border:"none",background:"transparent",borderBottom:npPlanTab===t?`2px solid ${GREEN}`:"2px solid transparent",color:npPlanTab===t?GREEN:"#aaa",cursor:"pointer"}}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"1rem 1.25rem 120px",width:"100%",boxSizing:"border-box"}}>
              <div style={{marginBottom:12}}><label style={{fontSize:12,color:"#888",display:"block",marginBottom:3}}>メモ・アイデア</label><textarea value={npMemo} onChange={e=>setNpMemo(e.target.value)} placeholder="行きたいお店やアイデアなど..." style={{...INP,minHeight:48,resize:"vertical"}}/></div>

              {npPlanTab==="スケジュール"&&(
                <>
                  <p style={{fontWeight:700,fontSize:14,marginBottom:4}}>タイムスケジュール</p>
                  <ScheduleEditor
                    rows={npSched}
                    onUpdate={npUpdSched}
                    onAdd={()=>setNpSched(p=>[...p,makeSched(Date.now())])}
                    onRemove={id=>setNpSched(p=>p.length>1?p.filter(r=>r.id!==id):p)}
                    onMove={npMoveSched}
                    onGeocode={npGeoSched}
                    onGeocodeMove={npGeoSchedMove}
                    baseDate={npDate}
                  />
                  <div style={{display:"flex",justifyContent:"flex-end",fontSize:14,fontWeight:700,color:GREEN,margin:"8px 0"}}>予算合計: {fmt(budgetOf(npSched))}</div>
                </>
              )}

              {npPlanTab==="持ち物"&&(
                <>
                  <p style={{fontWeight:700,fontSize:14,marginBottom:8}}>持ち物リスト</p>
                  {["Nk","Ak"].map(u=>(
                    <div key={u} style={{background:"#f9f9f9",borderRadius:10,border:"1px solid #eee",padding:"10px 12px",marginBottom:8}}>
                      <p style={{fontSize:13,fontWeight:700,color:USER_COLORS[u],marginBottom:8}}>{u}</p>
                      {(npChecks[u]||[]).map(item=>(
                        <div key={item.id} style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
                          <button onClick={()=>setNpChecks(p=>({...p,[u]:p[u].filter(c=>c.id!==item.id)}))}
                            style={{background:"none",border:"none",color:"#ccc",fontSize:18,cursor:"pointer",padding:0,flexShrink:0,lineHeight:1}}>×</button>
                          <input value={item.text} onChange={e=>setNpChecks(p=>({...p,[u]:p[u].map(c=>c.id===item.id?{...c,text:e.target.value}:c)}))}
                            placeholder="持ち物を入力" style={{...SI,flex:1,minWidth:0}}/>
                        </div>
                      ))}
                      <button onClick={()=>setNpChecks(p=>({...p,[u]:[...p[u],makeCheckItem(Date.now())]}))}
                        style={{fontSize:12,padding:"4px 12px",borderRadius:20,border:"1px solid #ddd",background:"transparent",cursor:"pointer",color:"#888",marginTop:2}}>+ 追加</button>
                    </div>
                  ))}
                </>
              )}

              {npPlanTab==="参照URL"&&(
                <>
                  <p style={{fontWeight:700,fontSize:14,marginBottom:8}}>参照URL</p>
                  <div style={{background:"#f9f9f9",borderRadius:10,border:"1px solid #eee",padding:"10px 12px",marginBottom:8}}>
                    {npLinks.map(link=>(
                      <div key={link.id} style={{display:"flex",gap:6,alignItems:"center",marginBottom:5}}>
                        <input value={link.label} onChange={e=>setNpLinks(p=>p.map(l=>l.id===link.id?{...l,label:e.target.value}:l))}
                          placeholder="ラベル" style={{...SI,width:72,flexShrink:0}}/>
                        <input value={link.url} onChange={e=>setNpLinks(p=>p.map(l=>l.id===link.id?{...l,url:e.target.value}:l))}
                          placeholder="https://..." style={{...SI,flex:1,minWidth:0}}/>
                        <button onClick={()=>setNpLinks(p=>p.filter(l=>l.id!==link.id))}
                          style={{background:"none",border:"none",color:"#ccc",fontSize:18,cursor:"pointer",padding:0,flexShrink:0,lineHeight:1}}>×</button>
                      </div>
                    ))}
                    <button onClick={()=>setNpLinks(p=>[...p,makeLink(Date.now())])}
                      style={{fontSize:12,padding:"4px 12px",borderRadius:20,border:"1px solid #ddd",background:"transparent",cursor:"pointer",color:"#888",marginTop:2}}>+ URLを追加</button>
                  </div>
                </>
              )}

              {npPlanTab==="買い物"&&(
                <>
                  <p style={{fontWeight:700,fontSize:14,marginBottom:8}}>買い物リスト</p>
                  <div style={{background:"#f9f9f9",borderRadius:10,border:"1px solid #eee",padding:"10px 12px",marginBottom:8}}>
                    {npShops.map(item=>(
                      <div key={item.id} style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
                        <button onClick={()=>setNpShops(p=>p.filter(s=>s.id!==item.id))}
                          style={{background:"none",border:"none",color:"#ccc",fontSize:18,cursor:"pointer",padding:0,flexShrink:0,lineHeight:1}}>×</button>
                        <input value={item.text} onChange={e=>setNpShops(p=>p.map(s=>s.id===item.id?{...s,text:e.target.value}:s))}
                          placeholder="買い物を入力" style={{...SI,flex:1,minWidth:0}}/>
                      </div>
                    ))}
                    <button onClick={()=>setNpShops(p=>[...p,makeShopItem(Date.now())])}
                      style={{fontSize:12,padding:"4px 12px",borderRadius:20,border:"1px solid #ddd",background:"transparent",cursor:"pointer",color:"#888",marginTop:2}}>+ 追加</button>
                  </div>
                </>
              )}
            </div>
            <div style={{padding:"0.75rem 1.25rem 2rem",borderTop:"1px solid #eee",flexShrink:0,display:"flex",gap:10}}>
              <button onClick={()=>{setShowAddPlan(false);setEditPlanId(null);}} style={{flex:1,padding:12,borderRadius:10,border:"1px solid #ddd",background:"transparent",cursor:"pointer"}}>キャンセル</button>
              <button onClick={savePlan} disabled={saving} style={{flex:1,padding:12,borderRadius:10,border:"none",background:GREEN,color:"#fff",fontWeight:700,cursor:"pointer",opacity:saving?0.7:1}}>{saving?"保存中...":(editPlanId?"更新":"保存")}</button>
            </div>
          </div>
        </div>
      )}

      {/* BULK MODAL */}
      {showBulk&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"flex-end",zIndex:1000}}>
          <div style={{background:"#fff",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:600,margin:"0 auto",boxSizing:"border-box",overflow:"hidden",height:"80vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"1.25rem 1.25rem 1rem",borderBottom:"1px solid #eee",flexShrink:0}}>
              <p style={{margin:"0 0 4px",fontWeight:700,fontSize:16}}>費用を一括入力</p>
              <p style={{margin:0,fontSize:12,color:"#888"}}>金額を入力した行だけ追加されます</p>
            </div>
            <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"1rem 1.25rem 120px",width:"100%",boxSizing:"border-box"}}>
              <RowEditor rows={bulkRows} onUpdate={bkUpd} onAdd={()=>setBulkRows(p=>[...p,makeRow(Date.now())])} onRemove={id=>setBulkRows(p=>p.length>1?p.filter(r=>r.id!==id):p)}/>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:15,fontWeight:700,color:GREEN,margin:"10px 0 8px",paddingTop:10,borderTop:"2px solid #eee"}}><span>合計</span><span>{fmt(totalOf(bulkRows))}</span></div>
            </div>
            <div style={{padding:"0.75rem 1.25rem 2rem",borderTop:"1px solid #eee",flexShrink:0,display:"flex",gap:10}}>
              <button onClick={()=>setShowBulk(false)} style={{flex:1,padding:12,borderRadius:10,border:"1px solid #ddd",background:"transparent",cursor:"pointer"}}>キャンセル</button>
              <button onClick={saveBulk} disabled={saving} style={{flex:1,padding:12,borderRadius:10,border:"none",background:GREEN,color:"#fff",fontWeight:700,cursor:"pointer",opacity:saving?0.7:1}}>{saving?"追加中...":"追加する"}</button>
            </div>
          </div>
        </div>
      )}

      {photoView&&(
        <div onClick={()=>setPhotoView(null)} style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000}}>
          <img src={photoView} alt="" style={{maxWidth:"95%",maxHeight:"90%",borderRadius:8}}/>
        </div>
      )}

      {/* みらい ADD/EDIT MODAL */}
      {showAddFuture&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"flex-end",zIndex:1000}}>
          <div style={{background:"#fff",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:600,margin:"0 auto",boxSizing:"border-box",overflow:"hidden",maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"1.25rem 1.25rem 1rem",borderBottom:"1px solid #eee",flexShrink:0}}>
              <p style={{margin:0,fontWeight:700,fontSize:16}}>{editFutureId?"場所を編集":"行きたいとこを追加"}</p>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"1rem 1.25rem",boxSizing:"border-box"}}>
              <div style={{marginBottom:12}}>
                <label style={{fontSize:12,color:"#888",display:"block",marginBottom:3}}>場所名 *</label>
                <input value={fsName} onChange={e=>setFsName(e.target.value)} placeholder="例: 白川郷" style={INP}/>
              </div>
              <div style={{marginBottom:12}}>
                <label style={{fontSize:12,color:"#888",display:"block",marginBottom:3}}>メモ</label>
                <textarea value={fsMemo} onChange={e=>setFsMemo(e.target.value)} placeholder="行きたい理由など..." style={{...INP,minHeight:56,resize:"vertical"}}/>
              </div>
              <div style={{marginBottom:8}}>
                <label style={{fontSize:12,color:"#888",display:"block",marginBottom:3}}>住所</label>
                <div style={{display:"flex",gap:6}}>
                  <input value={fsAddr} onChange={e=>setFsAddr(e.target.value)} placeholder="住所を入力" style={{...INP,flex:1,minWidth:0,width:"auto"}}/>
                  <button onClick={async()=>{
                    if(!fsAddr&&!fsName)return;
                    setFsSearching(true);
                    const r=await geocode(fsAddr||fsName);
                    if(r){setFsLat(String(r.lat));setFsLng(String(r.lng));}
                    setFsSearching(false);
                  }} disabled={fsSearching||(!fsAddr&&!fsName)}
                    style={{padding:"9px 12px",borderRadius:8,border:"none",background:GREEN,color:"#fff",fontSize:12,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,opacity:(fsSearching||(!fsAddr&&!fsName))?0.5:1}}>
                    {fsSearching?"検索中…":fsLat?"再取得":"地図取得"}
                  </button>
                </div>
                {fsLat&&<p style={{margin:"4px 0 0",fontSize:11,color:GREEN}}>✓ 位置情報取得済</p>}
              </div>
              <div style={{marginBottom:8}}>
                <label style={{fontSize:12,color:"#888",display:"block",marginBottom:3}}>参照URL（任意）</label>
                <input value={fsUrl} onChange={e=>setFsUrl(e.target.value)} placeholder="https://..." style={INP}/>
              </div>
            </div>
            <div style={{padding:"0.75rem 1.25rem 2rem",borderTop:"1px solid #eee",flexShrink:0,display:"flex",gap:10}}>
              <button onClick={()=>{setShowAddFuture(false);setEditFutureId(null);}} style={{flex:1,padding:12,borderRadius:10,border:"1px solid #ddd",background:"transparent",cursor:"pointer"}}>キャンセル</button>
              {editFutureId&&<button onClick={async()=>{if(!window.confirm("削除しますか？"))return;try{await deleteDoc(doc(db,"futureSpots",editFutureId));setFutureSpots(p=>p.filter(f=>f.id!==editFutureId));}catch(e){alert("削除に失敗しました");}setShowAddFuture(false);setEditFutureId(null);}}
                style={{padding:"12px 16px",borderRadius:10,border:"1px solid #ffcccc",background:"#fff8f8",color:"#E24B4A",fontWeight:700,cursor:"pointer"}}>削除</button>}
              <button onClick={async()=>{
                if(!fsName)return;
                const data={name:fsName,memo:fsMemo,address:fsAddr,lat:fsLat,lng:fsLng,url:fsUrl,checked:fsChecked};
                try{
                  if(editFutureId){
                    await updateDoc(doc(db,"futureSpots",editFutureId),data);
                    setFutureSpots(p=>p.map(f=>f.id===editFutureId?{...data,id:editFutureId}:f));
                  } else {
                    const ref=await addDoc(collection(db,"futureSpots"),data);
                    setFutureSpots(p=>[...p,{...data,id:ref.id}]);
                  }
                }catch(e){alert("保存に失敗しました: "+e.message);}
                setShowAddFuture(false);setEditFutureId(null);
              }} style={{flex:1,padding:12,borderRadius:10,border:"none",background:GREEN,color:"#fff",fontWeight:700,cursor:"pointer"}}>
                {editFutureId?"更新":"追加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
