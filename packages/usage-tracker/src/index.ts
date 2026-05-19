export interface UsageRecord {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export class UsageTracker {
  calculateCost(record: UsageRecord): number {
    return record.cost;
  }
}
