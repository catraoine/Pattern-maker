/** You stay in what you picked to make; this quiet link opens the list to pick something else. */
export function GarmentSwitch({ onChoose }: { onChoose: () => void }) {
  return (
    <button type="button" className="link quiet garment-change" onClick={onChoose}>
      Choose another garment
    </button>
  );
}
