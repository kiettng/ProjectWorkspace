-- Keep existing files and versions while reducing document states to two.
create or replace function public.protect_document() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status in ('Official','Approved','Issued','Signed','Archived') and
  (new.name<>old.name or new.template_id is distinct from old.template_id or new.requirement_code is distinct from old.requirement_code or new.deleted_at is distinct from old.deleted_at) then
  raise exception 'Hồ sơ chính thức được bảo toàn. Hãy tạo phiên bản mới.';
 end if;
 if old.status='Official' and new.status='Draft' and new.current_version=old.current_version then
  raise exception 'Hãy tạo phiên bản mới trước khi đưa hồ sơ chính thức về bản nháp.';
 end if;
 new.updated_at:=case when old.status in ('InReview','Approved','Issued','Signed','Archived') and new.status in ('Draft','Official')
  then old.updated_at else now() end;
 return new;
end $$;

alter table public.documents drop constraint documents_status_check;
update public.documents set status=case when status in ('Draft','InReview') then 'Draft' else 'Official' end
 where status not in ('Draft','Official');
alter table public.documents add constraint documents_status_check check(status in ('Draft','Official'));
update public.document_versions set status=case when status in ('Draft','InReview') then 'Draft' else 'Official' end
 where status not in ('Draft','Official');
alter table public.document_versions add constraint document_versions_status_check check(status in ('Draft','Official'));

create or replace function public.validate_task_completion() returns trigger language plpgsql set search_path='' as $$
declare required_code text; begin
 if new.deleted_at is not null then return new; end if;
 if jsonb_typeof(new.required_template_codes)<>'array' then raise exception 'Danh sách mã hồ sơ không hợp lệ.'; end if;
 for required_code in select jsonb_array_elements_text(new.required_template_codes) loop
  if not exists(select 1 from public.templates where code=required_code) then raise exception 'Mã hồ sơ không tồn tại: %',required_code; end if;
  if new.status='Done' and not exists(select 1 from public.documents d left join public.templates t on t.id=d.template_id
   where d.project_id=new.project_id and coalesce(d.requirement_code,t.code)=required_code and d.deleted_at is null and d.status='Official') then
   raise exception 'Thiếu hồ sơ chính thức: %',required_code;
  end if;
 end loop;
 if new.status='Done' then new.completed_at:=coalesce(new.completed_at,now()); else new.completed_at:=null; end if;
 return new;
end $$;

-- Reorder entire sibling sets in one transaction; RLS and owner guard still apply.
create function public.reorder_folders(p_project_id uuid,p_parent_id uuid,p_ids uuid[])
returns void language plpgsql security invoker set search_path='' as $$
declare item_id uuid; n integer; begin
 if not (select private.is_owner()) then raise exception 'Không có quyền sắp xếp thư mục.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_project_id::text,0));
 n:=coalesce(array_length(p_ids,1),0);
 if n=0 or n<>(select count(*) from public.folders where project_id=p_project_id and parent_id is not distinct from p_parent_id and deleted_at is null)
  or n<>(select count(distinct item_id) from unnest(p_ids) as submitted(item_id))
  or exists(select 1 from unnest(p_ids) as submitted(item_id) left join public.folders f on f.id=submitted.item_id
    where f.id is null or f.project_id<>p_project_id or f.parent_id is distinct from p_parent_id or f.deleted_at is not null) then
  raise exception 'Danh sách thư mục đã thay đổi. Hãy tải lại rồi thử lại.';
 end if;
 for item_id,n in select ordered.item_id,ordered.ordinality from unnest(p_ids) with ordinality as ordered(item_id,ordinality) loop
  update public.folders set sort_order=n*10 where id=item_id and project_id=p_project_id;
 end loop;
end $$;

create function public.reorder_tasks(p_project_id uuid,p_ids uuid[])
returns void language plpgsql security invoker set search_path='' as $$
declare item_id uuid; n integer; begin
 if not (select private.is_owner()) then raise exception 'Không có quyền sắp xếp công việc.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_project_id::text,0));
 n:=coalesce(array_length(p_ids,1),0);
 if n=0 or n<>(select count(*) from public.tasks where project_id=p_project_id and deleted_at is null)
  or n<>(select count(distinct item_id) from unnest(p_ids) as submitted(item_id))
  or exists(select 1 from unnest(p_ids) as submitted(item_id) left join public.tasks t on t.id=submitted.item_id
    where t.id is null or t.project_id<>p_project_id or t.deleted_at is not null) then
  raise exception 'Danh sách công việc đã thay đổi. Hãy tải lại rồi thử lại.';
 end if;
 for item_id,n in select ordered.item_id,ordered.ordinality from unnest(p_ids) with ordinality as ordered(item_id,ordinality) loop
  update public.tasks set sort_order=n*10 where id=item_id and project_id=p_project_id;
 end loop;
end $$;

revoke all on function public.reorder_folders(uuid,uuid,uuid[]),public.reorder_tasks(uuid,uuid[]) from public,anon;
grant execute on function public.reorder_folders(uuid,uuid,uuid[]),public.reorder_tasks(uuid,uuid[]) to authenticated;
