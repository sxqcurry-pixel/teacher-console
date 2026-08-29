/**
 * 部署健康检查 — 用来确认最新代码（含 /api/v1[...path] 代理）已上线。
 * 如果 GET /api/ping 返回带 deploy 标记的 JSON，说明当前部署 ≥ 5b2ba82。
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const GET = () =>
  NextResponse.json({
    code: 0,
    message: 'pong',
    data: {
      ts: Date.now(),
      deploy: 'netlify-route-handler-v1',
      backend:
        process.env.BACKEND_URL ||
        'https://satisfied-reflection-production.up.railway.app/api/v1',
    },
    timestamp: new Date().toISOString(),
  });
