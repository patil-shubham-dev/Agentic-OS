"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import React from "react";

export function GlowingBorder({
  children,
  className,
  containerClassName,
}: {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
}) {
  return (
    <div className={cn("relative group p-[1px] rounded-3xl", containerClassName)}>
      <motion.div
        className="absolute inset-0 rounded-3xl bg-gradient-to-r from-agentos-400 via-primary to-accent opacity-30 group-hover:opacity-100 transition-opacity duration-1000 blur-xl"
        animate={{
          backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "linear",
        }}
        style={{
          backgroundSize: "200% 200%",
        }}
      />
      <div className={cn("relative bg-card rounded-3xl h-full border border-white/10", className)}>
        {children}
      </div>
    </div>
  );
}

export function BentoCard({
  title,
  description,
  icon: Icon,
  className,
  children,
  index,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  className?: string;
  children?: React.ReactNode;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
      whileHover={{ y: -5 }}
      className={cn(
        "group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition-all hover:bg-white/10 hover:shadow-2xl hover:shadow-primary/20",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative z-10 flex flex-col h-full">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 text-primary group-hover:scale-110 transition-transform duration-300">
          <Icon className="h-6 w-6" />
        </div>
        <h3 className="mb-2 text-xl font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
        <div className="mt-6 flex-1">
          {children}
        </div>
      </div>
    </motion.div>
  );
}
