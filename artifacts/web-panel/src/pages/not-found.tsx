import { AlertCircle, ArrowLeft } from 'lucide-react';
import { PillButton, Reveal } from '@/components/ui/bezel';

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 relative overflow-hidden">
      <div className="noise-overlay" aria-hidden />
      <div className="absolute -top-32 right-0 w-96 h-96 rounded-full bg-[#8b5cf6]/12 blur-[120px] pointer-events-none" />
      <Reveal className="text-center max-w-sm">
        <div className="bezel mx-auto w-fit mb-8">
          <div className="bezel-inner w-20 h-20 flex items-center justify-center">
            <AlertCircle className="w-9 h-9 text-[#fbbf24]" strokeWidth={1.5} />
          </div>
        </div>
        <h1 className="text-5xl font-semibold tracking-tight text-foreground">404</h1>
        <p className="mt-3 text-lg font-medium text-foreground">Page Not Found</p>
        <p className="mt-2 text-sm text-muted-foreground">
          This node does not exist on the command surface.
        </p>
        <div className="mt-8">
          <PillButton
            href="/dashboard"
            icon={<ArrowLeft className="w-4 h-4" strokeWidth={1.8} />}
          >
            Return to Dashboard
          </PillButton>
        </div>
      </Reveal>
    </div>
  );
}
