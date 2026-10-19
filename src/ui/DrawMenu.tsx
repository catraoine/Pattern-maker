import { ReactNode, useRef } from 'react';

/** The ways to draw on a garment behind one Draw button, so the row above the sketch stays short. A tap on
 * any of them closes the list. */
export function DrawMenu({ children }: { children: ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null);
  return (
    <details className="drawmenu" ref={menu}>
      <summary>Draw</summary>
      <div className="drawmenu-list" onClick={() => menu.current?.removeAttribute('open')}>
        {children}
      </div>
    </details>
  );
}
