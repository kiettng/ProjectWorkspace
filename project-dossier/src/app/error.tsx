'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="center-page"><div className="login-card"><h1>Chưa thể mở trang</h1><p>Kiểm tra kết nối rồi thử lại. Dữ liệu đã lưu của bạn vẫn được giữ nguyên.</p><button className="btn" onClick={reset}>Thử lại</button><a className="btn secondary" href="/login">Đăng nhập lại</a></div></main>;}
