import { createHash } from 'node:crypto';
import { CHANNELS, ProviderAccessError, type AdChannel } from './advertising-agent.ts';

type Connector = {
  configuration(): Array<{ channel: AdChannel; configured: boolean; missing: string[] }>;
  verify(channel: AdChannel): Promise<{ readVerified: boolean; writeVerified: boolean }>;
};
export type ConnectionEvidence = {
  channel: AdChannel;
  configured: boolean;
  state: 'missing_credentials' | 'invalid_configuration' | 'not_checked' | 'verified_read' | 'provider_rejected' | 'expired';
  checkedAt: string | null;
  readVerified: boolean;
  writeVerified: false;
  message: string;
  failureReason?: string;
  httpStatus?: number;
  providerCode?: number | null;
  providerReason?: string | null;
};

// One server-owned connector pool for every agent; secrets never enter prompts or responses.
// Successful reads prove account access only, never billing, publishing or conversion tracking.
export class AgentConnections {
  private results = new Map<AdChannel, ConnectionEvidence>();
  private checkedFingerprint = '';
  private running: Promise<ConnectionEvidence[]> | null = null;
  private connector: Connector;
  private env: NodeJS.ProcessEnv;
  private now: () => number;
  constructor(connector: Connector, env = process.env, now = () => Date.now()) {
    this.connector = connector; this.env = env; this.now = now;
  }
  private fingerprint() {
    const entries = Object.entries(this.env).filter(([key]) => /^(META_|INSTAGRAM_|GOOGLE_ADS_|YOUTUBE_)/.test(key)).sort(([a], [b]) => a.localeCompare(b));
    return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
  }
  snapshot(): ConnectionEvidence[] {
    const changed = this.checkedFingerprint !== this.fingerprint();
    return this.connector.configuration().map(({ channel, configured }) => {
      const previous = changed ? undefined : this.results.get(channel);
      if (!configured) return { channel, configured, state: 'missing_credentials', checkedAt: null, readVerified: false, writeVerified: false, message: 'Faltan credenciales del canal.' };
      if (!previous) return { channel, configured, state: 'not_checked', checkedAt: null, readVerified: false, writeVerified: false, message: 'Credenciales guardadas; acceso pendiente de comprobación.' };
      if (this.now() - Date.parse(previous.checkedAt!) >= 15 * 60_000) return { ...previous, state: 'expired', readVerified: false, message: 'La comprobación venció. Verifica nuevamente.' };
      return previous;
    });
  }
  refresh(): Promise<ConnectionEvidence[]> {
    if (this.running) return this.running;
    const fingerprint = this.fingerprint();
    this.running = Promise.all(CHANNELS.map(async channel => {
      const configured = this.connector.configuration().find(item => item.channel === channel)!.configured;
      if (!configured) return;
      let readVerified = false;
      let invalidConfiguration = false;
      let diagnostic: Pick<ConnectionEvidence, 'failureReason' | 'httpStatus' | 'providerCode' | 'providerReason'> = {};
      try { readVerified = (await this.connector.verify(channel)).readVerified === true; }
      catch (error) {
        invalidConfiguration = error instanceof Error && error.message === 'AD_MISSING';
        if (error instanceof ProviderAccessError) diagnostic = { failureReason: error.reason, httpStatus: error.httpStatus, providerCode: error.providerCode, providerReason: error.providerReason };
        // Unknown exception text is deliberately discarded.
      }
      this.results.set(channel, {
        channel, configured, state: readVerified ? 'verified_read' : invalidConfiguration ? 'invalid_configuration' : 'provider_rejected',
        checkedAt: new Date(this.now()).toISOString(), readVerified, writeVerified: false,
        message: readVerified ? 'Acceso de lectura confirmado por el proveedor.' : invalidConfiguration ? 'El identificador de la cuenta no tiene el formato requerido.' : 'El proveedor no confirmó el acceso. Revisa token, cuenta y permisos en Conexiones.',
        ...diagnostic,
      });
    })).then(() => {
      this.checkedFingerprint = fingerprint;
      return this.snapshot();
    }).finally(() => { this.running = null; });
    return this.running;
  }
}
