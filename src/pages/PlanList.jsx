import { GREEN, CS, fmt, budgetOf, getYM } from "../constants";

export default function PlanList({ plans, setSelPlanId, openAddPlan }) {
  return (
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
  );
}
