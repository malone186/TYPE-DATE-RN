import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);
const read = (path: string) => readFileSync(fileURLToPath(new URL(path, root).href), 'utf8');
const migration = read('supabase/migrations/202609010001_inquiries_operations.sql');
const schema = read('supabase/schema.sql');
const admin = read('admin/index.html');

describe('inquiry operation contracts', () => {
  it('defines atomic creation, replies, status changes, and retry keys', () => {
    expect(migration).toContain('add column if not exists updated_at');
    expect(migration).toContain('create or replace function public.create_inquiry');
    expect(migration).toContain('create or replace function public.send_inquiry_message');
    expect(migration).toContain('create or replace function public.admin_reply_inquiry');
    expect(migration).toContain('create or replace function public.close_inquiry');
    expect(migration).toContain('client_request_id');
    expect(migration).toContain("then 'open'");
    expect(migration).toContain("else 'answered'");
    expect(migration).toContain("status = 'closed'");
    expect(migration).toContain('revoke all on public.inquiries from public, anon, authenticated');
    expect(migration).toContain('revoke all on public.inquiry_messages from public, anon, authenticated');
    expect(migration).toContain('grant execute on function public.create_inquiry');
    expect(migration).toContain('grant execute on function public.send_inquiry_message');
    expect(migration).toContain('grant execute on function public.admin_reply_inquiry');
    expect(migration).toContain('grant execute on function public.close_inquiry');
  });

  it('keeps the final schema aligned with the migration and RLS boundary', () => {
    expect(schema).toContain('updated_at        timestamptz not null default now()');
    expect(schema).toContain('create or replace function public.create_inquiry');
    expect(schema).toContain('create or replace function public.send_inquiry_message');
    expect(schema).toContain('create or replace function public.admin_reply_inquiry');
    expect(schema).toContain('create or replace function public.close_inquiry');
    expect(schema).toContain('user_id = auth.uid()');
    expect(schema).toContain('public.is_admin()');
    expect(schema).toContain("current_status = 'closed'");
  });

  it('pins user/admin ownership and sender transitions in the database', () => {
    expect(migration).toContain('where id = p_inquiry_id and user_id = current_user_id');
    expect(migration).toContain("values (p_inquiry_id, 'user', clean_body, p_request_id)");
    expect(migration).toContain("values (p_inquiry_id, 'admin', clean_body, p_request_id)");
    expect(migration).toContain('if not public.is_admin()');
    expect(migration).toContain("current_status = 'closed'");
    expect(schema).toContain('using (user_id = auth.uid() or public.is_admin())');
    expect(schema).toContain('where i.id = inquiry_id and i.user_id = auth.uid()');
  });

  it('uses RPC writes, escapes user content, and cleans up inquiry polling', () => {
    expect(admin).toContain(".rpc('admin_reply_inquiry'");
    expect(admin).toContain(".rpc('close_inquiry'");
    expect(admin).toContain('setInterval');
    expect(admin).toContain('clearInterval');
    expect(admin).toContain('esc(r.subject)');
    expect(admin).toContain('esc(r.email');
    expect(admin).toContain('esc(m.body)');
    expect(admin).toContain("row.last_sender === 'user'");
  });
});
