-- Project Dossier: one private workspace, one verified owner account.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table private.owner_settings (
  singleton boolean primary key default true check (singleton),
  email text not null,
  user_id uuid unique references auth.users(id)
);
-- Replace this example address with your own before initializing a NEW database.
-- This source file is not applied again to an existing, configured workspace.
insert into private.owner_settings(email) values ('owner@example.com');

create function private.restrict_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from private.owner_settings where lower(email) = lower(new.email) and user_id is null) then
    raise exception 'This is a private, single-owner application.';
  end if;
  return new;
end;
$$;
create trigger dossier_restrict_signup before insert on auth.users
for each row execute function private.restrict_signup();

create function private.bind_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update private.owner_settings set user_id = new.id where lower(email) = lower(new.email) and user_id is null;
  return new;
end;
$$;
create trigger dossier_bind_owner after insert on auth.users
for each row execute function private.bind_owner();

create function private.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.owner_settings where user_id = (select auth.uid()));
$$;
revoke all on function private.restrict_signup(), private.bind_owner(), private.is_owner() from public;
grant execute on function private.is_owner() to authenticated;

create table public.template_packs (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
  version integer not null default 1, blueprint jsonb not null
);
create table public.projects (
  id uuid primary key default gen_random_uuid(), code text not null unique,
  name text not null, customer text not null, tax_code text not null default '',
  manager text not null default '', start_date date, end_date date,
  status text not null default 'Draft' check(status in ('Draft','Active','OnHold','Completed','Archived')),
  project_type text not null default 'Triển khai mới', description text not null default '',
  modules jsonb not null default '[]', integrations jsonb not null default '[]',
  pack_snapshot jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create unique index projects_code_ci on public.projects(lower(code));
create table public.contracts (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
  number text not null, name text not null default '', signed_date date,
  is_primary boolean not null default false, parent_id uuid references public.contracts(id),
  value numeric(20,2), currency text not null default 'VND', created_at timestamptz not null default now()
);
create unique index one_primary_contract on public.contracts(project_id) where is_primary;
create index contracts_project on public.contracts(project_id);
create table public.members (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
  name text not null, role text not null default 'Thành viên', email text not null default '', phone text not null default ''
);
create table public.folders (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
  parent_id uuid, code text not null, name text not null, sort_order integer not null default 0,
  unique(id, project_id), unique(project_id, code),
  foreign key(parent_id, project_id) references public.folders(id, project_id), check (parent_id is distinct from id)
);
create index folders_project on public.folders(project_id);
create table public.templates (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
  category text not null, folder_code text not null, language text not null default 'vi',
  current_version_id uuid, created_at timestamptz not null default now()
);
create table public.template_versions (
  id uuid primary key default gen_random_uuid(), template_id uuid not null references public.templates(id),
  version integer not null, storage_key text not null unique,
  variables jsonb not null, checksum text not null, original_name text not null,
  created_at timestamptz not null default now(), unique(template_id,version)
);
alter table public.templates add foreign key(current_version_id) references public.template_versions(id);
create table public.documents (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
  folder_id uuid not null, template_id uuid references public.templates(id),
  name text not null, file_type text not null,
  status text not null default 'Draft' check(status in ('Draft','InReview','Approved','Issued','Signed','Archived')),
  current_version integer not null default 1, deleted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(folder_id,project_id) references public.folders(id,project_id), unique(project_id,template_id)
);
create index documents_project on public.documents(project_id) where deleted_at is null;
create table public.document_versions (
  id uuid primary key default gen_random_uuid(), document_id uuid not null references public.documents(id),
  version integer not null, storage_key text not null unique, checksum text not null,
  size_bytes integer not null check(size_bytes>=0), template_version_id uuid references public.template_versions(id),
  snapshot jsonb not null default '{}', request_key uuid not null unique,
  status text not null default 'Draft',
  created_at timestamptz not null default now(), unique(document_id,version)
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
  phase_code text not null, title text not null, owner_name text not null default '', due_date date,
  status text not null default 'Todo' check(status in ('Todo','InProgress','InReview','Done','Blocked','Cancelled')),
  required_template_codes jsonb not null default '[]', completed_at timestamptz,
  sort_order integer not null default 0, unique(project_id,phase_code)
);
create index tasks_project on public.tasks(project_id);
create table public.audit_logs (
  id bigint generated always as identity primary key, actor_id uuid default auth.uid(),
  action text not null, resource_type text not null, resource_id uuid,
  project_id uuid references public.projects(id), summary text not null,
  created_at timestamptz not null default now()
);
create index audit_recent on public.audit_logs(created_at desc);

-- Authenticated access is restricted to the bound owner, not just any signed-in account.
do $$ declare t text; begin
  foreach t in array array['template_packs','projects','contracts','members','folders','templates','template_versions','documents','document_versions','tasks','audit_logs'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy owner_only on public.%I for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()))',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select, insert on public.%I to authenticated',t);
  end loop;
