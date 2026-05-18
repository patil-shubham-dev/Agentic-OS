"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Brain,
  Code2,
  Palette,
  Workflow,
  Terminal,
  Zap,
  Shield,
  Globe,
  ArrowRight,
  Sparkles,
  MessageSquare,
  GitBranch,
  Bot,
  Database,
} from "lucide-react";
import Link from "next/link";

const features = [
  {
    icon: MessageSquare,
    title: "Multi-Model Chat",
    description: "Chat with Claude, GPT, Gemini, and more. Switch models mid-conversation.",
  },
  {
    icon: Code2,
    title: "AI-Powered Coding",
    description: "Write, edit, and test code with autonomous agents. Full terminal access.",
  },
  {
    icon: Palette,
    title: "Design Generation",
    description: "Generate UI components, design systems, and prototypes from prompts.",
  },
  {
    icon: Workflow,
    title: "Workflow Automation",
    description: "Build trigger-based automations with visual node editors.",
  },
  {
    icon: Bot,
    title: "Autonomous Agents",
    description: "Deploy specialist agents for research, coding, design, and QA.",
  },
  {
    icon: Database,
    title: "Knowledge Base",
    description: "Upload documents, code, and URLs for semantic search and RAG.",
  },
];

const providers = [
  "OpenAI", "Anthropic", "Google AI", "OpenRouter", "Groq", "Together AI", "Ollama", "DeepSeek"
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 agentos-gradient opacity-50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(14,165,233,0.1),transparent_50%)]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
              <Sparkles className="w-4 h-4" />
              Open Source AI Operating System
            </div>

            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-6">
              Your AI Team,
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-agentos-500 to-agentos-700">
                One Workspace
              </span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Combine Claude, Cursor, Figma, and Zapier into one unified platform.
              Chat, code, design, and automate with multiple AI agents.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/dashboard">
                <Button size="lg" className="gap-2 text-lg px-8">
                  Launch Studio <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="gap-2 text-lg px-8">
                <GitBranch className="w-5 h-5" /> View on GitHub
              </Button>
            </div>
          </motion.div>

          {/* Provider badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-16 flex flex-wrap justify-center gap-3"
          >
            {providers.map((provider) => (
              <span
                key={provider}
                className="px-4 py-2 rounded-full bg-muted text-muted-foreground text-sm font-medium border border-border"
              >
                {provider}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Everything You Need</h2>
            <p className="text-muted-foreground text-lg">
              A complete AI workspace with all the tools your team needs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="agentos-card p-6 group hover:border-primary/50 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Built for Scale</h2>
              <div className="space-y-6">
                {[
                  { icon: Shield, title: "Self-Hostable", desc: "Run on your own infrastructure with full data control" },
                  { icon: Globe, title: "Multi-Tenant", desc: "Organizations, projects, and role-based access control" },
                  { icon: Zap, title: "Horizontal Scaling", desc: "Celery workers and stateless API for infinite scale" },
                  { icon: Terminal, title: "Secure Sandboxing", desc: "Isolated execution environments for code and tools" },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="text-muted-foreground text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="agentos-card p-6 bg-card/50">
              <pre className="text-sm text-muted-foreground overflow-x-auto">
                <code>{`# Docker Compose deployment
docker-compose up -d

# Or Kubernetes
kubectl apply -f infra/kubernetes/

# BYOD - Bring Your Own Keys
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-...
export GROQ_API_KEY=gsk-...

# Start developing
pnpm dev`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Build?</h2>
          <p className="text-muted-foreground text-lg mb-8">
            Join the open-source community and start building with AI agents today.
          </p>
          <Link href="/dashboard">
            <Button size="lg" className="gap-2 text-lg px-8">
              <Brain className="w-5 h-5" /> Enter AgentOS Studio
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>AgentOS Studio — Open Source AI Operating System</p>
          <p className="mt-2">MIT License · Built with Next.js, FastAPI, and ❤️</p>
        </div>
      </footer>
    </div>
  );
}
