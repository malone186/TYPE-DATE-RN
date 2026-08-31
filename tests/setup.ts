// The Edge Function reads its secrets through Deno.env and registers a listener at module scope.
// Node has neither, so a minimal stand-in is installed before any suite imports that module.
const denoStub = {
  env: {
    get: (name: string): string | undefined => process.env[name],
  },
  serve: () => undefined,
};

(globalThis as unknown as { Deno: typeof denoStub }).Deno = denoStub;
