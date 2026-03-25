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
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

const GREEN = "#1D9E75";
const USERS = ["Nk", "Ak", "折半"];
const EXPENSE_CATS = ["飛行機", "電車", "その他交通費", "食事", "宿泊", "体験", "その他"];
const USER_COLORS = { Nk: "#D4537E", Ak: "#378ADD", 折半: "#888", Natsuki: "#D4537E", Akira: "#378ADD" };
// 旧データ(Natsuki/Akira)→新表示名(Nk/Ak)変換
const toDisplayUser = (u) => u === "Natsuki" ? "Nk" : u === "Akira" ? "Ak" : u;
const SCHEDULE_CATS = ["移動（行き）", "移動（帰り）", "場所・観光", "食事", "宿泊", "体験", "休憩", "その他"];

const makeRow   = (id) => ({ id, cat: "食事", note: "", amount: "", paidBy: "折半" });
const makeSpot  = (id) => ({ id, name: "", address: "", lat: "", lng: "" });
const makeSched = (id) => ({ id, cat: "食事", content: "", budget: "", time: "", place: "", address: "", lat: "", lng: "", dayOffset: 0, natsuki: { time: "", from: "", budget: "" }, akira: { time: "", from: "", budget: "" } });

const totalOf    = (items) => items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
const budgetOf   = (rows)  => rows.reduce((s, r) => isTransport(r.cat) ? s + (Number(r.natsuki?.budget)||0) + (Number(r.akira?.budget)||0) : s + (Number(r.budget)||0), 0);
const paidByUser = (items, u, alt) => items.filter(i => i.paidBy === u || (alt && i.paidBy === alt)).reduce((s, i) => s + (Number(i.amount)||0), 0);
const fmt        = (n) => `¥${Number(n).toLocaleString()}`;
const getYM      = (d) => d.slice(0, 7);
const getY       = (d) => d.slice(0, 4);
const itemLabel  = (item) => item.cat === "その他" && item.note ? item.note : item.cat + (item.note && item.cat !== "その他" ? `（${item.note}）` : "");
const isTransport = (cat) => cat === "移動（行き）" || cat === "移動（帰り）";
const isReturn    = (cat) => cat === "移動（帰り）";

