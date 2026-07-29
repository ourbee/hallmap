/*
 * Copyright © 2026 Ritwik Balo. All rights reserved.
 * https://github.com/ourbee
 */

import { useRef, useState } from 'react';
import type { ReactNode } from 'react';

// Click-to-browse plus drag-and-drop file target.
export function FileDrop({
  accept,
  multiple = false,
  onFiles,
  children,
}: {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  children: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div
      className="file-drop"
      style={over ? { borderColor: 'var(--primary)', background: 'var(--primary-soft)' } : undefined}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
      }}
    >
      {children}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onFiles(files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