end $$;
grant update on public.projects, public.contracts, public.members, public.folders, public.templates, public.documents, public.tasks to authenticated;
grant update(status) on public.document_versions to authenticated;
grant usage,select on all sequences in schema public to authenticated;

create function public.record_audit() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare pid uuid; begin
  pid := case when tg_table_name = 'projects' then new.id else nullif(to_jsonb(new)->>'project_id','')::uuid end;
  insert into public.audit_logs(action,resource_type,resource_id,project_id,summary)
  values(lower(tg_op),tg_table_name,new.id,pid,
    case when tg_table_name = 'projects' then (to_jsonb(new)->>'code') || ' · ' || (to_jsonb(new)->>'name')
    else coalesce(to_jsonb(new)->>'name',to_jsonb(new)->>'title',to_jsonb(new)->>'number',to_jsonb(new)->>'storage_key',tg_table_name) end);
  return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['projects','contracts','members','folders','documents','document_versions','tasks','templates','template_versions'] loop
  execute format('create trigger dossier_audit after insert or update on public.%I for each row execute function public.record_audit()',t);
 end loop;
end $$;

create function public.protect_folder_tree() returns trigger language plpgsql set search_path = '' as $$
begin
 if new.parent_id is not null and exists (
  with recursive ancestors as (
   select id,parent_id from public.folders where id=new.parent_id
   union all select f.id,f.parent_id from public.folders f join ancestors a on f.id=a.parent_id
  ) select 1 from ancestors where id=new.id
 ) then raise exception 'Không thể chuyển thư mục vào chính nó hoặc thư mục con.'; end if;
 return new;
end $$;
create trigger folder_no_cycle before insert or update on public.folders for each row execute function public.protect_folder_tree();

create function public.validate_task_completion() returns trigger language plpgsql set search_path = '' as $$
declare required_code text; begin
 if new.status='Done' then
  for required_code in select jsonb_array_elements_text(new.required_template_codes) loop
   if not exists(select 1 from public.documents d join public.templates t on t.id=d.template_id
     where d.project_id=new.project_id and t.code=required_code and d.deleted_at is null and d.status in ('Approved','Issued','Signed')) then
      raise exception 'Thiếu hồ sơ hợp lệ: %', required_code;
   end if;
  end loop;
  new.completed_at := coalesce(new.completed_at,now());
 else new.completed_at := null; end if;
 return new;
end $$;
create trigger validate_task before insert or update on public.tasks for each row execute function public.validate_task_completion();

create function public.protect_document() returns trigger language plpgsql set search_path = '' as $$
begin
 if old.status in ('Approved','Issued','Signed','Archived') and
    (new.name<>old.name or new.template_id is distinct from old.template_id or new.deleted_at is distinct from old.deleted_at) then
   raise exception 'Hồ sơ đã duyệt/ký được bảo toàn. Hãy tạo phiên bản mới.';
 end if;
 if old.status in ('Issued','Signed','Archived') and new.status not in (old.status,'Archived') and new.current_version=old.current_version then
   raise exception 'Hồ sơ đã phát hành cần một phiên bản mới để chỉnh sửa.';
 end if;
 new.updated_at := now(); return new;
end $$;
create trigger protect_document before update on public.documents for each row execute function public.protect_document();

