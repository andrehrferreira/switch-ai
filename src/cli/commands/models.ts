import chalk from 'chalk';
import { fetchOpenRouterModels } from '../../registry/openrouter';
import { modelRegistry } from '../../registry/model-registry';
import type { Model, ModelTier } from '../../registry/model-registry';

function formatCost(cost: number): string {
  if (cost === 0) return chalk.green('free');
  return `$${cost.toFixed(4)}`;
}

function formatTier(tier: ModelTier): string {
  const colors: Record<ModelTier, (s: string) => string> = {
    free: chalk.green,
    cheap: chalk.cyan,
    balanced: chalk.yellow,
    premium: chalk.red,
  };
  return colors[tier](tier);
}

async function getModels(apiKey?: string): Promise<Model[]> {
  const models = await fetchOpenRouterModels(apiKey);
  modelRegistry.reload(models);
  return models;
}

export async function cmdModelsList(options: {
  tier?: string;
  category?: string;
  json?: boolean;
  key?: string;
} = {}): Promise<void> {
  let models = await getModels(options.key);

  if (options.tier) {
    models = models.filter((m) => m.tier === options.tier);
  }

  if (options.category) {
    models = models.filter((m) => m.categories.includes(options.category!));
  }

  if (options.json) {
    console.log(JSON.stringify(models, null, 2));
    return;
  }

  if (models.length === 0) {
    console.log(chalk.dim('No models found matching filters'));
    return;
  }

  console.log(chalk.bold(`\nAvailable Models (${models.length}):\n`));
  for (const m of models) {
    const cost = `in: ${formatCost(m.costPer1kTokens.input)}/1k  out: ${formatCost(m.costPer1kTokens.output)}/1k`;
    const cats = m.categories.slice(0, 3).join(', ');
    console.log(`  ${chalk.cyan(m.id.padEnd(45))} [${formatTier(m.tier)}]`);
    console.log(`    ${cost}   ${chalk.dim(cats)}`);
  }
}

export async function cmdModelsShow(id: string, apiKey?: string): Promise<void> {
  const models = await getModels(apiKey);
  const model = models.find((m) => m.id === id);

  if (!model) {
    console.error(chalk.red(`Model '${id}' not found`));
    process.exitCode = 1;
    return;
  }

  console.log(chalk.bold(`\n${model.name}`));
  console.log(`  ID:       ${chalk.cyan(model.id)}`);
  console.log(`  Tier:     ${formatTier(model.tier)}`);
  console.log(`  Provider: ${model.provider}`);
  console.log(`  Context:  ${model.contextWindow.toLocaleString()} tokens`);
  console.log(`  Input:    ${formatCost(model.costPer1kTokens.input)}/1k tokens`);
  console.log(`  Output:   ${formatCost(model.costPer1kTokens.output)}/1k tokens`);
  console.log(`  Categories: ${model.categories.join(', ')}`);
}

export async function cmdModelsSync(apiKey?: string): Promise<void> {
  console.log(chalk.dim('Fetching models from OpenRouter...'));
  const models = await fetchOpenRouterModels(apiKey);
  modelRegistry.reload(models);
  console.log(chalk.green(`✓ Synced ${models.length} models from OpenRouter`));
  console.log(chalk.dim(`  Cached to ~/.switch-ai/models.json`));
}
