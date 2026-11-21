-- Run in the dedicated Project Dossier database. Every fixture is rolled back.
begin;
do $$
declare
 owner_id uuid; pid uuid; pack_id uuid; folder_id uuid; task_id uuid; did uuid; did2 uuid;
 tv_id uuid; req uuid:=gen_random_uuid(); blocked boolean;
begin
 select user_id into owner_id from private.owner_settings;
 if owner_id is null then
  owner_id:=gen_random_uuid();
  insert into auth.users(id,email,aud,role,email_confirmed_at)
  select owner_id,email,'authenticated','authenticated',now() from private.owner_settings;
 end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 set local role authenticated;
 assert private.is_owner(), 'Bound owner must have access';
 select id into pack_id from public.template_packs where code='BRAVO-ERP-NEW';
 pid:=public.create_project(jsonb_build_object('pack_id',pack_id,'code','QA-ROLLBACK','name','Rollback test','customer','Test Customer','manager','Tester','contract_number','TEST-PRIMARY','signed_date','2026-11-21'));
 assert (select count(*)=15 from public.folders where project_id=pid), 'Blueprint must create 15 folders';
 assert (select count(*)=6 from public.tasks where project_id=pid), 'Blueprint must create 6 phases';
 assert (select count(*)=1 from public.contracts where project_id=pid and is_primary), 'Exactly one primary contract';
 select id into task_id from public.tasks where project_id=pid and phase_code='A';
 blocked:=false;
 begin update public.tasks set status='Done' where id=task_id;
 exception when raise_exception then blocked:=true; end;
 assert blocked, 'A task with missing required documents must not be completed';
 select id into folder_id from public.folders where project_id=pid and code='01';
 select current_version_id into tv_id from public.templates where code='BM.40.08';
 did:=public.commit_document(jsonb_build_object('project_id',pid,'folder_id',folder_id,'template_version_id',tv_id,'name','QA.docx','file_type','docx','storage_key','qa/'||req,'checksum','qa','size_bytes',1,'request_key',req,'snapshot',jsonb_build_object('CustomerName','Original')));
 did2:=public.commit_document(jsonb_build_object('project_id',pid,'folder_id',folder_id,'template_version_id',tv_id,'name','QA.docx','file_type','docx','storage_key','qa/'||req,'checksum','qa','size_bytes',1,'request_key',req));
 assert did=did2, 'Repeated request must return the same document';
 assert (select count(*)=1 from public.document_versions where document_id=did), 'Retry must not create another version';
 update public.documents set status='Signed' where id=did;
 assert (select status='Signed' from public.document_versions where document_id=did and version=1), 'Signed status must be retained per version';
 update public.tasks set status='Done' where id=task_id;
 assert (select status='Done' from public.tasks where id=task_id), 'Valid required document must allow completion';
 blocked:=false;
 begin update public.document_versions set snapshot='{}' where document_id=did;
 exception when insufficient_privilege then blocked:=true; end;
 assert blocked, 'Historical snapshots must be immutable';
 blocked:=false;
 begin update public.folders set parent_id=(select id from public.folders where project_id=pid and code='04-01') where project_id=pid and code='04';
 exception when raise_exception then blocked:=true; end;
 assert blocked, 'Folder cycles must be rejected';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
 assert not private.is_owner(), 'Another authenticated user must be denied';
 assert (select count(*)=0 from public.projects), 'RLS must hide all projects from another user';
 reset role;
end $$;
rollback;
