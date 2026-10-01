"use client";

/** v1 uses the browser's print-to-PDF rather than building PDF export. */
export function PrintButton() {
  return (
    <button type="button" className="btn-primary" onClick={() => window.print()}>
      Print or save as PDF
    </button>
  );
}
