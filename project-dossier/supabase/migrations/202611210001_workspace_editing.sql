-- Extend the existing owner-only workspace without deleting historical records.
alter table public.folders add column deleted_at timestamptz;
alter table public.tasks add column deleted_at timestamptz;
alter table public.tasks drop constraint tasks_project_id_phase_code_key;
create unique index tasks_active_code on public.tasks(project_id,lower(phase_code)) where deleted_at is null;
alter table public.documents add column requirement_code text references public.templates(code);
create index documents_requirement on public.documents(requirement_code);

create or replace function public.protect_folder_tree() returns trigger language plpgsql set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.project_id::text,0));
 if tg_op='UPDATE' and new.project_id<>old.project_id then raise exception 'Không thể đổi dự án của thư mục.'; end if;
 if new.deleted_at is not null then
  if exists(select 1 from public.folders where parent_id=new.id and deleted_at is null)
   or exists(select 1 from public.documents where folder_id=new.id and deleted_at is null) then
   raise exception 'Thư mục còn tài liệu hoặc thư mục con. Hãy di chuyển dữ liệu trước khi xóa.';
  end if;
  return new;
 end if;
 if new.parent_id is not null and not exists(select 1 from public.folders where id=new.parent_id and project_id=new.project_id and deleted_at is null) then
  raise exception 'Thư mục cha không còn tồn tại.';
 end if;
 if new.parent_id is not null and exists (
  with recursive ancestors as (
   select id,parent_id from public.folders where id=new.parent_id
   union select f.id,f.parent_id from public.folders f join ancestors a on f.id=a.parent_id
  ) select 1 from ancestors where id=new.id
 ) then raise exception 'Không thể chuyển thư mục vào chính nó hoặc thư mục con.'; end if;
 if exists(select 1 from public.folders where project_id=new.project_id and parent_id is not distinct from new.parent_id
  and id<>new.id and deleted_at is null and lower(trim(name))=lower(trim(new.name))) then
  raise exception 'Tên thư mục đã tồn tại trong thư mục cha này.';
 end if;
 return new;
end $$;

create function public.require_active_folder() returns trigger language plpgsql set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.project_id::text,0));
 if new.deleted_at is null and not exists(select 1 from public.folders where id=new.folder_id and project_id=new.project_id and deleted_at is null) then
  raise exception 'Thư mục lưu hồ sơ không còn tồn tại. Hãy chọn thư mục khác.';
 end if;
 return new;
end $$;
revoke all on function public.require_active_folder() from public;
create trigger document_active_folder before insert or update on public.documents for each row execute function public.require_active_folder();

create or replace function public.validate_task_completion() returns trigger language plpgsql set search_path='' as $$
declare required_code text; begin
 if new.deleted_at is not null then return new; end if;
 if jsonb_typeof(new.required_template_codes)<>'array' then raise exception 'Danh sách mã hồ sơ không hợp lệ.'; end if;
 for required_code in select jsonb_array_elements_text(new.required_template_codes) loop
  if not exists(select 1 from public.templates where code=required_code) then raise exception 'Mã hồ sơ không tồn tại: %',required_code; end if;
  if new.status='Done' and not exists(select 1 from public.documents d left join public.templates t on t.id=d.template_id
   where d.project_id=new.project_id and coalesce(d.requirement_code,t.code)=required_code and d.deleted_at is null and d.status in ('Approved','Issued','Signed')) then
   raise exception 'Thiếu hồ sơ hợp lệ: %',required_code;
  end if;
 end loop;
 if new.status='Done' then new.completed_at:=coalesce(new.completed_at,now()); else new.completed_at:=null; end if;
 return new;
end $$;

create or replace function public.protect_document() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status in ('Approved','Issued','Signed','Archived') and
  (new.name<>old.name or new.template_id is distinct from old.template_id or new.requirement_code is distinct from old.requirement_code or new.deleted_at is distinct from old.deleted_at) then
  raise exception 'Hồ sơ đã duyệt/ký được bảo toàn. Hãy tạo phiên bản mới.';
 end if;
 if old.status in ('Issued','Signed','Archived') and new.status not in (old.status,'Archived') and new.current_version=old.current_version then
  raise exception 'Hồ sơ đã phát hành cần một phiên bản mới để chỉnh sửa.';
 end if;
 new.updated_at:=now(); return new;
end $$;

-- Only disposable generated previews may be removed. Stored document/template versions remain immutable.
create policy owner_delete_previews on storage.objects for delete to authenticated
using(bucket_id='dossier' and (select private.is_owner()) and (storage.foldername(name))[1]='previews'
 and (storage.foldername(name))[2]=(select auth.uid())::text);
