'use client';

import { useState, FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Youtube, Loader2, Sparkles, Wand2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function Home() {
    const [url, setUrl] = useState<string>('');
    const [isLoadingAnalysis, setIsLoadingAnalysis] = useState<boolean>(false);
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [progressValue, setProgressValue] = useState<number>(0);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoadingAnalysis(true);
        setAnalysis(null);
        setError(null);
        setProgressValue(0);

        let progressInterval: NodeJS.Timeout | null = null;

        try {
            progressInterval = setInterval(() => {
                setProgressValue((prev) => {
                    if (prev >= 95) {
                        if (progressInterval) clearInterval(progressInterval);
                        return prev;
                    }
                    return prev + 5;
                });
            }, 200);

            const response = await fetch('/api/transcript', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            });

            if (progressInterval) clearInterval(progressInterval);
            setProgressValue(100);

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Terjadi kesalahan saat mengambil data');
            }

            setAnalysis(data.analysis);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Terjadi kesalahan yang tidak diketahui');
            setProgressValue(0);
            if (progressInterval) clearInterval(progressInterval);
        } finally {
            setIsLoadingAnalysis(false);
        }
    };

    const handleResetPage = () => {
        setUrl('');
        setIsLoadingAnalysis(false);
        setAnalysis(null);
        setError(null);
        setProgressValue(0);
    };

  return (
        <main className="flex min-h-screen flex-col items-center justify-center py-16 px-4 sm:px-6 lg:px-8 
                       bg-gradient-to-br from-neutral-950 via-neutral-900 to-gray-900 
                       text-neutral-100 overflow-hidden">

            <div className="w-full max-w-3xl space-y-12 z-10">
                <div className="text-center space-y-3">
                    <Wand2 className="mx-auto h-10 w-10 text-red-500" />
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight 
                                   bg-gradient-to-r from-red-500 via-red-400 to-orange-400 
                                   text-transparent bg-clip-text">
                        Video Insight AI
                    </h1>
                    <p className="text-lg text-neutral-400 max-w-xl mx-auto">
                        Tempel URL YouTube, dapatkan ringkasan cerdas dalam sekejap.
                    </p>
                </div>

                <div className="bg-neutral-900/80 backdrop-blur-sm border border-neutral-700/60 shadow-xl rounded-xl p-6 sm:p-8 transition-all duration-500 ease-out" 
                     key={analysis ? 'analysis-visible' : 'form-visible'}
                >
                    {!analysis && (
                        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
                            <div className="relative group">
                                <Youtube className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500 
                                                transition-colors duration-300 group-focus-within:text-red-400" />
                                <Input
                                    type="url"
                                    placeholder="https://www.youtube.com/watch?v=..."
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    required
                                    className="pl-11 pr-4 py-3 text-base w-full 
                                               bg-neutral-800/70 border border-neutral-700 rounded-lg 
                                               text-neutral-100 placeholder-neutral-500 
                                               focus:ring-2 focus:ring-red-500/50 focus:border-red-500 
                                               transition-all duration-300 ease-in-out 
                                               shadow-sm hover:border-neutral-600 focus:shadow-md"
                                    disabled={isLoadingAnalysis}
                                />
                            </div>

                            {isLoadingAnalysis && (
                                <Progress value={progressValue} className="w-full h-2 bg-neutral-700 [&>div]:bg-gradient-to-r [&>div]:from-red-600 [&>div]:to-red-500 transition-all duration-300" />
                            )}

                            <Button
                                type="submit"
                                disabled={isLoadingAnalysis || !url}
                                className="w-full py-3.5 text-lg font-semibold 
                                           bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 
                                           text-black hover:text-white 
                                           rounded-lg shadow-md 
                                           transition-all duration-300 ease-in-out 
                                           transform hover:scale-[1.02] hover:shadow-lg 
                                           focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-neutral-900 
                                           disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none disabled:bg-gradient-to-r disabled:from-neutral-600 disabled:to-neutral-700"
                            >
                                {isLoadingAnalysis ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Menganalisis...
                                    </>
                                ) : (
                                    <>
                                      <Sparkles className="mr-2 h-5 w-5"/> Analisis Video
                                    </>
                                )}
                            </Button>

                            {error && (
                                <p className="text-red-400 text-center font-medium pt-2">{`Error: ${error}`}</p>
                            )}
                        </form>
                    )}

                    {isLoadingAnalysis && !analysis && (
                        <div className="space-y-5 pt-6 animate-pulse">
                            <Skeleton className="h-7 w-3/4 bg-neutral-700 rounded-md" />
                            <Skeleton className="h-5 w-full bg-neutral-700 rounded-md" />
                            <Skeleton className="h-5 w-11/12 bg-neutral-700 rounded-md" />
                            <Skeleton className="h-5 w-5/6 bg-neutral-700 rounded-md" />
                        </div>
                    )}

                    {analysis && (
                        <div className="space-y-6 animate-fade-in-up">
                            <h2 className="text-2xl font-semibold text-neutral-100 border-b border-neutral-700 pb-2">
                                Ringkasan AI:
                            </h2>
                            <div className="prose prose-invert prose-neutral max-w-none text-base leading-relaxed 
                                         prose-headings:text-red-400 prose-strong:text-neutral-100 
                                         prose-p:text-neutral-300 prose-p:mb-3 lg:prose-p:mb-4 
                                         prose-li:text-neutral-300 
                                         text-justify">
                                <ReactMarkdown>{analysis}</ReactMarkdown>
                            </div>
                            <div className="text-center">
                                <Button
                                    onClick={handleResetPage}
                                    variant="outline"
                                    className="w-full sm:w-auto border-neutral-600 text-neutral-200 
                                               hover:bg-neutral-800 hover:border-red-500/50 hover:text-red-400 
                                               transition-colors duration-200 rounded-lg focus:ring-red-500/50"
                                >
                                    Analisis Video Lain
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
    </div>

        </main>
  );
}
