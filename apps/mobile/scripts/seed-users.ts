import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TOTAL = 60;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

async function main() {
  let created = 0;
  let failed = 0;

  for (let i = 1; i <= TOTAL; i++) {
    const num = pad(i);
    const threeDigit = String(i).padStart(3, '0');
    const email = `user${num}@test.com`;
    const fullName = `Test User ${num}`;
    const memberNumber = `TEST-${threeDigit}`;

    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: 'test1234',
        email_confirm: true,
      });

      if (authError) throw authError;

      const userId = authData.user.id;

      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        full_name: fullName,
        member_number: memberNumber,
        role: 'MEMBER',
        onboarding_completed: true,
        trivia_1: 'Me gusta el café',
        trivia_2: 'Tengo un perro',
        trivia_3: 'Soy de Buenos Aires',
      });

      if (profileError) throw profileError;

      console.log(`Creado: ${email}`);
      created++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${email} - ${msg}`);
      failed++;
    }
  }

  console.log(`\nFinalizado: ${created} creados, ${failed} errores.`);
}

main();
