import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';
import OpenAI from 'openai'; // Impor OpenAI

// Log environment variables right after import to check if they are loaded
console.log('DEEPSEEK_API_KEY loaded:', process.env.DEEPSEEK_API_KEY ? 'Yes' : 'No');
console.log('DEEPSEEK_API_BASE_URL loaded:', process.env.DEEPSEEK_API_BASE_URL ? 'Yes' : 'No');
// Optional: Log a portion of the key for verification, but be careful not to log the whole key
if (process.env.DEEPSEEK_API_KEY) {
    console.log('API Key ends with:', process.env.DEEPSEEK_API_KEY.slice(-4));
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
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL tidak valid atau tidak ditemukan' }, { status: 400 });
    }

    // Validasi dan bersihkan URL
    const cleanUrl = validateAndCleanYouTubeUrl(url);
    if (!cleanUrl) {
      return NextResponse.json({ error: 'Format URL YouTube tidak valid' }, { status: 400 });
    }

    console.log(`Mencoba mengambil transkrip untuk: ${cleanUrl}`);

    let transcriptText = '';
    try {
      // Tambahkan timeout untuk fetch
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout mengambil transkrip')), 15000)
      );
      const transcriptPromise = YoutubeTranscript.fetchTranscript(cleanUrl);
      
      const result = await Promise.race([transcriptPromise, timeoutPromise]);
      const transcript = result as Array<{ text: string }>;
      
      if (!transcript || transcript.length === 0) {
        return NextResponse.json({ error: 'Transkrip tidak ditemukan untuk video ini.' }, { status: 404 });
      }
      transcriptText = transcript.map((item: { text: string }) => item.text).join(' ');
    } catch (error: unknown) {
      console.error('Kesalahan saat mengambil transkrip:', error);
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
      
      return NextResponse.json({ error: errorMessage }, { status: statusCode });
    }

    // Memanggil API DeepSeek untuk analisis
    console.log('Mengirim transkrip ke DeepSeek untuk analisis...');
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
        max_tokens: 700, // Tetap 700 untuk hasil lengkap
        temperature: 0.7,
      });

      const analysisResult = completion.choices[0]?.message?.content;
      console.log('[API Transcript] Full AI Analysis Result:', analysisResult);
      if (!analysisResult) {
        throw new Error('Tidak ada hasil analisis yang diterima dari AI.');
      }
      console.log('Analisis AI berhasil diterima.');
      return NextResponse.json({ analysis: analysisResult });

    } catch (aiError: unknown) {
        console.error('Kesalahan saat memanggil API DeepSeek:', aiError);
         let aiErrorMessage = 'Gagal menganalisis transkrip dengan AI.';
        if (aiError instanceof Error && 'response' in aiError && aiError.response && aiError.response instanceof Object && 'data' in aiError.response && aiError.response.data && aiError.response.data instanceof Object && 'error' in aiError.response.data && aiError.response.data.error && aiError.response.data.error instanceof Object && 'message' in aiError.response.data.error && aiError.response.data.error.message) {
            aiErrorMessage = `Error AI: ${aiError.response.data.error.message || 'Unknown AI Error'}`;
        } else if (aiError instanceof Error && aiError.message) {
             aiErrorMessage = `Error AI: ${aiError.message}`;
        }
        return NextResponse.json({ error: aiErrorMessage }, { status: 500 });
    }

  } catch (error: unknown) {
    console.error('Kesalahan tak terduga di API route:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan internal server.' }, { status: 500 });
  }
} 