export function downloadFile(name: string, data: string, type: string, extension: string): void {
  const url = URL.createObjectURL(new Blob([data], { type })),
    a = document.createElement('a');
  a.href = url;
  a.download = (name.replace(/[<>:"/\\|?*]/g, '_') || 'Untitled') + extension;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
