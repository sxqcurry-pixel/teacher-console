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
  const contentType = req.headers.get('content-type') || '';
  const isMultipart = contentType.toLowerCase().includes('multipart/form-data');
  // 【调试/版本标识 v3】dev 环境下打印路由命中版本，便于判断是否仍跑旧代码（旧代码会造成 File is required / Unsupported ZIP）
  if (process.env.NODE_ENV !== 'production') {
    const pathDisplay = `${method} /${(ctx.params.path ?? []).join('/')}${req.nextUrl.search || ''}`;
    if (isMultipart) {
      console.log(`[PROXY_v3_stream] HIT multipart → ${pathDisplay}   content-type=${contentType.slice(0, 80)}`);
    } else {
      console.log(`[PROXY_v3_stream] HIT → ${pathDisplay}`);
    }
  }
  // 【修复 File is required + Unsupported ZIP file 终极版】
  // multipart/form-data 的上传链路：
  //   1) 不能 req.text() / req.arrayBuffer() 后再 Uint8Array 传 fetch
  //      → Node/undici 会把 body 当成 application/octet-stream 推断，丢掉原始 Content-Type 里的 boundary=----... 参数
  //      → multer 不知道是 multipart → file 字段丢失 → Nest 抛 "File is required"
  //   2) 也不能 text() UTF-8 解码：xlsx 是 ZIP 字节，非法字节被替换 → "Unsupported ZIP file"
  //
  // 终极正确做法：直接把 req.body（ReadableStream）作为 body 透传，
  // 并手动重设 header['content-type'] = 浏览器原始带来的值（大小写 boundary 完全一致），
  // 同时加上 duplex: 'half'（stream body 必需）。这样 undici 不会做任何编码/推断，字节级 100% 保真。
  let body: BodyInit | undefined;
  if (hasBody && isMultipart) {
    // 二进制文件上传：流式透传，字节 100% 一致 + boundary 一字不改
    if (req.body) {
      body = req.body as unknown as BodyInit;
      // 显式再塞一遍：确保 fetch 不会重写/覆盖 boundary
      headers.set('content-type', contentType);
    }
  } else if (hasBody) {
    // JSON 等文本型 body：保持 text 兼容
    const t = await req.text();
    body = t && t.length ? t : undefined;
  }

  try {
    const upstream = await fetch(target, {
      method,
      headers,
      body,
      // duplex 是 undici / Node fetch 的扩展属性，TypeScript DOM RequestInit 类型未包含，用 as any 绕过。
      // 只有 multipart body 是 ReadableStream 时才需要设为 'half'；其他请求留空。
      ...((hasBody && isMultipart && req.body ? { duplex: 'half' as any } : null)),
      cache: 'no-store',
    } satisfies Parameters<typeof fetch>[1]);
    const text = await upstream.text();
    // 🔴 后端返回非 2xx 时，把原始响应体完整打印出来（避免之前只看状态码瞎猜）
    if (process.env.NODE_ENV !== 'production' && upstream.status >= 400) {
      const pathDisplay = `${method} /${(ctx.params.path ?? []).join('/')}${req.nextUrl.search || ''}`;
      console.error(
        `[PROXY_v3_UPSTREAM_ERR] ${pathDisplay}  STATUS=${upstream.status}  BODY=${text.slice(0, 800)}`,
      );
    }
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
