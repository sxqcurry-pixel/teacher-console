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
  const isMultipart = (req.headers.get('content-type') || '').toLowerCase().includes('multipart/form-data');
  // 【修复 xlsx 导入 Unsupported ZIP file】
  // 所有请求体必须按字节级透传，绝不能用 req.text() 做 UTF-8 解码：
  //   - multipart/form-data 里 xlsx 是 ZIP 二进制，UTF-8 解码会替换非法字节 → ZIP 损坏 → XLSX 解析报错 Unsupported ZIP file
  //   - application/json 也应该按字节传（避免不必要的编解码性能损耗 + BOM 等兼容）
  let body: ArrayBuffer | Uint8Array | string | undefined;
  if (hasBody && isMultipart) {
    // 二进制文件上传：传字节，保证与浏览器发送的 multipart payload 字节级一致。
    const raw = await req.arrayBuffer();
    body = raw.byteLength ? new Uint8Array(raw) : undefined;
  } else if (hasBody) {
    // JSON 等文本型 body：保持 text 兼容（和之前行为一致）
    const t = await req.text();
    body = t && t.length ? t : undefined;
  }

  try {
    const upstream = await fetch(target, {
      method,
      headers,
      body: body as any,
      // SSE 流式需要禁用缓冲时可在此扩展；当前登录/CRUD 用普通请求即可
      duplex: body instanceof Uint8Array ? 'half' : undefined,
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
