'use client';

import { LoggerProvider } from '@ayllu/react';
import { createIndexedDbStorage } from '@ayllu/storage-indexeddb';
import {
  createLogger,
  createMemoryStorage,
  defaultPolicies,
  Policy,
  Sampler,
} from '@ayllu/core';
import { createHttpTransport } from '@ayllu/transport-http';
import { z } from 'zod';
import { useMemo } from 'react';

const credentialHeader = () =>
  process.env.NEXT_PUBLIC_AYLLU_SIGNATURE ?? 'demo-signature';

const logSchema = z.object({
  message: z.string().min(1).max(2_000),
  context: z.record(z.unknown()).optional(),
  tags: z.array(z.string().max(32)).max(10).optional(),
  error: z.unknown().optional(),
});

const demoPolicies: Policy[] = [
  ...defaultPolicies,
  {
    name: 'redact-user-email',
    type: 'redact',
    path: 'context.user.email',
  },
  {
    name: 'redact-auth-token',
    type: 'redact',
    path: 'context.auth.token',
  },
  {
    name: 'truncate-stack',
    type: 'truncate',
    path: 'context.error.stack',
    maxLength: 1_024,
  },
];

const sampler: Sampler = (log) =>
  log.level === 'debug' ? Math.random() < 0.25 : true;

const base64Encode = (bytes: Uint8Array): string => {
  if (typeof btoa !== 'function') {
    return '';
  }
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const base64Decode = (value: string): Uint8Array => {
  if (typeof atob !== 'function') {
    return new Uint8Array();
  }
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const createStorage = () => {
  try {
    return createIndexedDbStorage({
      dbName: 'ayllu-demo',
      storeName: 'logs',
      encrypt: async (payload) => {
        if (typeof crypto !== 'undefined' && crypto.subtle) {
          const encoder = new TextEncoder();
          const data = encoder.encode(payload);
          const keyMaterial = encoder.encode('ayllu-demo-secret');
          const key = await crypto.subtle.importKey(
            'raw',
            keyMaterial,
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
          );
          const derivedKey = await crypto.subtle.deriveKey(
            {
              name: 'PBKDF2',
              salt: encoder.encode('ayllu-demo-salt'),
              iterations: 10_000,
              hash: 'SHA-256',
            },
            key,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
          );
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            derivedKey,
            data
          );
          const buffer = new Uint8Array(iv.length + encrypted.byteLength);
          buffer.set(iv);
          buffer.set(new Uint8Array(encrypted), iv.length);
          return base64Encode(buffer);
        }

        if (typeof btoa === 'function') {
          return base64Encode(new TextEncoder().encode(payload));
        }

        return payload;
      },
      decrypt: async (payload) => {
        if (typeof crypto !== 'undefined' && crypto.subtle) {
          const raw = base64Decode(payload);
          const iv = raw.slice(0, 12);
          const data = raw.slice(12);
          const encoder = new TextEncoder();
          const keyMaterial = encoder.encode('ayllu-demo-secret');
          const key = await crypto.subtle.importKey(
            'raw',
            keyMaterial,
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
          );
          const derivedKey = await crypto.subtle.deriveKey(
            {
              name: 'PBKDF2',
              salt: encoder.encode('ayllu-demo-salt'),
              iterations: 10_000,
              hash: 'SHA-256',
            },
            key,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
          );
          const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            derivedKey,
            data
          );
          return new TextDecoder().decode(decrypted);
        }

        if (typeof atob === 'function') {
          return new TextDecoder().decode(base64Decode(payload));
        }

        return payload;
      },
      warn: () => undefined,
    });
  } catch {
    return createMemoryStorage();
  }
};

export const AppProviders = ({ children }: { children: React.ReactNode }) => {
  const logger = useMemo(
    () =>
      createLogger({
        level: 'debug',
        transport: createHttpTransport({
          url: '/api/logs',
          headers: async () => ({
            'x-ayllu-signature': credentialHeader(),
          }),
          healthcheck: {
            url: '/api/logs/health',
            timeoutMs: 1_000,
          },
          timeoutMs: 4_000,
        }),
        storage: createStorage(),
        policies: demoPolicies,
        sampler,
        schema: logSchema,
        enrichers: [
          () => ({
            environment: process.env.NODE_ENV ?? 'development',
            url:
              typeof window !== 'undefined'
                ? window.location.href
                : 'server',
          }),
        ],
        onError: (error) => {
          console.error('[Ayllu] Logger error', error);
        },
      }),
    []
  );

  return <LoggerProvider logger={logger}>{children}</LoggerProvider>;
};

