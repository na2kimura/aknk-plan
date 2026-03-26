import { GREEN, CS, fmt, budgetOf, isTransport, isReturn, USER_COLORS, planSpots } from "../constants";
import SpotMap from "../components/SpotMap";

export default function PlanDetail({ selPlan, setSelPlanId, openEditPlan, markDone, deletePlan }) {
  return (
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
          const days = [...new Set(schedule.map(s=>s.dayOffset??0))].sort((a,b)=>a-b);
          return days.map(dayOff => {
            const dayRows = schedule.filter(s=>(s.dayOffset??0)===dayOff);
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
  );
}
