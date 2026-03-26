import { useState } from "react";
import { GREEN, INP } from "../constants";

export default function LoginScreen({ onLogin, error, loading }) {
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
