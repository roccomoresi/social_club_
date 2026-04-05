# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies (run from repo root)
pnpm i

# Mobile app
pnpm dev:mobile          # Start Expo dev server
pnpm -C apps/mobile android   # Run on Android
pnpm -C apps/mobile ios       # Run on iOS

# Linting
pnpm lint:mobile

Architecture & Stack

    Framework: React Native con Expo SDK 54.

    Navegación: Expo Router v6 (estructura de carpetas basada en archivos).

    Estilos: NativeWind (v2) / Tailwind CSS. (Usa className prop).

    Backend: Supabase (Auth + PostgreSQL + Realtime). Todo sin React Query, puro async/await en apps/mobile/lib/supabase.ts o services/.

    Auth: contexts/AuthContext.tsx maneja la sesión y el perfil.

Mobile App Routing (apps/mobile/app/)

Uses Expo Router file-based routing with three route groups:

    (auth)/ — unauthenticated routes (login)

    (setup)/ — post-login onboarding (profile setup, runs once)

    (app)/ — main protected routes (home, event)

⚠️ BUSINESS RULES & STRICT FUNNEL (CRITICAL)

The app is for a highly exclusive Social Club. Users CANNOT skip funnel steps.

    FASE 1 (Onboarding): If onboarding_completed is false/null, redirect to /(setup)/onboarding.

    FASE 2 (Match): In /(app)/event.tsx, users MUST find a partner using event_invitations.

    FASE 3 (Passline Unlock): Accepting an invitation creates an event_teams row. This unlocks the Passline Ticket URL.

    FASE 4 (Live Event): Physical entry is handled by Passline. The app is used INSIDE the event to scan a table QR and start the Game Engine via Supabase Realtime.

The Single Source of Truth (Database)

IGNORE old schema.sql files if they conflict with this. The active tables in Supabase are:

    profiles: id (PK), full_name, role, member_number, instagram_user, avatar_url, trivia_1, trivia_2, trivia_3, onboarding_completed (boolean).

    events: id (PK), title, starts_at, ends_at, location, capacity, passline_url.

    event_invitations: id (PK), event_id (FK), sender_id (FK), receiver_id (FK), status ('pending', 'accepted', 'rejected').

    event_teams: id (PK), event_id (FK), player1_id (FK), player2_id (FK, nullable), is_solo_pool (boolean), passline_unlocked (boolean).

    game_sessions (Planned): id, event_id, table_number, status, start_time.

    table_players (Planned): id, session_id, profile_id, is_ready.