import { Badge } from "@/components/ui/badge";
import type { RoleCapability } from "@/lib/runtime/types";

export function RoleCapabilityBadges({ role }: { role: RoleCapability }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {role.requires.map((cap) => (
        <Badge
          key={cap}
          variant="outline"
          className="text-[9px] bg-red-950/30 text-red-400 border-red-800/50 px-1.5 py-0 font-normal"
        >
          {cap}
        </Badge>
      ))}
      {role.preferred.map((cap) => (
        <Badge
          key={cap}
          variant="outline"
          className="text-[9px] bg-amber-950/20 text-[--accent-soft] border-[--border-secondary] px-1.5 py-0 font-normal"
        >
          {cap}*
        </Badge>
      ))}
    </div>
  );
}
