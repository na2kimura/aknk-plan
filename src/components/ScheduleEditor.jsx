import { isTransport, isReturn, SCHEDULE_CATS, USER_COLORS, GREEN, SI } from "../constants";

export default function ScheduleEditor({ rows, onUpdate, onAdd, onRemove, onMove, onGeocode, baseDate }) {
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
