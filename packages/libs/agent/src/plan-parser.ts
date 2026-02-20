/**
 * Plan Parser
 *
 * Extracts and tracks execution plans from LLM responses.
 * Supports both explicit [PLAN] blocks and implicit step detection.
 */

import type { PlanStep, AgentPlan } from './types.js';

/**
 * Default planning prompt to add to system prompt
 */
export const DEFAULT_PLANNING_PROMPT = `
Before taking any action, create a brief plan:

1. **Analyze** the request to understand what's needed
2. **Plan** the steps you'll take
3. **Execute** each step, updating progress as you go
4. **Verify** the result meets the requirements

Format your plan as:
[PLAN]
Goal: <one-line description>
Steps:
1. <step description> [tools: <tool1>, <tool2>]
2. <step description> [tools: <tool1>]
...
[/PLAN]

Mark completed steps with ✓ and failed steps with ✗.
`;

/**
 * Parse plan from LLM response
 *
 * Looks for [PLAN]...[/PLAN] blocks in the content.
 *
 * @example
 * ```typescript
 * const content = `
 * [PLAN]
 * Goal: Refactor the authentication module
 * Steps:
 * 1. Read current auth files [tools: read, glob]
 * 2. Update the login function [tools: edit]
 * 3. Run tests [tools: bash]
 * [/PLAN]
 * `;
 *
 * const plan = parsePlan(content);
 * // { goal: 'Refactor...', steps: [...] }
 * ```
 */
export function parsePlan(content: string): AgentPlan | null {
  // Match [PLAN]...[/PLAN] block
  const planMatch = content.match(/\[PLAN\]([\s\S]*?)\[\/PLAN\]/i);
  if (!planMatch) return null;

  const planContent = planMatch[1];

  // Extract goal
  const goalMatch = planContent.match(/Goal:\s*(.+)/i);
  const goal = goalMatch?.[1]?.trim() || 'Execute task';

  // Extract reasoning (optional)
  // Use [\s\S] instead of 's' flag for compatibility
  const reasoningMatch = planContent.match(/Reasoning:\s*([\s\S]+?)(?=Steps:|$)/i);
  const reasoning = reasoningMatch?.[1]?.trim();

  // Extract steps
  const steps: PlanStep[] = [];
  const stepsSection = planContent.match(/Steps:([\s\S]*?)$/i)?.[1] || planContent;

  // Match step patterns:
  // 1. Step description [tools: tool1, tool2]
  // - Step description [tools: tool1]
  const stepRegex = /(?:^|\n)\s*(?:(\d+)\.|[-•])\s+(.+?)(?:\[tools?:\s*([^\]]+)\])?(?=\n|$)/gi;

  let match;
  let stepNum = 1;
  while ((match = stepRegex.exec(stepsSection)) !== null) {
    const [, num, description, toolsStr] = match;
    const stepId = num ? `step-${num}` : `step-${stepNum}`;

    steps.push({
      id: stepId,
      description: description.trim(),
      status: 'pending',
      toolsToUse: toolsStr
        ?.split(',')
        .map(t => t.trim())
        .filter(Boolean),
    });
    stepNum++;
  }

  return steps.length > 0 ? { goal, steps, reasoning } : null;
}

/**
 * Step completion detection result
 */
export interface StepCompletion {
  stepId: string;
  status: 'completed' | 'failed' | 'skipped';
  result?: string;
}

/**
 * Detect step completion markers in content
 *
 * Recognizes various completion markers:
 * - ✓ Step 1 completed - description
 * - ✅ Step 1: result
 * - [DONE] Step 1
 * - [COMPLETE] Step 1
 * - ✗ Step 1 failed - error
 * - ❌ Step 1: error
 * - [FAILED] Step 1
 * - [SKIPPED] Step 1
 */
