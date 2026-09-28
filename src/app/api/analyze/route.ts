import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { VisionAnalysisResult, VisionMode } from '@/types/vision';

// Initialize Groq client with environment variable
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

const NAVIGATION_SYSTEM_PROMPT = `You are SAARTHI, an ultra-fast, intelligent assistive vision navigator for visually impaired and low-vision individuals.
Analyze the user's camera feed with extreme priority on SAFETY and NAVIGATION.

Respond ONLY with valid, unescaped JSON matching this exact structure:
{
  "alertLevel": "clear" | "caution" | "critical",
  "spokenGuidance": "Short, clear, direct guidance under 15 words to be spoken aloud via text-to-speech. Example: 'Clear path ahead' or 'Watch out, chair directly in front' or 'Stop, stairs going down 2 steps ahead'",
  "hazards": [
    {
      "name": "Object name (e.g. Chair, Stairs, Curb, Person, Door, Pole, Vehicle, Wet Floor)",
      "direction": "left" | "center" | "right",
      "distance": "immediate" | "near" | "medium" | "far",
      "actionGuidance": "Step left / Stop / Continue straight / Step up"
    }
  ],
  "sceneOverview": "1-2 sentence high-level description of where the user is (e.g. Narrow office hallway, tile floor, clear exit straight ahead)",
  "detectedText": "Any prominent signs, room numbers, or text seen in the image, or empty string"
}

CRITICAL RULES:
1. Alert Levels:
   - "critical": Hazard within immediate reach (<1.5 meters) in front/center, stairs/drop-offs, low hanging obstacles, approaching vehicles.
   - "caution": Obstacle nearby (1.5 - 3 meters) or on left/right that requires eventual maneuvering.
   - "clear": Safe walking corridor directly ahead.
2. Spoken guidance MUST be concise, calm, actionable, and directional. Blind users rely on instant, punchy cues.
3. Do NOT include markdown blocks (\`\`\`json) or extra commentary. Return only the raw JSON string.`;

const READING_SYSTEM_PROMPT = `You are SAARTHI OCR Reader, an assistive vision assistant for visually impaired users.
Your goal is to detect, extract, and read all visible text, signs, labels, documents, packaging, or room numbers in the user's camera view.

Respond ONLY with valid JSON matching this exact structure:
{
  "alertLevel": "clear",
  "spokenGuidance": "Natural speech summary of what text was read. Example: 'Room 204: Conference Room' or 'Warning label: Caution Hot Surface'",
  "hazards": [],
  "sceneOverview": "Description of the document, sign, or item with text",
  "detectedText": "Full transcription of the extracted text"
}

Do NOT include markdown blocks. Return only the raw JSON.`;

const FULL_SCENE_SYSTEM_PROMPT = `You are SAARTHI Scene Describer, providing rich spatial and environmental awareness to visually impaired users.
Analyze the scene and describe the environment, lighting, key objects, people, and layout.

Respond ONLY with valid JSON matching this exact structure:
{
  "alertLevel": "clear" | "caution",
  "spokenGuidance": "Punchy 15-20 word overview of the surroundings suitable for audio readout",
  "hazards": [
    {
      "name": "Noticeable object or landmark",
      "direction": "left" | "center" | "right",
      "distance": "near" | "medium" | "far"
    }
  ],
  "sceneOverview": "Rich description of room/outdoor setting, lighting, atmosphere, and layout",
  "detectedText": "Any readable signs or text"
}

Do NOT include markdown blocks. Return only the raw JSON.`;

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          status: 'error',
          error: 'GROQ_API_KEY is not configured on the server. Please add it to your environment variables or Vercel project settings.',
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { image, mode = 'navigation', userQuery } = body;

    if (!image) {
      return NextResponse.json(
        { status: 'error', error: 'No image frame provided' },
        { status: 400 }
      );
    }

    // Format image URL: Ensure data URI format
    let formattedImageUrl = image;
    if (!image.startsWith('data:image/')) {
      formattedImageUrl = `data:image/jpeg;base64,${image}`;
    }

    // Pick system prompt based on mode
    let systemPrompt = NAVIGATION_SYSTEM_PROMPT;
    if (mode === 'reading') {
      systemPrompt = READING_SYSTEM_PROMPT;
    } else if (mode === 'full_scene') {
      systemPrompt = FULL_SCENE_SYSTEM_PROMPT;
    }

    const userMessageContent: any[] = [
      {
        type: 'image_url',
        image_url: {
          url: formattedImageUrl,
        },
      },
      {
        type: 'text',
        text: userQuery
          ? `User specific question: "${userQuery}". Also provide navigation and safety JSON.`
          : 'Analyze this view for navigation and immediate hazards. Return strict JSON.',
      },
    ];

    // Call Groq Vision Model (qwen/qwen3.8-27b on Groq LPUs)
    const chatCompletion = await groq.chat.completions.create({
      model: 'qwen/qwen3.8-27b',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userMessageContent,
        },
      ],
      temperature: 0.1,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });

    const rawResponse = chatCompletion.choices[0]?.message?.content || '{}';
    const latencyMs = Date.now() - startTime;

    let parsedData: any;
    try {
      parsedData = JSON.parse(rawResponse);
    } catch {
      // Fallback clean regex
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        parsedData = {
          alertLevel: 'clear',
          spokenGuidance: rawResponse.slice(0, 100),
          hazards: [],
          sceneOverview: rawResponse,
        };
      }
    }

    const result: VisionAnalysisResult = {
      alertLevel: parsedData.alertLevel || 'clear',
      spokenGuidance: parsedData.spokenGuidance || 'Path appears clear.',
      hazards: Array.isArray(parsedData.hazards) ? parsedData.hazards : [],
      sceneOverview: parsedData.sceneOverview || '',
      detectedText: parsedData.detectedText || '',
      timestamp: Date.now(),
      latencyMs,
    };

    return NextResponse.json({
      status: 'success',
      data: result,
    });
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    console.error('Groq Vision API Error:', error);

    return NextResponse.json(
      {
        status: 'error',
        error: error?.message || 'Vision inference failed',
        latencyMs,
      },
      { status: 500 }
    );
  }
}
