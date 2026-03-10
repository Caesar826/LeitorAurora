'use client';

import { useState, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { initDB, Annotation } from '@/lib/db';
import { List, ChevronLeft, ChevronRight, X, MessageSquare, ZoomIn, ZoomOut } from 'lucide-react';

// Use a local worker or a reliable CDN version that matches the installed pdfjs-dist
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

const COLORS = [
  { id: 'yellow', value: 'rgba(255, 255, 0, 0.4)' },
  { id: 'green', value: 'rgba(0, 255, 0, 0.4)' },
  { id: 'blue', value: 'rgba(0, 191, 255, 0.4)' },
  { id: 'pink', value: 'rgba(255, 105, 180, 0.4)' },
  { id: 'purple', value: 'rgba(216, 191, 216, 0.4)' },
];

export default function PdfReader({ file, bookId }: { file: File; bookId: string }) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState(1.0);
  const [toc, setToc] = useState<any[]>([]);
  const [showToc, setShowToc] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [showNotes, setShowNotes] = useState(false);
  
  const [selection, setSelection] = useState<{ text: string; rect: DOMRect } | null>(null);
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [noteText, setNoteText] = useState('');

  const loadAnnotations = useCallback(async () => {
    const db = await initDB();
    const all = await db.getAllFromIndex('annotations', 'by-book', bookId);
    setAnnotations(all);
  }, [bookId]);

  useEffect(() => {
    const fetchAnns = async () => {
      await loadAnnotations();
    };
    fetchAnns();
  }, [loadAnnotations]);

  function onDocumentLoadSuccess(pdf: any) {
    setNumPages(pdf.numPages);
    pdf.getOutline().then((outline: any[]) => {
      setToc(outline || []);
    });
  }

  useEffect(() => {
    const handleMouseUp = () => {
      const sel = window.getSelection();
      if (sel && sel.toString().trim().length > 0) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelection({
          text: sel.toString(),
          rect,
        });
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  async function handleSaveHighlight() {
    if (!selection) return;

    const newAnn: Annotation = {
      id: crypto.randomUUID(),
      bookId,
      pageIndex: pageNumber,
      text: selection.text,
      color: selectedColor,
      note: noteText,
      createdAt: Date.now(),
    };

    const db = await initDB();
    await db.put('annotations', newAnn);
    
    setAnnotations(prev => [...prev, newAnn]);
    setSelection(null);
    setNoteText('');
    window.getSelection()?.removeAllRanges();
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
                {toc.length > 0 ? toc.map((item, i) => (
                  <li key={i}>
                    <button
                      onClick={async () => {
                        if (item.dest) {
                          // item.dest can be a page index or a named destination
                          // For simplicity, we assume it's something we can resolve or just navigate to
                          // In react-pdf, we usually need to find the page index from the destination
                          // This is a bit complex without the full PDF document object here, 
                          // but we can try to use the page number if provided in the item
                          if (typeof item.pageIndex === 'number') {
                            setPageNumber(item.pageIndex + 1);
                          } else if (typeof item.pageNumber === 'number') {
                            setPageNumber(item.pageNumber);
                          }
                        }
                        if (window.innerWidth < 768) setShowToc(false);
                      }}
                      className="text-left text-sm text-stone-700 hover:text-stone-900 w-full"
                    >
                      {item.title}
                    </button>
                  </li>
                )) : (
                  <p className="text-sm text-stone-500">Nenhum sumário disponível.</p>
                )}
              </ul>
            )}
            {showNotes && (
              <div className="space-y-4">
                {annotations.map(ann => (
                  <div key={ann.id} className="p-3 bg-stone-50 rounded-lg border border-stone-100">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: ann.color }} />
                      <span className="text-xs text-stone-500 font-mono">Pág {ann.pageIndex}</span>
                    </div>
                    <p className="text-sm italic text-stone-600 mb-2">&ldquo;{ann.text}&rdquo;</p>
                    {ann.note && <p className="text-sm text-stone-800 font-medium">{ann.note}</p>}
                    <button 
                      onClick={() => {
                        if (ann.pageIndex) setPageNumber(ann.pageIndex);
                        if (window.innerWidth < 768) setShowNotes(false);
                      }}
                      className="text-xs text-blue-600 mt-2 hover:underline"
                    >
                      Ir para página
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

      <div className="flex-1 relative h-full flex flex-col bg-stone-200 overflow-y-auto items-center py-8">
        <div className="fixed top-20 right-8 z-10 flex flex-col gap-2">
          <button onClick={() => { setShowToc(!showToc); setShowNotes(false); }} className="p-2 bg-white rounded-full shadow-md hover:bg-stone-50">
            <List size={20} className="text-stone-700" />
          </button>
          <button onClick={() => { setShowNotes(!showNotes); setShowToc(false); }} className="p-2 bg-white rounded-full shadow-md hover:bg-stone-50">
            <MessageSquare size={20} className="text-stone-700" />
          </button>
          <div className="h-4" />
          <button onClick={() => setScale(s => s + 0.2)} className="p-2 bg-white rounded-full shadow-md hover:bg-stone-50">
            <ZoomIn size={20} className="text-stone-700" />
          </button>
          <button onClick={() => setScale(s => Math.max(0.4, s - 0.2))} className="p-2 bg-white rounded-full shadow-md hover:bg-stone-50">
            <ZoomOut size={20} className="text-stone-700" />
          </button>
        </div>

        <div className="bg-white shadow-xl">
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div className="p-12 text-stone-500">Carregando PDF...</div>}
          >
            <Page 
              pageNumber={pageNumber} 
              scale={scale} 
              renderAnnotationLayer={true} 
              renderTextLayer={true}
            />
          </Document>
        </div>

        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-4 z-10">
          <button 
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber(p => p - 1)}
            className="p-1 disabled:opacity-30"
          >
            <ChevronLeft size={24} />
          </button>
          <span className="font-mono text-sm">
            {pageNumber} / {numPages || '-'}
          </span>
          <button 
            disabled={pageNumber >= numPages}
            onClick={() => setPageNumber(p => p + 1)}
            className="p-1 disabled:opacity-30"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {selection && (
          <div 
            className="fixed z-30 bg-white rounded-xl shadow-xl border border-stone-200 p-4 w-72"
            style={{
              top: Math.max(10, selection.rect.top - 180),
              left: Math.max(10, Math.min(window.innerWidth - 300, selection.rect.left + selection.rect.width / 2 - 144))
            }}
            onMouseDown={(e) => e.stopPropagation()}
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
                onClick={() => { setSelection(null); window.getSelection()?.removeAllRanges(); }}
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
