export type Project = {
  id: string; code: string; name: string; customer: string; tax_code: string;
  manager: string; start_date: string | null; end_date: string | null;
  status: 'Draft' | 'Active' | 'OnHold' | 'Completed' | 'Archived'; project_type: string;
  description: string; modules: string[]; integrations: string[]; pack_snapshot: Pack;
  created_at: string; updated_at: string;
};
export type Pack = { id: string; code: string; name: string; version: number; blueprint: {
  folders: { code: string; name: string; parent?: string; order: number }[];
  phases: { code: string; title: string; required: string[]; order: number }[];
} };
export type Contract = { id: string; project_id: string; number: string; name: string; signed_date: string | null; is_primary: boolean; value: number | null; currency: string };
export type Member = { id: string; project_id: string; name: string; role: string; email: string; phone: string };
export type Folder = { id: string; project_id: string; parent_id: string | null; code: string; name: string; sort_order: number; deleted_at?: string | null };
export type Template = { id: string; code: string; name: string; category: string; folder_code: string; language: string; current_version_id: string };
export type TemplateVersion = { id: string; template_id: string; version: number; storage_key: string; variables: string[]; checksum: string; original_name: string; created_at: string };
export type Document = { id: string; project_id: string; folder_id: string; template_id: string | null; requirement_code?: string | null; name: string; file_type: string; status: string; current_version: number; created_at: string; updated_at: string; deleted_at: string | null };
export type DocumentVersion = { id: string; document_id: string; version: number; status: string; storage_key: string; checksum: string; size_bytes: number; template_version_id: string | null; snapshot: Record<string, string>; created_at: string };
export type Task = { id: string; project_id: string; phase_code: string; title: string; owner_name: string; due_date: string | null; status: string; required_template_codes: string[]; sort_order: number; deleted_at?: string | null };
export type Audit = { id: number; action: string; resource_type: string; resource_id: string; project_id: string | null; summary: string; created_at: string };
export type Workspace = { projects: Project[]; contracts: Contract[]; members: Member[]; folders: Folder[]; templates: Template[]; template_versions: TemplateVersion[]; documents: Document[]; document_versions: DocumentVersion[]; tasks: Task[]; template_packs: Pack[]; audit_logs: Audit[] };
