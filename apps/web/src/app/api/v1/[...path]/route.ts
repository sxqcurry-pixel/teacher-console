/**
 * Catch-all API proxy (App Router Route Handler).
 * 浏览器请求同源 /api/v1/*，由本运行在服务端的函数转发到 Railway 后端，
 * 手动透传方法、请求体与 Authorization 头 → 无 CORS，且 Host/目标完全可控。
 */
import { NextRequest, NextResponse } from 'next/server';

const BACKEND =
  process.env.BACKEND_URL ||
  'https://satisfied-reflection-production.up.railway.app/api/v1';

async function handler(
  req: NextRequest,
  ctx: { params: { path?: string[] } },
) {
  const path = (ctx.params.path ?? []).join('/');
  const search = req.nextUrl.search || '';
  const target = `${BACKEND}/${path}${search}`;

  const headers = new Headers();
  const auth = req.headers.get('authorization');
  if (auth) headers.set('authorization', auth);
  const ct = req.headers.get('content-type');
  if (ct) headers.set('content-type', ct);
  const accept = req.headers.get('accept');
  if (accept) headers.set('accept', accept);

  const method = req.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);
  const bodyText = hasBody ? await req.text() : undefined;

  try {
    const upstream = await fetch(target, {
      method,
      headers,
      body: bodyText && bodyText.length ? bodyText : undefined,
      // SSE 流式需要禁用缓冲时可在此扩展；当前登录/CRUD 用普通请求即可
      cache: 'no-store',
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        code: 502,
        message: `后端代理请求失败: ${e instanceof Error ? e.message : 'unknown'}`,
        data: null,
      },
      { status: 502 },
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
