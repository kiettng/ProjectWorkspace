'use client';
import { useEffect,useRef } from 'react';
import { X,FolderOpen,LoaderCircle } from 'lucide-react';
import { statusLabels } from '@/lib/domain';

export function Badge({status}:{status:string}){return <span className={'badge status-'+status}>{statusLabels[status]||status}</span>;}
export function Progress({value}:{value:number}){return <div className="progress-row"><div className="progress" role="progressbar" aria-label="Tiến độ" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><span style={{width:value+'%'}}/></div><span>{value}%</span></div>;}
export function Empty({title,description,action}:{title:string;description:string;action?:React.ReactNode}){return <div className="empty"><span className="empty-icon"><FolderOpen size={30}/></span><h3>{title}</h3><p>{description}</p>{action}</div>;}
export function Modal({title,subtitle,children,onClose,wide=false}:{title:string;subtitle?:string;children:React.ReactNode;onClose:()=>void;wide?:boolean}) {
 const ref=useRef<HTMLDivElement>(null),closeRef=useRef(onClose);closeRef.current=onClose;
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  ref.current?.focus();
  const listener=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){closeRef.current();return;}
   if(e.key==='Tab'){
    const nodes=ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]');
    if(!nodes?.length)return;
    const first=nodes[0],last=nodes[nodes.length-1];
    if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
   }
  };
  document.addEventListener('keydown',listener);
  return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',listener);previous?.focus();};
 },[]);
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className={'modal '+(wide?'wide':'')} role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={ref} tabIndex={-1}>
 <header className="modal-head"><div><h2 id="modal-title">{title}</h2>{subtitle?<p>{subtitle}</p>:null}</div><button type="button" className="icon-btn" onClick={onClose} aria-label="Đóng hộp thoại"><X size={20}/></button></header>{children}</div></div>;
}
export function Submit({busy,children}:{busy:boolean;children:React.ReactNode}){return <button className="btn" disabled={busy} type="submit">{busy?<LoaderCircle className="spin" size={17}/>:null}{children}</button>;}
export function Field({label,children,wide=false}:{label:string;children:React.ReactNode;wide?:boolean}){return <label className={wide?'field-label wide':'field-label'}>{label}{children}</label>;}
