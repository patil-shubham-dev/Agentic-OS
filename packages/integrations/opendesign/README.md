# Open Design Integration for AgentOS Studio

This package integrates [Open Design](https://github.com/nexu-io/open-design) into AgentOS Studio for AI-powered UI generation and design systems.

## Architecture

Open Design provides:
- **UI generation** from natural language prompts
- **Design system** creation and management
- **Component generation** with React/Vue/Svelte support
- **Screenshot-to-design** conversion
- **Design tokens** export (CSS, Tailwind, Figma)
- **Visual diff** for design reviews
- **Accessibility** checks and recommendations

## Integration Points

### 1. Design Engine (packages/design-engine/)

```typescript
// packages/design-engine/src/open-design-adapter.ts
import { OpenDesignAPI } from '@nexu-io/open-design';

export class OpenDesignAdapter {
  """Adapter between Open Design and AgentOS Studio."""

  private client: OpenDesignAPI;

  constructor(config: OpenDesignConfig) {
    this.client = new OpenDesignAPI({
      apiKey: config.apiKey,
      endpoint: config.endpoint || 'https://api.open-design.io',
    });
  }

  async generateComponent(prompt: string, options: GenerateOptions): Promise<DesignResult> {
    """Generate a UI component from natural language."""

    const result = await this.client.generate({
      prompt,
      framework: options.framework || 'react',
      styling: options.styling || 'tailwind',
      theme: options.theme || 'default',
      accessibility: options.accessibility !== false,
      responsive: options.responsive !== false,
    });

    return {
      id: result.id,
      code: result.code,
      preview: result.preview_url,
      tokens: result.design_tokens,
      components: result.sub_components,
      accessibility: result.a11y_report,
    };
  }

  async generateDesignSystem(name: string, brandColors: string[]): Promise<DesignSystem> {
    """Generate a complete design system."""

    const result = await this.client.designSystem({
      name,
      colors: brandColors,
      include: ['colors', 'typography', 'spacing', 'components', 'icons'],
    });

    return {
      id: result.id,
      name: result.name,
      tokens: result.tokens,
      components: result.components.map(c => ({
        name: c.name,
        code: c.code,
        preview: c.preview,
        props: c.props,
      })),
      css: result.css,
      tailwind: result.tailwind_config,
    };
  }

  async screenshotToDesign(image: File | string): Promise<DesignResult> {
    """Convert a screenshot/image to editable design."""

    const result = await this.client.vision({
      image: typeof image === 'string' ? image : await this.fileToBase64(image),
      output_format: 'react',
      extract_assets: true,
    });

    return {
      id: result.id,
      code: result.code,
      assets: result.assets,
      layers: result.layers,
    };
  }

  async exportToFigma(designId: string): Promise<string> {
    """Export design to Figma."""
    const result = await this.client.export({
      design_id: designId,
      format: 'figma',
    });
    return result.figma_url;
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }
}

interface DesignResult {
  id: string;
  code: string;
  preview?: string;
  tokens?: DesignTokens;
  components?: SubComponent[];
  accessibility?: A11yReport;
  assets?: Asset[];
  layers?: Layer[];
}

interface DesignSystem {
  id: string;
  name: string;
  tokens: DesignTokens;
  components: ComponentSpec[];
  css: string;
  tailwind: Record<string, any>;
}
```

### 2. Design Canvas (apps/web/src/components/design/)

```tsx
// apps/web/src/components/design/design-canvas.tsx
"use client";

import { useState, useCallback } from "react";
import { ReactFlow, Background, Controls, MiniMap, Node, Edge } from "@xyflow/react";
import { OpenDesignAdapter } from "@agentos/design-engine";

export function DesignCanvas() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [generating, setGenerating] = useState(false);

  const adapter = new OpenDesignAdapter({
    apiKey: process.env.NEXT_PUBLIC_OPEN_DESIGN_API_KEY,
  });

  const generateComponent = async (prompt: string) => {
    setGenerating(true);
    try {
      const result = await adapter.generateComponent(prompt, {
        framework: 'react',
        styling: 'tailwind',
      });

      // Add to canvas as a node
      const newNode: Node = {
        id: result.id,
        type: 'designComponent',
        position: { x: 100, y: 100 },
        data: {
          code: result.code,
          preview: result.preview,
          tokens: result.tokens,
        },
      };

      setNodes((prev) => [...prev, newNode]);
    } finally {
      setGenerating(false);
    }
  };

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();

      const file = event.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        const result = await adapter.screenshotToDesign(file);
        // Add converted design to canvas
      }
    },
    [adapter]
  );

  return (
    <div className="h-full flex">
      {/* Toolbar */}
      <div className="w-64 border-r bg-card p-4 space-y-4">
        <h3 className="font-semibold">Design Tools</h3>

        <div className="space-y-2">
          <Button 
            className="w-full gap-2"
            onClick={() => generateComponent("Create a modern card component with hover effects")}
            disabled={generating}
          >
            <Wand2 className="w-4 h-4" />
            {generating ? "Generating..." : "Generate Component"}
          </Button>

          <Button variant="outline" className="w-full gap-2">
            <Palette className="w-4 h-4" />
            Design System
          </Button>

          <div 
            className="border-2 border-dashed border-muted rounded-lg p-6 text-center text-sm text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer"
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <ImageIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            Drop screenshot to convert
          </div>
        </div>

        {selectedNode && (
          <div className="space-y-2">
            <Separator />
            <h4 className="font-medium text-sm">Properties</h4>
            <DesignProperties node={selectedNode} />
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={setNodes}
          onEdgesChange={setEdges}
          onNodeClick={(_, node) => setSelectedNode(node)}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      {/* Preview Panel */}
      {selectedNode && (
        <div className="w-96 border-l bg-card p-4">
          <h3 className="font-semibold mb-4">Preview</h3>
          <DesignPreview code={selectedNode.data.code} />

          <Separator className="my-4" />

          <h4 className="font-medium text-sm mb-2">Code</h4>
          <CodeBlock code={selectedNode.data.code} language="tsx" />

          <div className="flex gap-2 mt-4">
            <Button className="flex-1 gap-2">
              <Copy className="w-4 h-4" /> Copy Code
            </Button>
            <Button variant="outline" className="flex-1 gap-2">
              <Download className="w-4 h-4" /> Export
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 3. Design-to-Code Pipeline (packages/design-engine/src/pipeline/)

```typescript
// packages/design-engine/src/pipeline/design-to-code.ts
import { OpenDesignAdapter } from '../open-design-adapter';
import { OpenClaudeFileOperations } from '@agentos/integrations/openclaude';

export class DesignToCodePipeline {
  """Pipeline: Design generation -> Code -> File write -> Git commit."""

  private design: OpenDesignAdapter;
  private files: OpenClaudeFileOperations;

  constructor() {
    this.design = new OpenDesignAdapter({
      apiKey: process.env.OPEN_DESIGN_API_KEY,
    });
    this.files = new OpenClaudeFileOperations();
  }

  async run(prompt: string, targetPath: string): Promise<PipelineResult> {
    """Run the full design-to-code pipeline."""

    // Step 1: Generate design
    console.log('Step 1: Generating design...');
    const design = await this.design.generateComponent(prompt, {
      framework: 'react',
      styling: 'tailwind',
      accessibility: true,
    });

    // Step 2: Generate supporting files
    console.log('Step 2: Generating design tokens...');
    const tokens = await this.generateTokens(design.tokens);

    // Step 3: Write files
    console.log('Step 3: Writing files...');
    await this.files.writeFile(
      `${targetPath}/components/${design.id}.tsx`,
      design.code
    );
    await this.files.writeFile(
      `${targetPath}/styles/tokens.css`,
      tokens.css
    );

    // Step 4: Update imports
    console.log('Step 4: Updating imports...');
    await this.updateIndexFile(targetPath, design.id);

    // Step 5: Run tests
    console.log('Step 5: Running tests...');
    const testResult = await this.files.executeBash(
      `cd ${targetPath} && npm test -- ${design.id}`,
    );

    return {
      design,
      filesWritten: [
        `${targetPath}/components/${design.id}.tsx`,
        `${targetPath}/styles/tokens.css`,
      ],
      testResult,
      success: testResult.exitCode === 0,
    };
  }

  private async generateTokens(tokens: DesignTokens): Promise<{ css: string; tailwind: any }> {
    return {
      css: `
        :root {
          ${Object.entries(tokens.colors).map(([k, v]) => `--color-${k}: ${v};`).join('\n')}
          ${Object.entries(tokens.spacing).map(([k, v]) => `--spacing-${k}: ${v};`).join('\n')}
        }
      `,
      tailwind: {
        theme: {
          extend: {
            colors: tokens.colors,
            spacing: tokens.spacing,
          },
        },
      },
    };
  }

  private async updateIndexFile(targetPath: string, componentId: string) {
    const indexPath = `${targetPath}/components/index.ts`;
    const current = await this.files.readFile(indexPath);
    const newExport = `export { default as ${componentId} } from './${componentId}';\n`;
    await this.files.writeFile(indexPath, current + newExport);
  }
}

interface PipelineResult {
  design: DesignResult;
  filesWritten: string[];
  testResult: CommandResult;
  success: boolean;
}
```

### 4. Screenshot-to-Design (apps/web/src/components/design/)

```tsx
// apps/web/src/components/design/screenshot-converter.tsx
"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

export function ScreenshotConverter() {
  const [converting, setConverting] = useState(false);
  const [result, setResult] = useState<DesignResult | null>(null);

  const adapter = new OpenDesignAdapter({
    apiKey: process.env.NEXT_PUBLIC_OPEN_DESIGN_API_KEY,
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setConverting(true);
    try {
      const design = await adapter.screenshotToDesign(file);
      setResult(design);
    } finally {
      setConverting(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1,
  });

  return (
    <div className="space-y-6">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
          transition-colors
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted'}
        `}
      >
        <input {...getInputProps()} />
        <ImageIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg font-medium">
          {isDragActive ? 'Drop screenshot here' : 'Drag & drop a screenshot'}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          or click to select a file
        </p>
      </div>

      {converting && (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Converting to design...</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <h3 className="font-semibold">Generated Design</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Original</p>
              <img src={result.originalImage} className="rounded-lg border" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Generated</p>
              <div className="rounded-lg border p-4 bg-card">
                <DesignPreview code={result.code} />
              </div>
            </div>
          </div>

          <CodeBlock code={result.code} language="tsx" />

          <div className="flex gap-2">
            <Button className="gap-2">
              <Copy className="w-4 h-4" /> Copy Code
            </Button>
            <Button variant="outline" className="gap-2">
              <GitBranch className="w-4 h-4" /> Apply to Project
            </Button>
            <Button variant="outline" className="gap-2">
              <Figma className="w-4 h-4" /> Export to Figma
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

## Setup

### Install Open Design

```bash
# As npm package
npm install @nexu-io/open-design

# Or as git submodule
git submodule add https://github.com/nexu-io/open-design.git packages/integrations/opendesign/vendor
```

### Environment Variables

```env
# Open Design API
OPEN_DESIGN_API_KEY=od-...
OPEN_DESIGN_ENDPOINT=https://api.open-design.io

# Optional: Figma integration
FIGMA_ACCESS_TOKEN=figd-...
FIGMA_TEAM_ID=...

# Optional: Asset storage
ASSET_STORAGE_BUCKET=agentos-design-assets
ASSET_STORAGE_REGION=us-east-1
```

## Usage in AgentOS

```typescript
import { OpenDesignAdapter, DesignToCodePipeline } from '@agentos/design-engine';

// Initialize
const design = new OpenDesignAdapter({
  apiKey: process.env.OPEN_DESIGN_API_KEY,
});

// Generate component
const component = await design.generateComponent(
  "Create a pricing card with 3 tiers, toggle for monthly/yearly, and gradient CTA buttons",
  {
    framework: 'react',
    styling: 'tailwind',
    theme: 'dark',
  }
);

// Generate design system
const ds = await design.generateDesignSystem("AgentOS Brand", [
  "#0ea5e9", "#6366f1", "#8b5cf6"
]);

// Screenshot to design
const fromScreenshot = await design.screenshotToDesign(
  "https://example.com/landing-page.png"
);

// Full pipeline
const pipeline = new DesignToCodePipeline();
const result = await pipeline.run(
  "Create a dashboard sidebar with navigation, search, and user profile",
  "/workspace/my-app"
);
```
