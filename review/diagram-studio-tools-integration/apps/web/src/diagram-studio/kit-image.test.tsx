import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { adjustPixels, canvasToSource, kitReference, preparationGeometry, sha256, sourceToCanvas, type PreparationManifest } from './kit-image';
import { DiagramKitWorkbench } from './DiagramKitWorkbench';

const settings = { crop: { x: 100, y: 50, width: 800, height: 600 }, maxEdge: 400, brightness: 100, contrast: 100 };
describe('KIT preparation', () => {
  it('uses bounded crop-scale without upscaling', () => {
    expect(preparationGeometry(1000, 700, settings)).toEqual({ canvas: { width: 400, height: 300 }, scale: { x: .5, y: .5 } });
    expect(preparationGeometry(1000, 700, { ...settings, maxEdge: 2400 }).canvas).toEqual({ width: 800, height: 600 });
  });
  it.each([{ x: -1 }, { width: 0 }, { width: 901 }, { y: 101, height: 600 }, { x: NaN }, { width: 1.5 }])('rejects invalid crop %j', patch => {
    expect(() => preparationGeometry(1000, 700, { ...settings, crop: { ...settings.crop, ...patch } })).toThrow();
  });
  it('rejects oversize processing and unsupported adjustments', () => {
    for (const patch of [{ maxEdge: 2401 }, { brightness: 150 }, { contrast: NaN }]) expect(() => preparationGeometry(1000, 700, { ...settings, ...patch })).toThrow();
    expect(() => preparationGeometry(12000, 12000, settings)).toThrow();
  });
  it('round-trips reference points through actual output ratios', () => {
    const manifest = { crop: settings.crop, ...preparationGeometry(1000, 700, settings) };
    for (const point of [{ x: 100, y: 50 }, { x: 500, y: 300 }, { x: 900, y: 650 }]) expect(canvasToSource(sourceToCanvas(point, manifest), manifest)).toEqual(point);
  });
  it('preserves default channels, alpha and thin white/colored pixel samples', () => {
    const pixels = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 128]);
    const before = pixels.slice(); adjustPixels(pixels, 100, 100); expect(pixels).toEqual(before);
    adjustPixels(pixels, 110, 110); expect(pixels[11]).toBe(128); expect(pixels[3]).toBe(255);
  });
  it('hashes original bytes without mutation', async () => {
    const original = new Blob(['abc']); expect(await sha256(original)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'); expect(await original.text()).toBe('abc');
  });
  it('never derives reference facts or coverage from candidate', () => {
    const manifest = { source: { sha256: 'a'.repeat(64), width: 1000, height: 700 }, crop: settings.crop, canvas: { width: 400, height: 300 } } as PreparationManifest;
    const reference = kitReference(manifest);
    expect(reference.source.crop).toEqual([100, 50, 800, 600]); expect(reference.texts).toEqual([]); expect(reference.nets).toEqual([]);
    expect(Object.values(reference.coverage).every(value => value === false)).toBe(true); expect(reference.unresolved.length).toBe(1);
  });
  it('initial UI never calls APIs and states local-only scope', () => {
    const generateDiagramDraft = vi.fn();
    const html = renderToStaticMarkup(<DiagramKitWorkbench api={{ generateDiagramDraft } as never}/>);
    expect(generateDiagramDraft).not.toHaveBeenCalled(); expect(html).toContain('Chọn ảnh nguồn'); expect(html).toContain('chưa lưu DB');
    expect(html).not.toContain('Dùng ảnh này → GEN AI');
  });
});
