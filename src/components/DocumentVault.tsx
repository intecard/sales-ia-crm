import React, { useState } from 'react';
import {
  FolderLock,
  FileText,
  Download,
  Upload,
  Search,
  CheckCircle2,
  Lock,
  HardDrive,
  FileCode,
  Mic,
  ShieldCheck
} from 'lucide-react';
import { LeadDocument, Lead } from '../types';

interface DocumentVaultProps {
  leads: Lead[];
}

export const DocumentVault: React.FC<DocumentVaultProps> = ({ leads }) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Collect all documents across leads
  const allDocuments: { doc: LeadDocument; leadName: string; leadEmail: string }[] = [];
  leads.forEach((l) => {
    l.documents.forEach((d) => {
      allDocuments.push({
        doc: d,
        leadName: `${l.firstName} ${l.lastName}`,
        leadEmail: l.email
      });
    });
  });

  const filteredDocs = allDocuments.filter((item) =>
    `${item.doc.title} ${item.leadName} ${item.doc.type}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-semibold mb-1">
            <FolderLock className="w-3.5 h-3.5 text-cyan-300" />
            <span>Bóveda Digital de Documentos & Encriptación AES-256</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Documentos, Contratos & Audios Organizados por Cliente</h1>
          <p className="text-xs text-slate-400 mt-1">
            Resguardo seguro de comprobantes, contratos de matrícula, certificados blockchain, audios de WhatsApp y fichas técnicas.
          </p>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar contrato, recibo, PDF..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Docs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.map((item, idx) => (
          <div
            key={idx}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between hover:border-indigo-500/50 transition-all space-y-3"
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] uppercase font-bold text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                  {item.doc.type}
                </span>
                <h3 className="font-bold text-xs text-white mt-1 truncate">{item.doc.title}</h3>
                <p className="text-[11px] text-slate-400">Cliente: <strong className="text-slate-200">{item.leadName}</strong></p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>Tamaño: {item.doc.fileSize}</span>
              <button
                onClick={() => alert(`Descargando ${item.doc.title}...`)}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar</span>
              </button>
            </div>
          </div>
        ))}

        {filteredDocs.length === 0 && (
          <div className="col-span-full p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl text-xs">
            No se encontraron documentos resguardados para esta búsqueda.
          </div>
        )}
      </div>
    </div>
  );
};
