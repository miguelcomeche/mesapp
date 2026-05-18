import { useNavigate } from 'react-router-dom';
import { useSupportMode } from '@/contexts/SupportModeContext';
import { Button } from '@/components/ui/button';
import { ShieldAlert, LogOut } from 'lucide-react';

export function SupportBanner() {
  const { support, exitSupport } = useSupportMode();
  const navigate = useNavigate();
  if (!support) return null;

  const handleExit = async () => {
    await exitSupport();
    navigate('/admin/restaurants');
  };

  return (
    <div className="sticky top-0 z-50 bg-amber-500/95 text-amber-950 border-b border-amber-700 px-4 py-2 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ShieldAlert className="w-4 h-4 flex-shrink-0" />
        <span>Modo soporte plataforma — {support.restaurant_name}</span>
      </div>
      <Button size="sm" variant="outline" className="bg-white hover:bg-white/90 border-amber-700 text-amber-950" onClick={handleExit}>
        <LogOut className="w-3.5 h-3.5 mr-1.5" />
        Salir de soporte
      </Button>
    </div>
  );
}
