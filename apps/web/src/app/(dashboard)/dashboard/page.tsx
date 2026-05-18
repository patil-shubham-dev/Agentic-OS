"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  MessageSquare,
  Bot,
  Workflow,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  AlertCircle,
  CheckCircle2,
  Zap,
  Brain,
  Terminal,
  Palette,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  FileText,
  GitBranch,
} from "lucide-react";

// Mock data
const usageData = [
  { name: "Mon", tokens: 12400, cost: 1.24 },
  { name: "Tue", tokens: 15600, cost: 1.56 },
  { name: "Wed", tokens: 18900, cost: 1.89 },
  { name: "Thu", tokens: 14200, cost: 1.42 },
  { name: "Fri", tokens: 22100, cost: 2.21 },
  { name: "Sat", tokens: 8900, cost: 0.89 },
  { name: "Sun", tokens: 10200, cost: 1.02 },
];

const costByProvider = [
  { name: "OpenAI", value: 45, color: "#10a37f" },
  { name: "Anthropic", value: 32, color: "#d97757" },
  { name: "Groq", value: 15, color: "#f55036" },
  { name: "Google", value: 8, color: "#4285f4" },
];

const modelLatency = [
  { name: "GPT-4o", latency: 420, success: 99.2 },
  { name: "Claude Opus", latency: 680, success: 98.8 },
  { name: "Llama 3.3", latency: 180, success: 99.5 },
  { name: "Gemini Pro", latency: 350, success: 99.1 },
  { name: "DeepSeek", latency: 520, success: 97.5 },
];

const recentActivities = [
  { id: 1, type: "chat", title: "Landing Page Design", model: "Claude Opus", tokens: 2847, time: "2 min ago", status: "success" },
  { id: 2, type: "agent", title: "Code Review Agent", model: "GPT-4o", tokens: 1523, time: "15 min ago", status: "success" },
  { id: 3, type: "automation", title: "Weekly Report", model: "Llama 3.3", tokens: 8900, time: "1 hr ago", status: "success" },
  { id: 4, type: "design", title: "Component Library", model: "Gemini Pro", tokens: 3421, time: "2 hrs ago", status: "warning" },
  { id: 5, type: "chat", title: "API Architecture", model: "Claude Sonnet", tokens: 5678, time: "3 hrs ago", status: "success" },
];

const automationStatus = [
  { name: "Landing Page Gen", status: "running", lastRun: "5 min ago", nextRun: "In 1 hr" },
  { name: "Competitor Research", status: "scheduled", lastRun: "Yesterday", nextRun: "In 2 hrs" },
  { name: "PR Review", status: "idle", lastRun: "2 hrs ago", nextRun: "On trigger" },
  { name: "Doc Sync", status: "error", lastRun: "Failed", nextRun: "Retrying" },
];

const stats = [
  { label: "Total Tokens", value: "102.3K", change: "+12%", trend: "up", icon: Zap },
  { label: "Total Cost", value: "$10.23", change: "+8%", trend: "up", icon: CreditCard },
  { label: "Active Agents", value: "7", change: "+2", trend: "up", icon: Bot },
  { label: "Success Rate", value: "98.7%", change: "+0.3%", trend: "up", icon: Activity },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your AI workspace</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Clock className="w-4 h-4 mr-2" />
            Last 7 Days
          </Button>
          <Button size="sm">
            <ArrowUpRight className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {stats.map((stat) => (
          <motion.div key={stat.label} variants={item}>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <stat.icon className="w-5 h-5 text-primary" />
                  </div>
                  <Badge
                    variant={stat.trend === "up" ? "default" : "destructive"}
                    className="gap-1"
                  >
                    {stat.trend === "up" ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {stat.change}
                  </Badge>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Usage Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Token Usage</CardTitle>
              <CardDescription>Daily token consumption over the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={usageData}>
                  <defs>
                    <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="tokens"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#colorTokens)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Cost by Provider */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Cost by Provider</CardTitle>
              <CardDescription>Distribution across LLM providers</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={costByProvider}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {costByProvider.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-4">
                {costByProvider.map((provider) => (
                  <div key={provider.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: provider.color }}
                      />
                      <span>{provider.name}</span>
                    </div>
                    <span className="font-medium">{provider.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Model Performance</CardTitle>
              <CardDescription>Latency and success rate by model</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={modelLatency} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="latency" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Automation Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Automation Status</CardTitle>
              <CardDescription>Active workflow automations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {automationStatus.map((auto) => (
                  <div
                    key={auto.name}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          auto.status === "running"
                            ? "bg-green-500 animate-pulse"
                            : auto.status === "scheduled"
                            ? "bg-blue-500"
                            : auto.status === "error"
                            ? "bg-destructive"
                            : "bg-muted-foreground"
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium">{auto.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Last: {auto.lastRun} · Next: {auto.nextRun}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        auto.status === "running"
                          ? "default"
                          : auto.status === "error"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {auto.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Recent Activity</CardTitle>
            <CardDescription>Latest conversations and agent runs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      {activity.type === "chat" && <MessageSquare className="w-4 h-4 text-primary" />}
                      {activity.type === "agent" && <Bot className="w-4 h-4 text-primary" />}
                      {activity.type === "automation" && <Workflow className="w-4 h-4 text-primary" />}
                      {activity.type === "design" && <Palette className="w-4 h-4 text-primary" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.model} · {activity.tokens.toLocaleString()} tokens
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{activity.time}</span>
                    {activity.status === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
