import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { sendJson } from "@/lib/client-api";
import { toast } from "sonner";
import { useCallback, useState } from "react";

export function SecurityToggleRow({
  icon,
  label,
  desc,
  defaultChecked,
  caution,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  defaultChecked: boolean;
  caution?: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);

  const handleSave = useCallback(async () => {
    const key = label.toLowerCase().includes("terminal")
      ? "terminal"
      : label.toLowerCase().includes("filesystem")
        ? "filesystem"
        : label.toLowerCase().includes("destructive")
          ? "approval"
          : "browser";
    try {
      await sendJson("/api/settings/security", "POST", { security: { [key]: checked } });
      toast.success(`${label} ${checked ? "enabled" : "disabled"}.`);
    } catch {
      toast.error("Failed to save.");
    }
  }, [checked, label]);

  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-[--bg-tertiary]/40 border border-[--border-primary] hover:border-[--border-hover] transition-all duration-200">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
            caution
              ? "bg-red-950/30 text-red-400"
              : "bg-[--bg-elevated] text-[--text-secondary]"
          )}
        >
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-[--text-primary]">{label}</p>
          <p className="text-[11px] text-[--text-muted]">{desc}</p>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={(v) => {
          setChecked(v);
          setTimeout(handleSave, 100);
        }}
        className={cn(
          "shrink-0",
          caution
            ? "data-[state=checked]:bg-rose-600"
            : "data-[state=checked]:bg-emerald-600"
        )}
      />
    </div>
  );
}
