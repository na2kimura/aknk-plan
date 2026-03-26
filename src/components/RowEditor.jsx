import { EXPENSE_CATS, USERS, USER_COLORS, SI } from "../constants";

export default function RowEditor({ rows, onUpdate, onAdd, onRemove, defaultPaidBy }) {
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