export function detectStepCompletion(content: string): StepCompletion[] {
  const completions: StepCompletion[] = [];

  // Match completed patterns
  const completedPatterns = [
    /(?:✓|✅|\[DONE\]|\[COMPLETE(?:D)?\])\s*[Ss]tep\s*(\d+)(?:\s*[-:]\s*(.+))?/gi,
    /[Ss]tep\s*(\d+)\s*(?:completed|done|finished)(?:\s*[-:]\s*(.+))?/gi,
  ];

  for (const regex of completedPatterns) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const [, stepNum, result] = match;
      const stepId = `step-${stepNum}`;

      // Avoid duplicates
      if (!completions.some(c => c.stepId === stepId)) {
        completions.push({
          stepId,
          status: 'completed',
          result: result?.trim(),
        });
      }
    }
  }

  // Match failed patterns
  const failedPatterns = [
    /(?:✗|❌|\[FAILED?\]|\[ERROR\])\s*[Ss]tep\s*(\d+)(?:\s*[-:]\s*(.+))?/gi,
    /[Ss]tep\s*(\d+)\s*(?:failed|error)(?:\s*[-:]\s*(.+))?/gi,
  ];

  for (const regex of failedPatterns) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const [, stepNum, result] = match;
      const stepId = `step-${stepNum}`;

      if (!completions.some(c => c.stepId === stepId)) {
        completions.push({
          stepId,
          status: 'failed',
          result: result?.trim(),
        });
      }
    }
  }

  // Match skipped patterns
  const skippedPattern = /(?:\[SKIPPED?\])\s*[Ss]tep\s*(\d+)(?:\s*[-:]\s*(.+))?/gi;
  let match;
  while ((match = skippedPattern.exec(content)) !== null) {
    const [, stepNum, result] = match;
    const stepId = `step-${stepNum}`;

    if (!completions.some(c => c.stepId === stepId)) {
      completions.push({
        stepId,
        status: 'skipped',
        result: result?.trim(),
      });
    }
  }

  return completions;
}

/**
 * Detect if content indicates a new step is starting
 */
export function detectStepStart(content: string): { stepId: string; description?: string } | null {
  // Match patterns like "Starting Step 1" or "Beginning step 2: description"
  const patterns = [
    /(?:starting|beginning|working on|executing)\s*[Ss]tep\s*(\d+)(?:\s*[-:]\s*(.+))?/i,
    /[Ss]tep\s*(\d+)\s*(?:in progress|started)(?:\s*[-:]\s*(.+))?/i,
    /\[(?:START|IN[- ]PROGRESS)\]\s*[Ss]tep\s*(\d+)(?:\s*[-:]\s*(.+))?/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return {
        stepId: `step-${match[1]}`,
        description: match[2]?.trim(),
      };
    }
  }

  return null;
}

/**
 * Instance for tracking plan state
 */
export interface PlanTrackerInstance {
  /** Current plan */
  getPlan(): AgentPlan | null;
  /** Set or update the plan */
  setPlan(plan: AgentPlan): void;
  /** Update step status based on content */
  processContent(content: string): {
    stepStarted?: string;
    stepsCompleted: StepCompletion[];
  };
  /** Get plan progress */
  getProgress(): { total: number; completed: number; failed: number; pending: number };
  /** Check if plan is complete */
  isComplete(): boolean;
}

/**
 * Create a plan tracker to manage plan state during execution
 */
export function createPlanTracker(): PlanTrackerInstance {
  let currentPlan: AgentPlan | null = null;

  return {
    getPlan() {
      return currentPlan;
    },

    setPlan(plan: AgentPlan) {
      currentPlan = plan;
    },

    processContent(content: string) {
      const result: ReturnType<PlanTrackerInstance['processContent']> = {
        stepsCompleted: [],
      };

      if (!currentPlan) {
        // Try to parse a new plan
        const parsed = parsePlan(content);
        if (parsed) {
          currentPlan = parsed;
        }
        return result;
      }

      // Check for step start
      const stepStart = detectStepStart(content);
      if (stepStart) {
        result.stepStarted = stepStart.stepId;
        const step = currentPlan.steps.find(s => s.id === stepStart.stepId);
        if (step && step.status === 'pending') {
          step.status = 'in_progress';
        }
      }

      // Check for step completions
      const completions = detectStepCompletion(content);
      for (const completion of completions) {
        const step = currentPlan.steps.find(s => s.id === completion.stepId);
        if (step) {
          step.status = completion.status;
          step.result = completion.result;
          if (completion.status === 'failed') {
            step.error = completion.result;
          }
        }
        result.stepsCompleted.push(completion);
      }

      return result;
    },

    getProgress() {
      if (!currentPlan) {
        return { total: 0, completed: 0, failed: 0, pending: 0 };
      }

      const total = currentPlan.steps.length;
      const completed = currentPlan.steps.filter(s => s.status === 'completed').length;
      const failed = currentPlan.steps.filter(s => s.status === 'failed').length;
      const pending = currentPlan.steps.filter(
        s => s.status === 'pending' || s.status === 'in_progress'
      ).length;

      return { total, completed, failed, pending };
    },

    isComplete() {
      if (!currentPlan) return false;
      return currentPlan.steps.every(
        s => s.status === 'completed' || s.status === 'failed' || s.status === 'skipped'
      );
    },
  };
}
