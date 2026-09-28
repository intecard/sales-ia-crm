import React, { useState } from 'react';
import {
  Settings,
  Building2,
  Users,
  Lock,
  QrCode,
  CheckCircle2,
  Key,
  ShieldCheck,
  RefreshCw,
  Sliders,
  Database,
  FileCheck,
} from 'lucide-react';
import { LicensePlan, OrganizationTenant, TenantLicense, UserProfile, UserRole } from '../types';

interface MultiTenantSettingsProps {
  organizations: OrganizationTenant[];
  currentOrg: OrganizationTenant;
  currentUser: UserProfile;
  licensePlans: LicensePlan[];
  tenantLicenses: TenantLicense[];
  onOrgChange: (org: OrganizationTenant) => void;
}

export const MultiTenantSettings: React.FC<MultiTenantSettingsProps> = ({
  organizations,
  currentOrg,
  currentUser,
  licensePlans,
  tenantLicenses,
  onOrgChange,
}) => {
  const [qrConnected, setQrConnected] = useState(true);
  const currentLicense = tenantLicenses.find((license) => license.organizationId === currentOrg.id);
  const currentPlan = licensePlans.find((plan) => plan.id === currentLicense?.planId);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-semibold mb-1">
            <Settings className="w-3.5 h-3.5 text-cyan-300" />
            <span>Multiempresa, Seguridad & Aislamiento de Datos</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            Configuración Multiempresa, Licencias & Permisos
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Administra empresas aisladas, planes de licencia, usuarios, roles, seguridad y
            conexiones comerciales configurables.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            Licencia activa de la empresa seleccionada
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-slate-500 uppercase font-bold text-[10px]">Plan</span>
              <p className="font-black text-white mt-1">{currentPlan?.name || 'Sin plan'}</p>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-slate-500 uppercase font-bold text-[10px]">Mensualidad</span>
              <p className="font-black text-emerald-400 mt-1">
                RD${(currentLicense?.monthlyAmount || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-slate-500 uppercase font-bold text-[10px]">Usuarios</span>
              <p className="font-black text-cyan-300 mt-1">
                {currentLicense?.seatsUsed || 0}/{currentLicense?.seatsLimit || 0}
              </p>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-slate-500 uppercase font-bold text-[10px]">Renovación</span>
              <p className="font-black text-amber-300 mt-1">
                {currentLicense?.renewalDate || 'Pendiente'}
              </p>
            </div>
          </div>
          {currentLicense?.isFreeForever && (
            <div className="mt-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-200">
              INTECA SRL queda configurada como cliente interno gratis permanente. Las demás
              empresas usan planes pagados.
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-cyan-400" />
            Aislamiento de datos
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-slate-400">Organización activa</span>
              <strong className="text-white">{currentOrg.name}</strong>
            </div>
            <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-slate-400">Usuario actual</span>
              <strong className="text-indigo-300">{currentUser.role}</strong>
            </div>
            <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl p-3">
              <span className="text-slate-400">Modo producción</span>
              <strong className="text-amber-300">Pendiente credenciales</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Multi-Tenant Institutions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-400" />
            Empresas / Clientes Registrados
          </h2>

          <div className="space-y-3">
            {organizations.map((org) => {
              const isSelected = org.id === currentOrg.id;

              return (
                <div
                  key={org.id}
                  onClick={() => onOrgChange(org)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-slate-950 border-blue-500 ring-1 ring-blue-500/50'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{org.logo}</span>
                    <div>
                      <h3 className="font-bold text-sm text-white">{org.name}</h3>
                      <span className="text-[10px] text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                        Plan base: {org.plan}
                      </span>
                    </div>
                  </div>

                  <div className="text-right text-xs text-slate-400">
                    <div>
                      Leads:{' '}
                      <strong className="text-white">
                        {org.activeLeadsCount.toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      Usuarios: <strong className="text-indigo-400">{org.activeUsers}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* WhatsApp QR Connection */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <QrCode className="w-4 h-4 text-emerald-400" />
            Estado de Canales e Integraciones
          </h2>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <span className="font-bold text-xs text-white">WhatsApp Business por empresa</span>
                <p className="text-[11px] text-slate-400">
                  QR/API configurable según credenciales reales del cliente
                </p>
              </div>
            </div>

            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold">
              ● {qrConnected ? 'Demo conectado' : 'Desconectado'}
            </span>
          </div>

          {/* Security details */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <span>Encriptación en Reposo:</span>
              <strong className="text-emerald-400">AES-256 Habilitado</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Autenticación de Dos Factores (MFA):</span>
              <strong className="text-emerald-400">Requerido Obligatorio</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Integraciones externas:</span>
              <strong className="text-amber-300">No configuradas / Sandbox</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Planes vendibles del CRM
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {licensePlans.map((plan) => (
            <div
              key={plan.id}
              className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-black text-white text-sm">{plan.name}</h3>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded border font-bold ${
                      plan.status === 'Vendible'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                    }`}
                  >
                    {plan.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">{plan.targetSegment}</p>
              </div>
              <div>
                <span className="text-2xl font-black text-emerald-400">
                  RD${plan.monthlyPrice.toLocaleString()}
                </span>
                <span className="text-slate-500 text-xs"> / mes</span>
              </div>
              <div className="space-y-1">
                {plan.features.slice(0, 4).map((feature) => (
                  <div key={feature} className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
