'use client';
import { useState } from 'react';
import { FolderClosed,LockKeyhole,LoaderCircle,CheckCircle2 } from 'lucide-react';
import { browserClient } from '@/lib/supabase/browser';

export default function LoginForm() {
 const [mode,setMode]=useState<'login'|'activate'|'recover'>('login');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function submit(e:React.SubmitEvent<HTMLFormElement>) {
  e.preventDefault();setError('');setMessage('');setBusy(true);
  const form=new FormData(e.currentTarget), email=String(form.get('email')||''),password=String(form.get('password')||'');
  const db=browserClient();
  try {
   if(mode==='activate') {
    if(password.length<12) throw new Error('Hãy dùng mật khẩu có ít nhất 12 ký tự.');
    const {error}=await db.auth.signUp({email,password,options:{emailRedirectTo:location.origin+'/auth/callback'}});
    if(error) throw error;
    setMessage('Nếu địa chỉ email được cấp quyền, bạn sẽ nhận được email xác nhận. Mở liên kết trong email rồi quay lại đăng nhập.');
   } else if(mode==='recover') {
    const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/auth/callback?next=/reset-password'});
    if(error) throw error;
    setMessage('Nếu tài khoản tồn tại, liên kết đặt lại mật khẩu đã được gửi đến email của bạn.');
   } else {
    const {error}=await db.auth.signInWithPassword({email,password});
    if(error) throw new Error('Không thể đăng nhập. Kiểm tra email, mật khẩu và xác nhận email.');
    location.assign('/');
   }
  }catch(e){setError(e instanceof Error?e.message:'Không thể kết nối. Vui lòng thử lại.');}
  finally{setBusy(false);}
 }
 return <main className="login-page"><section className="login-story"><a className="brand" href="/login"><img src="/icon.svg" className="brand-symbol" width={43} height={43} alt=""/><span>Project Dossier<small>KHÔNG GIAN TRIỂN KHAI CÁ NHÂN</small></span></a>
  <div><span className="eyebrow light">MỌI HỒ SƠ, MỘT NƠI</span><h1>Gọn hồ sơ.<br/>Rõ tiến độ.</h1><p>Từ kế hoạch đầu tiên đến biên bản bàn giao. Giữ dự án, dữ liệu và tài liệu của bạn luôn liền mạch.</p>
  <div className="login-features"><span><CheckCircle2 size={18}/> Điền dữ liệu một lần, dùng cho nhiều biểu mẫu</span><span><CheckCircle2 size={18}/> Lưu từng phiên bản, dễ dàng tra cứu</span><span><CheckCircle2 size={18}/> Tiếp tục công việc từ bất kỳ máy tính nào</span></div></div>
  <small>Project Dossier · Không gian riêng của bạn</small></section>
  <section className="login-form-area"><div className="login-card"><span className="login-lock"><LockKeyhole size={25}/></span><h2>{mode==='activate'?'Kích hoạt tài khoản':mode==='recover'?'Đặt lại mật khẩu':'Chào mừng trở lại'}</h2>
  <p className="muted">{mode==='activate'?'Tạo mật khẩu cho địa chỉ email đã được cấp quyền.':mode==='recover'?'Nhập email để nhận liên kết đặt lại mật khẩu.':'Đăng nhập để tiếp tục với hồ sơ dự án của bạn.'}</p>
  <form onSubmit={submit}><label>Email<input name="email" type="email" autoComplete="email" required placeholder="Email của bạn"/></label>
  {mode!=='recover'?<label>Mật khẩu<input name="password" type="password" minLength={mode==='activate'?12:1} autoComplete={mode==='activate'?'new-password':'current-password'} required placeholder={mode==='activate'?'Tối thiểu 12 ký tự':'Mật khẩu của bạn'}/></label>:null}
  {error?<p className="error-banner" role="alert">{error}</p>:null}{message?<p className="success-banner" role="status">{message}</p>:null}
  <button className="btn full" disabled={busy}>{busy?<LoaderCircle className="spin" size={18}/>:<LockKeyhole size={17}/>} {mode==='activate'?'Kích hoạt':mode==='recover'?'Gửi liên kết':'Đăng nhập'}</button></form>
  <div className="login-links"><button type="button" onClick={()=>{setMode(mode==='activate'?'login':'activate');setError('');setMessage('');}}>{mode==='activate'?'Quay lại đăng nhập':'Lần đầu sử dụng? Kích hoạt tài khoản'}</button><button type="button" onClick={()=>{setMode(mode==='recover'?'login':'recover');setError('');setMessage('');}}>{mode==='recover'?'Quay lại đăng nhập':'Quên mật khẩu?'}</button></div>
  <p className="privacy-note"><LockKeyhole size={14}/> Ứng dụng riêng tư · Chỉ tài khoản được cấp quyền</p></div></section></main>;
}
