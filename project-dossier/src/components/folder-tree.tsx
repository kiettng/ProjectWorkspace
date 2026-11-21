'use client';
import { useState } from 'react';
import { ChevronRight,ChevronDown,FolderClosed,FolderOpen,Pencil,Trash2 } from 'lucide-react';
import type { Folder,Document } from '@/lib/types';

export function folderOptions(folders:Folder[],exclude?:string) {
 const result:{id:string;label:string}[]=[];
 function visit(parent:string|null,depth:number){for(const f of folders.filter(f=>f.parent_id===parent&&f.id!==exclude)){
  result.push({id:f.id,label:'　'.repeat(depth)+(depth?'↳ ':'')+(f.code.startsWith('custom-')?'':f.code+' · ')+f.name});visit(f.id,depth+1);
 }}
 visit(null,0);return result;
}
export default function FolderTree({folders,documents,selected,onSelect,onEdit,onDelete}:{folders:Folder[];documents:Document[];selected:string;onSelect:(id:string)=>void;onEdit:(f:Folder)=>void;onDelete:(f:Folder)=>void}) {
 const [collapsed,setCollapsed]=useState<Set<string>>(new Set());
 function branch(parent:string|null):React.ReactNode {
  return <ul className="folder-branches">{folders.filter(f=>f.parent_id===parent).map(f=>{
   const children=folders.some(child=>child.parent_id===f.id),open=!collapsed.has(f.id),count=documents.filter(d=>d.folder_id===f.id).length;
   return <li key={f.id}><div className={'folder-node '+(selected===f.id?'selected':'')}>
    {children?<button className="folder-toggle" aria-label={(open?'Thu gọn ':'Mở rộng ')+f.name} aria-expanded={open} onClick={()=>setCollapsed(prev=>{const next=new Set(prev);if(next.has(f.id))next.delete(f.id);else next.add(f.id);return next;})}>{open?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</button>:<span className="folder-toggle-placeholder"/>}
    <button className="folder-select" aria-current={selected===f.id?'true':undefined} onClick={()=>onSelect(f.id)} title={f.name}>{selected===f.id?<FolderOpen size={17}/>:<FolderClosed size={17}/>}<span>{!f.code.startsWith('custom-')?<small className="folder-code">{f.code}</small>:null}{f.name}</span><small className="folder-count">{count||''}</small></button>
    <span className="folder-node-actions"><button className="icon-btn" aria-label={'Sửa thư mục '+f.name} onClick={()=>onEdit(f)}><Pencil size={13}/></button><button className="icon-btn danger" aria-label={'Xóa thư mục '+f.name} onClick={()=>onDelete(f)}><Trash2 size={13}/></button></span>
   </div>{children&&open?branch(f.id):null}</li>;
  })}</ul>;
 }
 return <nav aria-label="Cây hồ sơ">{branch(null)}</nav>;
}
