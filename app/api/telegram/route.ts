import { webhookCallback } from 'grammy';
import { bot } from '@/lib/bot';

export const dynamic = 'force-dynamic';

/**
 * Serverless Telegram webhook handler using grammY standard HTTP adapter.
 * Suitable for Vercel / serverless deployments.
 */
export const POST = webhookCallback(bot, 'std/http');

export async function GET() {
  return new Response('Telegram Bot webhook endpoint active.', { status: 200 });
}
