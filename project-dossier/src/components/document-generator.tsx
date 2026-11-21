'use client';
import { useState } from 'react';
import { CheckCircle2,FileCheck2,AlertCircle,Eye,Download } from 'lucide-react';
import { Field,Submit } from './ui';
import { variableLabels } from '@/lib/domain';
import type { Project,Template } from '@/lib/types';

async function generate(data:Record<string,unknown>){const r=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const json=await r.json();if(!r.ok)throw new Error(json.error);return json;}
export default function DocumentGenerator({projects,templates,projectId,templateId,onSaved,onClose}:{projects:Project[];templates:Template[];projectId:string;templateId?:string;onSaved:(id:string)=>Promise<void>;onClose:()=>void}) {
 const [pid,setPid]=useState(projectId||projects[0]?.id||''),[tid,setTid]=useState(templateId||templates[0]?.id||'');
 const [step,setStep]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [values,setValues]=useState<Record<string,string>>({}),[variables,setVariables]=useState<string[]>([]),[preview,setPreview]=useState('');
 const [requestKey]=useState(()=>crypto.randomUUID());
 const selected=templates.find(t=>t.id===tid);
 const missing=variables.filter(v=>!values[v]?.trim());
 async function next(){
  setBusy(true);setError('');
  try {
   const result=await generate({project_id:pid,template_version_id:selected?.current_version_id,mode:step===0?'resolve':'preview',values:step===0?undefined:values});
   if(step===0){setValues(result.values);setVariables(result.variables);setStep(1);}else{setPreview(result.text);setStep(2);}
  }catch(e){setError(e instanceof Error?e.message:'Không thể tạo tài liệu.');}finally{setBusy(false);}
 }
 return <form onSubmit={async e=>{
  e.preventDefault();if(step<2){await next();return;}
  setBusy(true);setError('');try{
   const result=await generate({project_id:pid,template_version_id:selected?.current_version_id,mode:'save',values,request_key:requestKey});
   await onSaved(result.document_id);
  }catch(e){setError(e instanceof Error?e.message:'Không thể lưu tài liệu.');}finally{setBusy(false);}
 }}><div className="modal-body"><ol className="stepper">{['Chọn mẫu','Kiểm tra dữ liệu','Xem trước & lưu'].map((s,i)=><li key={s} className={step===i?'active':step>i?'done':''}><span>{i+1}</span>{s}</li>)}</ol>
 {step===0?<><div className="form-grid"><Field label="Dự án" wide><select value={pid} onChange={e=>setPid(e.target.value)} required><option value="" disabled>Chọn dự án</option>{projects.map(p=><option value={p.id} key={p.id}>{p.code} · {p.name}</option>)}</select></Field><Field label="Biểu mẫu Word" wide><select value={tid} onChange={e=>setTid(e.target.value)} required><option value="" disabled>Chọn biểu mẫu</option>{templates.filter(t=>t.current_version_id).map(t=><option value={t.id} key={t.id}>{t.code} · {t.name}</option>)}</select></Field></div><div className="generator-intro"><FileCheck2 size={30}/><div><h3>Điền hồ sơ từ dữ liệu dự án</h3><p>Kiểm tra dữ liệu, xem nội dung và lưu thành phiên bản Word mới.</p></div></div></>:null}
 {step===1?<><div className={'resolve-banner '+(missing.length?'warning':'success')}>{missing.length?<AlertCircle size={19}/>:<CheckCircle2 size={19}/>} {missing.length?`${missing.length} trường cần bổ sung`:`Đã có đủ ${variables.length} trường dữ liệu`}</div><div className="form-grid">{variables.map(key=><Field key={key} label={(variableLabels[key]||key)+' *'}><input value={values[key]||''} onChange={e=>setValues({...values,[key]:e.target.value})} required/><code className="field-code">{'{='+key+'}'}</code></Field>)}</div><p className="form-hint">Giá trị chỉnh sửa ở đây chỉ áp dụng cho lần sinh hồ sơ này. Nội dung nghiệp vụ và các mục còn trống trong biểu mẫu cần được kiểm tra trong Word.</p></>:null}
 {step===2?<><div className="preview-notice"><Eye size={17}/> Xem trước nội dung văn bản · Tệp Word giữ bố cục của biểu mẫu</div><pre className="document-text generator-preview">{preview}</pre><p className="form-hint">Lưu phiên bản sẽ tạo tệp mới. Các phiên bản đã lưu được giữ nguyên.</p></>:null}
 {error?<p role="alert" className="error-banner">{error}</p>:null}</div><footer className="modal-footer"><button type="button" className="btn secondary" onClick={()=>step?setStep(step-1):onClose()} disabled={busy}>{step?'Quay lại':'Hủy'}</button><Submit busy={busy}>{step===0?'Kiểm tra dữ liệu':step===1?'Xem trước':'Lưu phiên bản Word'}</Submit></footer></form>;
}
