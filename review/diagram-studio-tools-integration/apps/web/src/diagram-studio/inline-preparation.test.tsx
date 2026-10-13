import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { DiagramConverterView, buildDraftReview, getDraftPaths } from './DiagramConverterView';
import { DiagramProjectManagerView } from './DiagramProjectManagerView';
import type { ElectricalDiagram } from './contract';
import type { PreparationManifest } from './kit-image';

describe('inline preparation entry and review', () => {
  it('does not generate or save on open and describes an explicit upload/confirm flow', () => {
    const api = { generateDiagramDraft: vi.fn(), saveDiagramCircuitDraft: vi.fn() };
    const html = renderToStaticMarkup(<DiagramConverterView api={api as never}/>);
    expect(html).toContain('Upload ảnh');
    expect(html).not.toContain('AI sẽ tự chạy ngay');
    expect(html).toContain('Dùng ảnh này để tạo sơ đồ');
    expect(api.generateDiagramDraft).not.toHaveBeenCalled();
    expect(api.saveDiagramCircuitDraft).not.toHaveBeenCalled();
  });
  it('removes separate KIT entry even for editors', () => {
    expect(renderToStaticMarkup(<DiagramProjectManagerView api={{} as never} canEdit admin/>)).not.toContain('Thử KIT');
  });
  it('exports original source links and declares prepared coordinate space', () => {
    const diagram = { id: 'bike-lamp', vehicleId: 'bike', vehicleTitle: 'Bike', circuitTitle: 'Lamp', canvas: { width: 300, height: 200 }, components: [], wires: [] } as ElectricalDiagram;
    const preparation = { canvas: diagram.canvas, crop: { x: 100, y: 50, width: 600, height: 400 }, adjustments: { brightness: 105, contrast: 100 } } as PreparationManifest;
    const text = buildDraftReview(diagram, { warnings: [], uncertainItems: [], model: 'test', preparation }, [], '', getDraftPaths(diagram, 'original.png'));
    expect(text).toContain('./bike-lamp.source.png');
    expect(text).toContain('./bike-lamp.preparation.json');
    expect(text).toContain('300×200');
    expect(text).toContain('không phải tọa độ ảnh gốc');
  });
});
