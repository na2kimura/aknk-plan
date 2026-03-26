import { GREEN, CS, fmt, budgetOf, totalOf, getY, paidByUser, USER_COLORS } from "../constants";

export default function Home({ yearlySummary, dates, plans, setActiveTab, setSelDateId, setSelPlanId, openAddDate }) {
  return (
    <div style={{padding:"1rem"}}>
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
        <div key={d.id} onClick={()=>{setSelDateId(d.id);setActiveTab("デート記録");}} style={{...CS,display:"flex",alignItems:"center",gap:12,cursor:"pointer",padding:"0.75rem 1rem"}}>
          {d.photos?.[0]?<img src={d.photos[0].url} alt="" style={{width:40,height:40,borderRadius:8,objectFit:"cover",flexShrink:0}}/>:<div style={{width:40,height:40,borderRadius:8,background:"#e8f5f0",flexShrink:0}}/>}
          <div style={{flex:1,minWidth:0}}><p style={{margin:0,fontWeight:600,fontSize:14}}>{d.title}</p><p style={{margin:0,fontSize:12,color:"#888"}}>{d.date}</p></div>
          <span style={{fontWeight:700,fontSize:14,color:GREEN,whiteSpace:"nowrap"}}>{fmt(totalOf(d.items||[]))}</span>
        </div>
      ))}
      <button onClick={openAddDate} style={{width:"100%",marginTop:"1rem",padding:"12px",borderRadius:10,border:"none",background:GREEN,color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer"}}>+ 新しいデートを記録</button>
    </div>
  );
}
