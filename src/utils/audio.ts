// Audio & Haptic Assistive Engine for Visually Impaired Users

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Synthesize pleasant sound cues without external MP3 files
export function playAssistiveTone(type: 'scan' | 'clear' | 'caution' | 'critical') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'scan') {
      // Gentle soft ping
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.12);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'clear') {
      // Pleasant harmonic double chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'caution') {
      // Amber alert tone
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.setValueAtTime(370, now + 0.12); // F#4
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);

      // Mild haptic buzz
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([80]);
      }
    } else if (type === 'critical') {
      // Urgent double beep
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(780, now);
      osc.frequency.setValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);

      // Urgent double vibration
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([150, 80, 150]);
      }
    }
  } catch (e) {
    // Ignore audio context autoplay limitations
  }
}

// Text-to-Speech Engine
class SpeechSynthesizer {
  private lastSpokenText: string = '';
  private lastSpokenTime: number = 0;
  private isMuted: boolean = false;
  private speechRate: number = 1.05; // Slightly faster for agile blind navigation
  private preferredVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.selectVoice();
      };
      this.selectVoice();
    }
  }

  private selectVoice() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    // Prioritize natural English voices
    const naturalVoice = voices.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Siri'))
    );
    this.preferredVoice = naturalVoice || voices.find((v) => v.lang.startsWith('en')) || null;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public getMuted() {
    return this.isMuted;
  }

  public setRate(rate: number) {
    this.speechRate = Math.max(0.7, Math.min(2.0, rate));
  }

  public getRate() {
    return this.speechRate;
  }

  public speak(text: string, priority: 'critical' | 'caution' | 'clear' = 'clear') {
    if (this.isMuted || !text || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    const now = Date.now();
    const cleanText = text.trim();

    // Spam suppression: Skip if same text spoken recently, unless critical
    const timeSinceLastSpoken = now - this.lastSpokenTime;
    if (priority !== 'critical' && cleanText === this.lastSpokenText && timeSinceLastSpoken < 4500) {
      return;
    }

    // Critical priority immediately cancels current speech
    if (priority === 'critical') {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = this.speechRate;
    utterance.pitch = priority === 'critical' ? 1.15 : 1.0;

    if (this.preferredVoice) {
      utterance.voice = this.preferredVoice;
    }

    utterance.onstart = () => {
      this.lastSpokenText = cleanText;
      this.lastSpokenTime = Date.now();
    };

    window.speechSynthesis.speak(utterance);
  }

  public stop() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const speechEngine = new SpeechSynthesizer();
