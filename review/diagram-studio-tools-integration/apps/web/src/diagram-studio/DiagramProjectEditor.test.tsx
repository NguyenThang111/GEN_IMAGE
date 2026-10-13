import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api, type DiagramCircuit, type DiagramProject } from '../api';
import { circuitHasData, DiagramProjectEditActions, DiagramProjectEditor, projectEditInput } from './DiagramProjectEditor';
import { getDraftPaths } from './DiagramConverterView';
import type { ElectricalDiagram } from './contract';

const circuit = { id: 'slot', circuitKey: 'night', circuitTitle: 'Mạch đèn đêm', required: true, status: 'REGISTERED' } as DiagramCircuit;
const project = { id: 'project', vehicleId: 'vision', vehicleTitle: 'Vision', manufacturer: 'Honda', modelYear: '2024', ecmId: null, scuId: null, circuits: [circuit] } as DiagramProject;
afterEach(() => vi.unstubAllGlobals());
describe('Admin project editor', () => {
  it('exposes editing to Diagram Editors, not ordinary members', () => {
    expect(renderToStaticMarkup(<DiagramProjectEditActions canEdit={false} onEdit={() => {}}/>)).toBe('');
    expect(renderToStaticMarkup(<DiagramProjectEditActions canEdit onEdit={() => {}}/>)).toContain('Sửa thông tin');
  });
  it('renders all metadata fields and the circuit registry', () => {
    const html = renderToStaticMarkup(<DiagramProjectEditor project={project} api={new Api('fixture')} canArchive onSaved={() => {}} onArchived={() => {}} onCancel={() => {}}/>);
    for (const text of ['Tên xe / Project', 'Vehicle ID', 'Hãng', 'Năm xe', 'ECM ID', 'SCU ID', 'Mã sơ đồ', 'Tên sơ đồ', 'Bắt buộc', 'Lưu thay đổi', 'Xóa project…']) expect(html).toContain(text);
  });
  it('lets Dev edit every field without showing deletion controls', () => {
    const html = renderToStaticMarkup(<DiagramProjectEditor project={project} api={new Api('fixture')} canArchive={false} onSaved={() => {}} onArchived={() => {}} onCancel={() => {}}/>);
    for (const text of ['Tên xe / Project', 'Vehicle ID', 'Hãng', 'Năm xe', 'ECM ID', 'SCU ID', 'Mã sơ đồ', 'Tên sơ đồ', 'Lưu thay đổi']) expect(html).toContain(text);
    expect(html).not.toContain('Xóa project');
    expect(html).not.toContain('Xác nhận xóa');
  });
  it('copies metadata without including schema or source data', () => {
    const input = projectEditInput({ ...project, circuits: [{ ...circuit, schema: { components: [] } }] });
    expect(input.ecmId).toBe(''); expect(input.scuId).toBe('');
    expect(Object.keys(input.circuits[0])).toEqual(['id', 'circuitKey', 'circuitTitle', 'required']);
    input.circuits[0].circuitTitle = 'Changed'; expect(circuit.circuitTitle).toBe('Mạch đèn đêm');
  });
  it('protects any existing output or review from removal', () => {
    expect(circuitHasData(circuit)).toBe(false);
    for (const extra of [{ schema: {} }, { sourceFileName: 'image.png' }, { sourceByteSize: 10 }, { validationErrors: [] }, { generatedByModel: 'manual' }, { status: 'NEEDS_REVIEW' as const }]) expect(circuitHasData({ ...circuit, ...extra })).toBe(true);
  });
  it('exports using updated vehicle and slot identity', () => {
    const paths = getDraftPaths({ id: 'vision-2026-night-light', vehicleId: 'vision-2026', vehicleTitle: 'Vision 2026', circuitTitle: 'Đèn đêm' } as ElectricalDiagram, 'old-source.png');
    expect(paths.json).toBe('vision-2026/night-light/vision-2026-night-light.schema.json');
    expect(paths.image).toBe('vision-2026/night-light/vision-2026-night-light.source.png');
  });
  it('sends updates and exact deletion confirmation to dedicated endpoints', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => project }); vi.stubGlobal('fetch', fetch);
    const api = new Api('fixture'); const input = projectEditInput(project);
    await api.updateDiagramProject(project.id, input);
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/diagram-projects/project'), expect.objectContaining({ method: 'PATCH', body: JSON.stringify(input) }));
    await api.archiveDiagramProject(project.id, 'Vision');
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/diagram-projects/project/archive'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ confirmationTitle: 'Vision' }) }));
  });
});
