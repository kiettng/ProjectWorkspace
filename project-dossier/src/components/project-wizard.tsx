'use client';
import { useState } from 'react';
import { FolderClosed,Check,FileText,Users,ClipboardCheck } from 'lucide-react';
import { Field,Submit } from './ui';
import type { Pack } from '@/lib/types';

export default function ProjectWizard({packs,onCreate,onClose,busy}:{packs:Pack[];onCreate:(data:Record<string,unknown>)=>Promise<void>;onClose:()=>void;busy:boolean}){
 const [step,setStep]=useState(0),[error,setError]=useState('');
 const [data,setData]=useState<Record<string,string>>({pack_id:packs[0]?.id||'',project_type:'Triển khai mới',code:'',name:'',customer:'',manager:'',tax_code:'',start_date:'',end_date:'',contract_number:'',signed_date:'',description:'',modules:'',integrations:''});
 const pack=packs.find(p=>p.id===data.pack_id);
 const input=(key:string,type='text',required=false)=><input name={key} type={type} value={data[key]||''} required={required} maxLength={type==='date'?undefined:300} onChange={e=>setData({...data,[key]:e.target.value})}/>;
 return <form onSubmit={async e=>{
  e.preventDefault();setError('');
  if(data.start_date&&data.end_date&&data.end_date<data.start_date){setError('Ngày kết thúc phải từ ngày bắt đầu trở đi.');return;}
  if(step<3){setStep(step+1);return;}
  try{await onCreate({...data,modules:data.modules.split(',').map(s=>s.trim()).filter(Boolean),integrations:data.integrations.split(',').map(s=>s.trim()).filter(Boolean)});}catch(e){setError(e instanceof Error?e.message:'Không thể tạo dự án.');}
 }}>
 <div className="modal-body"><ol className="stepper">{['Thông tin','Hợp đồng & phạm vi','Bộ hồ sơ','Xác nhận'].map((s,i)=><li key={s} className={step===i?'active':step>i?'done':''}><span>{step>i?<Check size={14}/>:i+1}</span>{s}</li>)}</ol>
 {step===0?<div className="form-grid"><Field label="Mã dự án *">{input('code','text',true)}</Field><Field label="Loại dự án"><select value={data.project_type} onChange={e=>setData({...data,project_type:e.target.value})}>{['Triển khai mới','Nâng cấp','Tích hợp API'].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Tên dự án *" wide>{input('name','text',true)}</Field><Field label="Khách hàng *" wide>{input('customer','text',true)}</Field><Field label="Mã số thuế">{input('tax_code')}</Field><Field label="Quản lý dự án">{input('manager')}</Field><Field label="Ngày bắt đầu">{input('start_date','date')}</Field><Field label="Ngày kết thúc dự kiến">{input('end_date','date')}</Field></div>:null}
 {step===1?<div className="form-grid"><Field label="Số hợp đồng chính">{input('contract_number')}</Field><Field label="Ngày ký">{input('signed_date','date')}</Field><Field label="Các phân hệ (cách nhau bằng dấu phẩy)" wide>{input('modules')}</Field><Field label="Các hệ thống tích hợp (cách nhau bằng dấu phẩy)" wide>{input('integrations')}</Field><Field label="Mô tả phạm vi" wide><textarea rows={4} value={data.description} onChange={e=>setData({...data,description:e.target.value})}/></Field><p className="form-hint wide">Bạn có thể bổ sung hợp đồng, phụ lục và nhân sự trong workspace sau khi tạo dự án.</p></div>:null}
 {step===2?<><Field label="Bộ quy trình"><select value={data.pack_id} onChange={e=>setData({...data,pack_id:e.target.value})}>{packs.map(p=><option value={p.id} key={p.id}>{p.name} · v{p.version}</option>)}</select></Field><div className="blueprint"><h3>Cây thư mục sẽ được tạo</h3>{pack?.blueprint.folders.map(f=><div key={f.code} style={{paddingLeft:f.parent?32:8}}><FolderClosed size={16}/><span>{f.code} · {f.name}</span></div>)}</div><p className="form-hint">Dự án giữ bản sao bộ quy trình này. Bạn có thể điều chỉnh thư mục riêng của dự án.</p></>:null}
 {step===3?<><div className="summary-top"><span className="summary-icon"><ClipboardCheck size={28}/></span><div><span className="eyebrow">SẴN SÀNG KHỞI TẠO</span><h3>{data.name}</h3><p>{data.code} · {data.customer}</p></div></div><dl className="summary-grid"><div><dt>Quản lý</dt><dd>{data.manager||'Chưa phân công'}</dd></div><div><dt>Hợp đồng chính</dt><dd>{data.contract_number||'Bổ sung sau'}</dd></div><div><dt>Bộ quy trình</dt><dd>{pack?.name}</dd></div><div><dt>Thời gian</dt><dd>{data.start_date||'Chưa xác định'} → {data.end_date||'Chưa xác định'}</dd></div></dl><div className="setup-counts"><span><FolderClosed size={18}/>{pack?.blueprint.folders.length} thư mục</span><span><FileText size={18}/>{pack?.blueprint.phases.length} giai đoạn</span><span><Users size={18}/>Workspace riêng</span></div></>:null}
 {error?<p className="error-banner" role="alert">{error}</p>:null}</div>
 <footer className="modal-footer"><button type="button" className="btn secondary" onClick={()=>step?setStep(step-1):onClose()} disabled={busy}>{step?'Quay lại':'Hủy'}</button><Submit busy={busy}>{step===3?'Tạo dự án':'Tiếp tục'}</Submit></footer></form>;
}
