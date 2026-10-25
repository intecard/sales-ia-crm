import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createTeamStudio } from './routes.ts';
import { TEAM_AGENTS, allowedAgent } from './agents.ts';

test('area mapping covers all agents and prevents cross-area access', () => {
  assert.equal(TEAM_AGENTS.length, 22);
  assert.ok(TEAM_AGENTS.every((a) => allowedAgent('owner', a.id)));
  assert.equal(allowedAgent('Marketing', 'agent_accounting'), false);
  assert.equal(allowedAgent('Contabilidad', 'agent_accounting'), true);
  assert.equal(allowedAgent('Inventario', 'agent_procurement_national'), true);
  assert.equal(allowedAgent('owner', 'unknown'), false);
});
test('signed-in team permissions, persistent history, shared briefs, and idempotent replies', async () => {
  const tables: Record<string, any[]> = {
    crm_team_members: [],
    crm_team_sessions: [],
    crm_team_messages: [],
    crm_team_notes: [],
    crm_team_tasks: [],
  };
  let modelCalls = 0;
  const store = {
    request: async (resource: string, method = 'GET', body?: any) => {
      const [name, q] = resource.split('?'),
        params = new URLSearchParams(q);
      const rows = tables[name];
      assert.ok(rows, 'known table');
      if (method === 'POST') {
        const row = {
          id: crypto.randomUUID(),
          active: true,
          created_at: new Date().toISOString(),
          ...body,
        };
        rows.push(row);
        return [row];
      }
      const matches = rows.filter((row) =>
        [...params].every(
          ([k, v]) =>
            ['select', 'order', 'limit'].includes(k) ||
            (v.startsWith('eq.') && String(row[k]) === v.slice(3)) ||
            (v.startsWith('gt.') && String(row[k]) > v.slice(3)) ||
            (v.startsWith('in.') && v.slice(4, -1).split(',').includes(row[k])),
        ),
      );
      if(method==='DELETE')tables[name]=rows.filter(row=>!matches.includes(row));
      if (method === 'PATCH') {
        matches.forEach((v) => Object.assign(v, body));
      }
      return structuredClone(matches);
    },
  };
  const app = express();
  app.use(express.json());
  const studio = createTeamStudio(
    store,
    (req) => req.headers.cookie === 'owner=yes',
    () => 'owner@example.test',
    async (p) => {
      modelCalls++;
      assert.ok(p.includes('CONVERSACIÓN'));
      return 'Plan propuesto: revisar fecha y preparar campaña.';
    },
    async () => 'Catálogo autorizado',
  );
  app.use('/api/team', studio.router);
  app.post('/login', async (req, res) => {
    if (!(await studio.login(req.body.email, req.body.password, res)))
      res.status(401).json({ error: 'invalid' });
  });
  const server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const call = (path: string, body?: unknown, cookie = 'owner=yes') =>
    fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { cookie, 'Content-Type': 'application/json', 'X-CRM-Action': 'team' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    assert.equal((await call('/api/team/org_inteca_main', undefined, '')).status, 401);
    const created = await call('/api/team/org_inteca_main/members', {
      name: 'Equipo marketing',
      email: 'marketing@example.test',
      password: 'test-only-password-123',
      area: 'Marketing',
      organizationName: 'INTECA',
    });
    assert.equal(created.status, 201);
    assert.notEqual(tables.crm_team_members[0].password_hash, 'test-only-password-123');
    const login = await call(
      '/login',
      { email: 'marketing@example.test', password: 'test-only-password-123' },
      '',
    );
    assert.equal(login.status, 200);
    assert.ok(login.headers.get('set-cookie')?.includes('crm_sales_session='));
    const cookies = login.headers.getSetCookie();
    const cookie = cookies.find((v) => v.startsWith('crm_team_session='))!.split(';')[0];
    const state = (await (
      await call('/api/team/org_inteca_main', undefined, cookie)
    ).json()) as any;
    assert.ok(state.agents.every((a: any) => a.area === 'Marketing'));
    assert.equal(state.identity.owner, false);
    assert.equal((await call('/api/team/org_other', undefined, cookie)).status, 403);
    assert.equal(
      (await call('/api/team/org_inteca_main/messages/agent_accounting', undefined, cookie)).status,
      403,
    );
    assert.equal((await call('/api/team/org_inteca_main/members', undefined, cookie)).status, 403);
    assert.equal(
      (
        await call(
          '/api/team/org_inteca_main/notes',
          {
            kind: 'course',
            course: 'Curso',
            date: '2026-11-15',
            content: 'Confirmar grupo de sábado.',
          },
          cookie,
        )
      ).status,
      201,
    );
    const requestId = crypto.randomUUID(),
      payload = {
        requestId,
        agentId: 'agent_media_buyer',
        message: 'Prepara un plan para este curso.',
      };
    assert.equal((await call('/api/team/org_inteca_main/chat', payload, cookie)).status, 200);
    assert.equal((await call('/api/team/org_inteca_main/chat', payload, cookie)).status, 200);
    assert.equal(modelCalls, 1);
    assert.equal(tables.crm_team_messages.length, 2);
    assert.equal(
      (
        await call(
          '/api/team/org_inteca_main/chat',
          { ...payload, message: 'Otro mensaje' },
          cookie,
        )
      ).status,
      409,
    );
    assert.equal((await call('/api/team/org_inteca_main/messages/agent_media_buyer/clear',{confirmed:true},cookie)).status,403);
    assert.equal((await call('/api/team/org_inteca_main/messages/agent_media_buyer/clear',{})).status,400);
    tables.crm_team_messages.push({id:crypto.randomUUID(),organization_id:'org_other',agent_id:'agent_media_buyer',content:'Preservar'});
    assert.equal((await call('/api/team/org_inteca_main/messages/agent_media_buyer/clear',{confirmed:true})).status,200);
    assert.equal(tables.crm_team_messages.length,1);assert.equal(tables.crm_team_messages[0].organization_id,'org_other');
    const id = tables.crm_team_members[0].id;
    assert.equal((await call(`/api/team/org_inteca_main/members/${id}/disable`, {})).status, 200);
    assert.equal((await call('/api/team/org_inteca_main', undefined, cookie)).status, 401);
  } finally {
    server.close();
  }
});
