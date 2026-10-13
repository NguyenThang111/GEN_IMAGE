import { BadGatewayException, BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthUser } from '../auth/auth.types';
import { requireDiagramEditor } from '../diagram-projects/diagram-access.policy';

const sharp = require('sharp') as (input: Buffer) => import('sharp').Sharp;
const COMPONENT_TYPES = ['battery', 'fuse', 'relay', 'switch', 'selectorSwitch', 'scu', 'ecm', 'acg', 'connector', 'ground', 'junction', 'horn', 'flasher', 'diode', 'lamp', 'gauge', 'sensor', 'ignitionCoil', 'sparkPlug', 'motor', 'injector', 'pump', 'valve', 'device'] as const;

const pointSchema = { type: 'object', additionalProperties: false, required: ['x', 'y'], properties: { x: { type: 'number' }, y: { type: 'number' } } };
const drawingTextSchema = { type: 'object', additionalProperties: false, required: ['kind','text','x','y','size','anchor','rotate','bold','fill','lineHeight'], properties: {
 kind:{type:'string',enum:['text']},text:{type:'string'},x:{type:'number'},y:{type:'number'},size:{type:'number'},anchor:{type:'string',enum:['start','middle','end']},rotate:{type:'number'},bold:{type:'boolean'},fill:{type:'string'},lineHeight:{type:'number'},
} };
const drawingPathSchema = { type:'object',additionalProperties:false,required:['kind','points','stroke','width','closed','fill'],properties:{
 kind:{type:'string',enum:['path']},points:{type:'array',minItems:2,items:{type:'array',minItems:2,maxItems:2,items:{type:'number'}}},stroke:{type:'string'},width:{type:'number'},closed:{type:'boolean'},fill:{type:'string'},
} };
const textLayoutSchema = { type:['object','null'],additionalProperties:false,required:['kind','texts','paths','padding'],properties:{
 kind:{type:'string',enum:['component','load-list','note-box']},texts:{type:'array',items:drawingTextSchema},paths:{type:'array',items:drawingPathSchema},padding:{type:'number'},
} };
const draftSchema = {
  type: 'object', additionalProperties: false, required: ['components', 'wires', 'annotations', 'warnings', 'uncertainItems'],
  properties: {
    components: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'type', 'x', 'y', 'width', 'height', 'label', 'terminals', 'textLayout'], properties: {
      id: { type: 'string' }, type: { type: 'string', enum: COMPONENT_TYPES }, x: { type: 'number' }, y: { type: 'number' }, width: { type: 'number' }, height: { type: 'number' }, label: { type: 'string' },
      textLayout: textLayoutSchema,
      terminals: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'label', 'x', 'y'], properties: { id: { type: 'string' }, label: { type: ['string', 'null'] }, x: { type: 'number' }, y: { type: 'number' } } } },
    } } },
    wires: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'from', 'to', 'points', 'code', 'primaryColor', 'stripeColor'], properties: {
      id: { type: 'string' },
      from: { type: 'object', additionalProperties: false, required: ['componentId', 'terminalId'], properties: { componentId: { type: 'string' }, terminalId: { type: 'string' } } },
      to: { type: 'object', additionalProperties: false, required: ['componentId', 'terminalId'], properties: { componentId: { type: 'string' }, terminalId: { type: 'string' } } },
      points: { type: 'array', minItems: 2, items: pointSchema }, code: { type: 'string' }, primaryColor: { type: 'string' }, stripeColor: { type: ['string', 'null'] },
    } } },
    annotations:{type:'array',items:{type:'object',additionalProperties:false,required:['id','elements'],properties:{id:{type:'string'},elements:{type:'array',items:{anyOf:[drawingTextSchema,drawingPathSchema]}}}}},
    warnings: { type: 'array', items: { type: 'string' } }, uncertainItems: { type: 'array', items: { type: 'string' } },
  },
};

