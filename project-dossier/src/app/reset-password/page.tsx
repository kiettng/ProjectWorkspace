'use client';
import { useState } from 'react';
import { browserClient } from '@/lib/supabase/browser';
export default function ResetPassword(){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <main className="center-page"><form className="login-card" onSubmit={async e=>{
  e.preventDefault();setBusy(true);setError('');const password=String(new FormData(e.currentTarget).get('password'));
  const db=browserClient();const {data:{user}}=await db.auth.getUser();
  if(!user){setError('Liên kết đã hết hạn. Hãy yêu cầu đặt lại mật khẩu.');setBusy(false);return;}
  const {error}=await db.auth.updateUser({password});
  if(error){setError(error.message);setBusy(false);}else location.assign('/');
 }}><h1>Mật khẩu mới</h1><label>Mật khẩu<input name="password" type="password" autoComplete="new-password" minLength={12} required/></label>{error?<p role="alert" className="error-banner">{error}</p>:null}<button className="btn" disabled={busy}>Lưu mật khẩu</button></form></main>;
}
