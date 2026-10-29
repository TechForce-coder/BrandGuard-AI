import React, { useState, useMemo } from 'react';
import { GitCompare, Columns, AlignJustify } from 'lucide-react';

/**
 * Computes line-by-line LCS diff without external dependencies.
 */
function computeLineDiff(oldText = '', newText = '') {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const matrix = Array.from({ length: oldLines.length + 1 }, () =>
    new Array(newLines.length + 1).fill(0)
  );

  for (let i = 1; i <= oldLines.length; i++) {
    for (let j = 1; j <= newLines.length; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
      }
    }
  }

  let i = oldLines.length;
  let j = newLines.length;
  const result = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: 'unchanged', text: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
      result.unshift({ type: 'added', text: newLines[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || matrix[i][j - 1] < matrix[i - 1][j])) {
      result.unshift({ type: 'removed', text: oldLines[i - 1] });
      i--;
    }
  }

  return result;
}

export default function DiffViewer({
  originalContent = '',
  currentContent = '',
  className = ''
}) {
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'unified'

  const diffLines = useMemo(() => {
    return computeLineDiff(originalContent, currentContent);
  }, [originalContent, currentContent]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    diffLines.forEach(line => {
      if (line.type === 'added') added++;
      if (line.type === 'removed') removed++;
    });
    return { added, removed };
  }, [diffLines]);

  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <GitCompare size={16} className="text-blue-700" />
          <span className="text-xs font-semibold text-slate-800">Content Revision Comparison</span>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <span className="text-emerald-700 font-medium">+{stats.added}</span>
            <span className="text-rose-700 font-medium">-{stats.removed}</span>
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition ${
              viewMode === 'split'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Columns size={13} />
            Split
          </button>
          <button
            type="button"
            onClick={() => setViewMode('unified')}
            className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition ${
              viewMode === 'unified'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlignJustify size={13} />
            Unified
          </button>
        </div>
      </div>

      {/* Diff Output */}
      {viewMode === 'split' ? (
        <div className="grid grid-cols-1 divide-y divide-slate-200 md:grid-cols-2 md:divide-x md:divide-y-0 text-xs font-mono">
          {/* Baseline Side */}
          <div className="flex flex-col">
            <div className="border-b border-slate-100 bg-rose-50/60 px-4 py-1.5 font-sans font-semibold text-rose-900">
              Original Baseline
            </div>
            <div className="max-h-96 overflow-auto p-4 space-y-1">
              {originalContent ? (
                originalContent.split('\n').map((line, idx) => (
                  <div key={idx} className="whitespace-pre-wrap text-slate-800 leading-relaxed">
                    {line || '\u00A0'}
                  </div>
                ))
              ) : (
                <p className="font-sans text-slate-400 italic">No original baseline recorded.</p>
              )}
            </div>
          </div>

          {/* Current Side */}
          <div className="flex flex-col">
            <div className="border-b border-slate-100 bg-emerald-50/60 px-4 py-1.5 font-sans font-semibold text-emerald-900">
              Current Version
            </div>
            <div className="max-h-96 overflow-auto p-4 space-y-1">
              {currentContent ? (
                currentContent.split('\n').map((line, idx) => (
                  <div key={idx} className="whitespace-pre-wrap text-slate-800 leading-relaxed">
                    {line || '\u00A0'}
                  </div>
                ))
              ) : (
                <p className="font-sans text-slate-400 italic">No current content.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="max-h-96 overflow-auto p-4 font-mono text-xs">
          {diffLines.length > 0 ? (
            diffLines.map((line, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-2 px-2 py-0.5 rounded leading-relaxed whitespace-pre-wrap ${
                  line.type === 'added'
                    ? 'bg-emerald-50 text-emerald-900'
                    : line.type === 'removed'
                    ? 'bg-rose-50 text-rose-900 line-through opacity-80'
                    : 'text-slate-800'
                }`}
              >
                <span className="w-4 shrink-0 font-bold select-none text-slate-400">
                  {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                </span>
                <span>{line.text || '\u00A0'}</span>
              </div>
            ))
          ) : (
            <p className="font-sans text-slate-400 italic">No difference detected.</p>
          )}
        </div>
      )}
    </div>
  );
}