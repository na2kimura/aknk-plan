import { GREEN, CS, SI, fmt, USERS, USER_COLORS, ALL_MONTHS, EXPENSE_CATS, isTransportCat, paidByUser } from "../constants";

export default function CostManagement({ userTotals, yearlySummary, monthlySummary, catSummary, catFilteredTotal, filtered, filterYear, filterMonth, allYears, filterCat, setFilterYear, setFilterMonth, setFilterCat, totalAll }) {
  return (
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
                <span style={{fontWeight:700,color:"#333"}}>交通費合計</span>
                <span style={{fontWeight:700,color:"#333"}}>{fmt(transportTotal)}</span>
              </div>
            );
          })()}
          {catSummary.map(([cat,t],i)=>(
            <div key={cat} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<catSummary.length-1?"1px solid #f0f0f0":"none",fontSize:13}}>
              <span style={{color:"#555",paddingLeft:isTransportCat(cat)?16:0}}>{cat}</span>
              <span style={{fontWeight:isTransportCat(cat)?400:700,color:isTransportCat(cat)?"#888":"#333"}}>{fmt(t)}</span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",padding:"9px 0 0",marginTop:4,borderTop:"2px solid #eee",fontWeight:700,fontSize:14}}>
            <span>{filterCat==="すべて"?"合計":filterCat+"合計"}</span><span style={{color:GREEN}}>{fmt(catFilteredTotal)}</span>
          </div>
        </div>
      )}
      <div style={CS}>
        {filtered.map((d,i)=>{
          const dispItems = filterCat==="すべて" ? (d.items||[])
            : filterCat==="交通費" ? (d.items||[]).filter(it=>isTransportCat(it.cat))
            : (d.items||[]).filter(it=>it.cat===filterCat);
          const dispTotal=dispItems.reduce((s,i)=>s+(Number(i.amount)||0),0);
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
  );
}
