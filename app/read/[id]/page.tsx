'use client';

import { useEffect, useState, use } from 'react';
import { initDB, Book } from '@/lib/db';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import EpubReader from '@/components/EpubReader';
import PdfReader from '@/components/PdfReader';

export default function ReadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [book, setBook] = useState<Book | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBook() {
      try {
        const db = await initDB();
        const decodedId = decodeURIComponent(id);
        const b = await db.get('books', decodedId);
        if (!b) {
          setError('Livro não encontrado');
          return;
        }
        setBook(b);

        // Request permission if needed
        const options = { mode: 'read' as FileSystemPermissionMode };
        if ((await b.handle.queryPermission(options)) !== 'granted') {
          const permission = await b.handle.requestPermission(options);
          if (permission !== 'granted') {
            setError('Permissão negada para acessar o arquivo');
            return;
          }
        }

        const f = await b.handle.getFile();
        setFile(f);
      } catch (err: any) {
        console.error(err);
        setError('Erro ao carregar o livro. Talvez o arquivo tenha sido movido ou excluído.');
      }
    }
    loadBook();
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={() => router.push('/')} className="text-stone-600 underline">
            Voltar para a estante
          </button>
        </div>
      </div>
    );
  }

  if (!book || !file) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <p className="text-stone-500 animate-pulse">Carregando livro...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-stone-50 overflow-hidden">
      <header className="h-14 border-b border-stone-200 bg-white flex items-center px-4 justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/')} className="p-2 hover:bg-stone-100 rounded-full">
            <ArrowLeft size={20} className="text-stone-600" />
          </button>
          <h1 className="font-serif font-medium text-stone-800 truncate max-w-[200px] md:max-w-md">
            {book.title}
          </h1>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden">
        {book.type === 'epub' ? (
          <EpubReader file={file} bookId={book.id} />
        ) : (
          <PdfReader file={file} bookId={book.id} />
        )}
      </main>
    </div>
  );
}
