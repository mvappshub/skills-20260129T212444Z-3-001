// components/RiskBanner.tsx
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { RiskWarning } from '../hooks/useProactiveRiskCheck';

interface RiskBannerProps {
  warnings: RiskWarning[];
  onDismiss: (eventId: string) => void;
  onOpenChat: () => void;
}

export const RiskBanner: React.FC<RiskBannerProps> = ({
  warnings,
  onDismiss,
  onOpenChat
}) => {
  if (warnings.length === 0) return null;

  const dangerWarnings = warnings.filter(w => w.severity === 'danger');
  const hasDanger = dangerWarnings.length > 0;
  const firstWarning = hasDanger ? dangerWarnings[0] : warnings[0];

  return (
    <div className={`${hasDanger ? 'bg-red-600' : 'bg-amber-500'} text-white px-4 py-2`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">
              {hasDanger ? 'Kritická rizika' : 'Upozornění'} pro {warnings.length} {
                warnings.length === 1 ? 'plánovanou akci' :
                warnings.length < 5 ? 'plánované akce' : 'plánovaných akcí'
              }
            </span>
            <span className="hidden sm:inline opacity-90">
              - {firstWarning.eventTitle} ({format(firstWarning.eventDate, 'd.M.', { locale: cs })})
              {firstWarning.risks[0] && `: ${firstWarning.risks[0]}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenChat}
            className="text-sm px-3 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors whitespace-nowrap"
          >
            Zeptat se AI
          </button>
          <button
            onClick={() => onDismiss(firstWarning.eventId)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title="Zavřít"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
