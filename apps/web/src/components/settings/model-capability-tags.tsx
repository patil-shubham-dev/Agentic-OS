import { Badge } from "@/components/ui/badge";
import type { NormalizedModel } from "@/lib/runtime/types";

export function ModelCapabilityTags({ model }: { model: NormalizedModel }) {
  const tags: string[] = [];
  if (model.capabilities.includes("vision")) tags.push("Vision");
  if (model.capabilities.includes("tools")) tags.push("Tools");
  if (model.capabilities.includes("reasoning")) tags.push("Reasoning");
  if (model.capabilities.includes("code")) tags.push("Code");
  if (model.capabilities.includes("fast-inference")) tags.push("Fast");
  if (model.contextWindow >= 128000) tags.push("128K");
  else if (model.contextWindow >= 64000) tags.push("64K");
  else if (model.contextWindow >= 32000) tags.push("32K");

  return (
    <div className="flex gap-1 flex-wrap">
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant="outline"
          className="text-[8px] bg-[--bg-tertiary] text-[--text-muted] border-[--border-primary] px-1 py-0 font-normal"
        >
          {tag}
        </Badge>
      ))}
    </div>
  );
}
