'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ePub, { Book as EpubBook, Rendition } from 'epubjs';
import { initDB, Annotation } from '@/lib/db';
import { List, ChevronLeft, ChevronRight, X, MessageSquare } from 'lucide-react';

const COLORS = [
  { id: 'yellow', value: 'rgba(255, 255, 0, 0.4)' },
  { id: 'green', value: 'rgba(0, 255, 0, 0.4)' },
  { id: 'blue', value: 'rgba(0, 191, 255, 0.4)' },
  { id: 'pink', value: 'rgba(255, 105, 180, 0.4)' },
  { id: 'purple', value: 'rgba(216, 191, 216, 0.4)' },
];

export default function EpubReader({ file, bookId }: { file: File; bookId: string }) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [book, setBook] = useState<EpubBook | null>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [toc, setToc] = useState<any[]>([]);
  const [showToc, setShowToc] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [showNotes, setShowNotes] = useState(false);
  
  const [selection, setSelection] = useState<{ cfiRange: string; text: string; rect: DOMRect } | null>(null);
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [noteText, setNoteText] = useState('');

  const loadAnnotations = useCallback(async (r: Rendition) => {
    const db = await initDB();
    const all = await db.getAllFromIndex('annotations', 'by-book', bookId);
    setAnnotations(all);
    
    all.forEach(ann => {
      if (ann.cfiRange) {
        r.annotations.highlight(ann.cfiRange, {}, (e: Event) => {
          console.log('Clicked highlight', ann);
        }, '', { fill: ann.color });
      }
    });
  }, [bookId]);

  useEffect(() => {
    let isMounted = true;
    let currentBook: EpubBook | null = null;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (!isMounted || !viewerRef.current) return;
      const bookData = e.target?.result as ArrayBuffer;
      const newBook = ePub(bookData);
      currentBook = newBook;
      setBook(newBook);

      const newRendition = newBook.renderTo(viewerRef.current, {
        width: '100%',
        height: '100%',
        spread: 'none',
        manager: 'continuous',
        flow: 'scrolled',
      });
      setRendition(newRendition);

      newBook.ready.then(() => {
        return newBook.locations.generate(1600);
      }).then(() => {
        // Ready
      });

      newBook.loaded.navigation.then((nav) => {
        setToc(nav.toc);
      });

      newRendition.display();

      loadAnnotations(newRendition);

      newRendition.on('selected', (cfiRange: string) => {
        const range = newRendition.getRange(cfiRange);
        const rect = range.getBoundingClientRect();
        const text = newRendition.getRange(cfiRange).toString();
        
        setSelection({ cfiRange, text, rect });
      });

      newRendition.on('click', () => {
        setSelection(null);
      });
    };
    reader.readAsArrayBuffer(file);

    return () => {
      isMounted = false;
      if (currentBook) {
        currentBook.destroy();
      }
    };
  }, [file, loadAnnotations]);

  async function handleSaveHighlight() {
    if (!selection || !rendition) return;

    const newAnn: Annotation = {
      id: crypto.randomUUID(),
      bookId,
      cfiRange: selection.cfiRange,
      text: selection.text,
      color: selectedColor,
      note: noteText,
      createdAt: Date.now(),
    };

    const db = await initDB();
    await db.put('annotations', newAnn);

    rendition.annotations.highlight(selection.cfiRange, {}, () => {}, '', { fill: selectedColor });
    
    setAnnotations(prev => [...prev, newAnn]);
    setSelection(null);
    setNoteText('');
  }

  return (
    <div className="w-full h-full relative flex">
      {(showToc || showNotes) && (
        <div className="w-80 bg-white border-r border-stone-200 h-full overflow-y-auto flex flex-col absolute left-0 top-0 z-20 md:relative shadow-xl md:shadow-none">
          <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-stone-50">
            <h2 className="font-serif font-medium">{showToc ? 'Sumário' : 'Notas e Destaques'}</h2>
            <button onClick={() => { setShowToc(false); setShowNotes(false); }} className="p-1 hover:bg-stone-200 rounded">
              <X size={18} />
            </button>
          </div>
          <div className="p-4 flex-1 overflow-y-auto">
            {showToc && (
              <ul className="space-y-3">
                {toc.map((item, i) => (
                  <li key={i}>
                    <button
                      onClick={() => {
                        rendition?.display(item.href);
                        if (window.innerWidth < 768) setShowToc(false);
                      }}
                      className="text-left text-sm text-stone-700 hover:text-stone-900 w-full"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {showNotes && (
              <div className="space-y-4">
                {annotations.map(ann => (
                  <div key={ann.id} className="p-3 bg-stone-50 rounded-lg border border-stone-100">
                    <div className="w-4 h-4 rounded-full mb-2" style={{ backgroundColor: ann.color }} />
                    <p className="text-sm italic text-stone-600 mb-2">&ldquo;{ann.text}&rdquo;</p>
                    {ann.note && <p className="text-sm text-stone-800 font-medium">{ann.note}</p>}
                    <button 
                      onClick={() => {
                        if (ann.cfiRange) rendition?.display(ann.cfiRange);
                        if (window.innerWidth < 768) setShowNotes(false);
                      }}
                      className="text-xs text-blue-600 mt-2 hover:underline"
                    >
                      Ir para destaque
                    </button>
                  </div>
                ))}
                {annotations.length === 0 && (
                  <p className="text-sm text-stone-500 text-center mt-8">Nenhuma nota ou destaque ainda.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 relative h-full flex flex-col">
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <button onClick={() => { setShowToc(!showToc); setShowNotes(false); }} className="p-2 bg-white rounded-full shadow-md hover:bg-stone-50">
            <List size={20} className="text-stone-700" />
          </button>
          <button onClick={() => { setShowNotes(!showNotes); setShowToc(false); }} className="p-2 bg-white rounded-full shadow-md hover:bg-stone-50">
            <MessageSquare size={20} className="text-stone-700" />
          </button>
        </div>

        <div ref={viewerRef} className="flex-1 w-full h-full bg-stone-50 overflow-hidden" />

        <button 
          onClick={() => rendition?.prev()} 
          className="absolute left-0 top-1/2 -translate-y-1/2 p-4 h-full w-1/4 opacity-0 hover:opacity-100 flex items-center justify-start transition-opacity"
        >
          <div className="bg-white/80 p-2 rounded-full shadow-sm">
            <ChevronLeft size={32} className="text-stone-600" />
          </div>
        </button>
        <button 
          onClick={() => rendition?.next()} 
          className="absolute right-0 top-1/2 -translate-y-1/2 p-4 h-full w-1/4 opacity-0 hover:opacity-100 flex items-center justify-end transition-opacity"
        >
          <div className="bg-white/80 p-2 rounded-full shadow-sm">
            <ChevronRight size={32} className="text-stone-600" />
          </div>
        </button>

        {selection && (
          <div 
            className="absolute z-30 bg-white rounded-xl shadow-xl border border-stone-200 p-4 w-72"
            style={{
              top: Math.max(10, selection.rect.top - 180),
              left: Math.max(10, Math.min(window.innerWidth - 300, selection.rect.left + selection.rect.width / 2 - 144))
            }}
          >
            <div className="flex gap-2 mb-3">
              {COLORS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedColor(c.value)}
                  className={`w-8 h-8 rounded-full border-2 ${selectedColor === c.value ? 'border-stone-800' : 'border-transparent'}`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Adicionar nota (opcional)..."
              className="w-full text-sm p-2 border border-stone-200 rounded-lg mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-stone-400"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setSelection(null)}
                className="px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveHighlight}
                className="px-3 py-1.5 text-sm bg-stone-800 text-white hover:bg-stone-700 rounded-lg"
              >
                Salvar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
