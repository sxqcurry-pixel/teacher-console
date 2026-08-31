import axios, { AxiosError, AxiosInstance } from 'axios';
import type { ApiResponse } from '@shared/dto';

/**
 * Typed API client — backend returns ApiResponse<T> for every endpoint.
 * Automatically:
 *   - Injects Bearer token from localStorage
 *   - Strips the envelope so callers get `T` directly (use raw=true for full ApiResponse)
 *   - Normalizes errors so TanStack Query sees them as Error objects with code/message
 */
class ApiClient {
  readonly instance: AxiosInstance;

  constructor() {
    this.instance = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/api/v1',
      timeout: 30_000,
      // ⚠️【不要全局设置 Content-Type: application/json】
      // 因为 axios 会把默认 headers 合并到每次请求，即使 data 是浏览器 FormData 也不会自动删除/替换这条：
      //   结果是上传请求的 Content-Type 变成 application/json（缺 boundary=----xxx）
      //   → proxy isMultipart 检测失败 → 走 req.text() UTF-8 解码，ZIP 字节损坏，同时 multer 找不到 file 字段
      //   → "Unsupported ZIP file" / "File is required"
      // 正确做法：在每个 method 里对非 FormData 的 body 手动 set Content-Type
      headers: {
        Accept: 'application/json',
      },
    });

    this.instance.interceptors.request.use((config) => {
      if (typeof window === 'undefined') return config;
      const token = localStorage.getItem('accessToken');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      // 浏览器 FormData：禁止任何手动 Content-Type，交给浏览器自动写 multipart/form-data; boundary=----xxx
      if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
        // @ts-expect-error delete Content-Type case-insensitively
        delete config.headers?.['Content-Type'];
        // @ts-expect-error lower-case too
        delete config.headers?.['content-type'];
        return config;
      }
      // 文本/对象 body：默认 JSON；如果调用方已经明确设了 Content-Type 就尊重
      if (
        config.data !== undefined &&
        !(
          typeof Blob !== 'undefined' &&
          (config.data instanceof Blob || config.data instanceof ArrayBuffer || ArrayBuffer.isView(config.data))
        )
      ) {
        const current = (config.headers as any)?.['Content-Type'] ?? (config.headers as any)?.['content-type'];
        if (!current) {
          if (!config.headers) (config as any).headers = {};
          (config.headers as any)['Content-Type'] = 'application/json';
        }
      }
      return config;
    });

    this.instance.interceptors.response.use(
      (response) => response,
      (err: AxiosError<ApiResponse<unknown>>) => {
        const data = err.response?.data;
        if (data && typeof data === 'object' && 'message' in data) {
          const e = new Error(data.message ?? String(err.message)) as Error & {
            code?: number;
            raw?: ApiResponse<unknown>;
          };
          e.code = data.code;
          e.raw = data;
          return Promise.reject(e);
        }
        return Promise.reject(err);
      },
    );
  }

  /** GET — returns unwrapped `data`. Use raw=true to retrieve full ApiResponse. */
  async get<T>(url: string, params?: Record<string, unknown>, raw = false): Promise<T> {
    const res = await this.instance.get<ApiResponse<T>>(url, { params });
    return raw ? (res.data as unknown as T) : res.data.data;
  }

  async post<T>(url: string, body?: unknown, raw = false): Promise<T> {
    const res = await this.instance.post<ApiResponse<T>>(url, body);
    return raw ? (res.data as unknown as T) : res.data.data;
  }

  async patch<T>(url: string, body?: unknown, raw = false): Promise<T> {
    const res = await this.instance.patch<ApiResponse<T>>(url, body);
    return raw ? (res.data as unknown as T) : res.data.data;
  }

  async delete<T>(url: string, raw = false): Promise<T> {
    const res = await this.instance.delete<ApiResponse<T>>(url);
    return raw ? (res.data as unknown as T) : res.data.data;
  }

  async upload<T>(url: string, file: File, fields: Record<string, string> = {}): Promise<T> {
    const fd = new FormData();
    fd.append('file', file);
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
    // ⚠️ 不要手动设置 Content-Type: multipart/form-data！
    // 浏览器会自动补全 boundary=----WebKitFormBoundaryXXX，手写会丢 boundary → 后端 multer 解析失败。
    const res = await this.instance.post<ApiResponse<T>>(url, fd);
    return res.data.data;
  }

  /**
   * Server-Sent Events streaming via fetch + ReadableStream.
   * axios can't read chunked bodies incrementally, so we bypass it.
   * Backend writes `data: <json|"[DONE]">\n\n`.
   */
  async streamSSE(
    url: string,
    body: unknown,
    onChunk: (content: string) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const baseURL = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const res = await fetch(`${baseURL}${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `请求失败 (${res.status})`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const line = block.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          const obj = JSON.parse(payload) as { content?: string; error?: string };
          if (obj.error) throw new Error(obj.error);
          if (typeof obj.content === 'string') onChunk(obj.content);
        } catch {
          /* ignore keepalive / partial */
        }
      }
    }
  }
}

export const api = new ApiClient();

/** Module-level helper — typed endpoints so imports feel nice. */
export const endpoints = {
  auth: {
    me: () => api.get('/auth/me'),
    login: (d: { email: string; password: string }) => api.post('/auth/login', d),
    register: (d: { email: string; password: string; name: string }) => api.post('/auth/register', d),
  },
  dashboard: {
    stats: () => api.get('/dashboard/stats'),
    activity: (limit = 10) => api.get(`/dashboard/activity?limit=${limit}`),
  },
  classes: {
    list: () => api.get('/classes'),
    create: (d: any) => api.post('/classes', d),
    update: (id: string, d: any) => api.patch(`/classes/${id}`, d),
    remove: (id: string) => api.delete(`/classes/${id}`),
  },
  students: {
    query: (q: any) => api.get('/students', q),
    get: (id: string) => api.get(`/students/${id}`),
    create: (d: any) => api.post('/students', d),
    update: (id: string, d: any) => api.patch(`/students/${id}`, d),
    remove: (id: string) => api.delete(`/students/${id}`),
    bulkImport: (file: File, classId: string) =>
      api.upload('/students/bulk-import', file, { classId }),
  },
  scores: {
    query: (q: any) => api.get('/scores', q),
    batch: (d: any) => api.post('/scores/batch', d),
    remove: (id: string) => api.delete(`/scores/${id}`),
  },
  points: {
    query: (q: any) => api.get('/points', q),
    ranking: (classId: string, limit = 50) =>
      api.get(`/points/ranking?classId=${classId}&limit=${limit}`),
    create: (d: any) => api.post('/points', d),
    remove: (id: string) => api.delete(`/points/${id}`),
  },
  auctions: {
    list: (classId?: string) =>
      api.get(classId ? `/auctions?classId=${classId}` : '/auctions'),
    create: (d: any) => api.post('/auctions', d),
    bid: (d: any) => api.post('/auctions/bid', d),
    settle: (id: string) => api.post(`/auctions/${id}/settle`),
  },
  wheel: {
    studentSegments: (classId: string) => api.get(`/wheel/segments/students/${classId}`),
    spin: (d: any) => api.post('/wheel/spin', d),
    history: (classId: string, limit = 50) =>
      api.get(`/wheel/history?classId=${classId}&limit=${limit}`),
  },
  communications: {
    query: (q: any) => api.get('/communications', q),
    create: (d: any) => api.post('/communications', d),
    remove: (id: string) => api.delete(`/communications/${id}`),
  },
  todos: {
    list: (f?: any) => api.get('/todos', f),
    create: (d: any) => api.post('/todos', d),
    update: (id: string, d: any) => api.patch(`/todos/${id}`, d),
    remove: (id: string) => api.delete(`/todos/${id}`),
  },
  materials: {
    list: (keyword?: string, tag?: string) =>
      api.get('/materials', { keyword, tag }),
    create: (d: any) => api.post('/materials', d),
    update: (id: string, d: any) => api.patch(`/materials/${id}`, d),
    remove: (id: string) => api.delete(`/materials/${id}`),
  },
  ai: {
    options: () => api.get('/ai/options'),
    chat: (d: any) => api.post('/ai/chat', d),
    /** Real streaming via SSE; falls back to POST + typewriter on failure. */
    streamChat: (
      d: any,
      onChunk: (content: string) => void,
      signal?: AbortSignal,
    ) => api.streamSSE('/ai/chat/stream', d, onChunk, signal),
  },
};
