import test from 'node:test';
import assert from 'node:assert/strict';
import { TEAM_AGENTS } from './agents.ts';
import { AGENT_PLAYBOOKS, agentPlaybook } from './playbooks.ts';
test('every registered agent has a distinct objective, deliverable, measurable outcome and execution boundary', () => {
  assert.equal(Object.keys(AGENT_PLAYBOOKS).length, TEAM_AGENTS.length);
  for (const agent of TEAM_AGENTS) {
    const p = agentPlaybook(agent.id);
    assert.match(p, /OBJETIVO:/);
    assert.match(p, /ENTREGABLE:/);
    assert.match(p, /MEDICIÓN:/);
    assert.match(p, /nunca declares una ejecución/);
  }
  assert.equal(new Set(Object.values(AGENT_PLAYBOOKS).map((p) => p.objective)).size, 22);
  for (const id of [
    'agent_closer',
    'agent_sales_elite',
    'agent_recovery',
    'agent_whatsapp',
    'agent_billing',
  ]) {
    assert.match(agentPlaybook(id), /US\$60/);
    assert.match(agentPlaybook(id), /pago en revisión no suma/);
    assert.match(agentPlaybook(id), /no una garantía/);
  }
});

test('other companies never inherit the INTECA price or sales target', () => {
  assert.doesNotMatch(agentPlaybook('agent_closer', false), /US\$60|5 ventas|INTECA/);
});
