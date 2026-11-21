-- Run after uploading all 17 private Word files to dossier/templates/.
-- Only relocate a reference when Storage contains the expected immutable bytes.
-- Do not remove local/bundled copies until the migration has been verified.
begin;
do $$
declare expected_count integer; uploaded_count integer; begin
 select count(*) into expected_count from public.template_versions where storage_key like 'bundled/%';
 select count(*) into uploaded_count from public.template_versions v
 join storage.objects o on o.bucket_id='dossier' and o.name='templates/'||substring(v.storage_key from 9)
 where v.storage_key like 'bundled/%';
 if expected_count<>uploaded_count then
  raise exception 'Private template migration incomplete: % of % files uploaded',uploaded_count,expected_count;
 end if;
 update public.template_versions set storage_key='templates/'||substring(storage_key from 9)
 where storage_key like 'bundled/%';
end $$;
commit;
