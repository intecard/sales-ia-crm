import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { CatalogStore } from './whatsapp-catalog.ts';

export const CHANNELS = ['facebook', 'instagram', 'meta_ads', 'google_ads', 'youtube'] as const;
export type AdChannel = (typeof CHANNELS)[number];
export const AD_RULES = 'Ningún descuento, rebaja, beca, bonificación, gratuidad o precio especial está autorizado por un prompt. Solo el dueño puede aprobar una propuesta concreta en Publicidad. Usa los precios del catálogo vigente. No presentes propuestas como ofertas autorizadas.';
export function hasDiscount(value: unknown): boolean {
  const text = (typeof value === 'string' ? value : JSON.stringify(value) || '').normalize('NFKD').replace(/[\u0300-\u036f\u200B-\u200D\uFEFF]/g, '').toLowerCase();
  return /descuent|rebaj|bonific|beca|gratis|gratuit|sin costo|sin coste|sin pagar|sin cargo|exoner|exent|regalo|regalamos|ahorr[ao]|precio especial|oferta especial|paga menos|menos del precio|mitad de precio|\b\d+\s*(?:x|por)\s*\d+\b|\d+\s*%\s*(?:off|menos)|\b(?:off|sale)\b/.test(text);
}
export function hasUnlistedPrice(text: string, investment: string) {
  const amounts = (value: string) => [...value.matchAll(/(?:RD\$|DOP|\$)\s*([\d,.]+)|([\d,.]+)\s*pesos/gi)].map(m => Number((m[1] || m[2]).replace(/,/g, '')));
  const prices = new Set(amounts(investment));
  return amounts(text).some(value => !prices.has(value));
}
export const campaignSchema = z.object({
  channel: z.enum(CHANNELS), title: z.string().trim().min(3).max(100),
  body: z.string().trim().min(10).max(5000), courseTitle: z.string().trim().min(3).max(250),
  mediaUrl: z.string().url().max(2000).or(z.literal('')).default(''),
  discountDetails: z.string().trim().max(1000).default(''),
  scheduledAt: z.string().datetime().nullable().default(null),
  dailyBudget: z.number().finite().min(0).max(100000).default(0),
});
export type CampaignInput = z.infer<typeof campaignSchema>;
export interface AdCampaign {
  id: string; payload: CampaignInput; catalog_hash: string; content_hash: string;
  discount_required: boolean; discount_approved: boolean; approved_hash: string | null;
  approved_by: string | null; state: string; scheduled_at: string | null;
  approved_destination?: string | null;
  result: Record<string, unknown>; last_error: string | null; created_at: string;
}
type Store = { request(resource: string, method?: string, body?: unknown): Promise<any> };
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const required: Record<AdChannel, string[]> = {
  facebook: ['META_PAGE_ID', 'META_PAGE_ACCESS_TOKEN'],
  instagram: ['INSTAGRAM_BUSINESS_ACCOUNT_ID', 'META_PAGE_ACCESS_TOKEN'],
  meta_ads: ['META_AD_ACCOUNT_ID', 'META_ADS_ACCESS_TOKEN'],
  google_ads: ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_REFRESH_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID'],
  youtube: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN', 'YOUTUBE_CHANNEL_ID'],
};
export const AD_ERRORS: Record<string, string> = {
  AD_STORAGE: 'No se pudo guardar la campaña. Comprueba Supabase.',
  AD_AUTH: 'Vuelve a iniciar sesión como administrador del CRM.',
  AD_INPUT: 'Revisa los campos de la campaña.',
  AD_MISSING: 'Faltan credenciales del canal. Abre Multiempresa y Seguridad → conexiones.',
  AD_PROVIDER: 'El proveedor rechazó la operación. Revisa los permisos y la cuenta conectada.',
  AD_UNKNOWN: 'Resultado externo incierto. Revisa la plataforma antes de volver a crear o publicar; no se reintentará automáticamente.',
  AD_CATALOG: 'No está disponible el catálogo vigente de Supabase.',
  AD_CHANGED: 'El catálogo cambió. Crea y revisa un nuevo borrador con los datos actuales.',
  AD_APPROVAL: 'Requiere revisión del dueño y autorización expresa del descuento si corresponde.',
  AD_STATE: 'La campaña ya cambió de estado. Actualiza la lista.',
  AD_MEDIA: 'Usa un archivo público de Storage del Supabase de INTECA. Instagram requiere una imagen JPEG; YouTube un video MP4 de hasta 20 MB.',
  AD_BUDGET: 'Indica el presupuesto diario en DOP. Esta operación solo prepara la campaña pagada en pausa.',
  AD_CURRENCY: 'La cuenta publicitaria debe operar en DOP. No se convertirá moneda automáticamente.',
};
export function adError(error: unknown) { const code = error instanceof Error ? error.message : ''; return AD_ERRORS[code] ? code : 'AD_STORAGE'; }

