import React, { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Crown,
  KeyRound,
  PlusCircle,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  CompanyAdminProfile,
  CompanyStaffUser,
  LicensePlan,
  OrganizationTenant,
  PlatformOwnerControl,
  TenantLicense,
  UserRole,
} from '../types';

interface OwnerControlCenterProps {
  ownerControl: PlatformOwnerControl;
  organizations: OrganizationTenant[];
  tenantLicenses: TenantLicense[];
  licensePlans: LicensePlan[];
  companyAdmins: CompanyAdminProfile[];
  staffUsers: CompanyStaffUser[];
  onCreateCompanyAdmin: (organizationId: string, name: string, email: string) => void;
  onInviteStaffUser: (
    organizationId: string,
    adminId: string,
    name: string,
    email: string,
    role: UserRole,
    department: string,
  ) => void;
}

export const OwnerControlCenter: React.FC<OwnerControlCenterProps> = ({
  ownerControl,
  organizations,
  tenantLicenses,
  licensePlans,
  companyAdmins,
  staffUsers,
  onCreateCompanyAdmin,
  onInviteStaffUser,
}) => {
  const initialClientOrgId =
    organizations.find((organization) => {
      const license = tenantLicenses.find((item) => item.organizationId === organization.id);
      return !license?.isOpenLicense;
    })?.id ||
    organizations[0]?.id ||
    '';
  const [selectedOrgId, setSelectedOrgId] = useState(initialClientOrgId);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffDepartment, setStaffDepartment] = useState('Ventas');
  const [staffRole, setStaffRole] = useState<UserRole>('Ventas');

  const selectedOrg = organizations.find((organization) => organization.id === selectedOrgId);
  const selectedAdmin = companyAdmins.find((admin) => admin.organizationId === selectedOrgId);
  const clientOrganizations = organizations.filter((organization) => {
    const license = tenantLicenses.find((item) => item.organizationId === organization.id);
    return !license?.isOpenLicense;
  });
  const selectedLicense = tenantLicenses.find(
    (license) => license.organizationId === selectedOrgId,
  );
  const isSelectedOrgOpenLicense = Boolean(selectedLicense?.isOpenLicense);

  const licenseByOrg = useMemo(
    () =>
      organizations.map((organization) => {
        const license = tenantLicenses.find((item) => item.organizationId === organization.id);
        const plan = licensePlans.find((item) => item.id === license?.planId);
        const admin = companyAdmins.find((item) => item.organizationId === organization.id);
        const usersCount = staffUsers.filter(
          (item) => item.organizationId === organization.id,
        ).length;
        return { organization, license, plan, admin, usersCount };
      }),
    [companyAdmins, licensePlans, organizations, staffUsers, tenantLicenses],
  );

  const handleCreateAdmin = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedOrgId || !adminName.trim() || !adminEmail.trim()) return;
    onCreateCompanyAdmin(selectedOrgId, adminName.trim(), adminEmail.trim());
    setAdminName('');
    setAdminEmail('');
  };

  const handleInviteStaff = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedOrgId || !selectedAdmin || !staffName.trim() || !staffEmail.trim()) return;
    onInviteStaffUser(
      selectedOrgId,
      selectedAdmin.id,
      staffName.trim(),
      staffEmail.trim(),
      staffRole,
      staffDepartment.trim() || staffRole,
    );
    setStaffName('');
    setStaffEmail('');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-3 py-1 rounded-full text-xs font-semibold mb-1">
            <Crown className="w-3.5 h-3.5" />
            <span>Dueño único, licencias vendibles y admins por empresa</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Centro del Dueño & Licencias</h1>
          <p className="text-xs text-slate-400 mt-1">
            Tú controlas la plataforma, vendes licencias y creas empresas. Cada empresa puede tener
            su administrador, pero no puede otorgar licencias del CRM.
          </p>
        </div>
        <div className="bg-slate-950 border border-yellow-500/30 rounded-2xl p-4 min-w-[260px]">
          <span className="text-[10px] uppercase font-black text-yellow-300">Super Admin CRM</span>
          <p className="text-white font-black mt-1">{ownerControl.ownerName}</p>
          <p className="text-xs text-slate-400">{ownerControl.ownerEmail}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {[
          { label: 'Empresas registradas', value: organizations.length, icon: Building2 },
          {
            label: 'Licencias vendibles',
            value: tenantLicenses.filter((license) => !license.isOpenLicense).length,
            icon: KeyRound,
          },
          { label: 'Admins empresa', value: companyAdmins.length, icon: ShieldCheck },
          { label: 'Usuarios cargados', value: staffUsers.length, icon: Users },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <Icon className="w-5 h-5 text-cyan-300 mb-3" />
              <span className="text-[10px] uppercase font-black text-slate-500">{item.label}</span>
              <p className="text-3xl font-black text-white mt-1">{item.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 mb-4">
            <KeyRound className="w-4 h-4 text-yellow-300" />
            Empresas, licencias y autoridad
          </h2>
          <div className="space-y-3">
            {licenseByOrg.map(({ organization, license, plan, admin, usersCount }) => (
              <button
                type="button"
                key={organization.id}
                onClick={() => setSelectedOrgId(organization.id)}
                className={`w-full text-left bg-slate-950 border rounded-xl p-4 transition-all ${
                  selectedOrgId === organization.id
                    ? 'border-blue-500 ring-1 ring-blue-500/40'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-white">
                      {organization.logo} {organization.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {plan?.name || 'Sin plan'} ·{' '}
                      {license?.isOpenLicense
                        ? 'No administrable como cliente'
                        : license?.status || 'Sin licencia'}{' '}
                      · {usersCount} usuarios cargados
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-black px-2 py-1 rounded-full border ${
                      license?.isFreeForever
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                    }`}
                  >
                    {license?.isOpenLicense ? 'Abierta indefinida' : 'Vendible'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3 text-xs">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <span className="text-slate-500 uppercase font-bold text-[10px]">Monto</span>
                    <p className="text-emerald-300 font-black">
                      RD${(license?.monthlyAmount || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <span className="text-slate-500 uppercase font-bold text-[10px]">Seats</span>
                    <p className="text-white font-black">
                      {license?.isOpenLicense
                        ? 'Abierto'
                        : `${license?.seatsUsed || 0}/${license?.seatsLimit || 0}`}
                    </p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <span className="text-slate-500 uppercase font-bold text-[10px]">Gestión</span>
                    <p className="text-cyan-300 font-black">
                      {license?.isOpenLicense ? 'No aplica' : admin ? 'Creado' : 'Pendiente'}
                    </p>
                  </div>
                </div>
                {license?.isOpenLicense && (
                  <div className="mt-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-200">
                    INTECA tiene licencia abierta, indefinida y para siempre. Queda fuera de la
                    administración comercial de licencias vendibles.
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <form
            onSubmit={handleCreateAdmin}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4"
          >
            <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              Crear Admin Empresa
            </h2>
            <p className="text-xs text-slate-400">
              Este usuario administra su empresa, usuarios e integraciones. No puede vender ni
              otorgar licencias.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <select
                value={selectedOrgId}
                onChange={(event) => setSelectedOrgId(event.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                {clientOrganizations.map((organization) => (
                  <option key={organization.id} value={organization.id} className="bg-slate-900">
                    {organization.name}
                  </option>
                ))}
              </select>
              <input
                value={adminName}
                onChange={(event) => setAdminName(event.target.value)}
                placeholder="Nombre del administrador"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
              <input
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.target.value)}
                placeholder="Correo del administrador"
                type="email"
                className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={clientOrganizations.length === 0 || isSelectedOrgOpenLicense}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-black rounded-xl px-4 py-2 flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              Crear admin de empresa
            </button>
            {clientOrganizations.length === 0 && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-200">
                Solo está INTECA registrada. Como INTECA tiene licencia abierta indefinida, no se
                administra como cliente vendible. Cuando crees una empresa cliente, aquí podrás
                asignarle su Admin Empresa.
              </div>
            )}
          </form>

          <form
            onSubmit={handleInviteStaff}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4"
          >
            <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-cyan-300" />
              Cargar personal de la empresa
            </h2>
            <p className="text-xs text-slate-400">
              Lo puede hacer el Admin Empresa. El sistema guarda quién cargó cada usuario.
            </p>
            {!selectedAdmin && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200">
                {isSelectedOrgOpenLicense
                  ? 'INTECA no necesita administrador de licencia. Esta sección aplica a empresas cliente.'
                  : `Primero crea un Admin Empresa para ${selectedOrg?.name || 'esta empresa'}.`}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <input
                value={staffName}
                onChange={(event) => setStaffName(event.target.value)}
                placeholder="Nombre del colaborador"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <input
                value={staffEmail}
                onChange={(event) => setStaffEmail(event.target.value)}
                placeholder="Correo del colaborador"
                type="email"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <select
                value={staffRole}
                onChange={(event) => setStaffRole(event.target.value as UserRole)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              >
                {[
                  'Ventas',
                  'Marketing',
                  'Call Center',
                  'Caja',
                  'Contabilidad',
                  'Compras',
                  'Inventario',
                  'KPIs',
                  'Soporte',
                ].map((role) => (
                  <option key={role} value={role} className="bg-slate-900">
                    {role}
                  </option>
                ))}
              </select>
              <input
                value={staffDepartment}
                onChange={(event) => setStaffDepartment(event.target.value)}
                placeholder="Departamento"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button
              type="submit"
              disabled={!selectedAdmin || isSelectedOrgOpenLicense}
              className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-400 text-white text-sm font-black rounded-xl px-4 py-2"
            >
              Invitar usuario
            </button>
          </form>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 mb-4">
          <Crown className="w-4 h-4 text-yellow-300" />
          Política del dueño
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ownerControl.licensePolicy.map((policy) => (
            <div
              key={policy}
              className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-slate-300 leading-relaxed">{policy}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
