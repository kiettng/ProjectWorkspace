-- Qualify submitted IDs because PL/pgSQL also declares an item_id loop variable.
create or replace function public.reorder_folders(p_project_id uuid,p_parent_id uuid,p_ids uuid[])
returns void language plpgsql security invoker set search_path='' as $$
declare item_id uuid; n integer; begin
 if not (select private.is_owner()) then raise exception 'Không có quyền sắp xếp thư mục.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_project_id::text,0));
 n:=coalesce(array_length(p_ids,1),0);
 if n=0 or n<>(select count(*) from public.folders where project_id=p_project_id and parent_id is not distinct from p_parent_id and deleted_at is null)
  or n<>(select count(distinct submitted.item_id) from unnest(p_ids) as submitted(item_id))
  or exists(select 1 from unnest(p_ids) as submitted(item_id) left join public.folders f on f.id=submitted.item_id
    where f.id is null or f.project_id<>p_project_id or f.parent_id is distinct from p_parent_id or f.deleted_at is not null) then
  raise exception 'Danh sách thư mục đã thay đổi. Hãy tải lại rồi thử lại.';
 end if;
 for item_id,n in select ordered.item_id,ordered.ordinality from unnest(p_ids) with ordinality as ordered(item_id,ordinality) loop
  update public.folders set sort_order=n*10 where id=item_id and project_id=p_project_id;
 end loop;
end $$;

create or replace function public.reorder_tasks(p_project_id uuid,p_ids uuid[])
returns void language plpgsql security invoker set search_path='' as $$
declare item_id uuid; n integer; begin
 if not (select private.is_owner()) then raise exception 'Không có quyền sắp xếp công việc.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_project_id::text,0));
 n:=coalesce(array_length(p_ids,1),0);
 if n=0 or n<>(select count(*) from public.tasks where project_id=p_project_id and deleted_at is null)
  or n<>(select count(distinct submitted.item_id) from unnest(p_ids) as submitted(item_id))
  or exists(select 1 from unnest(p_ids) as submitted(item_id) left join public.tasks t on t.id=submitted.item_id
    where t.id is null or t.project_id<>p_project_id or t.deleted_at is not null) then
  raise exception 'Danh sách công việc đã thay đổi. Hãy tải lại rồi thử lại.';
 end if;
 for item_id,n in select ordered.item_id,ordered.ordinality from unnest(p_ids) with ordinality as ordered(item_id,ordinality) loop
  update public.tasks set sort_order=n*10 where id=item_id and project_id=p_project_id;
 end loop;
end $$;
