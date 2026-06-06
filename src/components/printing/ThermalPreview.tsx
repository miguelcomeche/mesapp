import { TicketTemplate } from '@/types/tickets';
import { renderBlocks } from '@/lib/ticketRender';
import { mockContext } from '@/lib/ticketMockData';

// Approximate visual width for 80mm/58mm thermal paper in CSS pixels at 1x.
const WIDTH_PX: Record<number, number> = { 58: 220, 80: 300 };

export function ThermalPreview({ template, restaurantName }: { template: TicketTemplate; restaurantName?: string }) {
  const ctx = mockContext(template.kind, restaurantName);
  const w = WIDTH_PX[template.paper_width] ?? 300;
  return (
    <div className="flex justify-center">
      <div
        className="bg-white text-black shadow-md p-3"
        style={{ width: w, minHeight: 400 }}
      >
        {renderBlocks(template, ctx)}
      </div>
    </div>
  );
}