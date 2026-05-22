import { Shield, Terminal, Save, Globe } from "lucide-react";
import { SecurityToggleRow } from "./security-toggle-row";

export function SecuritySettings() {
  return (
    <div className="agentos-card overflow-hidden">
      <div className="border-b border-[--border-primary] px-5 py-4">
        <h3 className="text-base font-semibold text-[--text-primary] flex items-center gap-2">
          <Shield className="w-4 h-4 text-[--accent-primary]" /> Runtime Safety Controls
        </h3>
        <p className="text-xs text-[--text-muted] mt-0.5">
          Configure authorization boundaries and agent permissions.
        </p>
      </div>
      <div className="p-5 space-y-3">
        <SecurityToggleRow
          icon={<Terminal className="w-4 h-4" />}
          label="Allow Terminal Execution"
          desc="Permits agents to run shell commands."
          defaultChecked={true}
        />
        <SecurityToggleRow
          icon={<Save className="w-4 h-4" />}
          label="Allow Filesystem Writes"
          desc="Enables file creation, editing, and deletion."
          defaultChecked={true}
        />
        <SecurityToggleRow
          icon={<Shield className="w-4 h-4" />}
          label="Require Approval for Destructive Actions"
          desc="Ask for confirmation before deleting files or running terminal commands."
          defaultChecked={true}
          caution
        />
        <SecurityToggleRow
          icon={<Globe className="w-4 h-4" />}
          label="Enable Browser Automation"
          desc="Allows Playwright web crawling and browser navigation."
          defaultChecked={false}
        />
      </div>
    </div>
  );
}
