import React from 'react';
import {
  LayoutDashboard,
  Users,
  Bot,
  MessageSquare,
  GraduationCap,
  GitMerge,
  Megaphone,
  Rocket,
  CreditCard,
  Calculator,
  FolderLock,
  BarChart3,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Zap,
  Workflow,
  Crown,
  WalletCards,
  ShoppingCart,
  Gauge,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'leads'
  | 'agents'
  | 'chat'
  | 'courses'
  | 'funnels'
  | 'marketing'
  | 'growth'
  | 'operations'
  | 'owner'
  | 'adsWallet'
  | 'procurement'
  | 'kpis'
  | 'payments'
  | 'accounting'
  | 'documents'
  | 'analytics'
  | 'audit'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  leadsCount: number;
  activeAgentsCount: number;
  pendingPaymentsCount: number;
  deploymentMode?: 'production' | 'trial';
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  leadsCount,
  activeAgentsCount,
  pendingPaymentsCount,
  deploymentMode = 'production',
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const isTrialMode = deploymentMode === 'trial';

  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Dashboard Executive',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'leads' as NavTab,
      label: 'Leads CRM 360°',
      icon: Users,
      badge: leadsCount > 0 ? `${leadsCount}` : null,
      badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    },
    {
      id: 'agents' as NavTab,
      label: 'Agentes IA Autónomos',
      icon: Bot,
      badge: `${activeAgentsCount} IA`,
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    },
    {
      id: 'chat' as NavTab,
      label: 'Chat Sales Studio',
      icon: MessageSquare,
      badge: 'En Vivo',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    },
    {
      id: 'courses' as NavTab,
      label: 'Productos / Servicios',
      icon: GraduationCap,
      badge: 'Catálogo',
    },
    {
      id: 'funnels' as NavTab,
      label: 'Embudos & Workflows',
      icon: GitMerge,
      badge: null,
    },
    {
      id: 'marketing' as NavTab,
      label: 'IA Marketing & Ads',
      icon: Megaphone,
      badge: 'Auto',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    {
      id: 'growth' as NavTab,
      label: 'Marketing, Ads & Ventas',
      icon: Rocket,
      badge: 'Growth',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    },
    {
      id: 'operations' as NavTab,
      label: 'Operación Autónoma',
      icon: Workflow,
      badge: '24/7',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    },
    {
      id: 'owner' as NavTab,
      label: 'Dueño & Licencias',
      icon: Crown,
      badge: 'Owner',
      badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    },
    {
      id: 'adsWallet' as NavTab,
      label: 'Tarjeta & Pauta IA',
      icon: WalletCards,
      badge: 'Ads',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    },
    {
      id: 'procurement' as NavTab,
      label: 'Compras IA',
      icon: ShoppingCart,
      badge: 'N/I',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    },
    {
      id: 'kpis' as NavTab,
      label: 'KPIs Empresa',
      icon: Gauge,
      badge: 'KPI',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    },
    {
      id: 'payments' as NavTab,
      label: 'Pasarelas & Facturación',
      icon: CreditCard,
      badge: pendingPaymentsCount > 0 ? `${pendingPaymentsCount}` : null,
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    },
    {
      id: 'accounting' as NavTab,
      label: 'Contabilidad Autónoma',
      icon: Calculator,
      badge: 'IA',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    },
    {
      id: 'documents' as NavTab,
      label: 'Bóveda de Documentos',
      icon: FolderLock,
      badge: null,
    },
    {
      id: 'analytics' as NavTab,
      label: 'Analítica Predictiva IA',
      icon: BarChart3,
      badge: 'ROI',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    },
    {
      id: 'audit' as NavTab,
      label: 'Auditoría & Historial',
      icon: History,
      badge: 'Log',
      badgeColor: 'bg-slate-700/60 text-slate-200 border-slate-600',
    },
    {
      id: 'settings' as NavTab,
      label: 'Multiempresa & Seguridad',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <aside
      className={`bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col transition-all duration-300 select-none ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Top Header Toggle */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <Sparkles
              className="w-4 h-4 text-cyan-400 animate-spin"
              style={{ animationDuration: '6s' }}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Menú Principal
            </span>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-100 rounded-lg transition-colors ml-auto"
          title={isCollapsed ? 'Expandir Menú' : 'Colapsar Menú'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon
                className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`}
              />
              {!isCollapsed && (
                <div className="flex-1 flex items-center justify-between truncate">
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        item.badgeColor || 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Footer Info */}
      {!isCollapsed && (
        <div className="p-3 border-t border-slate-800 text-[11px] bg-slate-950/50">
          <div className="flex items-center gap-2 text-emerald-400 font-medium mb-1">
            <Zap className="w-3.5 h-3.5" />
            <span>IA Comercial: {isTrialMode ? 'Prueba segura' : 'Producción activa'}</span>
          </div>
          <p className="text-slate-500 text-[10px]">
            SALES AI CRM • {isTrialMode ? 'Modo prueba' : 'Versión original'}
          </p>
        </div>
      )}
    </aside>
  );
};
