import 'dotenv/config';

import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin as adminPlugin } from 'better-auth/plugins';
import { expo } from '@better-auth/expo';

import { prisma } from '../database/prisma.js';
import { ac, roles } from './permissions.js';

const secret = process.env.BETTER_AUTH_SECRET;
const baseURL = process.env.BETTER_AUTH_URL;
const webOrigin = process.env.WEB_ORIGIN;

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
    'chainpass://',

    ...(webOrigin ? [webOrigin] : []),

    ...(process.env.NODE_ENV !== 'production'
      ? [
          'http://localhost:3000',
          'http://localhost:8081',
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
