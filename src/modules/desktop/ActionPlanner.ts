/**
 * ActionPlanner - Multi-step desktop task decomposition and sequencing
 * ActionVerifier - Verifies execution outcomes before reporting success to Lucy
 * PermissionManager - Safety policies, deletion confirmations, and emergency stop
 */

export interface ActionPlanStep {
  id: string;
  tool: string;
  description: string;
  params: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export class ActionPlanner {
  constructor() {}

  public planMultiStepCommand(voiceCommand: string): ActionPlanStep[] {
    const cmd = voiceCommand.toLowerCase();
    const steps: ActionPlanStep[] = [];

    if (cmd.includes('youtube') && (cmd.includes('chalao') || cmd.includes('play') || cmd.includes('song'))) {
      steps.push({
        id: 'step-1',
        tool: 'youtube_open',
        description: 'Open YouTube and initialize playback engine',
        params: {},
        status: 'pending',
      });
      steps.push({
        id: 'step-2',
        tool: 'youtube_search_play',
        description: 'Search for song and initiate playback',
        params: { query: voiceCommand },
        status: 'pending',
      });
    } else if (cmd.includes('vscode') && (cmd.includes('file') || cmd.includes('python'))) {
      steps.push({
        id: 'step-1',
        tool: 'app_launch',
        description: 'Launch Visual Studio Code',
        params: { appName: 'VS Code' },
        status: 'pending',
      });
      steps.push({
        id: 'step-2',
        tool: 'create_code_file',
        description: 'Create Python file',
        params: { filename: 'script.py' },
        status: 'pending',
      });
    }

    return steps;
  }
}

export class ActionVerifier {
  constructor() {}

  public verify(result: { success: boolean; message: string }): { verified: boolean; message: string } {
    if (result.success) {
      return { verified: true, message: result.message };
    }
    return { verified: false, message: `Action could not be completed: ${result.message}` };
  }
}

export class PermissionManager {
  private isEmergencyStopped: boolean = false;

  constructor() {}

  public checkDangerousAction(actionName: string): boolean {
    const dangerous = ['delete_all', 'format_drive', 'kill_process', 'shutdown'];
    return dangerous.includes(actionName.toLowerCase());
  }

  public triggerEmergencyStop(): void {
    this.isEmergencyStopped = true;
    console.warn('[PermissionManager] EMERGENCY STOP TRIGGERED by user voice command');
  }

  public resetEmergencyStop(): void {
    this.isEmergencyStopped = false;
  }

  public isStopped(): boolean {
    return this.isEmergencyStopped;
  }
}

export const actionPlanner = new ActionPlanner();
export const actionVerifier = new ActionVerifier();
export const permissionManager = new PermissionManager();
