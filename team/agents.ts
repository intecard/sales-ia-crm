import { MULTI_AGENTS_SPEC } from '../src/data/initialData.ts';
export const AREAS = [
  'Ventas',
  'Marketing',
  'Call Center',
  'Docentes',
  'Caja',
  'Contabilidad',
  'Compras',
  'Inventario',
  'KPIs',
  'Soporte',
] as const;
const areaById: Record<string, string> = {
  agent_voice_closer: 'Call Center',
  agent_community_manager: 'Marketing',
  agent_director: 'Ventas',
  agent_closer: 'Ventas',
  agent_conversion: 'Docentes',
  agent_whatsapp: 'Call Center',
  agent_copywriter: 'Marketing',
  agent_growth_master: 'Marketing',
  agent_media_buyer: 'Marketing',
  agent_funnel_architect: 'Marketing',
  agent_sdr: 'Ventas',
  agent_sales_elite: 'Ventas',
  agent_cro_analytics: 'KPIs',
  agent_recovery: 'Ventas',
  agent_omnichannel: 'Call Center',
  agent_creative: 'Marketing',
  agent_video: 'Marketing',
  agent_billing: 'Caja',
  agent_accounting: 'Contabilidad',
  agent_launch: 'Marketing',
  agent_owner_ops: 'Soporte',
  agent_procurement_national: 'Compras',
  agent_procurement_international: 'Compras',
};
export const TEAM_AGENTS = MULTI_AGENTS_SPEC.map((a) => ({
  id: a.id,
  name: a.name,
  title: a.roleTitle,
  area: areaById[a.id] || 'Soporte',
}));
export function allowedAgent(area: string, id: string) {
  const a = TEAM_AGENTS.find((a) => a.id === id);
  return Boolean(
    a && (area === 'owner' || a.area === area || (area === 'Inventario' && a.area === 'Compras')),
  );
}
