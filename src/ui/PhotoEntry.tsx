/**
 * A garment matched to a photo: the photo, with a way to try another. The way in is "Start from a photo" in the
 * name's drop-down; the skirt has its own card, which also undoes the matched proportions.
 */
export function PhotoEntry({ onPhoto, photo }: { onPhoto?: () => void; photo: string }) {
  return (
    <div className="photo-matched">
      <img src={photo} alt="Your photo" />
      <div>
        <p>Matched to your photo</p>
        <p className="muted small">Change anything below.</p>
      </div>
      {onPhoto && (
        <button type="button" className="link" onClick={onPhoto}>
          New photo
        </button>
      )}
    </div>
  );
}
