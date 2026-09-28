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
  FileCheck
} from 'lucide-react';
import { OrganizationTenant, UserProfile, UserRole } from '../types';

interface MultiTenantSettingsProps {
  organizations: OrganizationTenant[];
  currentOrg: OrganizationTenant;
  currentUser: UserProfile;
  onOrgChange: (org: OrganizationTenant) => void;
}

export const MultiTenantSettings: React.FC<MultiTenantSettingsProps> = ({
  organizations,
  currentOrg,
  currentUser,
  onOrgChange
}) => {
  const [qrConnected, setQrConnected] = useState(true);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-semibold mb-1">
            <Settings className="w-3.5 h-3.5 text-cyan-300" />
            <span>Multiempresa, Seguridad & Aislamiento de Datos</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Configuración Multitenant & Permisos por Rol (RBAC)</h1>
          <p className="text-xs text-slate-400 mt-1">
            Administra múltiples instituciones de forma completamente aislada, roles de usuario, encriptación AES-256 y conexión WhatsApp Web QR.
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Multi-Tenant Institutions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-400" />
            Instituciones & Sedes Registradas
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
                        Plan: {org.plan}
                      </span>
                    </div>
                  </div>

                  <div className="text-right text-xs text-slate-400">
                    <div>Leads: <strong className="text-white">{org.activeLeadsCount.toLocaleString()}</strong></div>
                    <div>Usuarios: <strong className="text-indigo-400">{org.activeUsers}</strong></div>
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
            Estado Conexión WhatsApp Business API / Web QR
          </h2>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <span className="font-bold text-xs text-white">Línea Oficial WhatsApp INTECA</span>
                <p className="text-[11px] text-slate-400">+52 55 9018 2026 (Verificado con Tilde Azul)</p>
              </div>
            </div>

            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold">
              ● Conectado
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
              <span>Cumplimiento Normativo Privacidad:</span>
              <strong className="text-cyan-300">Conforme con GDPR & Equivalentes</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
