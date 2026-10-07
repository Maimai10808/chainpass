import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { chmod, lstat, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Explicit local test setup, never a public registration or production bootstrap endpoint.
const database = new URL(process.env.DATABASE_URL ?? '');
if (
  process.env.NODE_ENV === 'production' ||
  !['localhost', '127.0.0.1'].includes(database.hostname) ||
  database.port !== '55432' ||
  database.pathname !== '/chainpass'
) {
  throw new Error(
    'Demo accounts require the local ChainPass development database on port 55432',
  );
}
const api = 'http://localhost:3001';
const storePath = fileURLToPath(
  new URL('../.env.demo-accounts.local', import.meta.url),
);
const { prisma } = await import('../dist/database/prisma.js');
const definitions = [
  {
    role: 'admin',
    email: 'admin.demo@chainpass.local',
    name: 'ChainPass Demo Admin',
  },
  {
    role: 'merchant',
    email: 'merchant.demo@chainpass.local',
    name: 'ChainPass Demo Merchant',
  },
  {
    role: 'user',
    email: 'user.demo@chainpass.local',
    name: 'ChainPass Demo User',
  },
];
let state = { accounts: {} };
try {
  const info = await lstat(storePath);
  if (!info.isFile() || info.isSymbolicLink())
    throw new Error('Credential path must be a regular local file');
  state = JSON.parse(await readFile(storePath, 'utf8'));
  await chmod(storePath, 0o600);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
async function save() {
  await writeFile(storePath, JSON.stringify(state, null, 2) + '\n', {
    mode: 0o600,
  });
  await chmod(storePath, 0o600);
}
async function auth(path, body, cookie) {
  const response = await fetch(api + '/api/auth/' + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok)
    throw new Error(
      `Local auth ${path} failed (HTTP ${response.status}); credentials were not printed`,
    );
  const data = await response.json();
  const session = response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  return { data, cookie: session };
}
try {
  for (const definition of definitions) {
    const known = state.accounts[definition.role];
    if (known) {
      const stored = await prisma.user.findUnique({
        where: { email: definition.email },
        select: { id: true },
      });
      if (!stored || stored.id !== known.id || known.email !== definition.email)
        throw new Error(
          'Saved demo credentials do not match the current database; refusing to overwrite an account',
        );
      continue;
    }
    if (
      await prisma.user.findUnique({
        where: { email: definition.email },
        select: { id: true },
      })
    ) {
      throw new Error(
        'Demo email already exists without this credential file; refusing to reset its password or role',
      );
    }
    const password = randomBytes(24).toString('base64url') + '!a1';
    const created = await auth('sign-up/email', {
      name: definition.name,
      email: definition.email,
      password,
    });
    state.accounts[definition.role] = {
      ...definition,
      id: created.data.user.id,
      password,
    };
    await save();
  }
  const admin = state.accounts.admin;
  const storedAdmin = await prisma.user.findUniqueOrThrow({
    where: { id: admin.id },
  });
  if (storedAdmin.role !== 'admin') {
    if (
      storedAdmin.role !== 'user' ||
      !process.argv.includes('--bootstrap-local-admin')
    ) {
      throw new Error(
        'Initial demo admin needs explicit --bootstrap-local-admin authorization',
      );
    }
    // The first administrator cannot authorize itself through an admin-only endpoint.
    // This is the sole, explicitly requested local fixture bootstrap, scoped to the newly created demo identity.
    await prisma.user.update({
      where: { id: admin.id, email: 'admin.demo@chainpass.local' },
      data: { role: 'admin' },
    });
  }
  const signedIn = await auth('sign-in/email', {
    email: admin.email,
    password: admin.password,
  });
  const merchant = state.accounts.merchant;
  await auth(
    'admin/set-role',
    { userId: merchant.id, role: 'merchant' },
    signedIn.cookie,
  );
  await auth('sign-out', {}, signedIn.cookie);
  for (const definition of definitions) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: state.accounts[definition.role].id },
      select: { role: true },
    });
    if (user.role !== definition.role)
      throw new Error('Demo role verification failed');
    console.log(`${definition.role}: ${definition.email} (ready)`);
  }
  console.log(
    'Passwords saved only in ignored apps/api/.env.demo-accounts.local (mode 600). No password printed.',
  );
} finally {
  await prisma.$disconnect();
}