const ALL_YEARS  = ["すべて"];
const ALL_MONTHS = ["すべて","01月","02月","03月","04月","05月","06月","07月","08月","09月","10月","11月","12月"];
const TABS = ["ホーム", "デート記録", "計画", "費用管理"];
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
      {/* アプリ内地図（座標取得済みのスポットのみ表示） */}
      {withCoords.length > 0 && (
        <div ref={ref} style={{width:"100%",height:220,borderRadius:10,overflow:"hidden",border:"1px solid #eee",marginBottom:8}}/>
      )}
      {/* Googleマップでルートを開くボタン */}
      <a href={routeUrl} target="_blank" rel="noreferrer"
        style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:"100%",padding:"9px",borderRadius:10,background:"#e8f5f0",border:`1px solid ${GREEN}33`,color:GREEN,fontWeight:700,fontSize:13,textDecoration:"none",marginBottom:8,boxSizing:"border-box"}}>
        <span>🗺️</span>
        <span>{allNamed.length === 1 ? "Googleマップで開く" : `${allNamed.length}ヶ所のルートをGoogleマップで開く`}</span>
      </a>
      {/* 個別リスト */}
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

  // ① 郵便番号が含まれる場合: zipcloud で住所に変換
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

  // ② 国土地理院API（日本住所・番地レベルまで対応・無料・APIキー不要）
  try {
    const r = await fetchWithTimeout(
      `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(q)}`,
      6000
    );
    if (r.ok) {
      const d = await r.json();
      if (d?.[0]?.geometry?.coordinates) {
        const [lng, lat] = d[0].geometry.coordinates;
        return { lat, lng };
      }
    }
  } catch {}

  // ③ photon（施設名・店舗名に強い）- 日本のbboxで絞る
  try {
    const r = await fetchWithTimeout(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=10&lang=ja&bbox=122,24,154,46`,
      7000
    );
    if (r.ok) {
      const d = await r.json();
      const jp = d?.features?.find(f => f.properties?.country === "Japan" || f.properties?.country === "日本");
      const f = jp || d?.features?.[0];
      if (f) return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
    }
  } catch {}

  // ④ GSI - 番地を除いた短縮クエリで再試行
  const qShort = q.replace(/\d+番(地|丁目)?/, "").replace(/[-－]\d+$/, "").trim();
  if (qShort !== q) {
    try {
      const r = await fetchWithTimeout(
        `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(qShort)}`,
        6000
      );
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

function RowEditor({ rows, onUpdate, onAdd, onRemove }) {
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
      <button onClick={onAdd} style={{width:"100%",padding:"7px",borderRadius:8,border:"1px dashed #ddd",background:"transparent",cursor:"pointer",fontSize:12,color:"#888",marginTop:2}}>+ 行を追加</button>
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

function ScheduleEditor({ rows, onUpdate, onAdd, onRemove, onMove, onGeocode, baseDate }) {
  // 基準日から日付ラベルを生成（最大7日）
  const dayOptions = Array.from({length:7}, (_,i) => {
    if (!baseDate) return { value: i, label: `${i+1}日目` };
    const d = new Date(baseDate);
    d.setDate(d.getDate() + i);
    const m = d.getMonth()+1, day = d.getDate();
    return { value: i, label: `${i+1}日目（${m}/${day}）` };
  });

  return (
    <div style={{width:"100%",minWidth:0}}>
      {rows.map((row,i) => {
        const trans = isTransport(row.cat), ret = isReturn(row.cat);
        const dayOff = row.dayOffset ?? 0;
        return (
          <div key={row.id} style={{background:"#f9f9f9",borderRadius:10,padding:"10px 12px",marginBottom:8,border:"1px solid #eee",minWidth:0,boxSizing:"border-box"}}>
            <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:8,minWidth:0}}>
              <div style={{display:"flex",flexDirection:"column",gap:1,flexShrink:0}}>
                <button onClick={()=>onMove(i,-1)} disabled={i===0} style={{background:"none",border:"none",color:i===0?"#ddd":"#aaa",cursor:i===0?"default":"pointer",padding:"0 2px",fontSize:12,lineHeight:1}}>▲</button>
                <button onClick={()=>onMove(i,1)} disabled={i===rows.length-1} style={{background:"none",border:"none",color:i===rows.length-1?"#ddd":"#aaa",cursor:i===rows.length-1?"default":"pointer",padding:"0 2px",fontSize:12,lineHeight:1}}>▼</button>
              </div>
              <select value={row.cat} onChange={e=>onUpdate(row.id,"cat",e.target.value)} style={{...SI,padding:"7px 4px",flexShrink:0,maxWidth:120}}>
                {SCHEDULE_CATS.map(c=><option key={c}>{c}</option>)}
              </select>
              <input value={row.content} onChange={e=>onUpdate(row.id,"content",e.target.value)} placeholder="内容" style={{...SI,flex:1,minWidth:0}}/>
              <button onClick={()=>onRemove(row.id)} style={{background:"none",border:"none",color:"#ccc",fontSize:16,cursor:"pointer",padding:0,flexShrink:0}}>×</button>
            </div>
            {/* 日付セレクト */}
            <div style={{paddingLeft:32,marginBottom:6}}>
              <select value={dayOff} onChange={e=>onUpdate(row.id,"dayOffset",Number(e.target.value))}
                style={{...SI,fontSize:12,padding:"5px 8px",background:"#fff",color:GREEN,fontWeight:600,border:`1px solid ${GREEN}44`}}>
                {dayOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {!trans && (
              <div style={{display:"flex",flexDirection:"column",gap:6,minWidth:0}}>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <div style={{display:"flex",gap:2,alignItems:"center",flexShrink:0}}>
                    <select value={row.time ? row.time.split(":")[0] : ""} onChange={e=>{const m=row.time?row.time.split(":")[1]||"00":"00";onUpdate(row.id,"time",e.target.value?`${e.target.value}:${m}`:"");}}
                      style={{...SI,width:56,padding:"7px 4px",boxSizing:"border-box",fontSize:13}}>
                      <option value="">--</option>
                      {Array.from({length:24},(_,i)=><option key={i} value={String(i).padStart(2,"0")}>{String(i).padStart(2,"0")}</option>)}
                    </select>
                    <span style={{fontSize:13,color:"#888"}}>:</span>
                    <select value={row.time ? row.time.split(":")[1]||"00" : ""} onChange={e=>{const h=row.time?row.time.split(":")[0]||"00":"00";onUpdate(row.id,"time",row.time||h?`${h||"00"}:${e.target.value}`:"");}}
                      style={{...SI,width:52,padding:"7px 4px",boxSizing:"border-box",fontSize:13}}>
                      <option value="">--</option>
                      {["00","15","30","45"].map(m=><option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:3,flex:1,minWidth:0}}>
                    <span style={{fontSize:11,color:"#aaa",flexShrink:0}}>予算¥</span>
                    <input type="number" value={row.budget} onChange={e=>onUpdate(row.id,"budget",e.target.value)} placeholder="0" style={{...SI,flex:1,minWidth:0,textAlign:"right",boxSizing:"border-box"}}/>
                  </div>
                </div>
                <input value={row.place||""} onChange={e=>onUpdate(row.id,"place",e.target.value)} placeholder="場所名（例: 近江町市場）" style={{...SI,width:"100%",boxSizing:"border-box"}}/>
                <div style={{display:"flex",gap:6,alignItems:"center",minWidth:0}}>
                  <input value={row.address||""} onChange={e=>onUpdate(row.id,"address",e.target.value)} placeholder="住所を入力すると地図にピンが立ちます" style={{...SI,flex:1,minWidth:0}}/>
                  <button onClick={()=>onGeocode(row.id, row.address||row.place||row.content)} disabled={row.searching||(!row.place&&!row.content&&!row.address)}
                    style={{padding:"7px 8px",borderRadius:7,border:"none",background:GREEN,color:"#fff",fontSize:11,cursor:(row.searching||(!row.place&&!row.content&&!row.address))?"not-allowed":"pointer",whiteSpace:"nowrap",flexShrink:0,opacity:(row.searching||(!row.place&&!row.content&&!row.address))?0.5:1}}>
                    {row.searching ? "検索中…" : row.lat ? "再取得" : "地図取得"}
                  </button>
                </div>
                {row.lat && <p style={{margin:"2px 0 0",fontSize:11,color:GREEN}}>✓ 取得済</p>}
                {row.geoError && !row.lat && <p style={{margin:"2px 0 0",fontSize:11,color:"#E24B4A"}}>取得できませんでした。住所を入力して再度お試しください。</p>}
              </div>
            )}
            {trans && (
              <div style={{display:"flex",flexDirection:"column",gap:8,width:"100%",boxSizing:"border-box"}}>
                {[["natsuki","Natsuki"],["akira","Akira"]].map(([who,label]) => (
                  <div key={who} style={{background:"#fff",borderRadius:8,padding:"10px 12px",border:`1px solid ${USER_COLORS[label]}33`,boxSizing:"border-box"}}>
                    <p style={{margin:"0 0 8px",fontSize:12,fontWeight:700,color:USER_COLORS[label]}}>{label}</p>
                    <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:6}}>
                      <input type="time" step="60" value={row[who]?.time||""} onChange={e=>onUpdate(row.id,`${who}_time`,e.target.value)} style={{...SI,width:110,flexShrink:0,boxSizing:"border-box"}}/>
                      <div style={{display:"flex",alignItems:"center",gap:3,flex:1,minWidth:0}}>
                        <span style={{fontSize:11,color:"#aaa",flexShrink:0}}>予算¥</span>
                        <input type="number" value={row[who]?.budget||""} onChange={e=>onUpdate(row.id,`${who}_budget`,e.target.value)} placeholder="0" style={{...SI,flex:1,textAlign:"right",minWidth:0,boxSizing:"border-box"}}/>
                      </div>
                    </div>
                    <input value={row[who]?.from||""} onChange={e=>onUpdate(row.id,`${who}_from`,e.target.value)}
                      placeholder={ret?"目的地（例: 福井駅）":"出発地（例: 福井駅）"} style={{...SI,width:"100%",boxSizing:"border-box"}}/>
                  </div>
                ))}
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

  const [ndTitle,  setNdTitle]  = useState("");
  const [ndDate,   setNdDate]   = useState("");
  const [ndMemo,   setNdMemo]   = useState("");
  const [ndItems,  setNdItems]  = useState(Array.from({length:5},(_,i)=>makeRow(i+1)));
  const [ndSpots,  setNdSpots]  = useState([makeSpot(1)]);
  const [ndPhotos, setNdPhotos] = useState([]);
  const [ndSearch, setNdSearch] = useState(false);
  const photoRef = useRef(null);

  const [npTitle,  setNpTitle]  = useState("");
  const [npDate,   setNpDate]   = useState("");
  const [npMemo,   setNpMemo]   = useState("");
  const [npSched,  setNpSched]  = useState([makeSched(1)]);
  const [npSearch, setNpSearch] = useState(false);

  const [bulkRows, setBulkRows] = useState(Array.from({length:5},(_,i)=>makeRow(i+1)));

  // ── Auth ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const handleLogin = async (email, password) => {
    setLoginLoading(true); setLoginError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      setLoginError("メールアドレスまたはパスワードが違います");
    }
    setLoginLoading(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setDates([]); setPlans([]);
    setActiveTab("ホーム");
  };

  // ── Firestore load ──
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      getDocs(query(collection(db, "dates"), orderBy("date","desc"))),
      getDocs(query(collection(db, "plans"), orderBy("date","asc"))),
    ]).then(([dateSnap, planSnap]) => {
      setDates(dateSnap.docs.map(d => ({ ...d.data(), id: d.id })));
      setPlans(planSnap.docs.map(d => ({ ...d.data(), id: d.id })));
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
    const res={Nk:0,Ak:0,折半:0};
    dates.forEach(d=>(d.items||[]).forEach(i=>{
      const key = toDisplayUser(i.paidBy);
      res[key]=(res[key]||0)+(Number(i.amount)||0);
    }));
    return res;
  },[dates]);

  const catSummary = useMemo(()=>{
    const map={};
    filtered.forEach(d=>(d.items||[]).forEach(i=>{
      if(filterCat!=="すべて"&&i.cat!==filterCat)return;
      map[i.cat]=(map[i.cat]||0)+(Number(i.amount)||0);
    }));
    return Object.entries(map).sort((a,b)=>b[1]-a[1]);
  },[filtered,filterCat]);

  const catFilteredTotal = useMemo(()=>{
    if(filterCat==="すべて") return filteredTot;
    return filtered.reduce((s,d)=>s+(d.items||[]).filter(i=>i.cat===filterCat).reduce((ss,i)=>ss+(Number(i.amount)||0),0),0);
  },[filtered,filterCat,filteredTot]);

  const planSpots = (plan) => (plan.schedule||[])
    .filter(s => !isTransport(s.cat) && (s.place||s.content))
    .map((s,i) => ({id:s.id||i, name:s.place||s.content||"スポット", address:s.address||"", lat:s.lat||"", lng:s.lng||""}));

  // ── Date form ──
  const openAddDate = () => {
    setEditDateId(null); setNdTitle(""); setNdDate(""); setNdMemo("");
    setNdItems(Array.from({length:5},(_,i)=>makeRow(i+1)));
    setNdSpots([makeSpot(1)]); setNdPhotos([]); setShowAddDate(true);
  };
  const openEditDate = (d) => {
    setEditDateId(d.id); setNdTitle(d.title); setNdDate(d.date); setNdMemo(d.memo||"");
    const existing = (d.items||[]).map(it=>({...it, amount: String(it.amount)}));
    setNdItems(existing.length ? existing : Array.from({length:5},(_,i)=>makeRow(i+1)));
    setNdSpots((d.spots||[]).length ? d.spots.map(s=>({...s})) : [makeSpot(1)]);
    setNdPhotos(d.photos ? [...d.photos] : []);
    setShowAddDate(true);
  };

  const saveDate = async () => {
    if(!ndTitle||!ndDate) return;
    setSaving(true);
    const validItems = ndItems.filter(i => i.amount !== "" && Number(i.amount) > 0).map(i=>({...i,amount:Number(i.amount)}));
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
    } catch(e) { alert("保存に失敗しました: "+e.message); }
    setSaving(false); setShowAddDate(false); setEditDateId(null);
  };

  const deleteDate = async (id) => {
    if(!window.confirm("このデート記録を削除しますか？\nこの操作は元に戻せません。")) return;
    try {
      await deleteDoc(doc(db,"dates",id));
      setDates(p=>p.filter(d=>d.id!==id));
      setSelDateId(null);
    } catch(e) { alert("削除に失敗しました: "+e.message); }
  };

  const deletePlan = async (id) => {
    if(!window.confirm("この計画を削除しますか？\nこの操作は元に戻せません。")) return;
    try {
      await deleteDoc(doc(db,"plans",id));
      setPlans(p=>p.filter(pl=>pl.id!==id));
      setSelPlanId(null);
    } catch(e) { alert("削除に失敗しました: "+e.message); }
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
  const npUpdSched = (id,field,val) => setNpSched(p=>p.map(r=>{
    if(r.id!==id) return r;
    if(field==="natsuki_time")   return {...r,natsuki:{...r.natsuki,time:val}};
    if(field==="natsuki_from")   return {...r,natsuki:{...r.natsuki,from:val}};
    if(field==="natsuki_budget") return {...r,natsuki:{...r.natsuki,budget:val}};
    if(field==="akira_time")     return {...r,akira:{...r.akira,time:val}};
    if(field==="akira_from")     return {...r,akira:{...r.akira,from:val}};
    if(field==="akira_budget")   return {...r,akira:{...r.akira,budget:val}};
    if(field==="dayOffset")      return {...r,dayOffset:val};
    return {...r,[field]:val};
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
  const npMoveSched = (i, dir) => setNpSched(p => {
    const a=[...p], j=i+dir;
    if(j<0||j>=a.length)return p; [a[i],a[j]]=[a[j],a[i]]; return a;
  });
  const openAddPlan = () => { setEditPlanId(null); setNpTitle(""); setNpDate(""); setNpMemo(""); setNpSched([makeSched(1)]); setShowAddPlan(true); };
  const openEditPlan = (plan) => { setEditPlanId(plan.id); setNpTitle(plan.title); setNpDate(plan.date); setNpMemo(plan.memo||""); setNpSched((plan.schedule||[]).map(s=>({...s,natsuki:{...s.natsuki},akira:{...s.akira}}))); setShowAddPlan(true); };
  const savePlan = async () => {
    if(!npTitle||!npDate) return;
    setSaving(true);
    const data = { title:npTitle, date:npDate, memo:npMemo, status:"計画中", schedule:npSched };
    try {
      if(editPlanId) {
        await updateDoc(doc(db,"plans",editPlanId), data);
        setPlans(p=>p.map(pl=>pl.id===editPlanId?{...data,id:editPlanId}:pl));
      } else {
        const ref = await addDoc(collection(db,"plans"), data);
        setPlans(p=>[...p,{...data,id:ref.id}].sort((a,b)=>a.date.localeCompare(b.date)));
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

  // ── Render ──
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
            <button key={t} onClick={()=>{setActiveTab(t);setSelDateId(null);setSelPlanId(null);}} style={{flex:1,padding:"8px 4px",fontSize:12,fontWeight:activeTab===t?700:400,border:"none",background:"transparent",borderBottom:activeTab===t?`2px solid ${GREEN}`:"2px solid transparent",color:activeTab===t?GREEN:"#888",cursor:"pointer"}}>{t}</button>
          ))}
        </div>
      </div>

      {loading && <div style={{padding:"2rem",textAlign:"center",color:"#aaa",fontSize:14}}>データを読み込み中...</div>}

      <div style={{flex:1,overflowY:"auto"}}>

        {/* HOME */}
        {activeTab==="ホーム"&&!loading&&(
          <div style={{padding:"1rem"}}>
            {yearlySummary.length>0&&<p style={{fontWeight:700,marginBottom:10,fontSize:14}}>年別サマリー</p>}
            {yearlySummary.map(([y,d])=>(
              <div key={y} style={{...CS,padding:"0.75rem 1rem",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <span style={{fontWeight:700,fontSize:15}}>{y}年</span>
                  <span style={{fontSize:12,color:"#888"}}>{d.count}回</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                  {[{l:"合計費用",v:fmt(d.total),c:"#888"},{l:"Nk",v:fmt(dates.filter(dt=>getY(dt.date)===y).reduce((s,dt)=>s+paidByUser(dt.items||[],"Nk","Natsuki"),0)),c:USER_COLORS.Nk},{l:"Ak",v:fmt(dates.filter(dt=>getY(dt.date)===y).reduce((s,dt)=>s+paidByUser(dt.items||[],"Ak","Akira"),0)),c:USER_COLORS.Ak}].map(s=>(
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
              <div key={d.id} onClick={()=>{setSelDateId(d.id);setActiveTab("デート記録");}} style={{...CS,display:"flex",alignItems:"center",gap:12,cursor:"pointer",padding:"0.75rem 1rem"}}>
                {d.photos?.[0]?<img src={d.photos[0].url} alt="" style={{width:40,height:40,borderRadius:8,objectFit:"cover",flexShrink:0}}/>:<div style={{width:40,height:40,borderRadius:8,background:"#e8f5f0",flexShrink:0}}/>}
                <div style={{flex:1,minWidth:0}}><p style={{margin:0,fontWeight:600,fontSize:14}}>{d.title}</p><p style={{margin:0,fontSize:12,color:"#888"}}>{d.date}</p></div>
                <span style={{fontWeight:700,fontSize:14,color:GREEN,whiteSpace:"nowrap"}}>{fmt(totalOf(d.items||[]))}</span>
              </div>
            ))}
            <button onClick={openAddDate} style={{width:"100%",marginTop:"1rem",padding:"12px",borderRadius:10,border:"none",background:GREEN,color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer"}}>+ 新しいデートを記録</button>
          </div>
        )}

        {/* DATE LIST */}
        {activeTab==="デート記録"&&!selDate&&!loading&&(
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
        {activeTab==="デート記録"&&selDate&&(
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
              {(selDate.items||[]).map((item,i)=>(
                <div key={item.id||i} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:"4px 12px",padding:"7px 0",borderBottom:i<selDate.items.length-1?"1px solid #f0f0f0":"none",alignItems:"center"}}>
                  <span style={{fontSize:14}}>{itemLabel(item)}</span>
                  <span style={{fontSize:11,padding:"1px 7px",borderRadius:20,background:(USER_COLORS[item.paidBy]||"#888")+"22",color:USER_COLORS[item.paidBy]||"#888",whiteSpace:"nowrap"}}>{toDisplayUser(item.paidBy)}</span>
                  <span style={{fontWeight:500,fontSize:14,textAlign:"right"}}>{fmt(item.amount)}</span>
                </div>
              ))}
              <div style={{paddingTop:10,marginTop:6,borderTop:"2px solid #eee"}}>
                <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:16,marginBottom:6}}><span>合計</span><span style={{color:GREEN}}>{fmt(totalOf(selDate.items||[]))}</span></div>
                <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                  {USERS.map(u=>{const t=paidByUser(selDate.items||[],u);return t>0?<span key={u} style={{fontSize:12,color:USER_COLORS[u]}}>{u}: {fmt(t)}</span>:null;})}
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
              <p style={{margin:"0 0 6px",fontSize:13,color:"#888"}}>予定日: {selPlan.date}</p>
              {selPlan.memo&&<div style={{background:"#f7f7f7",borderRadius:8,padding:"8px 12px",fontSize:14,marginTop:6}}>{selPlan.memo}</div>}
            </div>
            {planSpots(selPlan).length>0&&(
              <div style={{marginBottom:12}}>
                <p style={{fontWeight:700,fontSize:14,marginBottom:8}}>訪れる場所</p>
                <SpotMap spots={planSpots(selPlan)}/>
              </div>
            )}
            <p style={{fontWeight:700,fontSize:14,marginBottom:8}}>タイムスケジュール</p>
            <div style={CS}>
              {(()=>{
                const schedule = selPlan.schedule||[];
                // dayOffsetでグループ化
                const days = [...new Set(schedule.map(s=>s.dayOffset??0))].sort((a,b)=>a-b);
                return days.map(dayOff => {
                  const dayRows = schedule.filter(s=>(s.dayOffset??0)===dayOff);
                  // 日付ラベル生成
                  let dayLabel = `${dayOff+1}日目`;
                  if (selPlan.date) {
                    const d = new Date(selPlan.date);
                    d.setDate(d.getDate()+dayOff);
                    dayLabel = `${dayOff+1}日目（${d.getMonth()+1}/${d.getDate()}）`;
                  }
                  return (
                    <div key={dayOff} style={{marginBottom:dayOff<days[days.length-1]?12:0}}>
                      {days.length>1&&<p style={{margin:"0 0 8px",fontSize:12,fontWeight:700,color:GREEN,background:"#e8f5f0",padding:"4px 10px",borderRadius:6,display:"inline-block"}}>{dayLabel}</p>}
                      {dayRows.map((s,i)=>{
                        const trans=isTransport(s.cat), ret=isReturn(s.cat);
                        const isLast = i===dayRows.length-1 && dayOff===days[days.length-1];
                        return (
                          <div key={s.id||i} style={{padding:"8px 0",borderBottom:!isLast?"1px solid #f0f0f0":"none"}}>
                            {!trans&&(
                              <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                                <span style={{fontSize:13,color:"#888",fontWeight:500,minWidth:44,flexShrink:0}}>{s.time||"--:--"}</span>
                                <div style={{flex:1}}>
                                  <div style={{display:"flex",justifyContent:"space-between"}}>
                                    <span style={{fontSize:14,fontWeight:500}}>{s.content}</span>
                                    {s.budget&&<span style={{fontSize:13,color:GREEN,fontWeight:700}}>{fmt(s.budget)}</span>}
                                  </div>
                                  <div style={{display:"flex",gap:8,alignItems:"center",marginTop:2,flexWrap:"wrap"}}>
                                    <span style={{fontSize:11,color:"#888"}}>{s.cat}</span>
                                    {(s.place||s.lat)&&(
                                      <a href={s.lat?`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.place)}`} target="_blank" rel="noreferrer"
                                        style={{fontSize:11,color:GREEN,textDecoration:"none"}}>{s.place||"地図"} →Gマップ</a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                            {trans&&(
                              <div>
                                <p style={{margin:"0 0 6px",fontSize:13,fontWeight:700,color:"#555"}}>{s.cat}　{s.content}</p>
                                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                                  {[["natsuki","Natsuki"],["akira","Akira"]].map(([who,label])=>{
                                    const d=s[who]||{}, hasData=d.time||d.from||d.budget;
                                    return (
                                      <div key={who} style={{background:"#f7f7f7",borderRadius:8,padding:"8px 10px"}}>
                                        <p style={{margin:"0 0 4px",fontSize:11,fontWeight:700,color:USER_COLORS[label]}}>{label}</p>
                                        {hasData?(<>{d.time&&<p style={{margin:"0 0 2px",fontSize:13}}>{d.time}</p>}{d.from&&<p style={{margin:"0 0 2px",fontSize:12,color:"#555"}}>{ret?"目的地":"出発地"}: {d.from}</p>}{d.budget&&<p style={{margin:0,fontSize:12,color:GREEN,fontWeight:700}}>{fmt(d.budget)}</p>}</>):<p style={{margin:0,fontSize:12,color:"#bbb"}}>未入力</p>}
                                      </div>
                                    );
                                  })}
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
            <div style={{display:"flex",gap:10,marginTop:"1rem",flexWrap:"wrap"}}>
              <button onClick={()=>openEditPlan(selPlan)} style={{flex:1,padding:"12px",borderRadius:10,border:"1px solid #ddd",background:"#fff",color:"#555",fontWeight:700,fontSize:14,cursor:"pointer"}}>編集する</button>
              {selPlan.status==="計画中"&&<button onClick={()=>markDone(selPlan.id)} style={{flex:1,padding:"12px",borderRadius:10,border:`2px solid ${GREEN}`,background:"#fff",color:GREEN,fontWeight:700,fontSize:14,cursor:"pointer"}}>実行済みにする</button>}
              <button onClick={()=>deletePlan(selPlan.id)} style={{width:"100%",padding:"12px",borderRadius:10,border:"1px solid #ffcccc",background:"#fff8f8",color:"#E24B4A",fontWeight:700,fontSize:14,cursor:"pointer"}}>削除</button>
            </div>
          </div>
        )}

        {/* COST */}
        {activeTab==="費用管理"&&!loading&&(
          <div style={{padding:"1rem"}}>
            <p style={{margin:"0 0 10px",fontWeight:700}}>費用管理</p>
            <div style={{display:"flex",gap:8,marginBottom:"1.25rem"}}>
              {USERS.map(u=>(
                <div key={u} style={{flex:1,background:USER_COLORS[u]+"18",borderRadius:10,padding:"0.65rem 0.75rem"}}>
                  <p style={{margin:0,fontSize:11,color:USER_COLORS[u]}}>{u}</p>
                  <p style={{margin:"3px 0 0",fontWeight:700,fontSize:15}}>{fmt(userTotals[u]||0)}</p>
                </div>
              ))}
            </div>
            <p style={{fontWeight:700,fontSize:13,marginBottom:8,color:"#555"}}>年別合計</p>
            <div style={CS}>
              {yearlySummary.map(([y,d],i)=>(
                <div key={y} style={{padding:"7px 0",borderBottom:i<yearlySummary.length-1?"1px solid #f0f0f0":"none",fontSize:14}}>
                  <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:500}}>{y}年（{d.count}回）</span><span style={{fontWeight:700}}>{fmt(d.total)}</span></div>
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",padding:"9px 0 0",marginTop:4,borderTop:"2px solid #eee",fontWeight:700,fontSize:15}}><span>累計</span><span style={{color:GREEN}}>{fmt(totalAll)}</span></div>
            </div>
            <p style={{fontWeight:700,fontSize:13,margin:"1.25rem 0 8px",color:"#555"}}>月別合計</p>
            <div style={CS}>
              {monthlySummary.map(([ym,t],i)=>{
                const [y,m]=ym.split("-"), max=Math.max(...monthlySummary.map(([,v])=>v));
                return (
                  <div key={ym} style={{padding:"7px 0",borderBottom:i<monthlySummary.length-1?"1px solid #f0f0f0":"none"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:13}}><span>{y}年{m}月</span><span style={{fontWeight:700}}>{fmt(t)}</span></div>
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
              {["すべて",...EXPENSE_CATS].map(c=>(
                <button key={c} onClick={()=>setFilterCat(c)} style={{fontSize:12,padding:"4px 10px",borderRadius:20,border:`1px solid ${filterCat===c?GREEN:"#ddd"}`,background:filterCat===c?GREEN:"transparent",color:filterCat===c?"#fff":"#555",cursor:"pointer",whiteSpace:"nowrap"}}>{c}</button>
              ))}
            </div>
            {catSummary.length>0&&(
              <div style={{...CS,marginBottom:10}}>
                {catSummary.map(([cat,t],i)=>(
                  <div key={cat} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<catSummary.length-1?"1px solid #f0f0f0":"none",fontSize:13}}>
                    <span style={{color:"#555"}}>{cat}</span><span style={{fontWeight:700}}>{fmt(t)}</span>
                  </div>
                ))}
                <div style={{display:"flex",justifyContent:"space-between",padding:"9px 0 0",marginTop:4,borderTop:"2px solid #eee",fontWeight:700,fontSize:14}}>
                  <span>{filterCat==="すべて"?"合計":filterCat+"合計"}</span><span style={{color:GREEN}}>{fmt(catFilteredTotal)}</span>
                </div>
              </div>
            )}
            <div style={CS}>
              {filtered.map((d,i)=>{
                const dispItems=filterCat==="すべて"?(d.items||[]):(d.items||[]).filter(it=>it.cat===filterCat);
                const dispTotal=totalOf(dispItems);
                if(filterCat!=="すべて"&&dispTotal===0)return null;
                return (
                  <div key={d.id} style={{padding:"8px 0",borderBottom:i<filtered.length-1?"1px solid #f0f0f0":"none"}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:14}}><span style={{fontWeight:500}}>{d.title}</span><span style={{fontWeight:700}}>{fmt(dispTotal)}</span></div>
                    <div style={{display:"flex",gap:10,marginTop:3,flexWrap:"wrap"}}>
                      <span style={{fontSize:11,color:"#aaa"}}>{d.date}</span>
                      {filterCat==="すべて"&&USERS.map(u=>{const t=paidByUser(d.items||[],u);return t>0?<span key={u} style={{fontSize:11,color:USER_COLORS[u]}}>{u}: {fmt(t)}</span>:null;})}
                    </div>
                  </div>
                );
              })}
              <div style={{display:"flex",justifyContent:"space-between",padding:"9px 0 0",marginTop:4,borderTop:"2px solid #eee",fontWeight:700,fontSize:15}}><span>合計</span><span style={{color:GREEN}}>{fmt(catFilteredTotal)}</span></div>
            </div>
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
            <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"1rem 1.25rem",width:"100%",boxSizing:"border-box"}}>
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
              <RowEditor rows={ndItems} onUpdate={ndUpdRow} onAdd={()=>setNdItems(p=>[...p,makeRow(Date.now())])} onRemove={id=>setNdItems(p=>p.length>1?p.filter(r=>r.id!==id):p)}/>
              <div style={{display:"flex",justifyContent:"flex-end",fontSize:14,fontWeight:700,color:GREEN,margin:"8px 0"}}>合計: {fmt(totalOf(ndItems))}</div>
            </div>
            <div style={{padding:"0.75rem 1.25rem",borderTop:"1px solid #eee",flexShrink:0,display:"flex",gap:10}}>
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
              <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                <div style={{flex:2,minWidth:0}}><label style={{fontSize:12,color:"#888",display:"block",marginBottom:3}}>タイトル *</label><input value={npTitle} onChange={e=>setNpTitle(e.target.value)} placeholder="例: 金沢・兼六園デート" style={{...INP,minWidth:0}}/></div>
                <div style={{flexShrink:0,width:120}}><label style={{fontSize:12,color:"#888",display:"block",marginBottom:3}}>予定日 *</label><input type="date" value={npDate} onChange={e=>setNpDate(e.target.value)} style={{...INP,fontSize:13,padding:"9px 6px"}}/></div>
              </div>
            </div>
            <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"1rem 1.25rem",width:"100%",boxSizing:"border-box"}}>
              <div style={{marginBottom:14}}><label style={{fontSize:12,color:"#888",display:"block",marginBottom:3}}>メモ・アイデア</label><textarea value={npMemo} onChange={e=>setNpMemo(e.target.value)} placeholder="行きたいお店やアイデアなど..." style={{...INP,minHeight:56,resize:"vertical"}}/></div>
              <p style={{fontWeight:700,fontSize:14,marginBottom:4}}>タイムスケジュール</p>
              <ScheduleEditor rows={npSched} onUpdate={npUpdSched} onAdd={()=>setNpSched(p=>[...p,makeSched(Date.now())])} onRemove={id=>setNpSched(p=>p.length>1?p.filter(r=>r.id!==id):p)} onMove={npMoveSched} onGeocode={npGeoSched} baseDate={npDate}/>
              <div style={{display:"flex",justifyContent:"flex-end",fontSize:14,fontWeight:700,color:GREEN,margin:"8px 0"}}>予算合計: {fmt(budgetOf(npSched))}</div>
            </div>
            <div style={{padding:"0.75rem 1.25rem",borderTop:"1px solid #eee",flexShrink:0,display:"flex",gap:10}}>
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
            <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"1rem 1.25rem",width:"100%",boxSizing:"border-box"}}>
              <RowEditor rows={bulkRows} onUpdate={bkUpd} onAdd={()=>setBulkRows(p=>[...p,makeRow(Date.now())])} onRemove={id=>setBulkRows(p=>p.length>1?p.filter(r=>r.id!==id):p)}/>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:15,fontWeight:700,color:GREEN,margin:"10px 0 8px",paddingTop:10,borderTop:"2px solid #eee"}}><span>合計</span><span>{fmt(totalOf(bulkRows))}</span></div>
            </div>
            <div style={{padding:"0.75rem 1.25rem",borderTop:"1px solid #eee",flexShrink:0,display:"flex",gap:10}}>
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
    </div>
  );
}
