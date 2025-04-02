import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import OpenAI from 'openai'; // Impor OpenAI

// Log environment variables right after import to check if they are loaded
console.log('[API] Environment Check:');
console.log('- DEEPSEEK_API_KEY:', process.env.DEEPSEEK_API_KEY ? 'Present' : 'Missing');
console.log('- DEEPSEEK_API_BASE_URL:', process.env.DEEPSEEK_API_BASE_URL ? 'Present' : 'Missing');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- VERCEL_ENV:', process.env.VERCEL_ENV);

if (!process.env.DEEPSEEK_API_KEY || !process.env.DEEPSEEK_API_BASE_URL) {
  console.error('[API] Missing required environment variables');
  throw new Error('Missing required environment variables');
}

// Inisialisasi klien OpenAI dengan konfigurasi DeepSeek
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY, // Baca kunci API dari env
  baseURL: process.env.DEEPSEEK_API_BASE_URL, // Baca base URL dari env
  timeout: 30000, // 30 detik timeout
});

// Fungsi untuk memvalidasi dan membersihkan URL YouTube
function validateAndCleanYouTubeUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    // Validasi domain
    if (!['youtube.com', 'www.youtube.com', 'youtu.be'].includes(urlObj.hostname)) {
      return null;
    }
    // Dapatkan video ID
    let videoId = '';
    if (urlObj.hostname === 'youtu.be') {
      videoId = urlObj.pathname.slice(1);
    } else {
      videoId = urlObj.searchParams.get('v') || '';
    }
    if (!videoId) return null;
    // Kembalikan URL yang sudah dibersihkan
    return `https://www.youtube.com/watch?v=${videoId}`;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  console.log('[API] Received POST request');
  
  try {
    const body = await request.json();
    const { url } = body;
    console.log('[API] Received URL:', url);

    if (!url || typeof url !== 'string') {
      console.log('[API] Invalid URL format');
      return NextResponse.json({ error: 'URL tidak valid atau tidak ditemukan' }, { status: 400 });
    }

    // Validasi dan bersihkan URL
    const cleanUrl = validateAndCleanYouTubeUrl(url);
    if (!cleanUrl) {
      console.log('[API] URL validation failed');
      return NextResponse.json({ error: 'Format URL YouTube tidak valid' }, { status: 400 });
    }

    console.log('[API] Fetching transcript for:', cleanUrl);

    let transcriptText = '';
    try {
      // Tambahkan timeout untuk fetch
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout mengambil transkrip')), 15000)
      );
      console.log('[API] Starting transcript fetch');
      const transcriptPromise = YoutubeTranscript.fetchTranscript(cleanUrl);
      
      const result = await Promise.race([transcriptPromise, timeoutPromise]);
      console.log('[API] Transcript fetch completed');
      
      const transcript = result as Array<{ text: string }>;
      
      if (!transcript || transcript.length === 0) {
        console.log('[API] No transcript found');
        return NextResponse.json({ error: 'Transkrip tidak ditemukan untuk video ini.' }, { status: 404 });
      }
      
      transcriptText = transcript.map((item: { text: string }) => item.text).join(' ');
      console.log('[API] Transcript processed, length:', transcriptText.length);
      
    } catch (error: unknown) {
      console.error('[API] Transcript fetch error:', error);
      console.error('[API] Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      let errorMessage = 'Gagal mengambil transkrip.';
      let statusCode = 500;

      if (error instanceof Error) {
        if (error.message?.includes('disabled subtitles')) {
          errorMessage = 'Transkrip (subtitles) dinonaktifkan untuk video ini.';
          statusCode = 404;
        } else if (error.message?.includes('No transcripts found')) {
          errorMessage = 'Tidak ada transkrip yang ditemukan untuk video ini.';
          statusCode = 404;
        } else if (error.message?.includes('invalid video ID')) {
          errorMessage = 'URL YouTube tidak valid atau video tidak ditemukan.';
          statusCode = 400;
        } else if (error.message?.includes('Timeout')) {
          errorMessage = 'Waktu mengambil transkrip habis. Silakan coba lagi.';
          statusCode = 504;
        } else if (error.message?.includes('ENOTFOUND')) {
          errorMessage = 'Tidak dapat terhubung ke YouTube. Periksa koneksi internet Anda.';
          statusCode = 503;
        }
      }
      
      return NextResponse.json({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : undefined
      }, { status: statusCode });
    }

    console.log('[API] Calling DeepSeek API');
    try {
      const completion = await deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'Anda adalah asisten AI yang membantu meringkas dan menganalisis transkrip video YouTube. Susun ringkasan yang jelas, ringkas, dan mudah dibaca dari teks berikut. Gunakan heading Markdown level 3 (###) untuk setiap bagian atau poin utama yang berbeda. Pastikan paragraf mengalir dengan baik dan hindari membuat paragraf yang hanya terdiri dari satu kalimat pendek jika memungkinkan. Sajikan dalam format profesional.'
          },
          {
            role: 'user',
            content: `Berikut adalah transkrip video: ${transcriptText}`
          }
        ],
        max_tokens: 700,
        temperature: 0.7,
      });

      const analysisResult = completion.choices[0]?.message?.content;
      console.log('[API] Analysis completed, result length:', analysisResult?.length);
      
      if (!analysisResult) {
        console.error('[API] No analysis result received');
        throw new Error('Tidak ada hasil analisis yang diterima dari AI.');
      }
      
      return NextResponse.json({ analysis: analysisResult });

    } catch (aiError: unknown) {
      console.error('[API] DeepSeek API error:', aiError);
      console.error('[API] Error details:', {
        name: aiError instanceof Error ? aiError.name : 'Unknown',
        message: aiError instanceof Error ? aiError.message : 'Unknown error',
        stack: aiError instanceof Error ? aiError.stack : undefined
      });
      
      let aiErrorMessage = 'Gagal menganalisis transkrip dengan AI.';
      if (aiError instanceof Error && 'response' in aiError && aiError.response && aiError.response instanceof Object && 'data' in aiError.response && aiError.response.data && aiError.response.data instanceof Object && 'error' in aiError.response.data && aiError.response.data.error && aiError.response.data.error instanceof Object && 'message' in aiError.response.data.error && aiError.response.data.error.message) {
        aiErrorMessage = `Error AI: ${aiError.response.data.error.message || 'Unknown AI Error'}`;
      } else if (aiError instanceof Error && aiError.message) {
        aiErrorMessage = `Error AI: ${aiError.message}`;
      }
      
      return NextResponse.json({ 
        error: aiErrorMessage,
        details: process.env.NODE_ENV === 'development' ? aiError instanceof Error ? aiError.message : 'Unknown error' : undefined
      }, { status: 500 });
    }

  } catch (error: unknown) {
    console.error('[API] Unexpected error:', error);
    console.error('[API] Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json({ 
      error: 'Terjadi kesalahan internal server.',
      details: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : undefined
    }, { status: 500 });
  }
} 