import { NextResponse } from 'next/server';
import { z } from 'zod';

const signatureHeader = 'x-ayllu-signature';

const logSchema = z.object({
  id: z.string(),
  level: z.enum(['debug', 'info', 'warn', 'error']),
  message: z.string(),
  timestamp: z.number(),
  tags: z.array(z.string()).optional(),
  context: z.record(z.unknown()).optional(),
  enriched: z.record(z.unknown()).optional(),
});

const batchSchema = z.object({
  logs: z.array(logSchema),
});

const verifySignature = (signature: string | null): boolean => {
  if (!signature) {
    return false;
  }

  const expected =
    process.env.AYLLU_PROXY_SIGNATURE ??
    process.env.NEXT_PUBLIC_AYLLU_SIGNATURE ??
    'demo-signature';

  return signature === expected;
};

export async function POST(request: Request) {
  const signature = request.headers.get(signatureHeader);

  if (!verifySignature(signature)) {
    return NextResponse.json(
      { message: 'Invalid signature' },
      { status: 401 }
    );
  }

  const result = batchSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json(
      { message: 'Malformed payload', issues: result.error.issues },
      { status: 400 }
    );
  }

  const { logs } = result.data;

  // Demo behaviour: log to server console. In production this is where vendors receive data.
  console.info('[Ayllu proxy] forwarding batch', {
    count: logs.length,
    levels: [...new Set(logs.map((log) => log.level))],
    sample: logs[0],
  });

  // TODO: forward to vendor(s) or queue for processing.

  return NextResponse.json({ received: logs.length });
}

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}


