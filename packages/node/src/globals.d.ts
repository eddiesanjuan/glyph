/**
 * Minimal type declarations for Node 18+ built-in globals.
 * These are available at runtime but not in TypeScript's ES2022 lib.
 */

interface ResponseInit {
  status?: number;
  statusText?: string;
  headers?: HeadersInit;
}

interface RequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

interface Response {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

declare function fetch(url: string, init?: RequestInit): Promise<Response>;
