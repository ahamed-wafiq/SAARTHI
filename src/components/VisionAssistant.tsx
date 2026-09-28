'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  Volume2,
  VolumeX,
  RefreshCw,
  Sun,
  Eye,
  FileText,
  Compass,
  Zap,
  Activity,
  Maximize2,
  Sliders,
} from 'lucide-react';
import { VisionMode, VisionAnalysisResult } from '@/types/vision';
import { playAssistiveTone, speechEngine } from '@/utils/audio';
import { NavigationRadar } from '@/components/NavigationRadar';

export const VisionAssistant: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // App State
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isAutoScan, setIsAutoScan] = useState<boolean>(true);
  const [mode, setMode] = useState<VisionMode>('navigation');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [highContrast, setHighContrast] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Vision Result State
  const [result, setResult] = useState<VisionAnalysisResult>({
    alertLevel: 'clear',
    spokenGuidance: 'Ready. Point your camera forward and press Start.',
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

        // Check if torch/flashlight is supported
        const track = stream.getVideoTracks()[0];
        const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
        setHasTorch(Boolean(capabilities.torch));

        playAssistiveTone('scan');
        speechEngine.speak('Vision guide active.', 'clear');
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setErrorMsg(
        'Unable to access camera. Please allow camera permissions in your browser.'
      );
      speechEngine.speak('Camera access denied. Please grant permission.', 'critical');
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

  // Frame Capture & Analysis
  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing || !isStreaming) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    setIsAnalyzing(true);

    try {
      // Downscale frame for ultra-fast upload & token efficiency (640px max width)
      const scale = Math.min(1, 640 / video.videoWidth);
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Export as compact JPEG
      const base64Data = canvas.toDataURL('image/jpeg', 0.72);

      // Play soft scan ping
      playAssistiveTone('scan');

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Data,
          mode,
        }),
      });

      const json = await response.json();

      if (json.status === 'success' && json.data) {
        const data: VisionAnalysisResult = json.data;
        setResult(data);

        // Assistive sound cue according to hazard level
        playAssistiveTone(data.alertLevel);

        // Voice Readout
        speechEngine.speak(data.spokenGuidance, data.alertLevel);
      } else {
        if (json.error) {
          console.warn('Analysis warning:', json.error);
        }
      }
    } catch (err) {
      console.error('Frame analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, isStreaming, mode]);

  // Continuous Auto-Scan Interval Loop
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isStreaming && isAutoScan) {
      // 1.8 seconds between scans - ideal for walking navigation while respecting rate limits
      timer = setInterval(() => {
        if (!isAnalyzing) {
          captureAndAnalyze();
        }
      }, 1900);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isStreaming, isAutoScan, isAnalyzing, captureAndAnalyze]);

  // Handle Mute Toggle
  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    speechEngine.setMuted(nextMuted);
  };

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-between p-3 sm:p-6 transition-colors duration-300 ${
        highContrast ? 'bg-black text-yellow-300' : 'bg-slate-950 text-slate-100'
      }`}
    >
      {/* Top Header / Status Bar */}
      <header className="w-full max-w-4xl flex items-center justify-between py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-cyan-400 animate-ping" />
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            SAARTHI <span className="text-cyan-400 text-sm font-semibold">VISION</span>
          </h1>
        </div>

        {/* Quick Utility Controls */}
        <div className="flex items-center gap-2">
          {/* High Contrast Mode for Low Vision */}
          <button
            onClick={() => setHighContrast(!highContrast)}
            aria-label="Toggle High Contrast Mode"
            className="p-2.5 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200"
          >
            <Sun className="w-5 h-5" />
          </button>

          {/* Mute / Unmute Voice */}
          <button
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute Voice Guidance' : 'Mute Voice Guidance'}
            className={`p-2.5 rounded-xl border transition-colors ${
              isMuted
                ? 'bg-red-950/60 border-red-500 text-red-300'
                : 'bg-zinc-900 border-zinc-700 text-emerald-300 hover:bg-zinc-800'
            }`}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Vision Interface */}
      <main className="w-full max-w-4xl flex-1 flex flex-col items-center justify-center my-4 gap-4">
        {/* Error Alert */}
        {errorMsg && (
          <div className="w-full p-4 rounded-xl bg-red-950 border-2 border-red-600 text-red-200 text-sm font-bold flex items-center justify-between">
            <span>{errorMsg}</span>
            <button
              onClick={() => startCamera()}
              className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs"
            >
              Retry
            </button>
          </div>
        )}

        {/* Video Viewport / Viewfinder */}
        <div className="relative w-full aspect-[4/3] sm:aspect-[16/9] max-h-[52vh] bg-zinc-950 rounded-3xl overflow-hidden border-2 border-zinc-800 shadow-2xl flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          />
          {/* Hidden Canvas for Frame Sampling */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Viewport Overlay Overlays */}
          {!isStreaming && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 p-6 text-center">
              <Eye className="w-16 h-16 text-cyan-400 mb-4 animate-bounce" />
              <h2 className="text-2xl font-bold mb-2">Live AI Assistive Guide</h2>
              <p className="text-zinc-400 max-w-md text-sm mb-6">
                Real-time obstacle avoidance, text reader, and spatial navigation powered by Groq LPU Vision.
              </p>
              <button
                onClick={() => startCamera()}
                className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-lg rounded-2xl shadow-lg shadow-cyan-500/30 transition-transform active:scale-95 flex items-center gap-3"
              >
                <Camera className="w-6 h-6" />
                START CAMERA GUIDE
              </button>
            </div>
          )}

          {/* Live Scanning HUD & Badges */}
          {isStreaming && (
            <>
              {/* Top HUD Stats */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-zinc-700 text-xs font-semibold text-zinc-300">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      isAnalyzing ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'
                    }`}
                  />
                  <span>{isAnalyzing ? 'Analyzing LPU...' : 'Live 1080p'}</span>
                  {result.latencyMs && (
                    <span className="text-cyan-400 ml-1">({result.latencyMs}ms)</span>
                  )}
                </div>

                <div className="bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-zinc-700 text-xs font-semibold text-zinc-300 uppercase">
                  Mode: {mode.replace('_', ' ')}
                </div>
              </div>

              {/* Floating Camera Actions (Torch & Flip) */}
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                {hasTorch && (
                  <button
                    onClick={toggleTorch}
                    aria-label="Toggle Flashlight"
                    className={`p-3 rounded-2xl backdrop-blur-md border ${
                      isTorchOn
                        ? 'bg-yellow-400 text-black border-yellow-300'
                        : 'bg-black/70 text-white border-zinc-700'
                    }`}
                  >
                    <Zap className="w-5 h-5" />
                  </button>
                )}

                <button
                  onClick={toggleCameraFacing}
                  aria-label="Flip Camera"
                  className="p-3 rounded-2xl bg-black/70 backdrop-blur-md border border-zinc-700 text-white hover:bg-black/90 active:rotate-180 transition-all"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Spatial Radar & Spoken Guidance Card */}
        <NavigationRadar
          hazards={result.hazards}
          alertLevel={result.alertLevel}
          spokenGuidance={result.spokenGuidance}
        />

        {/* Scene Overview or Detected OCR Text (if present) */}
        {(result.sceneOverview || result.detectedText) && (
          <div className="w-full p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-sm space-y-2">
            {result.sceneOverview && (
              <p className="text-zinc-300">
                <strong className="text-cyan-300">Scene:</strong> {result.sceneOverview}
              </p>
            )}
            {result.detectedText && (
              <p className="text-yellow-200 bg-yellow-950/40 p-2 rounded-lg border border-yellow-700/50">
                <strong className="text-yellow-400">Extracted Text:</strong> "{result.detectedText}"
              </p>
            )}
          </div>
        )}
      </main>

      {/* Bottom Sticky Control Bar */}
      <footer className="w-full max-w-4xl bg-zinc-900/90 border border-zinc-800 p-3 sm:p-4 rounded-3xl backdrop-blur-xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-2xl border border-zinc-800 w-full sm:w-auto justify-center">
          <button
            onClick={() => setMode('navigation')}
            className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all ${
              mode === 'navigation'
                ? 'bg-cyan-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4" />
            Navigation
          </button>
          <button
            onClick={() => setMode('reading')}
            className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all ${
              mode === 'reading'
                ? 'bg-cyan-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            Read Text
          </button>
          <button
            onClick={() => setMode('full_scene')}
            className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all ${
              mode === 'full_scene'
                ? 'bg-cyan-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Eye className="w-4 h-4" />
            Describe
          </button>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {/* Tap-To-Inspect Instant Trigger */}
          {isStreaming && (
            <button
              onClick={() => captureAndAnalyze()}
              disabled={isAnalyzing}
              aria-label="Inspect View Now"
              className="flex-1 sm:flex-initial px-4 py-3 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-white font-bold rounded-2xl border border-zinc-600 flex items-center justify-center gap-2 text-sm"
            >
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Inspect Now</span>
            </button>
          )}

          {/* Camera Start / Stop */}
          {isStreaming ? (
            <button
              onClick={stopCamera}
              className="flex-1 sm:flex-initial px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-red-600/30"
            >
              <CameraOff className="w-5 h-5" />
              <span>Pause Guide</span>
            </button>
          ) : (
            <button
              onClick={() => startCamera()}
              className="flex-1 sm:flex-initial px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold rounded-2xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-cyan-500/30"
            >
              <Camera className="w-5 h-5" />
              <span>Start Guide</span>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
