import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../server';

describe('API foundation', () => {
  it('reports explicit service configuration', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body).toHaveProperty('databaseConfigured');
    expect(response.body).toHaveProperty('geminiConfigured');
  });

  it('rejects protected CRM endpoints without a session', async () => {
    const response = await request(app).get('/api/crm/contacts');
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('AUTH_REQUIRED');
  });

  it('rejects protected AI endpoints without a session', async () => {
    const response = await request(app).post('/api/ai/chat-agent').send({ userMessage: 'Hola' });
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('AUTH_REQUIRED');
  });

  it('exposes a machine-readable API description', async () => {
    const response = await request(app).get('/api/openapi.json');
    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe('3.1.0');
  });
});
