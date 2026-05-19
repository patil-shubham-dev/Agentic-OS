export interface DesignResult {
  id: string;
  code: string;
  preview?: string;
  tokens?: any;
  components?: any[];
  accessibility?: any;
  assets?: any[];
  layers?: any[];
}

export interface DesignSystem {
  id: string;
  name: string;
  tokens: any;
  components: any[];
  css: string;
  tailwind: Record<string, any>;
}

export class OpenDesignAdapter {
  constructor(private config: { apiKey?: string; endpoint?: string }) {}

  async generateComponent(prompt: string, options: any): Promise<DesignResult> {
    // Stub implementation
    return {
      id: "generated-id",
      code: `export default function Generated() { return <div>${prompt}</div> }`
    };
  }

  async screenshotToDesign(image: any): Promise<DesignResult> {
    return { id: "from-screenshot", code: "export default function Design() { return <div>Screenshot</div> }" };
  }
}