create function public.track_version_status() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.current_version=old.current_version and new.status<>old.status then
  update public.document_versions set status=new.status where document_id=new.id and version=new.current_version;
 end if;
 return new;
end $$;
revoke all on function public.track_version_status() from public;
create trigger track_version_status after update on public.documents for each row execute function public.track_version_status();

create index audit_project on public.audit_logs(project_id);
create index contract_parent on public.contracts(parent_id);
create index docversion_template on public.document_versions(template_version_id);
create index document_folder on public.documents(folder_id,project_id);
create index document_template on public.documents(template_id);
create index folder_parent on public.folders(parent_id,project_id);
create index member_project on public.members(project_id);
create index template_current on public.templates(current_version_id);

-- All project setup is committed in a single database transaction.
create function public.create_project(payload jsonb) returns uuid language plpgsql security invoker set search_path = '' as $$
declare pid uuid; pack public.template_packs; item jsonb; par uuid; begin
 select * into strict pack from public.template_packs where id=(payload->>'pack_id')::uuid;
 insert into public.projects(code,name,customer,tax_code,manager,start_date,end_date,project_type,description,modules,integrations,pack_snapshot)
 values(trim(payload->>'code'),trim(payload->>'name'),trim(payload->>'customer'),coalesce(payload->>'tax_code',''),
 coalesce(payload->>'manager',''),nullif(payload->>'start_date','')::date,nullif(payload->>'end_date','')::date,
 coalesce(payload->>'project_type','Triển khai mới'),coalesce(payload->>'description',''),coalesce(payload->'modules','[]'),
 coalesce(payload->'integrations','[]'),to_jsonb(pack)) returning id into pid;
 for item in select * from jsonb_array_elements(pack.blueprint->'folders') loop
  par:=null;
  if item->>'parent' is not null then select id into par from public.folders where project_id=pid and code=item->>'parent'; end if;
  insert into public.folders(project_id,parent_id,code,name,sort_order) values(pid,par,item->>'code',item->>'name',(item->>'order')::integer);
 end loop;
 for item in select * from jsonb_array_elements(pack.blueprint->'phases') loop
  insert into public.tasks(project_id,phase_code,title,owner_name,required_template_codes,sort_order)
  values(pid,item->>'code',item->>'title',coalesce(payload->>'manager',''),coalesce(item->'required','[]'),(item->>'order')::integer);
 end loop;
 if length(trim(coalesce(payload->>'contract_number','')))>0 then
  insert into public.contracts(project_id,number,signed_date,is_primary) values(pid,trim(payload->>'contract_number'),nullif(payload->>'signed_date','')::date,true);
 end if;
 if length(trim(coalesce(payload->>'manager','')))>0 then
  insert into public.members(project_id,name,role) values(pid,trim(payload->>'manager'),'Quản lý dự án');
 end if;
 return pid;
end $$;

create function public.set_primary_contract(contract_id uuid) returns void language plpgsql security invoker set search_path = '' as $$
declare pid uuid; begin
 select project_id into strict pid from public.contracts where id=contract_id;
 perform pg_advisory_xact_lock(hashtextextended(pid::text,0));
 update public.contracts set is_primary=false where project_id=pid and is_primary;
 update public.contracts set is_primary=true where id=contract_id;
end $$;

create function public.commit_document(payload jsonb) returns uuid language plpgsql security invoker set search_path = '' as $$
declare did uuid; ver integer; tid uuid; pid uuid; tv public.template_versions; begin
 pid:=(payload->>'project_id')::uuid;
 perform pg_advisory_xact_lock(hashtextextended(pid::text,0));
 select document_id into did from public.document_versions where request_key=(payload->>'request_key')::uuid;
 if found then return did; end if;
 if payload->>'template_version_id' is not null then
  select * into strict tv from public.template_versions where id=(payload->>'template_version_id')::uuid;
  tid:=tv.template_id;
  select id into did from public.documents where project_id=pid and template_id=tid and deleted_at is null;
 elsif payload->>'document_id' is not null then
  select id into strict did from public.documents where id=(payload->>'document_id')::uuid and project_id=pid and deleted_at is null;
 end if;
 if did is null then
  insert into public.documents(project_id,folder_id,template_id,name,file_type)
  values(pid,(payload->>'folder_id')::uuid,tid,payload->>'name',payload->>'file_type') returning id into did;
  ver:=1;
 else
  select coalesce(max(version),0)+1 into ver from public.document_versions where document_id=did;
  update public.documents set current_version=ver,status='Draft' where id=did;
 end if;
 insert into public.document_versions(document_id,version,storage_key,checksum,size_bytes,template_version_id,snapshot,request_key)
 values(did,ver,payload->>'storage_key',payload->>'checksum',(payload->>'size_bytes')::integer,tv.id,
 coalesce(payload->'snapshot','{}'),(payload->>'request_key')::uuid);
 return did;
