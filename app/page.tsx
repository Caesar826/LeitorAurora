'use client';

import { useState, useEffect } from 'react';
import { initDB, Book } from '@/lib/db';
import { scanDirectory } from '@/lib/scanner';
import { FolderPlus, Book as BookIcon, FileText, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    loadBooks();
  }, []);

  async function loadBooks() {
    const db = await initDB();
    const allBooks = await db.getAll('books');
    setBooks(allBooks.sort((a, b) => b.addedAt - a.addedAt));
  }

  async function handleAddFolder() {
    try {
      const dirHandle = await window.showDirectoryPicker({
        mode: 'read',
      });
      
      setScanning(true);
      const files = await scanDirectory(dirHandle);
      
      const db = await initDB();
      
      // Save directory handle
      await db.put('directories', {
        id: dirHandle.name,
        handle: dirHandle,
        addedAt: Date.now(),
      });

      // Save file handles
      for (const file of files) {
        const type = file.name.toLowerCase().endsWith('.epub') ? 'epub' : 'pdf';
        await db.put('books', {
          id: file.name, // Simplistic ID, could use hash
          title: file.name.replace(/\.(epub|pdf)$/i, ''),
          handle: file,
          type,
          addedAt: Date.now(),
        });
      }
      
      await loadBooks();
    } catch (err) {
      console.error('Error selecting folder:', err);
    } finally {
      setScanning(false);
    }
  }

  async function handleRemoveBook(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const db = await initDB();
    await db.delete('books', id);
    await loadBooks();
  }

  return (
    <div className="min-h-screen bg-stone-100 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-4">
          <div>
            <h1 className="text-4xl font-serif text-stone-800 tracking-tight">Minha Estante</h1>
            <p className="text-stone-500 mt-2">Leia seus livros direto do seu dispositivo, sem copiar.</p>
          </div>
          <button
            onClick={handleAddFolder}
            disabled={scanning}
            className="flex items-center gap-2 bg-stone-800 text-white px-6 py-3 rounded-full hover:bg-stone-700 transition-colors disabled:opacity-50"
          >
            <FolderPlus size={20} />
            {scanning ? 'Analisando...' : 'Adicionar Pasta'}
          </button>
        </header>

        {books.length === 0 ? (
          <div className="text-center py-24 text-stone-500 bg-white rounded-2xl border border-stone-200 border-dashed">
            <BookIcon size={64} className="mx-auto mb-4 opacity-20" />
            <p className="text-xl font-serif">Sua estante está vazia.</p>
            <p className="mt-2 text-sm">Adicione uma pasta do seu celular ou cartão SD para começar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {books.map((book) => (
              <Link href={`/read/${encodeURIComponent(book.id)}`} key={book.id}>
                <motion.div
                  whileHover={{ y: -4 }}
                  className="bg-white p-4 rounded-xl shadow-sm border border-stone-200 aspect-[3/4] flex flex-col justify-end relative group cursor-pointer overflow-hidden"
                >
                  <div className="absolute top-4 right-4 text-stone-400">
                    {book.type === 'epub' ? <BookIcon size={24} /> : <FileText size={24} />}
                  </div>
                  
                  <button 
                    onClick={(e) => handleRemoveBook(e, book.id)}
                    className="absolute top-4 left-4 p-1.5 bg-red-50 text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100"
                    title="Remover da estante"
                  >
                    <Trash2 size={16} />
                  </button>

                  <h3 className="font-serif font-medium text-stone-800 line-clamp-3 leading-snug">
                    {book.title}
                  </h3>
                  <p className="text-xs text-stone-500 mt-2 uppercase tracking-wider font-mono">
                    {book.type}
                  </p>
                </motion.div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