type UploadedDiagram = { buffer: Buffer; mimetype: string; originalname: string; size: number };
type OpenAiResponse = { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
function responseText(response: OpenAiResponse) { if (response.output_text) return response.output_text; for (const item of response.output ?? []) for (const content of item.content ?? []) if (content.type === 'output_text' && content.text) return content.text; return ''; }
type Point = { x: number; y: number };

function samePoint(left: Point, right: Point) { return left.x === right.x && left.y === right.y; }
function manhattanPoints(from: Point, interior: Point[], to: Point) {
  const result: Point[] = [{ ...from }];
  [...interior, to].forEach(target => {
    const previous = result[result.length - 1];
    if (samePoint(previous, target)) return;
    if (previous.x !== target.x && previous.y !== target.y) result.push({ x: target.x, y: previous.y });
    if (!samePoint(result[result.length - 1], target)) result.push({ ...target });
  });
  return result;
}

export function normalizeDraftGeometry(components: any[], wires: any[]) {
  const terminals = new Map<string, Point>();
  components.forEach(component => component.terminals.forEach((terminal: Point & { id: string }) => terminals.set(`${component.id}.${terminal.id}`, terminal)));
  return wires.map(wire => {
    const from = terminals.get(`${wire.from.componentId}.${wire.from.terminalId}`);
    const to = terminals.get(`${wire.to.componentId}.${wire.to.terminalId}`);
    if (!from || !to) return wire;
    return { ...wire, points: manhattanPoints({ x: from.x, y: from.y }, wire.points.slice(1, -1), { x: to.x, y: to.y }) };
  });
}

@Injectable()
export class DiagramAiService {
  constructor(private readonly config: ConfigService) {}

  async generateDraft(file: UploadedDiagram, actor: AuthUser) {
    requireDiagramEditor(actor);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) throw new BadRequestException('Chỉ nhận ảnh JPEG, PNG hoặc WebP');
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) throw new ServiceUnavailableException('Server chưa cấu hình OPENAI_API_KEY');
    const model = this.config.get<string>('DIAGRAM_AI_MODEL') || 'gpt-6-astra';
    let prepared: { data: Buffer; info: { width: number; height: number } };
    try { prepared = await sharp(file.buffer).rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true }); }
    catch { throw new BadRequestException('Ảnh bị hỏng hoặc không đọc được'); }
    const image = prepared.data; const metadata = prepared.info;
    const prompt = [
      `Đọc sơ đồ điện xe máy trong ảnh. Hệ tọa độ output là pixel ảnh PNG được gửi ${metadata.width}x${metadata.height}.`,
      `Chỉ dùng symbol: ${COMPONENT_TYPES.join(', ')}. ECM, SCU, ACG, connector và sensor được phép khi nhìn thấy trong ảnh, nhưng chỉ tạo terminal/pin có nhãn hoặc điểm chạm dây nhìn thấy rõ; không suy đoán pin bị che hoặc không đọc được.`,
      'Mỗi component cần bounds quanh chính symbol, terminal nằm đúng điểm dây chạm symbol. Mỗi wire nối hai terminal thật và points chỉ gồm đoạn ngang/dọc.',
      'Chép đầy đủ chữ tiếng Việt, dấu câu, đơn vị và từng dòng tên tải trong các cụm mạch nguồn. Dùng textLayout cho chữ có vị trí riêng; null khi chỉ cần label thông thường.',
      'Cụm liệt kê tải dùng type device, textLayout.kind load-list: mỗi dòng là text căn trái ở vị trí nhìn thấy; label bằng các dòng nối bằng ký tự xuống dòng. Vẽ đường gom tải trong paths, không thay danh sách chữ bằng ký hiệu linh kiện.',
      'Khung GHI CHÚ, lưu ý và note là annotations (path khung và text nội dung), không có chân điện. Với khung đã gắn component, dùng device và textLayout.kind note-box. Tiêu đề căn giữa, nội dung căn trái, giữ lề trong khung và khoảng cách dòng. Chữ quay phải có rotate. Phần không đọc rõ ghi uncertainItems.',
      'Giữ mã màu dây nhìn thấy như R, R/Bl, G/Bu. primaryColor/stripeColor là hex; nếu không chắc dùng #4b5563 và ghi uncertainItems.',
      'Crossing không có junction thì không nối. Junction chỉ tạo khi ảnh thể hiện điểm nối rõ. Không suy đoán phần bị che/mờ; ghi warning bằng tiếng Việt.',
      'ID ngắn, ổn định, lowercase-kebab-case. Đây chỉ là draft để human review.',
    ].join('\n');
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, store: false, input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_image', image_url: `data:image/png;base64,${image.toString('base64')}`, detail: 'high' }] }], text: { format: { type: 'json_schema', name: 'electrical_diagram_draft', strict: true, schema: draftSchema } } }),
    });
    if (!response.ok) { const detail = await response.text(); throw new BadGatewayException(`AI provider lỗi ${response.status}: ${detail.slice(0, 240)}`); }
    const raw = responseText(await response.json() as OpenAiResponse);
    if (!raw) throw new BadGatewayException('AI provider không trả structured output');
    let draft: any; try { draft = JSON.parse(raw); } catch { throw new BadGatewayException('AI provider trả JSON không đọc được'); }
    const components = draft.components.map(({textLayout,...component}: any) => ({ ...component, ...(textLayout ? {textLayout} : {}), terminals: component.terminals.map((terminal: any) => terminal.label ? terminal : { id: terminal.id, x: terminal.x, y: terminal.y }) }));
    const wires = normalizeDraftGeometry(components, draft.wires).map((wire: any) => wire.stripeColor ? { ...wire, state: 'controlled' } : { id: wire.id, from: wire.from, to: wire.to, points: wire.points, code: wire.code, primaryColor: wire.primaryColor, state: 'controlled' });
    return {
      diagram: {
        schemaVersion: 1, reviewStatus: 'draft', sourceImage: file.originalname,
        id: 'diagram-ai-draft', vehicleId: 'vehicle-id', vehicleTitle: 'Tên xe', circuitTitle: 'Tên mạch', canvas: { width: metadata.width, height: metadata.height },
        components, wires, annotations: draft.annotations ?? [],
      }, warnings: draft.warnings, uncertainItems: draft.uncertainItems, model,
    };
  }
}
