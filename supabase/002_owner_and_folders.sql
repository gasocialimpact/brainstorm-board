-- Brainstorm Board: owner sign-in and folders.
--
-- Run after schema.sql, in the Supabase dashboard: SQL Editor > New query >
-- paste > Run. Safe to re-run.
--
-- Access model after this migration:
-- - The owner signs in (Supabase Auth, email link). Only emails listed in
--   bb_admins get admin rights: the landing page with every board, folders,
--   and creating, moving and deleting boards.
-- - Anyone with a board's link can view and edit that board (unchanged).
-- - Anyone with a folder's link can see the boards in that folder and open
--   them. Folder ids, like board ids, are long random secrets.
--
-- Add the owner after running this (not stored in this file, which is public):
--   insert into public.bb_admins (email) values ('you@example.org');

-- ---------- Admins ----------

create table if not exists public.bb_admins (
  email text primary key
);
alter table public.bb_admins enable row level security;
revoke all on public.bb_admins from anon, authenticated;

create or replace function public.bb_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bb_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.bb_require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.bb_is_admin() then
    raise exception 'Only the board owner can do that.' using errcode = '42501';
  end if;
end;
$$;

-- ---------- Folders ----------

create table if not exists public.folders (
  id text primary key check (char_length(id) >= 20),
  name text not null default 'Untitled folder',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.folders enable row level security;
revoke all on public.folders from anon, authenticated;

alter table public.boards add column if not exists folder_id text
  references public.folders (id) on delete set null;
alter table public.boards add column if not exists thumbnail text;
create index if not exists boards_folder on public.boards (folder_id);

-- ---------- Owner-only functions ----------

-- Creating boards is now owner-only (replaces the open version in schema.sql).
drop function if exists public.bb_create_board(text, text);
create or replace function public.bb_create_board(p_id text, p_title text, p_folder text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.bb_require_admin();
  insert into public.boards (id, title, folder_id)
  values (p_id, coalesce(nullif(p_title, ''), 'Untitled Brainstorm'), p_folder)
  on conflict (id) do nothing;
end;
$$;

create or replace function public.bb_admin_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.bb_require_admin();
  return jsonb_build_object(
    'folders', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'updated_at', f.updated_at)
        order by lower(f.name))
      from public.folders f
    ), '[]'::jsonb),
    'boards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'title', b.title, 'folder_id', b.folder_id,
        'updated_at', b.updated_at, 'thumbnail', b.thumbnail,
        'frames', (select count(*) from public.frames fr where fr.board_id = b.id and not fr.is_deleted)
      ) order by b.updated_at desc)
      from public.boards b
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.bb_delete_board(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.bb_require_admin();
  delete from public.boards where id = p_id;
end;
$$;

create or replace function public.bb_move_board(p_id text, p_folder text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.bb_require_admin();
  update public.boards set folder_id = p_folder where id = p_id;
end;
$$;

create or replace function public.bb_save_folder(p_id text, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.bb_require_admin();
  insert into public.folders (id, name)
  values (p_id, coalesce(nullif(p_name, ''), 'Untitled folder'))
  on conflict (id) do update set name = excluded.name, updated_at = now();
end;
$$;

-- Deleting a folder keeps its boards; they become unfiled.
create or replace function public.bb_delete_folder(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.bb_require_admin();
  delete from public.folders where id = p_id;
end;
$$;

-- ---------- Link functions ----------

-- What a folder link shows: the folder's name and its boards.
create or replace function public.bb_get_folder(p_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', f.id,
    'name', f.name,
    'boards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'title', b.title, 'updated_at', b.updated_at, 'thumbnail', b.thumbnail
      ) order by b.updated_at desc)
      from public.boards b where b.folder_id = f.id
    ), '[]'::jsonb)
  )
  from public.folders f
  where f.id = p_id;
$$;

-- Cover image shown on the landing and folder pages; set by whoever edits.
create or replace function public.bb_set_thumbnail(p_board text, p_data text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.boards set thumbnail = p_data
  where id = p_board
    and p_data like 'data:image/%'
    and char_length(p_data) <= 300000;
$$;

-- ---------- Permissions ----------

revoke all on function public.bb_is_admin() from public;
revoke all on function public.bb_require_admin() from public;
revoke all on function public.bb_create_board(text, text, text) from public;
revoke all on function public.bb_admin_list() from public;
revoke all on function public.bb_delete_board(text) from public;
revoke all on function public.bb_move_board(text, text) from public;
revoke all on function public.bb_save_folder(text, text) from public;
revoke all on function public.bb_delete_folder(text) from public;
revoke all on function public.bb_get_folder(text) from public;
revoke all on function public.bb_set_thumbnail(text, text) from public;

grant execute on function public.bb_is_admin() to anon, authenticated;
grant execute on function public.bb_create_board(text, text, text) to authenticated;
grant execute on function public.bb_admin_list() to authenticated;
grant execute on function public.bb_delete_board(text) to authenticated;
grant execute on function public.bb_move_board(text, text) to authenticated;
grant execute on function public.bb_save_folder(text, text) to authenticated;
grant execute on function public.bb_delete_folder(text) to authenticated;
grant execute on function public.bb_get_folder(text) to anon, authenticated;
grant execute on function public.bb_set_thumbnail(text, text) to anon, authenticated;

-- The owner can clean up a deleted board's images.
drop policy if exists "board files owner read" on storage.objects;
create policy "board files owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'board-files' and public.bb_is_admin());

drop policy if exists "board files owner delete" on storage.objects;
create policy "board files owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'board-files' and public.bb_is_admin());
