import React from 'react';
import { usePwa } from '../context/PwaContext';
import { X, Share, PlusSquare, MoreVertical, Download, Smartphone, CheckCircle, Sparkles } from 'lucide-react';

export default function PwaInstallModal() {
  const { showInstallModal, setShowInstallModal, isIOS, hasNativePrompt, triggerInstall } = usePwa();

  if (!showInstallModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-[#0e121b] border border-[rgba(245,196,81,0.3)] rounded-2xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] text-white space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={() => setShowInstallModal(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[#9b8f7c] hover:text-white hover:bg-[#1a2130] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl p-1 bg-[#141924] border border-[#ffd700]/30 shadow-[0_0_20px_rgba(245,196,81,0.25)] flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="EarnFlow App" className="w-full h-full object-cover rounded-lg" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-extrabold text-base sm:text-lg text-white">
                Install EarnFlow App
              </h3>
              <span className="text-[10px] font-mono-numbers px-1.5 py-0.5 rounded bg-[rgba(5,213,170,0.15)] text-[#05d5aa] border border-[#05d5aa]/30 font-bold">
                PWA
              </span>
            </div>
            <p className="text-xs text-[#9b8f7c]">
              Add to Home Screen for the full app experience
            </p>
          </div>
        </div>

        {/* Benefits list */}
        <div className="grid grid-cols-2 gap-2 py-1">
          <div className="flex items-center gap-1.5 text-[11px] text-[#cfcbd6] bg-[#141924]/80 px-2.5 py-1.5 rounded-lg border border-[#272a31]">
            <CheckCircle className="w-3.5 h-3.5 text-[#05d5aa] shrink-0" />
            <span>Full-Screen Mode</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#cfcbd6] bg-[#141924]/80 px-2.5 py-1.5 rounded-lg border border-[#272a31]">
            <CheckCircle className="w-3.5 h-3.5 text-[#05d5aa] shrink-0" />
            <span>Faster Instant Loads</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#cfcbd6] bg-[#141924]/80 px-2.5 py-1.5 rounded-lg border border-[#272a31]">
            <CheckCircle className="w-3.5 h-3.5 text-[#05d5aa] shrink-0" />
            <span>1-Tap USDT Access</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#cfcbd6] bg-[#141924]/80 px-2.5 py-1.5 rounded-lg border border-[#272a31]">
            <CheckCircle className="w-3.5 h-3.5 text-[#05d5aa] shrink-0" />
            <span>Live Draw Alerts</span>
          </div>
        </div>

        {/* Step-by-step guidance */}
        {isIOS ? (
          /* iOS Safari Guide */
          <div className="bg-[#121622] border border-[#272a31] rounded-xl p-3.5 space-y-3">
            <span className="text-[11px] font-bold text-[#f5c451] uppercase tracking-wider block">
              Instructions for Safari on iPhone / iPad:
            </span>
            <div className="space-y-2 text-xs text-[#cfcbd6]">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#f5c451]/20 text-[#f5c451] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  1
                </span>
                <p className="flex items-center gap-1 flex-wrap">
                  Tap the <strong className="text-white inline-flex items-center gap-1 bg-[#1a2130] px-1.5 py-0.5 rounded border border-[#333]"><Share className="w-3 h-3 text-[#38bdf8]" /> Share</strong> button in Safari's bottom toolbar.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#f5c451]/20 text-[#f5c451] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  2
                </span>
                <p className="flex items-center gap-1 flex-wrap">
                  Scroll down and tap <strong className="text-white inline-flex items-center gap-1 bg-[#1a2130] px-1.5 py-0.5 rounded border border-[#333]"><PlusSquare className="w-3 h-3 text-[#05d5aa]" /> Add to Home Screen</strong>.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#f5c451]/20 text-[#f5c451] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  3
                </span>
                <p>
                  Tap <strong className="text-white">Add</strong> at the top right corner. The app icon will appear on your screen!
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Android / Chrome Desktop / Edge Guide */
          <div className="bg-[#121622] border border-[#272a31] rounded-xl p-3.5 space-y-3">
            <span className="text-[11px] font-bold text-[#f5c451] uppercase tracking-wider block">
              Instructions for Google Chrome / Android:
            </span>
            <div className="space-y-2 text-xs text-[#cfcbd6]">
              {hasNativePrompt ? (
                <div className="p-2.5 rounded-lg bg-[#05d5aa]/10 border border-[#05d5aa]/30 text-[#05d5aa] text-center font-semibold">
                  Chrome is ready! Click the button below to install directly.
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#f5c451]/20 text-[#f5c451] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      1
                    </span>
                    <p className="flex items-center gap-1 flex-wrap">
                      Tap the <strong className="text-white inline-flex items-center gap-1 bg-[#1a2130] px-1.5 py-0.5 rounded border border-[#333]"><MoreVertical className="w-3 h-3 text-[#f5c451]" /> 3 Dots Menu</strong> in Chrome's top-right corner.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#f5c451]/20 text-[#f5c451] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      2
                    </span>
                    <p className="flex items-center gap-1 flex-wrap">
                      Select <strong className="text-white inline-flex items-center gap-1 bg-[#1a2130] px-1.5 py-0.5 rounded border border-[#333]"><Download className="w-3 h-3 text-[#05d5aa]" /> Install app</strong> or <strong className="text-white">Add to Home screen</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#f5c451]/20 text-[#f5c451] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      3
                    </span>
                    <p>
                      Tap <strong className="text-white">Install</strong> to confirm. EarnFlow will be added to your home screen!
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex gap-2 pt-1">
          {hasNativePrompt && (
            <button
              onClick={() => {
                triggerInstall();
              }}
              className="btn-gold flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#f5c451]/20"
            >
              <Download className="w-4 h-4" />
              <span>Install Now</span>
            </button>
          )}
          <button
            onClick={() => setShowInstallModal(false)}
            className="flex-1 py-2.5 rounded-xl bg-[#141924] hover:bg-[#1a2130] text-xs text-[#cfcbd6] hover:text-white border border-[#272a31] transition-colors cursor-pointer text-center font-medium"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
