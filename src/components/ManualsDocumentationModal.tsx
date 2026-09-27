import React, { useState } from 'react';
import {
  BookOpen,
  Code2,
  Terminal,
  FileText,
  Server,
  Layers,
  CheckCircle2,
  X,
  Copy,
  Check,
  Cpu,
  Database,
} from 'lucide-react';

interface ManualsDocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManualsDocumentationModal: React.FC<ManualsDocumentationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'tech' | 'user' | 'api' | 'uml' | 'deploy'>('tech');
  const [copiedSection, setCopiedSection] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Manuales, Arquitectura UML & Documentación API — INTECA Sales AI
              </h2>
              <p className="text-xs text-slate-400">
                Documentación técnica empresarial para desarrolladores y administradores.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-full cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-4 gap-2 text-xs overflow-x-auto">
          {[
            { id: 'tech', label: 'Manual Técnico' },
            { id: 'user', label: 'Manual de Usuario' },
            { id: 'api', label: 'Especificación API REST' },
            { id: 'uml', label: 'Diagramas UML & DB' },
            { id: 'deploy', label: 'Scripts Despliegue Desktop/Mobile' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2.5 px-3.5 font-semibold transition-all border-b-2 cursor-pointer ${
                activeTab === tab.id
                  ? 'border-blue-500 text-white font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 p-6 overflow-y-auto font-sans text-xs text-slate-300 leading-relaxed space-y-4">
          {activeTab === 'tech' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-cyan-300 uppercase">
                1. Arquitectura de Software & Clean Architecture
              </h3>
              <p>
                INTECA Sales AI está diseñado bajo principios de <strong>Clean Architecture</strong>
                , <strong>Domain-Driven Design (DDD)</strong> y <strong>SOLID</strong>. Se compone
                de un frontend desacoplado desarrollado en React 19, Tailwind CSS v4, Motion y un
                backend de alto rendimiento en Express / Node.js integrado con la SDK oficial de{' '}
                <code>@google/genai</code> para el modelo <code>gemini-3.6-flash</code>.
              </p>

              <h3 className="text-sm font-bold text-cyan-300 uppercase">
                2. Pila Tecnológica Elegida
              </h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Frontend:</strong> React 19, TypeScript 5.8, Tailwind CSS v4, Lucide
                  Icons, Motion.
                </li>
                <li>
                  <strong>Desktop Envoltura:</strong> Electron / Flutter wrapper para instaladores
                  Windows (.exe), macOS (.dmg) y Linux (.AppImage).
                </li>
                <li>
                  <strong>Mobile Sync:</strong> Capacitor / Flutter con sincronización en tiempo
                  real vía WebSockets.
                </li>
                <li>
                  <strong>Backend:</strong> Express.js con Vite middleware en desarrollo y bundle
                  compilado CJS con esbuild para producción.
                </li>
                <li>
                  <strong>Inteligencia Artificial:</strong> Google GenAI SDK con agente multi-rol
                  server-side.
                </li>
              </ul>
            </div>
          )}

          {activeTab === 'user' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-emerald-400 uppercase">
                Guía de Operación Autónoma
              </h3>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  <strong>Captura de Leads:</strong> Los leads ingresan automáticamente desde
                  WhatsApp, Meta Ads, TikTok, Google Search o carga de archivos CSV.
                </li>
                <li>
                  <strong>Calificación Predictiva:</strong> La IA evalúa la probabilidad de pago,
                  perfil DISC y asigna la mejor promoción.
                </li>
                <li>
                  <strong>Negociación y Cierre:</strong> Los agentes IA autónomos (Valeria, Don
                  Fernando, Mateo) conversan de forma persuasiva y emiten links de pago
                  instantáneos.
                </li>
                <li>
                  <strong>Cobro y Enrolamiento:</strong> Al completar el pago en Stripe o PayPal, el
                  sistema genera la factura PDF y otorga acceso al campus virtual inmediatamente.
                </li>
              </ol>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="space-y-4 font-mono text-[11px] bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="text-cyan-300 font-bold">POST /api/ai/chat-agent</div>
              <p className="text-slate-400">
                // Procesa diálogos persuasivos con el agente multi-rol
              </p>
              <pre className="bg-slate-900 p-2.5 rounded border border-slate-800 text-slate-200">
                {`{
  "agentRole": "Closer de Ventas",
  "leadName": "Alejandro Gómez",
  "courseTitle": "Diplomado en IA Aplicada a Negocios",
  "userMessage": "¿Tienen vacantes con beca?"
}`}
              </pre>

              <div className="text-emerald-400 font-bold pt-3">POST /api/ai/qualify-lead</div>
              <p className="text-slate-400">
                // Calificación predictiva y profiling DISC con JSON Schema
              </p>
            </div>
          )}

          {activeTab === 'uml' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-purple-300 uppercase">
                Diagrama de Entidad-Relación de Base de Datos
              </h3>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] space-y-2 text-slate-300">
                <div>
                  <strong>Lead 1:N ConversationMessage</strong> (Sincronización por canal)
                </div>
                <div>
                  <strong>Lead 1:N LeadDocument</strong> (Contratos, recibos, audios)
                </div>
                <div>
                  <strong>Course 1:N PaymentTransaction</strong> (Asociación de cobros)
                </div>
                <div>
                  <strong>OrganizationTenant 1:N Lead</strong> (Aislamiento de datos Multitenant)
                </div>
              </div>
            </div>
          )}

          {activeTab === 'deploy' && (
            <div className="space-y-4 font-mono text-[11px] bg-slate-950 p-4 rounded-xl border border-slate-800">
              <h3 className="text-sm font-bold text-amber-400 font-sans uppercase">
                Comandos de Compilación Native Desktop & Mobile
              </h3>
              <p className="text-slate-300 font-sans">
                Compilar instaladores para Windows, macOS, Linux y dispositivos móviles:
              </p>
              <pre className="bg-slate-900 p-3 rounded text-slate-200">
                {`# 1. Compilar aplicación Web para Producción
npm run build

# 2. Empaquetar Electron Desktop (Windows .exe, macOS .dmg, Linux .AppImage)
npx electron-builder --win --mac --linux

# 3. Compilar APK Android & iOS
npx cap build android
npx cap build ios`}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
