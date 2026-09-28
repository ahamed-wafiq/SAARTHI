// Audio & Haptic Assistive Engine for Visually Impaired Users
// Supports Sarvam AI Human Voice Model + Web Speech API fallback

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
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'clear') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (type === 'caution') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(370, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);

      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([80]);
      }
    } else if (type === 'critical') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.setValueAtTime(900, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);

      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([150, 70, 150]);
      }
    }
  } catch {
    // Ignore audio context autoplay limitations
  }
}

// Advanced Speech Synthesizer: Sarvam Human Voice with Web Speech fallback
class SpeechSynthesizer {
  private lastSpokenText: string = '';
  private lastSpokenTime: number = 0;
  private isMuted: boolean = false;
  private voiceModel: 'sarvam' | 'native' = 'sarvam';
  private speaker: string = 'shubh'; // Sarvam human speaker
  private languageCode: string = 'en-IN';
  private currentAudioElement: HTMLAudioElement | null = null;
  private audioCache = new Map<string, string>(); // In-memory cache of base64 audio
  private isGeneratingAudio: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Warm up audio unlock on first user touch/click
      const unlockAudio = () => {
        getAudioContext();
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
      };
      window.addEventListener('click', unlockAudio);
      window.addEventListener('touchstart', unlockAudio);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stop();
    }
  }

  public getMuted() {
    return this.isMuted;
  }

  public setVoiceModel(model: 'sarvam' | 'native') {
    this.voiceModel = model;
  }

  public getVoiceModel() {
    return this.voiceModel;
  }

  public setSpeaker(speaker: string) {
    this.speaker = speaker;
  }

  public getSpeaker() {
    return this.speaker;
  }

  public setLanguage(lang: string) {
    this.languageCode = lang;
  }

  public getLanguage() {
    return this.languageCode;
  }

  // Play browser fallback TTS
  private speakBrowserNative(text: string, priority: 'critical' | 'caution' | 'clear') {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (priority === 'critical') {
      window.speechSynthesis.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = priority === 'critical' ? 1.15 : 1.0;
    window.speechSynthesis.speak(utterance);
  }

  public async speak(text: string, priority: 'critical' | 'caution' | 'clear' = 'clear') {
    if (this.isMuted || !text) return;

    const now = Date.now();
    const cleanText = text.trim();

    // Anti-spam debounce: Don't repeat the identical phrase within 4.5 seconds unless critical
    const timeSinceLastSpoken = now - this.lastSpokenTime;
    if (priority !== 'critical' && cleanText === this.lastSpokenText && timeSinceLastSpoken < 4500) {
      return;
    }

    this.lastSpokenText = cleanText;
    this.lastSpokenTime = now;

    // Interrupt current playback if critical alert arrives
    if (priority === 'critical') {
      this.stop();
    }

    // Try Sarvam AI human voice first if selected
    if (this.voiceModel === 'sarvam') {
      try {
        const cacheKey = `${this.languageCode}_${this.speaker}_${cleanText}`;
        let base64Audio = this.audioCache.get(cacheKey);

        if (!base64Audio) {
          if (this.isGeneratingAudio && priority !== 'critical') {
            return;
          }
          this.isGeneratingAudio = true;

          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: cleanText,
              language_code: this.languageCode,
              speaker: this.speaker,
              pace: 1.05,
            }),
          });

          this.isGeneratingAudio = false;

          if (res.ok) {
            const data = await res.json();
            if (data.status === 'success' && typeof data.audio === 'string') {
              base64Audio = data.audio;
              // Cache up to 30 phrases
              if (this.audioCache.size > 30) {
                const firstKey = this.audioCache.keys().next().value;
                if (firstKey) this.audioCache.delete(firstKey);
              }
              this.audioCache.set(cacheKey, data.audio);
            }
          }
        }

        if (base64Audio) {
          if (this.currentAudioElement) {
            this.currentAudioElement.pause();
            this.currentAudioElement = null;
          }

          const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
          this.currentAudioElement = audio;
          await audio.play();
          return;
        }
      } catch (err) {
        console.warn('Sarvam TTS failed, falling back to native speech:', err);
      }
    }

    // Fallback to browser Web Speech API
    this.speakBrowserNative(cleanText, priority);
  }

  public stop() {
    if (this.currentAudioElement) {
      this.currentAudioElement.pause();
      this.currentAudioElement.currentTime = 0;
      this.currentAudioElement = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const speechEngine = new SpeechSynthesizer();
