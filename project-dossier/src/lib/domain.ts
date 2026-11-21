import type { Contract, Document, Project, Task, Template } from './types';

export const variableLabels: Record<string,string> = {
  ProjectCode: 'Mã dự án', ProjectName: 'Tên dự án', CustomerName: 'Tên khách hàng',
  CustomerTaxCode: 'Mã số thuế', ContractNo: 'Số hợp đồng chính', ContractSignedDate: 'Ngày ký hợp đồng',
  ProjectManager: 'Quản lý dự án', ProjectStartDate: 'Ngày bắt đầu', ProjectEndDate: 'Ngày kết thúc',
  DocumentDate: 'Ngày lập hồ sơ', DocumentNo: 'Số biên bản', ModuleList: 'Phân hệ triển khai',
  IntegrationList: 'Danh sách tích hợp'
};
export const statusLabels: Record<string,string> = {
  Draft: 'Bản nháp', Active: 'Đang triển khai', OnHold: 'Tạm dừng', Completed: 'Hoàn thành', Archived: 'Lưu trữ',
  InReview: 'Chờ duyệt', Approved: 'Đã duyệt', Issued: 'Đã phát hành', Signed: 'Đã ký',
  Todo: 'Chưa bắt đầu', InProgress: 'Đang thực hiện', Done: 'Hoàn thành', Blocked: 'Đang vướng', Cancelled: 'Đã hủy'
};
export function dateLabel(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}
export function todayISO() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit' }).formatToParts(new Date());
  const get = (type:string) => parts.find(p=>p.type===type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function resolveVariables(p: Project, contracts: Contract[]): Record<string,string> {
  const primary = contracts.filter(c=>c.project_id===p.id && c.is_primary);
  if(primary.length>1) throw new Error('Dự án có nhiều hợp đồng chính. Hãy chọn lại hợp đồng.');
  const c=primary[0];
  return { ProjectCode:p.code, ProjectName:p.name, CustomerName:p.customer, CustomerTaxCode:p.tax_code,
    ProjectManager:p.manager, ContractNo:c?.number||'', ContractSignedDate:c?.signed_date?dateLabel(c.signed_date):'',
    ProjectStartDate:p.start_date?dateLabel(p.start_date):'', ProjectEndDate:p.end_date?dateLabel(p.end_date):'',
    DocumentDate:dateLabel(todayISO()), DocumentNo:p.code, ModuleList:p.modules.join(', '), IntegrationList:p.integrations.join(', ') };
}
export function missingVariables(keys: string[], values: Record<string,string>) {
  return keys.filter(key=>!String(values[key]??'').trim());
}
export function documentProgress(tasks: Task[], docs: Document[], templates: Template[]) {
  const codes=[...new Set(tasks.filter(t=>!t.deleted_at&&t.status!=='Cancelled').flatMap(t=>t.required_template_codes))];
  const valid=codes.filter(code=>docs.some(d=>!d.deleted_at && ['Approved','Issued','Signed'].includes(d.status) && documentCode(d,templates)===code)).length;
  return {total:codes.length, valid, percent: codes.length?Math.round(valid/codes.length*100):100};
}
export function documentCode(doc:Document,templates:Template[]) {
  return doc.requirement_code||templates.find(t=>t.id===doc.template_id)?.code||'';
}
export function uploadMime(filename:string) {
  const types:Record<string,string>={docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',dotx:'application/vnd.openxmlformats-officedocument.wordprocessingml.template',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',txt:'text/plain',csv:'text/csv'};
  return types[filename.split('.').pop()?.toLowerCase()||'']||'application/octet-stream';
}
export function safeName(value:string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(0,150) || 'document';
}
export function csvCell(value:unknown) {
  let text=String(value??'');
  if(/^[=+\-@\t\r]/.test(text)) text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}
