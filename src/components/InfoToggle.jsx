// Kleines "ⓘ"-Symbol, das per Klick einen Infotext-Popover einblendet.
export default function InfoToggle({ text }) {
  return (
    <details className="info-details">
      <summary aria-label="Info anzeigen">ⓘ</summary>
      <p>{text}</p>
    </details>
  );
}
