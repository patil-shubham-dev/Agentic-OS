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
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { GlowingBorder, BentoCard } from "@/components/ui/animated-components";

const providers = [
  "OpenAI", "Anthropic", "Google AI", "OpenRouter", "Groq", "Together AI", "Ollama", "DeepSeek"
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 selection:bg-primary/30 font-sans overflow-hidden">
      
      {/* Background Mesh Gradient */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-primary/20 blur-[150px] rounded-full mix-blend-screen opacity-50" />
        <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-accent/20 blur-[150px] rounded-full mix-blend-screen opacity-50" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Navigation */}
        <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#020617]/50 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
              <Sparkles className="w-6 h-6 text-primary" />
              AgentOS
            </div>
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
              <Link href="#features" className="hover:text-white transition-colors">Features</Link>
              <Link href="#architecture" className="hover:text-white transition-colors">Architecture</Link>
              <Link href="#docs" className="hover:text-white transition-colors">Documentation</Link>
            </nav>
            <div className="flex items-center gap-4">
              <Link href="https://github.com/patil-shubham-dev/AgentOS-Studio" target="_blank" className="text-sm font-medium text-slate-300 hover:text-white hidden md:block">
                GitHub
              </Link>
              <Link href="/dashboard">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full px-6 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all">
                  Launch Studio
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1 pt-32 pb-24">
          <section className="relative max-w-7xl mx-auto px-6 pt-20 pb-32 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium mb-8 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                <Sparkles className="w-4 h-4 animate-pulse" />
                <span>Open Source AI Operating System v1.0</span>
              </div>

              <h1 className="text-6xl md:text-8xl font-bold tracking-tighter mb-8 leading-[1.1]">
                Your AI Team, <br className="hidden md:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-emerald-400 to-accent animate-gradient-x">
                  One Workspace
                </span>
              </h1>

              <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed font-light">
                Combine Claude, Cursor, Figma, and Zapier into one unified platform.
                Chat, code, design, and automate with specialized autonomous agents.
              </p>

              <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                <Link href="/dashboard">
                  <GlowingBorder className="p-1" containerClassName="w-full sm:w-auto">
                    <Button size="lg" className="h-14 px-8 text-lg font-semibold bg-[#020617] hover:bg-white/5 border-none w-full sm:w-auto group">
                      Enter Studio
                      <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </GlowingBorder>
                </Link>
                <Link href="https://github.com/patil-shubham-dev/AgentOS-Studio" target="_blank">
                  <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-semibold border-white/10 hover:bg-white/5 w-full sm:w-auto group">
                    <GitBranch className="mr-2 w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                    View on GitHub
                  </Button>
                </Link>
              </div>
            </motion.div>

            {/* Provider Badges Floating */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="mt-20 pt-10 border-t border-white/10"
            >
              <p className="text-sm font-medium text-slate-500 uppercase tracking-widest mb-8">
                Powered by leading frontier models
              </p>
              <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
                {providers.map((provider, i) => (
                  <motion.div
                    key={provider}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + i * 0.1 }}
                    className="px-5 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-slate-300 text-sm font-semibold backdrop-blur-md hover:bg-white/10 hover:border-primary/50 transition-colors cursor-default"
                  >
                    {provider}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </section>

          {/* Features Bento Grid */}
          <section id="features" className="py-32 relative">
            <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-20">
                <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Everything You Need</h2>
                <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                  A complete, self-hostable AI workspace equipped with specialized tools and agents.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <BentoCard
                  index={0}
                  title="Multi-Model Chat"
                  description="Switch effortlessly between Claude Opus, GPT-4o, Gemini 1.5, and local Llama 3 models in the same thread. Compare outputs side-by-side."
                  icon={MessageSquare}
                  className="lg:col-span-2 lg:row-span-2"
                >
                  <div className="relative h-full min-h-[200px] w-full rounded-xl border border-white/10 bg-[#0a0f1c] overflow-hidden mt-4">
                     <div className="absolute top-0 left-0 w-full h-8 bg-white/5 border-b border-white/10 flex items-center px-4 gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                     </div>
                     <div className="pt-12 px-6 pb-6 flex flex-col gap-4">
                        <div className="self-end bg-primary/20 text-primary-foreground border border-primary/30 px-4 py-2 rounded-2xl rounded-tr-sm text-sm max-w-[80%]">
                          Compare the performance of quicksort in Python vs Go.
                        </div>
                        <div className="self-start bg-white/5 border border-white/10 px-4 py-2 rounded-2xl rounded-tl-sm text-sm text-slate-300 max-w-[80%]">
                          <span className="text-xs text-primary font-semibold block mb-1">Claude 3.5 Sonnet</span>
                          Here's a detailed comparison of Quicksort implementations...
                        </div>
                     </div>
                  </div>
                </BentoCard>

                <BentoCard
                  index={1}
                  title="AI-Powered Coding"
                  description="Autonomous agents with full terminal and file system access. Let AI write, edit, and test your code securely."
                  icon={Code2}
                />

                <BentoCard
                  index={2}
                  title="Design Generation"
                  description="Transform prompts and screenshots into fully functional React + Tailwind components instantly."
                  icon={Palette}
                />

                <BentoCard
                  index={3}
                  title="Workflow Automation"
                  description="Build complex, multi-step agentic workflows with a visual node editor and cron scheduling."
                  icon={Workflow}
                  className="lg:col-span-2"
                />

                <BentoCard
                  index={4}
                  title="Knowledge Base (RAG)"
                  description="Upload massive codebases or documents for instant semantic retrieval and context injection."
                  icon={Database}
                />
              </div>
            </div>
          </section>

          {/* Architecture Section */}
          <section id="architecture" className="py-32 bg-white/[0.02] border-y border-white/5 relative overflow-hidden">
             <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1/3 h-[600px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
             
             <div className="max-w-7xl mx-auto px-6">
              <div className="grid lg:grid-cols-2 gap-16 items-center">
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                >
                  <h2 className="text-4xl md:text-5xl font-bold mb-8 tracking-tight">Built for Scale & Security</h2>
                  <div className="space-y-8">
                    {[
                      { icon: Shield, title: "100% Self-Hostable", desc: "Run entirely on your own infrastructure. Total data privacy and control." },
                      { icon: Globe, title: "Multi-Tenant Architecture", desc: "Support for isolated organizations, projects, and granular RBAC." },
                      { icon: Zap, title: "Infinite Scalability", desc: "Powered by Redis and Celery workers for heavy background processing." },
                      { icon: Terminal, title: "Secure Execution", desc: "Isolated Docker sandboxing prevents agents from damaging host systems." },
                    ].map((item, i) => (
                      <div key={item.title} className="flex gap-5 group">
                        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 group-hover:border-primary/30 transition-colors">
                          <item.icon className="w-6 h-6 text-slate-300 group-hover:text-primary transition-colors" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold mb-1 text-slate-100">{item.title}</h3>
                          <p className="text-slate-400 leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <GlowingBorder className="p-6 bg-[#0a0f1c]">
                    <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-4">
                      <Terminal className="w-5 h-5 text-slate-400" />
                      <span className="text-sm font-mono text-slate-400">deploy.sh</span>
                    </div>
                    <pre className="text-sm font-mono text-slate-300 overflow-x-auto leading-loose">
                      <span className="text-slate-500"># 1. Clone the repository</span><br/>
                      <span className="text-emerald-400">git</span> clone https://github.com/agentos/studio<br/><br/>
                      
                      <span className="text-slate-500"># 2. Configure your API keys (BYOK)</span><br/>
                      <span className="text-emerald-400">cp</span> .env.example .env<br/><br/>
                      
                      <span className="text-slate-500"># 3. Deploy via Docker Compose</span><br/>
                      <span className="text-emerald-400">docker-compose</span> up -d --build<br/><br/>

                      <span className="text-slate-500"># Or run locally with Turborepo</span><br/>
                      <span className="text-emerald-400">pnpm</span> install<br/>
                      <span className="text-emerald-400">pnpm</span> dev
                    </pre>
                  </GlowingBorder>
                </motion.div>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="py-32 relative text-center px-6">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-5xl font-bold mb-8 tracking-tight">Ready to Build the Future?</h2>
              <p className="text-2xl text-slate-400 mb-12 font-light max-w-2xl mx-auto leading-relaxed">
                Join the open-source community and start orchestrating AI agents in your own secure workspace today.
              </p>
              <Link href="/dashboard">
                <Button size="lg" className="h-16 px-10 text-xl font-bold rounded-full bg-white text-black hover:bg-slate-200 transition-colors shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)]">
                  <Brain className="mr-3 w-6 h-6" /> Start Building Free
                </Button>
              </Link>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/5 py-12 bg-[#020617]">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2 font-bold text-lg text-slate-300">
              <Sparkles className="w-5 h-5 text-primary" />
              AgentOS Studio
            </div>
            <p className="text-slate-500 text-sm">
              © 2026 AgentOS Open Source Contributors. MIT Licensed.
            </p>
            <div className="flex items-center gap-6 text-sm font-medium text-slate-500">
              <Link href="#" className="hover:text-white transition-colors">Twitter</Link>
              <Link href="https://github.com/patil-shubham-dev/AgentOS-Studio" target="_blank" className="hover:text-white transition-colors">GitHub</Link>
              <Link href="#" className="hover:text-white transition-colors">Discord</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
