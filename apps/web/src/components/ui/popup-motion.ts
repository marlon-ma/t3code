// Enter settles over 150ms; exit is shorter and accelerates away. Popups add their own origin.
const POPUP_MOTION_CLASS =
  "transition-[scale,opacity] duration-150 ease-emphasized data-starting-style:scale-98 data-starting-style:opacity-0 data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-100 data-ending-style:ease-exit data-instant:transition-none motion-reduce:transition-none";

export { POPUP_MOTION_CLASS };
