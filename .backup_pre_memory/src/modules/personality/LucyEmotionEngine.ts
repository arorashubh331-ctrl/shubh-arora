/**
 * LucyEmotionEngine - Emotional ambiance, aura lighting, mood dynamics, and reaction variation
 * Helps Lucy maintain diverse, authentic emotional expressions rather than repeating the same reaction.
 */

import { AuraTheme } from '../../types/assistant';

export type LucyEmotionalTone = 'affectionate' | 'playful' | 'supportive' | 'excited' | 'serene' | 'witty';

export class LucyEmotionEngine {
  private currentAura: AuraTheme = 'sunset';
  private currentTone: LucyEmotionalTone = 'playful';
  private recentTones: LucyEmotionalTone[] = ['playful'];
  private onAuraChangeCallback: ((aura: AuraTheme) => void) | null = null;
  private onToneChangeCallback: ((tone: LucyEmotionalTone) => void) | null = null;

  constructor() {}

  public setOnAuraChange(cb: (aura: AuraTheme) => void) {
    this.onAuraChangeCallback = cb;
  }

  public setOnToneChange(cb: (tone: LucyEmotionalTone) => void) {
    this.onToneChangeCallback = cb;
  }

  public setAuraTheme(aura: AuraTheme) {
    this.currentAura = aura;
    this.onAuraChangeCallback?.(aura);
  }

  public getAuraTheme(): AuraTheme {
    return this.currentAura;
  }

  public setTone(tone: LucyEmotionalTone) {
    this.currentTone = tone;
    this.recentTones.unshift(tone);
    if (this.recentTones.length > 8) {
      this.recentTones.pop();
    }
    this.onToneChangeCallback?.(tone);
  }

  public getTone(): LucyEmotionalTone {
    return this.currentTone;
  }

  public getRecentTones(): LucyEmotionalTone[] {
    return [...this.recentTones];
  }

  /**
   * Suggests an complementary aura theme based on emotional tone
   */
  public getAuraForTone(tone: LucyEmotionalTone): AuraTheme {
    switch (tone) {
      case 'affectionate':
        return 'sunset';
      case 'playful':
      case 'witty':
        return 'cyberpunk';
      case 'excited':
        return 'aurora';
      case 'supportive':
        return 'crimson';
      case 'serene':
      default:
        return 'cosmic';
    }
  }
}

export const lucyEmotionEngine = new LucyEmotionEngine();
