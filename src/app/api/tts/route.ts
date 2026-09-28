import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { status: 'error', error: 'SARVAM_API_KEY not configured on server' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { text, language_code = 'en-IN', speaker = 'shubh', pace = 1.05 } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { status: 'error', error: 'Text prompt is required' },
        { status: 400 }
      );
    }

    // Clean text to avoid special characters that could break TTS
    const sanitizedText = text.trim().slice(0, 500);

    const sarvamRes = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: sanitizedText,
        language_code,
        speaker,
        pace,
      }),
    });

    if (!sarvamRes.ok) {
      const errText = await sarvamRes.text();
      console.error('Sarvam AI TTS Error:', sarvamRes.status, errText);
      return NextResponse.json(
        { status: 'error', error: `Sarvam API error: ${sarvamRes.status}` },
        { status: sarvamRes.status }
      );
    }

    const data = await sarvamRes.json();
    const base64Audio = data?.audios?.[0];

    if (!base64Audio) {
      return NextResponse.json(
        { status: 'error', error: 'No audio returned from Sarvam AI' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'success',
      audio: base64Audio,
      format: 'wav',
    });
  } catch (error: any) {
    console.error('TTS Route Exception:', error);
    return NextResponse.json(
      { status: 'error', error: error.message || 'TTS generation failed' },
      { status: 500 }
    );
  }
}
