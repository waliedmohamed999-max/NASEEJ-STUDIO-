-- NASEEJ STUDIO — core schema
-- Catalogue tables keep the full camelCase domain object in `data` (jsonb) for the
-- client, plus scalar columns for filtering, sorting and foreign keys.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Roles & profiles
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('student', 'designer', 'brand', 'supplier', 'shopper', 'admin');
create type public.plan_tier as enum ('free', 'pro', 'studio');

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         public.user_role not null default 'designer',
  plan         public.plan_tier not null default 'free',
  display_name text,
  avatar_url   text,
  country      text,
  bio          text,
  locale       text not null default 'en',
  created_at   timestamptz not null default now()
);

-- Create a profile for every new auth user (email or Google). Role is read from
-- sign-up metadata but can never be self-assigned as admin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  requested text := coalesce(new.raw_user_meta_data ->> 'role', 'designer');
begin
  insert into public.profiles (id, display_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    case when requested in ('student', 'designer', 'brand', 'supplier', 'shopper') then requested::public.user_role else 'designer' end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

-- Users may edit their own profile but not their role or plan.
create or replace function public.protect_profile_columns()
returns trigger language plpgsql as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.plan := old.plan;
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table public.suppliers (
  id          text primary key,
  owner_id    uuid references public.profiles (id) on delete set null,
  name        text not null,
  country     char(2) not null,
  moq_meters  integer,
  verified    boolean not null default false,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

create table public.fabrics (
  id              text primary key,
  slug            text unique not null,
  supplier_id     text references public.suppliers (id) on delete set null,
  construction    text not null,
  gsm             integer not null check (gsm > 0),
  price_per_meter numeric(10, 2) not null,
  sustainability  smallint not null check (sustainability between 0 and 100),
  published       boolean not null default true,
  data            jsonb not null,
  created_at      timestamptz not null default now()
);
create index fabrics_construction_idx on public.fabrics (construction);
create index fabrics_gsm_idx on public.fabrics (gsm);
create index fabrics_supplier_idx on public.fabrics (supplier_id);

create table public.garment_templates (
  id   text primary key,
  data jsonb not null
);

create table public.courses (
  id        text primary key,
  slug      text unique not null,
  topic     text not null,
  level     text not null,
  published boolean not null default true,
  data      jsonb not null
);

-- ---------------------------------------------------------------------------
-- User content
-- ---------------------------------------------------------------------------
create table public.projects (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  name       text not null default '',
  garment_id text not null references public.garment_templates (id),
  data       jsonb not null,   -- Design (layers, size)
  thumbnail  text,             -- storage path
  is_public  boolean not null default false,
  updated_at timestamptz not null default now()
);
create index projects_owner_idx on public.projects (owner_id, updated_at desc);

create table public.looks (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  data       jsonb not null,   -- Look (garment, fabric, colour, size)
  is_public  boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.saved_fabrics (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  fabric_id  text not null references public.fabrics (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, fabric_id)
);

-- ---------------------------------------------------------------------------
-- Marketplace: sample / quote requests and messaging
-- ---------------------------------------------------------------------------
create type public.request_kind as enum ('sample', 'quote');
create type public.request_status as enum ('open', 'quoted', 'accepted', 'declined', 'shipped', 'closed');

create table public.requests (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  supplier_id  text not null references public.suppliers (id) on delete cascade,
  fabric_id    text references public.fabrics (id) on delete set null,
  kind         public.request_kind not null,
  quantity_m   numeric(10, 2),
  message      text,
  status       public.request_status not null default 'open',
  quoted_price numeric(10, 2),
  created_at   timestamptz not null default now()
);

create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index messages_request_idx on public.messages (request_id, created_at);

-- ---------------------------------------------------------------------------
-- Community
-- ---------------------------------------------------------------------------
create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create table public.likes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table public.challenges (
  id        uuid primary key default gen_random_uuid(),
  title     jsonb not null,  -- LText
  brief     jsonb not null,
  starts_on date not null,
  ends_on   date not null
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.suppliers         enable row level security;
alter table public.fabrics           enable row level security;
alter table public.garment_templates enable row level security;
alter table public.courses           enable row level security;
alter table public.projects          enable row level security;
alter table public.looks             enable row level security;
alter table public.saved_fabrics     enable row level security;
alter table public.requests          enable row level security;
alter table public.messages          enable row level security;
alter table public.follows           enable row level security;
alter table public.likes             enable row level security;
alter table public.comments          enable row level security;
alter table public.challenges        enable row level security;

-- Profiles: public read, self update
create policy "profiles readable" on public.profiles for select using (true);
create policy "profiles self update" on public.profiles for update using (id = auth.uid() or public.is_admin());

-- Catalogue: public read; admins manage; suppliers manage their own records
create policy "suppliers readable" on public.suppliers for select using (true);
create policy "suppliers admin write" on public.suppliers for all using (public.is_admin()) with check (public.is_admin());
create policy "suppliers owner update" on public.suppliers for update using (owner_id = auth.uid());

create policy "fabrics readable" on public.fabrics for select using (published or public.is_admin()
  or exists (select 1 from public.suppliers s where s.id = supplier_id and s.owner_id = auth.uid()));
create policy "fabrics admin write" on public.fabrics for all using (public.is_admin()) with check (public.is_admin());
create policy "fabrics supplier write" on public.fabrics for all
  using (exists (select 1 from public.suppliers s where s.id = supplier_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.suppliers s where s.id = supplier_id and s.owner_id = auth.uid()));

create policy "garments readable" on public.garment_templates for select using (true);
create policy "garments admin write" on public.garment_templates for all using (public.is_admin()) with check (public.is_admin());

create policy "courses readable" on public.courses for select using (published or public.is_admin());
create policy "courses admin write" on public.courses for all using (public.is_admin()) with check (public.is_admin());

create policy "challenges readable" on public.challenges for select using (true);
create policy "challenges admin write" on public.challenges for all using (public.is_admin()) with check (public.is_admin());

-- Owned content
create policy "projects read" on public.projects for select using (is_public or owner_id = auth.uid());
create policy "projects write" on public.projects for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "looks read" on public.looks for select using (is_public or owner_id = auth.uid());
create policy "looks write" on public.looks for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "saved fabrics own" on public.saved_fabrics for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Requests: visible to the requester and the supplier's owner
create policy "requests participants read" on public.requests for select using (
  requester_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.suppliers s where s.id = supplier_id and s.owner_id = auth.uid()));
create policy "requests create" on public.requests for insert with check (requester_id = auth.uid());
create policy "requests supplier update" on public.requests for update using (
  exists (select 1 from public.suppliers s where s.id = supplier_id and s.owner_id = auth.uid()));

create policy "messages participants" on public.messages for select using (
  exists (select 1 from public.requests r
          left join public.suppliers s on s.id = r.supplier_id
          where r.id = request_id and (r.requester_id = auth.uid() or s.owner_id = auth.uid())));
create policy "messages send" on public.messages for insert with check (
  sender_id = auth.uid() and exists (select 1 from public.requests r
          left join public.suppliers s on s.id = r.supplier_id
          where r.id = request_id and (r.requester_id = auth.uid() or s.owner_id = auth.uid())));

-- Community
create policy "follows read" on public.follows for select using (true);
create policy "follows own" on public.follows for all using (follower_id = auth.uid()) with check (follower_id = auth.uid());
create policy "likes read" on public.likes for select using (true);
create policy "likes own" on public.likes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "comments read" on public.comments for select using (
  exists (select 1 from public.projects p where p.id = project_id and (p.is_public or p.owner_id = auth.uid())));
create policy "comments write" on public.comments for insert with check (author_id = auth.uid());
create policy "comments delete" on public.comments for delete using (author_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: user uploads (try-on photos, thumbnails). Path prefix = user id.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('user-uploads', 'user-uploads', false)
  on conflict (id) do nothing;

create policy "uploads own read" on storage.objects for select
  using (bucket_id = 'user-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "uploads own write" on storage.objects for insert
  with check (bucket_id = 'user-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "uploads own delete" on storage.objects for delete
  using (bucket_id = 'user-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
