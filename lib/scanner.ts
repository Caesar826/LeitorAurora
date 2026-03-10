export async function scanDirectory(dirHandle: FileSystemDirectoryHandle): Promise<FileSystemFileHandle[]> {
  const files: FileSystemFileHandle[] = [];
  
  async function scan(handle: FileSystemDirectoryHandle) {
    try {
      for await (const entry of (handle as any).values()) {
        if (entry.kind === 'file') {
          if (entry.name.toLowerCase().endsWith('.epub') || entry.name.toLowerCase().endsWith('.pdf')) {
            files.push(entry as FileSystemFileHandle);
          }
        } else if (entry.kind === 'directory') {
          await scan(entry as FileSystemDirectoryHandle);
        }
      }
    } catch (e) {
      console.warn('Could not scan directory:', handle.name, e);
    }
  }
  
  await scan(dirHandle);
  return files;
}