export class AdvertisingAgent {
  private store: Store;
  private catalog: Pick<CatalogStore, 'get'>;
  private env: NodeJS.ProcessEnv;
  private fetcher: typeof fetch;
  private running = false;
  constructor(store: Store, catalog: Pick<CatalogStore, 'get'>, env = process.env, fetcher: typeof fetch = (...args) => fetch(...args)) {
    this.store = store; this.catalog = catalog; this.env = env; this.fetcher = fetcher;
  }
  configuration() {
    return CHANNELS.map(channel => ({ channel, configured: required[channel].every(key => !!this.env[key]?.trim()),
      missing: required[channel].filter(key => !this.env[key]?.trim()),
      capability: channel.endsWith('_ads') ? 'Preparar campaña en pausa; lectura de métricas' : channel === 'youtube' ? 'Subir video privado; lectura del canal' : 'Publicar contenido aprobado',
      verified: false,
      destination: this.destination(channel),
    }));
  }
  private destination(channel: AdChannel) {
    const key = { facebook: 'META_PAGE_ID', instagram: 'INSTAGRAM_BUSINESS_ACCOUNT_ID', meta_ads: 'META_AD_ACCOUNT_ID', google_ads: 'GOOGLE_ADS_CUSTOMER_ID', youtube: 'YOUTUBE_CHANNEL_ID' }[channel];
    const value = this.env[key] || '';
    return channel === 'google_ads' ? value.replace(/-/g, '') : channel === 'meta_ads' ? value.replace(/^act_/, '') : value;
  }
  private configured(channel: AdChannel) {
    if (this.configuration().find(c => c.channel === channel)!.missing.length) throw new Error('AD_MISSING');
  }
  private id(key: string, prefix = '') {
    const value = (this.env[key] || '').replace(/-/g, '').replace(/^act_/, '');
    if (!/^\d+$/.test(value)) throw new Error('AD_MISSING');
    return prefix + value;
  }
  private async json(url: string, init: RequestInit = {}) {
    try {
      const response = await this.fetcher(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error('AD_PROVIDER');
      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.message === 'AD_PROVIDER') throw error;
      throw new Error(init.method && init.method !== 'GET' ? 'AD_UNKNOWN' : 'AD_PROVIDER');
    }
  }
  private graph(resource: string, token: string, body?: Record<string, unknown>) {
    const version = /^v\d+\.0$/.test(this.env.META_GRAPH_API_VERSION || '') ? this.env.META_GRAPH_API_VERSION : 'v26.0';
    return this.json(`https://graph.facebook.com/${version}/${resource}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
    });
  }
  private async googleToken(prefix: 'GOOGLE_ADS' | 'YOUTUBE') {
    const data = await this.json('https://oauth2.googleapis.com/token', { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: this.env[`${prefix}_CLIENT_ID`] || '', client_secret: this.env[`${prefix}_CLIENT_SECRET`] || '', refresh_token: this.env[`${prefix}_REFRESH_TOKEN`] || '' }).toString(),
    });
    if (!data.access_token) throw new Error('AD_PROVIDER');
    return String(data.access_token);
  }
  private async googleAds(resource: string, body: unknown) {
    const token = await this.googleToken('GOOGLE_ADS');
    const version = /^v\d+$/.test(this.env.GOOGLE_ADS_API_VERSION || '') ? this.env.GOOGLE_ADS_API_VERSION : 'v26';
    return this.json(`https://googleads.googleapis.com/${version}/customers/${this.id('GOOGLE_ADS_CUSTOMER_ID')}/${resource}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'developer-token': this.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
        'Content-Type': 'application/json', ...(this.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ? { 'login-customer-id': this.id('GOOGLE_ADS_LOGIN_CUSTOMER_ID') } : {}) }, body: JSON.stringify(body),
    });
  }
  async verify(channel: AdChannel) {
    this.configured(channel);
    if (channel === 'facebook' || channel === 'instagram') {
      const account = await this.graph(`${this.id(channel === 'facebook' ? 'META_PAGE_ID' : 'INSTAGRAM_BUSINESS_ACCOUNT_ID')}?fields=id,${channel === 'facebook' ? 'name' : 'username'}`, this.env.META_PAGE_ACCESS_TOKEN!);
      if (!account.id) throw new Error('AD_PROVIDER');
      return { channel, id: account.id, name: account.name || account.username, readVerified: true, writeVerified: false };
    }
    if (channel === 'meta_ads') {
      const account = await this.graph(`${this.id('META_AD_ACCOUNT_ID', 'act_')}?fields=id,name,currency,account_status`, this.env.META_ADS_ACCESS_TOKEN!);
      if (!account.id || account.account_status !== 1) throw new Error('AD_PROVIDER');
      return { channel, id: account.id, name: account.name, currency: account.currency, readVerified: true, writeVerified: false };
    }
    if (channel === 'google_ads') {
      const result = await this.googleAds('googleAds:search', { query: 'SELECT customer.id, customer.descriptive_name, customer.currency_code FROM customer LIMIT 1' });
      const customer = result.results?.[0]?.customer;
      if (!customer?.id) throw new Error('AD_PROVIDER');
      return { channel, id: customer.id, name: customer.descriptiveName, currency: customer.currencyCode, readVerified: true, writeVerified: false };
    }
    const token = await this.googleToken('YOUTUBE');
    const result = await this.json('https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true', { headers: { Authorization: `Bearer ${token}` } });
    const channelData = result.items?.find((item: { id: string }) => item.id === this.env.YOUTUBE_CHANNEL_ID);
    if (!channelData) throw new Error('AD_PROVIDER');
    return { channel, id: channelData.id, name: channelData.snippet?.title, readVerified: true, writeVerified: false };
  }
  async snapshot() {
    const campaigns = await this.store.request('crm_ad_campaigns?order=created_at.desc&limit=100');
    const catalog = await this.catalog.get();
    return { campaigns, connections: this.configuration(), courses: catalog?.courses.map(c => ({ title: c.title, investment: c.investment })) || [],
      policy: { maxAutonomousDiscountPercent: 0, requiresOwnerApproval: true, paidCampaignsPaused: true, scheduleIntervalSeconds: 60 } };
  }
  async metrics(channel: AdChannel) {
    this.configured(channel);
    if (channel === 'meta_ads') {
      const result = await this.graph(`${this.id('META_AD_ACCOUNT_ID', 'act_')}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend&level=campaign&date_preset=last_7d&limit=50`, this.env.META_ADS_ACCESS_TOKEN!);
      return { channel, period: 'Últimos 7 días', rows: result.data || [], partial: !!result.paging?.next };
    }
    if (channel === 'google_ads') {
      const result = await this.googleAds('googleAds:search', { query: 'SELECT campaign.id, campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE segments.date DURING LAST_7_DAYS LIMIT 50' });
      return { channel, period: 'Últimos 7 días', rows: result.results || [], partial: !!result.nextPageToken };
    }
    throw new Error('AD_INPUT');
  }
  async create(input: CampaignInput) {
    const payload = campaignSchema.parse(input);
    const catalog = await this.catalog.get();
    if (!catalog || !catalog.courses.some(c => c.title === payload.courseTitle)) throw new Error('AD_CATALOG');
    if (payload.mediaUrl) this.mediaUrl(payload.mediaUrl);
    const content_hash = hash({ payload, catalogHash: catalog.hash });
    return (await this.store.request('crm_ad_campaigns', 'POST', { payload, content_hash, catalog_hash: catalog.hash,
      discount_required: !!payload.discountDetails || !!payload.mediaUrl || hasDiscount([payload.title, payload.body]) || hasUnlistedPrice(`${payload.title}\n${payload.body}`, catalog.courses.find(c => c.title === payload.courseTitle)!.investment), scheduled_at: payload.scheduledAt }))[0];
  }
  async approve(id: string, expectedHash: string, discounts: boolean, actor: string, expectedDestination: string) {
    const row = await this.get(id);
    if (row.state !== 'draft' || expectedHash !== row.content_hash) throw new Error('AD_STATE');
    if (!actor || (row.discount_required && !discounts)) throw new Error('AD_APPROVAL');
    await this.currentCatalog(row);
    this.configured(row.payload.channel);
    const destination = this.destination(row.payload.channel);
    if (!expectedDestination || expectedDestination !== destination) throw new Error('AD_STATE');
    const result = await this.store.request(`crm_ad_campaigns?id=eq.${id}&state=eq.draft&content_hash=eq.${expectedHash}`, 'PATCH', {
      state: 'approved', approved_hash: expectedHash, approved_by: actor, approved_at: new Date().toISOString(), discount_approved: discounts,
      approved_destination: destination,
    });
    if (!result.length) throw new Error('AD_STATE');
    return result[0];
  }
  private async get(id: string): Promise<AdCampaign> {
    if (!z.string().uuid().safeParse(id).success) throw new Error('AD_INPUT');
    const row = (await this.store.request(`crm_ad_campaigns?id=eq.${id}&limit=1`))[0];
    if (!row) throw new Error('AD_STATE');
    return row;
  }
  private async currentCatalog(row: AdCampaign) {
    const catalog = await this.catalog.get();
    if (!catalog) throw new Error('AD_CATALOG');
    if (catalog.hash !== row.catalog_hash) throw new Error('AD_CHANGED');
  }
  private mediaUrl(value: string) {
    const url = new URL(value); const allowed = new URL(this.env.SUPABASE_URL || 'https://invalid.invalid');
    if (url.origin !== allowed.origin || url.protocol !== 'https:' || url.username || url.password || !url.pathname.startsWith('/storage/v1/object/public/')) throw new Error('AD_MEDIA');
    return url.toString();
  }
  async execute(id: string) {
    const row = await this.get(id);
    if (row.state !== 'approved' || row.approved_hash !== row.content_hash || !row.approved_by ||
      row.content_hash !== hash({ payload: row.payload, catalogHash: row.catalog_hash }) ||
      ((row.discount_required || hasDiscount([row.payload.title, row.payload.body, row.payload.discountDetails])) && !row.discount_approved)) throw new Error('AD_APPROVAL');
    await this.currentCatalog(row);
    this.configured(row.payload.channel);
    if (!row.approved_destination || row.approved_destination !== this.destination(row.payload.channel)) throw new Error('AD_APPROVAL');
    const identity = await this.verify(row.payload.channel);
    if (row.payload.channel.endsWith('_ads') && ('currency' in identity && identity.currency !== 'DOP')) throw new Error('AD_CURRENCY');
    if (row.payload.channel.endsWith('_ads') && row.payload.dailyBudget <= 0) throw new Error('AD_BUDGET');
    if (['instagram', 'youtube'].includes(row.payload.channel) && !row.payload.mediaUrl) throw new Error('AD_MEDIA');
    // Conditional database update is the cross-process lock. Never auto-retry uncertain external writes.
    const claimed = await this.store.request(`crm_ad_campaigns?id=eq.${id}&state=eq.approved`, 'PATCH', { state: 'executing', last_error: null });
    if (!claimed.length) throw new Error('AD_STATE');
    try {
      const result = await this.publish(row);
      const state = row.payload.channel.endsWith('_ads') ? 'prepared' : row.payload.channel === 'youtube' ? 'uploaded_private' : 'published';
      await this.store.request(`crm_ad_campaigns?id=eq.${id}&state=eq.executing`, 'PATCH', { state, result });
      return { state, result };
    } catch (error) {
      const code = adError(error);
      await this.store.request(`crm_ad_campaigns?id=eq.${id}&state=eq.executing`, 'PATCH', { state: 'review_required', last_error: code }).catch(() => {});
      throw error;
    }
  }
  private async publish(row: AdCampaign): Promise<Record<string, unknown>> {
    const p = row.payload;
    if (p.channel === 'facebook') {
      const result = await this.graph(`${this.id('META_PAGE_ID')}/${p.mediaUrl ? 'photos' : 'feed'}`, this.env.META_PAGE_ACCESS_TOKEN!, p.mediaUrl
        ? { url: this.mediaUrl(p.mediaUrl), caption: `${p.title}\n\n${p.body}`, published: true }
        : { message: `${p.title}\n\n${p.body}` });
      if (!result.id) throw new Error('AD_UNKNOWN');
      return { id: result.post_id || result.id };
    }
    if (p.channel === 'instagram') {
      if (`${p.title}\n\n${p.body}`.length > 2200 || !/\.jpe?g(?:\?|$)/i.test(p.mediaUrl)) throw new Error('AD_MEDIA');
      const account = this.id('INSTAGRAM_BUSINESS_ACCOUNT_ID');
      const container = await this.graph(`${account}/media`, this.env.META_PAGE_ACCESS_TOKEN!, { image_url: this.mediaUrl(p.mediaUrl), caption: `${p.title}\n\n${p.body}` });
      if (!container.id) throw new Error('AD_UNKNOWN');
      const result = await this.graph(`${account}/media_publish`, this.env.META_PAGE_ACCESS_TOKEN!, { creation_id: container.id });
      if (!result.id) throw new Error('AD_UNKNOWN');
      return { id: result.id };
    }
    if (p.channel === 'meta_ads') {
      const result = await this.graph(`${this.id('META_AD_ACCOUNT_ID', 'act_')}/campaigns`, this.env.META_ADS_ACCESS_TOKEN!, {
        name: `${p.title} [${row.id.slice(0, 8)}]`, objective: 'OUTCOME_TRAFFIC', status: 'PAUSED', special_ad_categories: [],
      });
      if (!result.id) throw new Error('AD_UNKNOWN');
      return { id: result.id, status: 'PAUSED', nextStep: 'Completar conjunto de anuncios, segmentación, presupuesto y creativo; aprobar gasto en Meta Ads.', requestedDailyBudgetDop: p.dailyBudget };
    }
    if (p.channel === 'google_ads') {
      const customer = this.id('GOOGLE_ADS_CUSTOMER_ID');
      const budgetName = `customers/${customer}/campaignBudgets/-1`;
      const result = await this.googleAds('googleAds:mutate', { partialFailure: false, mutateOperations: [
        { campaignBudgetOperation: { create: { resourceName: budgetName, name: `${p.title} ${row.id}`, amountMicros: String(Math.round(p.dailyBudget * 1000000)), deliveryMethod: 'STANDARD', explicitlyShared: false } } },
        { campaignOperation: { create: { name: `${p.title} ${row.id}`, advertisingChannelType: 'SEARCH', status: 'PAUSED', campaignBudget: budgetName, manualCpc: {}, containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING', networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false, targetPartnerSearchNetwork: false } } } },
      ] });
      const resourceName = result.mutateOperationResponses?.find((r: any) => r.campaignResult)?.campaignResult?.resourceName;
      if (result.partialFailureError || !resourceName) throw new Error('AD_UNKNOWN');
      return { id: resourceName, status: 'PAUSED', nextStep: 'Completar grupos, palabras clave, ubicación, URL de destino y anuncios; aprobar gasto en Google Ads.' };
    }
    const media = await this.fetcher(this.mediaUrl(p.mediaUrl), { redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!media.ok || !media.headers.get('content-type')?.startsWith('video/mp4') || Number(media.headers.get('content-length')) > 20 * 1024 * 1024 || !media.body) throw new Error('AD_MEDIA');
    const chunks: Uint8Array[] = []; let size = 0; const reader = media.body.getReader();
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 20 * 1024 * 1024) { await reader.cancel(); throw new Error('AD_MEDIA'); } chunks.push(value); }
    if (!size) throw new Error('AD_MEDIA');
    const token = await this.googleToken('YOUTUBE'); const boundary = `crm_${row.id}`;
    const metadata = { snippet: { title: p.title, description: p.body, categoryId: '27' }, status: { privacyStatus: 'private' } };
    const body = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`), ...chunks, Buffer.from(`\r\n--${boundary}--\r\n`)]);
    const result = await this.json('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status&notifySubscribers=false', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
    if (!result.id) throw new Error('AD_UNKNOWN');
    return { id: result.id, privacyStatus: 'private', nextStep: 'Revisar procesamiento y visibilidad en YouTube Studio.' };
  }
  async tick() {
    if (this.running) return; this.running = true;
    try {
      const rows: AdCampaign[] = await this.store.request(`crm_ad_campaigns?state=eq.approved&scheduled_at=lte.${encodeURIComponent(new Date().toISOString())}&order=scheduled_at.asc&limit=5`);
      for (const row of rows) {
        try { await this.execute(row.id); }
        catch (error) { await this.store.request(`crm_ad_campaigns?id=eq.${row.id}&state=eq.approved`, 'PATCH', { state: 'blocked', last_error: adError(error) }).catch(() => {}); }
      }
    } catch { /* Storage outage: no external writes without a durable claim. */ }
    finally { this.running = false; }
  }
}
