-- Perfil de socio (app móvil). Aplicar en Supabase si aún no existe la tabla o columnas.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  member_number text,
  role text default 'MEMBER',
  instagram_user text,
  secret_fact text,
  avatar_url text,
  onboarding_completed boolean not null default false,
  trivia_1 text,
  trivia_2 text,
  trivia_3 text,
  updated_at timestamptz
);

-- Índice opcional para escaneo por número de socio
create index if not exists profiles_member_number_idx on public.profiles (member_number);
