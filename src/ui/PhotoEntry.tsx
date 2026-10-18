/**
 * The style screens' way into photo reading, or, once a garment was matched to a photo, that photo
 * with a way to try another. The skirt has its own card, which also undoes the matched proportions.
 */
export function PhotoEntry({ onPhoto, photo }: { onPhoto?: () => void; photo?: string }) {
  if (!onPhoto) return null;
  if (photo)
    return (
      <div className="photo-matched">
        <img src={photo} alt="Your photo" />
        <div>
          <p>Matched to your photo</p>
          <p className="muted small">Change anything below.</p>
        </div>
        <button type="button" className="link" onClick={onPhoto}>
          New photo
        </button>
      </div>
    );
  return (
    <button type="button" className="secondary photo-entry" onClick={onPhoto}>
      Start from a photo
    </button>
  );
}
