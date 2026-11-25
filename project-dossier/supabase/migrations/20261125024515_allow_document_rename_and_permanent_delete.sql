-- Renaming changes only document metadata; Official content and versions stay immutable.
create or replace function public.protect_document() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status in ('Official','Approved','Issued','Signed','Archived') and
  (new.template_id is distinct from old.template_id or new.requirement_code is distinct from old.requirement_code or new.deleted_at is distinct from old.deleted_at) then
  raise exception 'Hồ sơ chính thức được bảo toàn. Hãy tạo phiên bản mới.';
 end if;
 if old.status='Official' and new.status='Draft' and new.current_version=old.current_version then
  raise exception 'Hãy tạo phiên bản mới trước khi đưa hồ sơ chính thức về bản nháp.';
 end if;
 new.updated_at:=now();
 return new;
end $$;

-- The owner needs DELETE permission for an atomic metadata purge and for Storage API removal.
grant delete on public.documents, public.document_versions, public.audit_logs to authenticated;
create policy owner_delete_files on storage.objects for delete to authenticated
using(bucket_id='dossier' and (select private.is_owner()));

create function public.purge_document(p_document_id uuid,p_expected_keys text[],p_execute boolean default true)
returns uuid language plpgsql security invoker set search_path='' as $$
declare pid uuid; required_code text; actual_keys text[];
begin
 if not (select private.is_owner()) then raise exception 'Không có quyền xóa hồ sơ.'; end if;
 select d.project_id,coalesce(d.requirement_code,t.code) into pid,required_code
 from public.documents d left join public.templates t on t.id=d.template_id
 where d.id=p_document_id and d.deleted_at is null;
 if not found then raise exception 'Hồ sơ không còn tồn tại.'; end if;
 select coalesce(array_agg(v.storage_key order by v.storage_key),array[]::text[])
 into actual_keys from public.document_versions v where v.document_id=p_document_id;
 if actual_keys is distinct from coalesce(p_expected_keys,array[]::text[]) then
  raise exception 'Phiên bản hồ sơ đã thay đổi. Hãy tải lại rồi thử lại.';
 end if;
 if not p_execute then return p_document_id; end if;

 delete from public.audit_logs a where
  (a.resource_type='documents' and a.resource_id=p_document_id)
  or (a.resource_type='document_versions' and a.resource_id in
   (select v.id from public.document_versions v where v.document_id=p_document_id));
 delete from public.document_versions where document_id=p_document_id;
 delete from public.documents where id=p_document_id;

 if required_code is not null and not exists (
  select 1 from public.documents d left join public.templates t on t.id=d.template_id
  where d.project_id=pid and d.deleted_at is null and d.status='Official'
   and coalesce(d.requirement_code,t.code)=required_code
 ) then
  update public.tasks set status='InProgress'
  where project_id=pid and deleted_at is null and status='Done'
   and required_template_codes ? required_code;
 end if;
 return p_document_id;
end $$;
revoke all on function public.purge_document(uuid,text[],boolean) from public;
grant execute on function public.purge_document(uuid,text[],boolean) to authenticated;
