// Frontend upgrade using high-end-visual-design + design-design-system skills
// Double-Bezel (Doppelrand), Ethereal Glass vibe, Asymmetrical Bento layout
// Mobile collapse: below md (768px) single column w-full px-4 py-8

import React from 'react';

export const RegistrationCard: React.FC = () => (
  <section className="min-h-[100dvh] bg-[#050505] relative overflow-hidden">
    {/* Radial mesh gradient background */}
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      <div className="absolute top-[-10%] left-[20%] w-[50vw] h-[50vh] rounded-full bg-[rgba(120,90,240,0.15)] blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[10%] w-[40vw] h-[40vh] rounded-full bg-[rgba(200,100,240,0.1)] blur-[100px]" />
    </div>

    <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 py-24 md:py-40">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
        {/* Main form card — spans 8 cols on desktop */}
        <div className="md:col-span-8">
          <div className="rounded-[2rem] bg-white/[0.04] p-2 ring-1 ring-white/10 backdrop-blur-2xl">
            <div className="rounded-[calc(2rem-0.375rem)] bg-[#050505] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] p-8 md:p-12">
              <h2 className="font-sans text-3xl md:text-5xl font-bold text-white mb-2 tracking-tight">
                Sign Up
              </h2>
              <p className="text-white/60 mb-8">One-step transport solution for cities</p>
              <form className="space-y-5">
                <input
                  type="text"
                  placeholder="Vehicle Number"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
                  aria-label="Vehicle registration number"
                />
                <input
                  type="tel"
                  placeholder="Mobile Number"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
                  aria-label="Mobile phone number"
                />
                <button
                  type="submit"
                  className="group w-full rounded-full px-6 py-3 bg-white text-[#050505] font-semibold text-lg tracking-tight hover:scale-[0.98] active:scale-[0.98] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] shadow-[0_10px_25px_rgba(255,255,255,0.15)]"
                  aria-label="Submit registration"
                >
                  <span className="inline-flex items-center gap-2">
                    Continue
                    <span className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center group-hover:translate-x-1 group-hover:-translate-y-[1px] scale-105 transition-transform duration-300">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                    </span>
                  </span>
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Side info card — spans 4 cols on desktop */}
        <div className="md:col-span-4">
          <div className="rounded-[2rem] bg-white/[0.04] p-2 ring-1 ring-white/10 backdrop-blur-2xl h-full">
            <div className="rounded-[calc(2rem-0.375rem)] bg-[#050505]/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] p-6 md:p-8 h-full flex flex-col justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/40 font-medium mb-4">Secure</div>
                <h3 className="text-xl font-bold text-white mb-3">SHA-256 Protected</h3>
                <p className="text-sm text-white/50 leading-relaxed">Your data is encrypted end-to-end. We never store unencrypted credentials.</p>
              </div>
              <div className="mt-6 flex items-center gap-3 text-sm text-white/60">
                <span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" /></svg>
                </span>
                <span>Verified</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);
