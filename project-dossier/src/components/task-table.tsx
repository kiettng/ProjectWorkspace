'use client';
import { useState } from 'react';
import { ArrowDown,ArrowUp,GripVertical,Pencil,Trash2 } from 'lucide-react';
import type { Project,Task } from '@/lib/types';
import { dateLabel,todayISO } from '@/lib/domain';
import { Badge,Empty } from './ui';

export default function TaskTable({tasks,projects,busy,reorderable,onReorder,onEdit,onDelete,addButton}:{tasks:Task[];projects:Project[];busy:boolean;reorderable:boolean;onReorder:(source:Task,target:Task)=>void;onEdit:(task:Task)=>void;onDelete:(task:Task)=>void;addButton:()=>React.ReactNode}) {
 const [dragId,setDragId]=useState<string|null>(null),[dropId,setDropId]=useState<string|null>(null);
 if(!tasks.length)return <Empty title="Chưa có công việc" description="Thêm công việc và chọn các hồ sơ cần hoàn thiện." action={addButton()}/>;
 const ordered=tasks.toSorted((a,b)=>projects.findIndex(p=>p.id===a.project_id)-projects.findIndex(p=>p.id===b.project_id)||a.sort_order-b.sort_order||a.title.localeCompare(b.title));
 return <div className="table-scroll"><table className="task-table"><thead><tr>{reorderable?<th scope="col">Thứ tự</th>:null}<th>Giai đoạn / Công việc</th><th>Người phụ trách</th><th>Hạn hoàn thành</th><th>Hồ sơ bắt buộc</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{ordered.map(task=>{
  const siblings=ordered.filter(item=>item.project_id===task.project_id),index=siblings.findIndex(item=>item.id===task.id);
  const dragged=ordered.find(item=>item.id===dragId),canDrop=reorderable&&dragged&&dragged.id!==task.id&&dragged.project_id===task.project_id;
  return <tr key={task.id} className={dropId===task.id&&canDrop?'drop-target':''} onDragOver={e=>{if(canDrop){e.preventDefault();e.dataTransfer.dropEffect='move';setDropId(task.id);}}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDropId(null);}} onDrop={e=>{e.preventDefault();if(canDrop)onReorder(dragged,task);setDragId(null);setDropId(null);}}>
   {reorderable?<td className="reorder-cell"><button className="icon-btn drag-handle" draggable={!busy} disabled={busy} aria-label={'Kéo để sắp xếp '+task.title} title="Kéo để đổi thứ tự" onDragStart={e=>{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',task.id);setDragId(task.id);}} onDragEnd={()=>{setDragId(null);setDropId(null);}}><GripVertical size={16}/></button><div className="reorder-steps"><button className="icon-btn" disabled={busy||index===0} aria-label={'Đưa '+task.title+' lên'} onClick={()=>onReorder(task,siblings[index-1])}><ArrowUp size={14}/></button><button className="icon-btn" disabled={busy||index===siblings.length-1} aria-label={'Đưa '+task.title+' xuống'} onClick={()=>onReorder(task,siblings[index+1])}><ArrowDown size={14}/></button></div></td>:null}
   <td><div className="task-title"><span className="phase-letter">{task.phase_code}</span><div><strong>{task.title}</strong><small>{projects.find(p=>p.id===task.project_id)?.code}</small></div></div></td>
   <td>{task.owner_name||'Chưa phân công'}</td><td className={task.due_date&&task.due_date<todayISO()&&!['Done','Cancelled'].includes(task.status)?'overdue':''}>{dateLabel(task.due_date)}</td>
   <td><div className="chips compact">{task.required_template_codes.map(code=><span className="chip" key={code}>{code}</span>)}</div></td><td><Badge status={task.status}/></td>
   <td><div className="row-actions"><button className="icon-btn" aria-label={'Chỉnh sửa '+task.title} onClick={()=>onEdit(task)}><Pencil size={16}/></button><button className="icon-btn danger" aria-label={'Xóa công việc '+task.title} onClick={()=>onDelete(task)}><Trash2 size={16}/></button></div></td>
  </tr>;
 })}</tbody></table></div>;
}
