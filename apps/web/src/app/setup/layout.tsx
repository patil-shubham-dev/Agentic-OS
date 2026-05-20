export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="agentos-shell min-h-screen w-full text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-12">{children}</div>
    </div>
  );
}
