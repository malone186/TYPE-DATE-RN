import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// .href keeps the DOM URL type out of fileURLToPath, whose signature comes from @types/node.
const resolvePath = (path: string) => fileURLToPath(new URL(path, import.meta.url).href);

export default defineConfig({
  resolve: {
    alias: {
      // The Edge Function imports Supabase over a URL because it runs on Deno. Under the test
      // runner that specifier resolves to a local double instead of a network fetch.
      'https://esm.sh/@supabase/supabase-js@2': resolvePath('./tests/mocks/supabase-js.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'supabase/functions/**/*.test.ts'],
    setupFiles: [resolvePath('./tests/setup.ts')],
  },
});
