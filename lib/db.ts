import { openDB, DBSchema } from 'idb';

export interface Book {
  id: string;
  title: string;
  handle: FileSystemFileHandle;
  type: 'epub' | 'pdf';
  addedAt: number;
}

export interface Annotation {
  id: string;
  bookId: string;
  cfiRange?: string; // For EPUB
  pageIndex?: number; // For PDF
  rects?: any[]; // For PDF
  text: string;
  color: string;
  note?: string;
  createdAt: number;
}

interface ReaderDB extends DBSchema {
  books: {
    key: string;
    value: Book;
  };
  annotations: {
    key: string;
    value: Annotation;
    indexes: { 'by-book': string };
  };
  directories: {
    key: string;
    value: {
      id: string;
      handle: FileSystemDirectoryHandle;
      addedAt: number;
    };
  };
}

export async function initDB() {
  return openDB<ReaderDB>('reader-db', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('books')) {
        db.createObjectStore('books', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('annotations')) {
        const annotationStore = db.createObjectStore('annotations', { keyPath: 'id' });
        annotationStore.createIndex('by-book', 'bookId');
      }
      if (!db.objectStoreNames.contains('directories')) {
        db.createObjectStore('directories', { keyPath: 'id' });
      }
    },
  });
}
