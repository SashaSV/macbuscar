export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { message } = await request.json();
    if (!message) return NextResponse.json({ error: 'No message' }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: `Eres el asistente de Manzana.es, un comparador de precios Apple en España.
Responde siempre en español, de forma concisa (máximo 3-4 frases).
Ayuda con: elegir entre modelos, comparar características, explicar diferencias, recomendar dónde comprar más barato.
Tiendas disponibles: Apple Store, MediaMarkt, PcComponentes, Fnac, El Corte Inglés, Amazon.es, Worten, iStore.`,
        messages: [{ role: 'user', content: message }],
      }),
    });

    const data = await res.json();
    const text = data.content?.map(b => b.text || '').join('') || 'Sin respuesta.';
    return NextResponse.json({ reply: text });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
