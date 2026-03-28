# Scrap World

Monorepo con:

- `apps/mobile`: App de miembros (Expo + React Native + NativeWind)
- `apps/dashboard`: Dashboard admins (Next.js App Router + Tailwind + Shadcn UI)
- `packages/supabase`: Cliente Supabase compartido

## Variables de entorno

Supabase (ambos frentes):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Dashboard (server-side auth):

- `SUPABASE_SERVICE_ROLE_KEY` (opcional para tareas administrativas)

Mobile:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Desarrollo

```bash
pnpm i
pnpm dev:mobile
pnpm dev:dashboard
```

