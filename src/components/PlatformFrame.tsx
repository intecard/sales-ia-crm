import React from 'react';
import { PlatformMode } from '../types';
import { Minus, Square, X, Wifi, Battery, Signal, Smartphone } from 'lucide-react';

interface PlatformFrameProps {
  platform: PlatformMode;
  children: React.ReactNode;
}

export const PlatformFrame: React.FC<PlatformFrameProps> = ({ platform, children }) => {
  if (platform === 'web') {
    return <div className="w-full min-h-screen flex flex-col">{children}</div>;
  }

  // Windows Desktop Frame
  if (platform === 'windows') {
    return (
      <div className="w-full min-h-screen bg-slate-950 p-2 sm:p-4 flex flex-col items-center justify-start">
        <div className="w-full max-w-[1700px] bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col min-h-[92vh]">
          {/* Windows Title Bar */}
          <div className="bg-slate-950 text-slate-300 px-3 py-1.5 flex items-center justify-between border-b border-slate-800 text-xs font-sans select-none">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-500 rounded-sm inline-block"></span>
              <span className="font-semibold text-slate-200">Sales AI CRM — Vista Windows</span>
            </div>
            <div className="flex items-center gap-4 text-slate-400">
              <span className="text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded">
                ● Sincronizado en Tiempo Real
              </span>
              <div className="flex items-center">
                <button className="px-2.5 py-1 hover:bg-slate-800 text-slate-300 transition-colors">
                  <Minus className="w-3 h-3" />
                </button>
                <button className="px-2.5 py-1 hover:bg-slate-800 text-slate-300 transition-colors">
                  <Square className="w-2.5 h-2.5" />
                </button>
                <button className="px-2.5 py-1 hover:bg-rose-600 hover:text-white text-slate-300 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 flex flex-col overflow-auto">{children}</div>
        </div>
      </div>
    );
  }

  // macOS Desktop Frame
  if (platform === 'macos') {
    return (
      <div className="w-full min-h-screen bg-slate-950 p-2 sm:p-4 flex flex-col items-center justify-start">
        <div className="w-full max-w-[1700px] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col min-h-[92vh]">
          {/* macOS Title Bar */}
          <div className="bg-slate-950/90 backdrop-blur text-slate-300 px-4 py-2 flex items-center justify-between border-b border-slate-800 text-xs select-none">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500 hover:bg-rose-600 cursor-pointer shadow-sm"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500 hover:bg-amber-600 cursor-pointer shadow-sm"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500 hover:bg-emerald-600 cursor-pointer shadow-sm"></div>
              <span className="ml-3 font-semibold text-slate-300 text-xs tracking-tight">
                Sales AI CRM — Vista macOS
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="bg-purple-950/80 border border-purple-800/80 text-purple-300 px-2 py-0.5 rounded-full font-medium">
                macOS Tahoe Native Sync
              </span>
            </div>
          </div>
          <div className="flex-1 flex flex-col overflow-auto">{children}</div>
        </div>
      </div>
    );
  }

  // Linux Desktop Frame
  if (platform === 'linux') {
    return (
      <div className="w-full min-h-screen bg-slate-950 p-2 sm:p-4 flex flex-col items-center justify-start">
        <div className="w-full max-w-[1700px] bg-slate-900 border border-slate-700/80 rounded-lg shadow-2xl overflow-hidden flex flex-col min-h-[92vh]">
          {/* Linux Title Bar */}
          <div className="bg-slate-950 text-slate-300 px-3 py-1.5 flex items-center justify-between border-b border-slate-800 text-xs font-mono select-none">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold">[SALES-AI-CRM]</span>
              <span className="text-slate-400">Vista Linux</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <button className="p-1 hover:bg-slate-800 rounded">
                <Minus className="w-3 h-3" />
              </button>
              <button className="p-1 hover:bg-slate-800 rounded">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="flex-1 flex flex-col overflow-auto">{children}</div>
        </div>
      </div>
    );
  }

  // Mobile App Frame (Android / iOS)
  return (
    <div className="w-full min-h-screen bg-slate-950 py-6 px-2 flex flex-col items-center justify-center">
      <div className="text-center mb-3">
        <div className="inline-flex items-center gap-2 bg-slate-800/80 border border-slate-700 text-slate-200 px-3 py-1 rounded-full text-xs">
          <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            Simulador Móvil {platform === 'android' ? 'Android (APK Native)' : 'iOS (App Store Native)'} — Sincronizado
          </span>
        </div>
      </div>

      {/* Phone Shell */}
      <div className="w-full max-w-[420px] h-[850px] bg-slate-900 border-[8px] border-slate-800 rounded-[48px] shadow-2xl overflow-hidden flex flex-col relative">
        {/* Phone Notch / Island */}
        <div className="bg-slate-950 text-slate-100 px-6 py-2 flex items-center justify-between text-[11px] font-semibold border-b border-slate-800 select-none z-50">
          <span>19:42</span>
          {platform === 'ios' ? (
            <div className="w-20 h-4 bg-black rounded-full mx-auto shadow-inner"></div>
          ) : (
            <div className="w-3 h-3 bg-black border border-slate-700 rounded-full mx-auto"></div>
          )}
          <div className="flex items-center gap-1.5 text-slate-300">
            <Signal className="w-3 h-3" />
            <Wifi className="w-3 h-3" />
            <Battery className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Mobile View Content Container */}
        <div className="flex-1 flex flex-col overflow-y-auto">{children}</div>

        {/* Phone Bottom Home Bar */}
        <div className="bg-slate-950 py-2 flex justify-center items-center border-t border-slate-800">
          <div className="w-32 h-1 bg-slate-600 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};
