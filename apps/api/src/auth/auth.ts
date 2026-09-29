import 'dotenv/config';

import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin as adminPlugin } from 'better-auth/plugins';
import { expo } from '@better-auth/expo';

import { prisma } from '../lib/prisma.js';
import { ac, roles } from './permissions.js';

const secret = process.env.BETTER_AUTH_SECRET;
const baseURL = process.env.BETTER_AUTH_URL;

if (!secret) {
  throw new Error('BETTER_AUTH_SECRET is not set');
}

if (!baseURL) {
  throw new Error('BETTER_AUTH_URL is not set');
}

export const auth = betterAuth({
  secret,
  baseURL,

  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  emailAndPassword: {
    enabled: true,
  },

  trustedOrigins: [
    'http://localhost:3000',
    'http://localhost:8081',
    'chainpass://',

    ...(process.env.NODE_ENV !== 'production'
      ? [
          'exp://',
          'exp://**',
          'exp://192.168.*.*:*/**',
        ]
      : []),
  ],

  plugins: [
    expo(),

    adminPlugin({
      ac,
      roles,
      defaultRole: 'user',
    }),
  ],
});
