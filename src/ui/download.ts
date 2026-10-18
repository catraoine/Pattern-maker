// Handing a file to the person: the share sheet on phones, a download everywhere else.

// Phones can hand a file to the share sheet (email, Files, AirDrop, a printer app); most desktops can't.
export const canShareFiles = (() => {
  try {
    return (
      typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'x.pdf', { type: 'application/pdf' })] })
    );
  } catch {
    return false;
  }
})();

export function download(data: BlobPart, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
