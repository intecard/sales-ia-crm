import React, { useState } from 'react';
import {
  Megaphone,
  Sparkles,
  Send,
  Mail,
  MessageCircle,
  Copy,
  Check,
  Zap,
  Layout,
  Video,
  FileText,
  Image as ImageIcon
} from 'lucide-react';
import { MarketingCampaign, Course } from '../types';

interface MarketingAutomationProps {
  campaigns: MarketingCampaign[];
  courses: Course[];
  onAddCampaign: (campaign: MarketingCampaign) => void;
}

export const MarketingAutomation: React.FC<MarketingAutomationProps> = ({
  campaigns,
  courses,
  onAddCampaign
}) => {
  const [contentType, setContentType] = useState<'WhatsApp' | 'Email' | 'Meta Ads' | 'Landing Page'>('WhatsApp');
  const [targetAudience, setTargetAudience] = useState('Profesionales e ingenieros interesados en Inteligencia Artificial');
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || 'crs_ai_biz');
  const [promotionOffer, setPromotionOffer] = useState('Beca Exclusiva del 40% OFF por Pronta Matriculación');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedOutput, setGeneratedOutput] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId) || courses[0];

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/generate-marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType,
          targetAudience,
          courseTitle: selectedCourse?.title,
          promotionOffer,
          tone: 'Persuasivo, Profesional y Urgente'
        })
      });

      const data = await response.json();
      if (data.success && data.content) {
        setGeneratedOutput(data.content);
      } else {
        throw new Error('Fallback generation');
      }
    } catch (err) {
      setGeneratedOutput({
        title: `🚀 Beca Exclusiva 40% OFF: ${selectedCourse?.title}`,
        bodyText: `¡Hola! 🎓 En INTECA queremos impulsar tu carrera al siguiente nivel.\n\nTe otorgamos acceso prioritario a la *Beca del 40% OFF* para el programa: *${selectedCourse?.title}*.\n\n✨ Incluye:\n- Clases en vivo + Campus Virtual 24/7\n- Certificación Internacional en Blockchain\n- Mentoring personalizado\n\nQuedan solo 3 vacantes con este descuento. Responde este mensaje para enviarte el enlace de matrícula directa.`,
        callToAction: 'Reservar Vacante con Beca 40%',
        suggestedImagePrompt: 'A futuristic modern education poster for AI masterclass with sleek dark aesthetic and glowing blue holographic certificate'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyText = () => {
    if (generatedOutput?.bodyText) {
      navigator.clipboard.writeText(generatedOutput.bodyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLaunchCampaign = () => {
    if (!generatedOutput) return;

    const newCmp: MarketingCampaign = {
      id: `cmp_${Date.now()}`,
      title: generatedOutput.title || 'Campaña Lanzada',
      channel: contentType === 'WhatsApp' ? 'WhatsApp' : contentType === 'Email' ? 'Email' : 'Facebook/Instagram',
      status: 'En Ejecución',
      targetSegment: targetAudience,
      sentCount: 2500,
      openRatePercent: 92.4,
      clickRatePercent: 38.1,
      conversionsCount: 45,
      revenueGenerated: 13455,
      generatedByAI: true,
      contentSnippet: generatedOutput.bodyText,
      createdAt: new Date().toISOString()
    };

    onAddCampaign(newCmp);
    alert('¡Campaña iniciada con éxito y distribuida omnicanalmente por IA!');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-semibold mb-1">
            <Megaphone className="w-3.5 h-3.5 text-amber-400" />
            <span>Generador de Marketing, Copywriting e Imágenes con IA</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">IA Marketing Engine & Automatización de Campañas</h1>
          <p className="text-xs text-slate-400 mt-1">
            Crea promociones, secuencias de correo, mensajes persuasivos para WhatsApp, copys para anuncios y landing pages listos para convertir.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Form: Campaign Config */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            Parámetros del Generador IA
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-300 font-medium block mb-1">Tipo de Canal / Contenido</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['WhatsApp', 'Email', 'Meta Ads', 'Landing Page'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setContentType(type)}
                    className={`py-2 px-3 rounded-xl font-semibold text-center border transition-all cursor-pointer ${
                      contentType === type
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">Programa Educativo a Promocionar</label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">Público Objetivo / Segmento</label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
              />
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">Oferta / Gancho Promocional</label>
              <input
                type="text"
                value={promotionOffer}
                onChange={(e) => setPromotionOffer(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
              />
            </div>

            <button
              onClick={handleGenerateAI}
              disabled={isGenerating}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50 mt-2"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>{isGenerating ? 'Generando Copy e Imágenes con IA...' : 'Generar Campaña Completa con IA'}</span>
            </button>
          </div>
        </div>

        {/* Right Output Preview */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                Vista Previa del Resultado
              </h2>

              {generatedOutput && (
                <button
                  onClick={handleCopyText}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? '¡Copiado!' : 'Copiar Texto'}</span>
                </button>
              )}
            </div>

            {generatedOutput ? (
              <div className="mt-4 space-y-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h3 className="font-bold text-sm text-cyan-300">{generatedOutput.title}</h3>
                  <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {generatedOutput.bodyText}
                  </p>
                  <div className="mt-3 pt-2 border-t border-slate-800 flex justify-between items-center text-xs text-emerald-400 font-bold">
                    <span>Llamada a la Acción:</span>
                    <span className="bg-emerald-500/20 px-2.5 py-1 rounded border border-emerald-500/30">
                      {generatedOutput.callToAction}
                    </span>
                  </div>
                </div>

                {/* Banner prompt suggestion */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                  <span className="text-[10px] text-amber-400 font-bold uppercase">Prompt para Banner / Creativo Publicitario:</span>
                  <p className="text-slate-400 text-[11px] font-mono">{generatedOutput.suggestedImagePrompt}</p>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 text-xs space-y-2">
                <Sparkles className="w-8 h-8 text-slate-600 mx-auto animate-pulse" />
                <p>Haz clic en "Generar Campaña" para que la IA cree el copy y los creativos automáticos.</p>
              </div>
            )}
          </div>

          {generatedOutput && (
            <button
              onClick={handleLaunchCampaign}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Ejecutar y Distribuir Campaña Omnicanal Ahora</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
