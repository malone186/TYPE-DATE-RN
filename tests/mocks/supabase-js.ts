import { vi } from 'vitest';

type AuthResult = { data: { user: { id: string } | null }; error: { message: string } | null };

// Tests drive the Edge Function through these handles: swap the implementations to simulate a
// rejected JWT or a failing ledger write, then read `rows` to assert what was actually stored.
export const supabaseDouble = {
  getUser: vi.fn(async (_jwt: string): Promise<AuthResult> => ({
    data: { user: { id: 'user-1' } },
    error: null,
  })),
  upsert: vi.fn(async (): Promise<{ error: { message: string } | null }> => ({ error: null })),
  rows: [] as Array<{ table: string; row: Record<string, unknown>; options: unknown }>,
  keys: [] as string[],
  reset() {
    this.getUser.mockReset();
    this.getUser.mockImplementation(async () => ({ data: { user: { id: 'user-1' } }, error: null }));
    this.upsert.mockReset();
    this.upsert.mockImplementation(async () => ({ error: null }));
    this.rows = [];
    this.keys = [];
  },
};

export function createClient(_url: string, key: string) {
  supabaseDouble.keys.push(key);
  return {
    auth: {
      getUser: (jwt: string) => supabaseDouble.getUser(jwt),
    },
    from: (table: string) => ({
      upsert: (row: Record<string, unknown>, options: unknown) => {
        supabaseDouble.rows.push({ table, row, options });
        return supabaseDouble.upsert();
      },
    }),
  };
}
