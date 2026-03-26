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

import {
  GREEN, TABS, INP,
  getUserName, getPartnerName, toDisplayUser,
  makeRow, makeSpot, makeSched,
  totalOf, budgetOf, fmt, itemLabel,
  getY, getYM,
  isTransportCat,
  USER_COLORS,
} from "./constants";
import { geocode } from "./utils/geocode";

import LoginScreen    from "./components/LoginScreen";
import SpotEditor     from "./components/SpotEditor";
import RowEditor      from "./components/RowEditor";
import ScheduleEditor from "./components/ScheduleEditor";

import Home           from "./pages/Home";
import DateList       from "./pages/DateList";
import DateDetail     from "./pages/DateDetail";
import PlanList       from "./pages/PlanList";
import PlanDetail     from "./pages/PlanDetail";
import CostManagement from "./pages/CostManagement";

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
    const res={Nk:0,Ak:0};
    dates.forEach(d=>(d.items||[]).forEach(i=>{
      const key = toDisplayUser(i.paidBy);
      res[key]=(res[key]||0)+(Number(i.amount)||0);
    }));
    return res;
  },[dates]);

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
        {activeTab==="ホーム"&&!loading&&(
          <Home yearlySummary={yearlySummary} dates={dates} plans={plans} setActiveTab={setActiveTab} setSelDateId={setSelDateId} setSelPlanId={setSelPlanId} openAddDate={openAddDate}/>
        )}
        {activeTab==="デート記録"&&!selDate&&!loading&&(
          <DateList filtered={filtered} filterYear={filterYear} filterMonth={filterMonth} allYears={allYears} setFilterYear={setFilterYear} setFilterMonth={setFilterMonth} setSelDateId={setSelDateId} openAddDate={openAddDate}/>
        )}
        {activeTab==="デート記録"&&selDate&&(
          <DateDetail selDate={selDate} setSelDateId={setSelDateId} openEditDate={openEditDate} deleteDate={deleteDate} setShowBulk={setShowBulk} setPhotoView={setPhotoView}/>
        )}
        {activeTab==="計画"&&!selPlan&&!loading&&(
          <PlanList plans={plans} setSelPlanId={setSelPlanId} openAddPlan={openAddPlan}/>
        )}
        {activeTab==="計画"&&selPlan&&(
          <PlanDetail selPlan={selPlan} setSelPlanId={setSelPlanId} openEditPlan={openEditPlan} markDone={markDone} deletePlan={deletePlan}/>
        )}
        {activeTab==="費用管理"&&!loading&&(
          <CostManagement userTotals={userTotals} yearlySummary={yearlySummary} monthlySummary={monthlySummary} catSummary={catSummary} catFilteredTotal={catFilteredTotal} filtered={filtered} filterYear={filterYear} filterMonth={filterMonth} allYears={allYears} filterCat={filterCat} setFilterYear={setFilterYear} setFilterMonth={setFilterMonth} setFilterCat={setFilterCat} totalAll={totalAll}/>
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
