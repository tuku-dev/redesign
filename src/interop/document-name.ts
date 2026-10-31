/** Document titles exclude the file extension; local filenames must be portable. */
export function documentNameFromFile(filename: string): string {
  return (
    filename
      .trim()
      .replace(/\.(redesign|json)$/i, '')
      .trim() || 'Untitled'
  );
}
export function safeDocumentName(value: string): string {
  return (
    documentNameFromFile(value)
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\p{Cc}/gu, '_')
      .replace(/[. ]+$/g, '')
      .trim() || 'Untitled'
  );
}
