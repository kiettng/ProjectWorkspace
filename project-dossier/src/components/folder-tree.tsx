'use client';
import { useState } from 'react';
import { ChevronRight,ChevronDown,FolderClosed,FolderOpen,Pencil,Trash2,GripVertical,ArrowUp,ArrowDown } from 'lucide-react';
import type { Folder,Document } from '@/lib/types';

export function folderOptions(folders:Folder[],exclude?:string) {
 const result:{id:string;label:string}[]=[];
 function visit(parent:string|null,depth:number){for(const f of folders.filter(f=>f.parent_id===parent&&f.id!==exclude)){
  result.push({id:f.id,label:'　'.repeat(depth)+(depth?'↳ ':'')+(f.code.startsWith('custom-')?'':f.code+' · ')+f.name});visit(f.id,depth+1);
 }}
 visit(null,0);return result;
}
export default function FolderTree({folders,documents,selected,onSelect,onEdit,onDelete,onReorder,busy}:{folders:Folder[];documents:Document[];selected:string;onSelect:(id:string)=>void;onEdit:(f:Folder)=>void;onDelete:(f:Folder)=>void;onReorder:(source:Folder,target:Folder)=>void;busy:boolean}) {
 const [collapsed,setCollapsed]=useState<Set<string>>(new Set());
 const [dragId,setDragId]=useState<string|null>(null),[dropId,setDropId]=useState<string|null>(null);
 function branch(parent:string|null):React.ReactNode {
  const siblings=folders.filter(f=>f.parent_id===parent).toSorted((a,b)=>a.sort_order-b.sort_order||a.name.localeCompare(b.name));
  return <ul className="folder-branches">{siblings.map((f,index)=>{
   const children=folders.some(child=>child.parent_id===f.id),open=!collapsed.has(f.id),count=documents.filter(d=>d.folder_id===f.id).length;
   const canDrop=dragId!==null&&dragId!==f.id&&folders.some(source=>source.id===dragId&&source.parent_id===f.parent_id);
   return <li key={f.id} onDragOver={e=>{e.stopPropagation();if(canDrop){e.preventDefault();e.dataTransfer.dropEffect='move';setDropId(f.id);}}} onDragLeave={e=>{e.stopPropagation();if(!e.currentTarget.contains(e.relatedTarget as Node))setDropId(null);}} onDrop={e=>{e.preventDefault();e.stopPropagation();const source=folders.find(item=>item.id===dragId);if(source&&source.parent_id===f.parent_id&&source.id!==f.id)onReorder(source,f);setDragId(null);setDropId(null);}}><div className={'folder-node '+(selected===f.id?'selected':'')+(dropId===f.id&&canDrop?' drop-target':'')}>
    {children?<button className="folder-toggle" aria-label={(open?'Thu gọn ':'Mở rộng ')+f.name} aria-expanded={open} onClick={()=>setCollapsed(prev=>{const next=new Set(prev);if(next.has(f.id))next.delete(f.id);else next.add(f.id);return next;})}>{open?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</button>:<span className="folder-toggle-placeholder"/>}
    <button className="folder-select" aria-current={selected===f.id?'true':undefined} onClick={()=>onSelect(f.id)} title={f.name}>{selected===f.id?<FolderOpen size={17}/>:<FolderClosed size={17}/>}<span>{!f.code.startsWith('custom-')?<small className="folder-code">{f.code}</small>:null}{f.name}</span><small className="folder-count">{count||''}</small></button>
    <span className="folder-node-actions"><button className="icon-btn drag-handle" draggable={!busy} disabled={busy} aria-label={'Kéo để sắp xếp '+f.name} title="Kéo để sắp xếp trong cùng cấp" onDragStart={e=>{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',f.id);setDragId(f.id);}} onDragEnd={()=>{setDragId(null);setDropId(null);}}><GripVertical size={14}/></button><button className="icon-btn" disabled={busy||index===0} aria-label={'Đưa '+f.name+' lên'} onClick={()=>onReorder(f,siblings[index-1])}><ArrowUp size={13}/></button><button className="icon-btn" disabled={busy||index===siblings.length-1} aria-label={'Đưa '+f.name+' xuống'} onClick={()=>onReorder(f,siblings[index+1])}><ArrowDown size={13}/></button><button className="icon-btn" aria-label={'Sửa thư mục '+f.name} onClick={()=>onEdit(f)}><Pencil size={13}/></button><button className="icon-btn danger" aria-label={'Xóa thư mục '+f.name} onClick={()=>onDelete(f)}><Trash2 size={13}/></button></span>
   </div>{children&&open?branch(f.id):null}</li>;
  })}</ul>;
 }
 return <nav aria-label="Cây hồ sơ">{branch(null)}</nav>;
}
