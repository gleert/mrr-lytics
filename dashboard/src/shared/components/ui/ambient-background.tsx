export function AmbientBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none transition-colors duration-500">
      {/* Light mode: Clean white/blue gradient */}
      {/* Dark mode: Deep space gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50 to-indigo-50 dark:from-[#0a0a0e] dark:via-[#0f0f14] dark:to-[#0a0a0e]" />
      
      {/* Blob 1 - Top left - Purple/Violet */}
      <div className="absolute top-[-20%] left-[-15%] w-[50vw] h-[50vw] rounded-full blur-[100px] bg-indigo-200/40 dark:bg-violet-600/15 animate-blob" />
      
      {/* Blob 2 - Top right - Blue */}
      <div className="absolute top-[-15%] right-[-10%] w-[45vw] h-[45vw] rounded-full blur-[100px] bg-blue-200/40 dark:bg-blue-700/15 animate-blob animation-delay-2000" />
      
      {/* Blob 3 - Bottom - Pink/Purple */}
      <div className="absolute bottom-[-20%] left-[15%] w-[50vw] h-[50vw] rounded-full blur-[100px] bg-purple-200/40 dark:bg-purple-700/15 animate-blob animation-delay-4000" />
      
      {/* Noise Texture - very subtle */}
      <div 
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />
    </div>
  )
}
