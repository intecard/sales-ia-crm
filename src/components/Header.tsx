import React from 'react';
import {
  Sparkles,
  Building2,
  UserCheck,
  Monitor,
  Laptop,
  Smartphone,
  BookOpen,
  Sun,
  Moon,
  ShieldCheck,
  RefreshCw,
  Zap,
  Bot,
} from 'lucide-react';
import { PlatformMode, UserRole, OrganizationTenant, UserProfile } from '../types';

interface HeaderProps {
  currentOS?: 'windows' | 'mac' | 'linux' | 'android' | 'ios' | 'web' | PlatformMode;
  onOSChange?: (os: any) => void;
  currentPlatform?: PlatformMode;
  onPlatformChange?: (platform: PlatformMode) => void;
  currentOrg?: OrganizationTenant;
  organizations?: OrganizationTenant[];
  onOrgChange?: (org: OrganizationTenant) => void;
  currentUser?: UserProfile;
  onRoleChange?: (role: UserRole) => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
  onOpenManuals?: () => void;
  onOpenDocumentation?: () => void;
  isAiActive?: boolean;
  deploymentMode?: 'production' | 'trial';
}

export const Header: React.FC<HeaderProps> = ({
  currentOS,
  onOSChange,
  currentPlatform,
  onPlatformChange,
  currentOrg,
  organizations = [],
  onOrgChange,
  currentUser,
  onRoleChange,
  isDarkMode = true,
  onToggleTheme,
  onOpenManuals,
  onOpenDocumentation,
  isAiActive = true,
  deploymentMode = 'production',
}) => {
  const activePlatform = currentPlatform || currentOS || 'web';
  const isTrialMode = deploymentMode === 'trial';
  const handlePlatformChange = (p: any) => {
    if (onPlatformChange) onPlatformChange(p);
    else if (onOSChange) onOSChange(p);
  };
  const handleManuals = onOpenManuals || onOpenDocumentation || (() => {});
  const userRole = currentUser?.role || 'Admin';

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-slate-100 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-lg">
      {/* Brand & Organization Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-2 rounded-xl shadow-md shadow-indigo-500/20">
          <Bot className="w-6 h-6 text-white animate-pulse" />
          <div className="flex flex-col">
            <span className="font-extrabold text-base tracking-tight leading-none text-white">
              SALES <span className="text-cyan-300">AI CRM</span>
            </span>
            <span className="text-[10px] text-blue-200 font-medium tracking-wider uppercase">
              CRM Autónomo Enterprise
            </span>
          </div>
        </div>

        {/* Multi-Tenant Switcher */}
        {currentOrg && (
          <div className="hidden md:flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-slate-300">
            <Building2 className="w-3.5 h-3.5 text-cyan-400" />
            <select
              value={currentOrg.id}
              onChange={(e) => {
                const selected = organizations.find((o) => o.id === e.target.value);
                if (selected && onOrgChange) onOrgChange(selected);
              }}
              className="bg-transparent text-slate-100 font-medium focus:outline-none cursor-pointer pr-1"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id} className="bg-slate-900 text-slate-200">
                  {org.logo} {org.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Live AI Status Badge */}
        <div className="hidden lg:flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full px-2.5 py-1 text-[11px] font-semibold">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>IA Vendedora 24/7 Activa</span>
        </div>

        <div
          className={`hidden xl:flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border ${
            isTrialMode
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{isTrialMode ? 'Modo prueba' : 'Versión original'}</span>
        </div>
      </div>

      {/* Center: Environment / Platform Mode Simulator */}
      <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-lg p-1 text-xs">
        <span className="text-[10px] text-slate-400 uppercase font-semibold px-2 hidden xl:inline">
          Modo Entorno:
        </span>
        <button
          onClick={() => handlePlatformChange('web')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
            activePlatform === 'web'
              ? 'bg-blue-600 text-white font-medium shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
          title="Aplicación Web"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Web</span>
        </button>

        <button
          onClick={() => handlePlatformChange('windows')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
            activePlatform === 'windows' || activePlatform === 'mac' // or macos
              ? 'bg-blue-600 text-white font-medium shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
          title="Desktop App Windows (.exe)"
        >
          <Laptop className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">Windows</span>
        </button>

        <button
          onClick={() => handlePlatformChange('macos')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
            activePlatform === 'macos'
              ? 'bg-purple-600 text-white font-medium shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
          title="Desktop App macOS (.dmg)"
        >
          <Laptop className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden sm:inline">macOS</span>
        </button>

        <button
          onClick={() => handlePlatformChange('linux')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
            activePlatform === 'linux'
              ? 'bg-amber-600 text-white font-medium shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
          title="Desktop App Linux (.AppImage)"
        >
          <Laptop className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Linux</span>
        </button>

        <button
          onClick={() => handlePlatformChange('android')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
            activePlatform === 'android'
              ? 'bg-emerald-600 text-white font-medium shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
          title="App Móvil Android"
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Android</span>
        </button>

        <button
          onClick={() => handlePlatformChange('ios')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
            activePlatform === 'ios'
              ? 'bg-rose-600 text-white font-medium shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
          title="App Móvil iOS"
        >
          <Smartphone className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden sm:inline">iOS</span>
        </button>
      </div>

      {/* Right Controls: Role Switcher, Manuals, Theme */}
      <div className="flex items-center gap-2">
        {/* Role Selector */}
        <div className="flex items-center gap-1 bg-slate-800/80 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs">
          <UserCheck className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[10px] text-slate-400 hidden sm:inline">Rol:</span>
          <select
            value={userRole}
            onChange={(e) => onRoleChange && onRoleChange(e.target.value as UserRole)}
            className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer pr-1"
          >
            <option value="Admin" className="bg-slate-900 text-slate-200">
              Admin General
            </option>
            <option value="Supervisor" className="bg-slate-900 text-slate-200">
              Supervisor Comercial
            </option>
            <option value="Ventas" className="bg-slate-900 text-slate-200">
              Ejecutivo Ventas
            </option>
            <option value="Marketing" className="bg-slate-900 text-slate-200">
              Marketing Director
            </option>
            <option value="Call Center" className="bg-slate-900 text-slate-200">
              Call Center / Televentas
            </option>
            <option value="Docentes" className="bg-slate-900 text-slate-200">
              Coordinación Académica
            </option>
            <option value="Caja" className="bg-slate-900 text-slate-200">
              Caja y Cobranzas
            </option>
            <option value="Contabilidad" className="bg-slate-900 text-slate-200">
              Contabilidad & Facturas
            </option>
            <option value="Soporte" className="bg-slate-900 text-slate-200">
              Soporte Técnico
            </option>
          </select>
        </div>

        {/* Documentation & Manuals Modal Trigger */}
        <button
          onClick={handleManuals}
          className="flex items-center gap-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 hover:text-white px-2.5 py-1 rounded-lg text-xs font-medium transition-all shadow-sm"
          title="Manuales Técnicos, Guía de Usuario, Documentación API y UML"
        >
          <BookOpen className="w-3.5 h-3.5 text-indigo-300" />
          <span className="hidden lg:inline">Manuales & API</span>
        </button>

        {/* Theme Toggle */}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
            title={isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-200" />
            )}
          </button>
        )}
      </div>
    </header>
  );
};
