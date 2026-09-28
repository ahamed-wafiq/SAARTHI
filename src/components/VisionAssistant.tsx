'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  Volume2,
  VolumeX,
  RefreshCw,
  Eye,
  FileText,
  Compass,
  Zap,
  Activity,
  Mic,
} from 'lucide-react';
import { VisionMode, VisionAnalysisResult } from '@/types/vision';
import { playAssistiveTone, speechEngine } from '@/utils/audio';
import { NavigationRadar } from '@/components/NavigationRadar';

export const VisionAssistant: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isAnalyzingRef = useRef<boolean>(false);

  // App State
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isAutoScan, setIsAutoScan] = useState<boolean>(true);
  const [mode, setMode] = useState<VisionMode>('navigation');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [voiceType, setVoiceType] = useState<'sarvam' | 'native'>('sarvam');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Vision Result State
  const [result, setResult] = useState<VisionAnalysisResult>({
    alertLevel: 'clear',
    spokenGuidance: 'Ready. Point your camera forward and tap Start.',
    hazards: [],
    sceneOverview: 'System initialized.',
    timestamp: Date.now(),
  });

  // Camera Stream Management
  const startCamera = async (facing: 'environment' | 'user' = facingMode) => {
    setErrorMsg(null);
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStreaming(true);

        const track = stream.getVideoTracks()[0];
        const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
        setHasTorch(Boolean(capabilities.torch));

        playAssistiveTone('scan');
        speechEngine.speak('Vision guide active.', 'clear');
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setErrorMsg('Camera access denied. Please grant camera permission.');
      speechEngine.speak('Camera access denied. Please grant permission in browser.', 'critical');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setIsAnalyzing(false);
    isAnalyzingRef.current = false;
    speechEngine.stop();
  };

  const toggleCameraFacing = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    if (isStreaming) {
      startCamera(nextFacing);
    }
  };

  const toggleTorch = async () => {
    if (!videoRef.current?.srcObject) return;
    try {
      const stream = videoRef.current.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      const nextTorch = !isTorchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setIsTorchOn(nextTorch);
    } catch (err) {
      console.error('Torch error:', err);
    }
  };

  // Frame Capture & Inference Loop with strict 5s AbortController
  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzingRef.current || !isStreaming) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    isAnalyzingRef.current = true;
    setIsAnalyzing(true);

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 6000); // 6s max timeout

    try {
      // Downscale frame for ultra-fast upload & token efficiency (540px width max)
      const scale = Math.min(1, 540 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const base64Data = canvas.toDataURL('image/jpeg', 0.70);

      playAssistiveTone('scan');

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Data,
          mode,
        }),
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      const json = await response.json();

      if (json.status === 'success' && json.data) {
        const data: VisionAnalysisResult = json.data;
        setResult(data);

        // Assistive sound cue according to hazard level
        playAssistiveTone(data.alertLevel);

        // Voice Readout with Sarvam Human Voice
        speechEngine.speak(data.spokenGuidance, data.alertLevel);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.warn('Vision request timed out, skipping to next frame.');
      } else {
        console.error('Frame analysis error:', err);
      }
    } finally {
      clearTimeout(timeoutId);
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  }, [isStreaming, mode]);

  // Continuous Auto-Scan Interval Loop
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isStreaming && isAutoScan) {
      timer = setInterval(() => {
        if (!isAnalyzingRef.current) {
          captureAndAnalyze();
        }
      }, 2000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isStreaming, isAutoScan, captureAndAnalyze]);

  // Voice Controls
  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    speechEngine.setMuted(nextMuted);
  };

  const toggleVoiceType = () => {
    const next = voiceType === 'sarvam' ? 'native' : 'sarvam';
    setVoiceType(next);
    speechEngine.setVoiceModel(next);
    speechEngine.speak(
      next === 'sarvam' ? 'Sarvam human voice enabled.' : 'Native device voice enabled.',
      'clear'
    );
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between p-3 max-w-md mx-auto w-full selection:bg-cyan-500 selection:text-black">
      {/* Top Header / Status Bar */}
      <header className="w-full flex items-center justify-between py-2 border-b border-zinc-800/80 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
          <h1 className="text-lg font-black tracking-wider text-white">
            SAARTHI <span className="text-cyan-400 text-xs font-bold">PRO</span>
          </h1>
        </div>

        {/* Header Controls: Voice Mode Toggle + Mute */}
        <div className="flex items-center gap-1.5">
          {/* Sarvam AI Human Voice Badge & Toggle */}
          <button
            onClick={toggleVoiceType}
            aria-label="Toggle Voice Engine"
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
              voiceType === 'sarvam'
                ? 'bg-cyan-950/70 border-cyan-500/80 text-cyan-300'
                : 'bg-zinc-900 border-zinc-700 text-zinc-400'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-cyan-400" />
            <span>{voiceType === 'sarvam' ? 'Sarvam AI' : 'Native TTS'}</span>
          </button>

          {/* Mute Audio Button */}
          <button
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            className={`p-2 rounded-xl border transition-colors ${
              isMuted
                ? 'bg-red-950/70 border-red-500 text-red-300'
                : 'bg-[#121216] border-zinc-800 text-zinc-300 hover:text-white'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full flex-1 flex flex-col gap-2.5 my-1">
        {/* Error Alert */}
        {errorMsg && (
          <div className="w-full p-3 rounded-xl bg-red-950/90 border border-red-600 text-red-200 text-xs font-bold flex items-center justify-between">
            <span>{errorMsg}</span>
            <button
              onClick={() => startCamera()}
              className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-xs"
            >
              Retry
            </button>
          </div>
        )}

        {/* Video Viewport / Viewfinder */}
        <div className="relative w-full aspect-[4/3] max-h-[38vh] bg-[#0a0a0d] rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          />
          {/* Hidden Canvas for Frame Sampling */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Initial Start Overlay */}
          {!isStreaming && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-4 text-center">
              <Eye className="w-12 h-12 text-cyan-400 mb-3 animate-pulse" />
              <h2 className="text-xl font-extrabold text-white mb-1">Assistive Vision</h2>
              <p className="text-zinc-400 text-xs mb-4 max-w-[260px]">
                Real-time obstacle avoidance with human voice guidance.
              </p>
              <button
                onClick={() => startCamera()}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-sm rounded-xl shadow-lg shadow-cyan-500/25 active:scale-95 transition-transform flex items-center gap-2"
              >
                <Camera className="w-4 h-4" />
                START CAMERA
              </button>
            </div>
          )}

          {/* In-Stream HUD Overlay */}
          {isStreaming && (
            <>
              {/* Top HUD: Mode & Status */}
              <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-1.5 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-zinc-800 text-[11px] font-semibold text-zinc-300">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isAnalyzing ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'
                    }`}
                  />
                  <span>{isAnalyzing ? 'Analyzing...' : 'Live'}</span>
                  {result.latencyMs && (
                    <span className="text-cyan-400 font-mono text-[10px]">
                      ({result.latencyMs}ms)
                    </span>
                  )}
                </div>

                <div className="bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-zinc-800 text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
                  {mode.replace('_', ' ')}
                </div>
              </div>

              {/* Viewport Floating Actions (Torch & Flip) */}
              <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2">
                {hasTorch && (
                  <button
                    onClick={toggleTorch}
                    aria-label="Toggle Flashlight"
                    className={`p-2.5 rounded-xl backdrop-blur-md border ${
                      isTorchOn
                        ? 'bg-yellow-400 text-black border-yellow-300'
                        : 'bg-black/80 text-white border-zinc-700'
                    }`}
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={toggleCameraFacing}
                  aria-label="Flip Camera"
                  className="p-2.5 rounded-xl bg-black/80 backdrop-blur-md border border-zinc-700 text-white active:rotate-180 transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Spatial Radar & Spoken Guidance (Refined for Phone Viewports) */}
        <NavigationRadar
          hazards={result.hazards}
          alertLevel={result.alertLevel}
          spokenGuidance={result.spokenGuidance}
        />

        {/* Scene Description / Detected OCR Text */}
        {(result.sceneOverview || result.detectedText) && (
          <div className="w-full p-3 rounded-2xl bg-[#0e0e12] border border-zinc-800/80 text-xs space-y-1.5">
            {result.sceneOverview && (
              <p className="text-zinc-300 leading-relaxed">
                <strong className="text-cyan-400 font-bold">Scene: </strong>
                {result.sceneOverview}
              </p>
            )}
            {result.detectedText && (
              <p className="text-yellow-200 bg-yellow-950/30 p-2 rounded-lg border border-yellow-700/40 font-mono text-[11px]">
                <strong className="text-yellow-400">Extracted Text: </strong>"
                {result.detectedText}"
              </p>
            )}
          </div>
        )}
      </main>

      {/* Bottom Sticky Control Bar */}
      <footer className="w-full bg-[#0a0a0d] border border-zinc-800/90 p-2.5 rounded-2xl shadow-2xl flex flex-col gap-2 mt-2">
        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-black p-1 rounded-xl border border-zinc-800/80">
          <button
            onClick={() => setMode('navigation')}
            className={`py-2 px-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${
              mode === 'navigation'
                ? 'bg-cyan-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5 shrink-0" />
            <span>Navigation</span>
          </button>
          <button
            onClick={() => setMode('reading')}
            className={`py-2 px-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${
              mode === 'reading'
                ? 'bg-cyan-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>Read Text</span>
          </button>
          <button
            onClick={() => setMode('full_scene')}
            className={`py-2 px-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${
              mode === 'full_scene'
                ? 'bg-cyan-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span>Describe</span>
          </button>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Tap-To-Inspect Button */}
          {isStreaming && (
            <button
              onClick={() => captureAndAnalyze()}
              disabled={isAnalyzing}
              aria-label="Inspect View Now"
              className="flex-1 py-3 px-3 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 text-white font-bold rounded-xl border border-zinc-700/80 flex items-center justify-center gap-1.5 text-xs shadow-md"
            >
              <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Inspect Now</span>
            </button>
          )}

          {/* Camera Start / Stop Button */}
          {isStreaming ? (
            <button
              onClick={stopCamera}
              className="flex-1 py-3 px-3 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl flex items-center justify-center gap-1.5 text-xs shadow-lg shadow-red-600/30 active:scale-95 transition-transform"
            >
              <CameraOff className="w-4 h-4 shrink-0" />
              <span>Pause Guide</span>
            </button>
          ) : (
            <button
              onClick={() => startCamera()}
              className="w-full py-3.5 px-4 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-cyan-500/25 active:scale-95 transition-transform"
            >
              <Camera className="w-5 h-5 shrink-0" />
              <span>Start Guide</span>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