end $$;

revoke all on function public.record_audit(), public.protect_folder_tree(), public.validate_task_completion(), public.protect_document(), public.create_project(jsonb), public.set_primary_contract(uuid), public.commit_document(jsonb) from public;
grant execute on function public.create_project(jsonb), public.set_primary_contract(uuid), public.commit_document(jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('dossier','dossier',false,20971520,array[
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
 'application/pdf','image/png','image/jpeg','image/webp','text/plain','text/csv',
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/zip'
]);
create policy owner_read_files on storage.objects for select to authenticated
using(bucket_id='dossier' and (select private.is_owner()));
create policy owner_insert_files on storage.objects for insert to authenticated
with check(bucket_id='dossier' and (select private.is_owner()));
-- No update/delete policy: uploaded blobs and historical versions stay immutable.

insert into public.template_packs(code,name,blueprint) values ('BRAVO-ERP-NEW','BRAVO ERP · Triển khai mới',
'{"folders":[
 {"code":"00","name":"Thông tin chung & Hợp đồng","order":0},
 {"code":"01","name":"Khảo sát & Phương án thực hiện","order":1},
 {"code":"02","name":"Kế hoạch & Chuẩn bị triển khai","order":2},
 {"code":"03","name":"Cài đặt & Đào tạo","order":3},
 {"code":"04","name":"Kiểm thử UAT","order":4},
 {"code":"04-01","name":"Kế hoạch UAT","parent":"04","order":5},
 {"code":"04-02","name":"Test Cases","parent":"04","order":6},
 {"code":"04-03","name":"Test Results","parent":"04","order":7},
 {"code":"04-04","name":"Biên bản nghiệm thu UAT","parent":"04","order":8},
 {"code":"04-05","name":"Lỗi và xử lý","parent":"04","order":9},
 {"code":"05","name":"PROD & Nghiệm thu","order":10},
 {"code":"06","name":"Chuyển bảo hành & Hỗ trợ","order":11},
 {"code":"07","name":"Tích hợp & Tài liệu kỹ thuật","order":12},
 {"code":"08","name":"Họp & Báo cáo tuần","order":13},
 {"code":"99","name":"Lưu trữ","order":14}],
 "phases":[
 {"code":"A","title":"Khảo sát & phương án kỹ thuật","required":["BM.40.08"],"order":0},
 {"code":"B","title":"Chuẩn bị & kế hoạch triển khai","required":["BM.40.01"],"order":1},
 {"code":"C","title":"Cài đặt & đào tạo","required":["PL.40.02.01","PL.40.03.02"],"order":2},
 {"code":"D","title":"Kiểm thử UAT","required":["PL.40.09.UAT"],"order":3},
 {"code":"E","title":"Sử dụng & nghiệm thu","required":["PL.40.04"],"order":4},
 {"code":"F","title":"Chuyển bảo hành & hỗ trợ","required":["BM.SNT"],"order":5}]}'::jsonb);
insert into public.template_packs(code,name,blueprint)
select 'BRAVO-ERP-UPGRADE','BRAVO ERP · Nâng cấp',blueprint from public.template_packs where code='BRAVO-ERP-NEW';
insert into public.template_packs(code,name,blueprint)
select 'API-INTEGRATION','Dự án tích hợp API',blueprint from public.template_packs where code='BRAVO-ERP-NEW';
