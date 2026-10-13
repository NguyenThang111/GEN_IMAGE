import { ConfigService } from '@nestjs/config';
import { DiagramAiService, normalizeDraftGeometry } from './diagram-ai.service';
import { UserRole } from '../users/user.entity';

const actor = { id: 'admin', username: 'admin', displayName: 'Admin', role: UserRole.ADMIN };
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

describe('DiagramAiService', () => {
  afterEach(() => jest.restoreAllMocks());
  it.each([actor, { ...actor, username: 'phu', role: UserRole.MEMBER }, { ...actor, username: 'thang', role: UserRole.MEMBER }])('allows $username to generate a draft and preserves warnings', async editor => {
    const config = { get: (key: string) => key === 'OPENAI_API_KEY' ? 'test-key' : key === 'DIAGRAM_AI_MODEL' ? 'test-model' : undefined } as ConfigService;
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ output_text: JSON.stringify({ components: [], wires: [], warnings: ['Cần kiểm tra'], uncertainItems: ['Dây mờ'] }) }) } as Response);
    const result = await new DiagramAiService(config).generateDraft({ buffer: image, mimetype: 'image/png', originalname: 'source.png', size: image.length }, editor);
    expect(result.diagram.reviewStatus).toBe('draft'); expect(result.diagram.sourceImage).toBe('source.png'); expect(result.warnings).toEqual(['Cần kiểm tra']); expect(result.model).toBe('test-model');
    const request = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(request.input[0].content[1].image_url).toMatch(/^data:image\/png;base64,/);
    expect(request.text.format.schema.properties.components.items.properties.type.enum).toEqual(expect.arrayContaining(['ecm', 'scu', 'acg', 'connector', 'sensor', 'motor', 'device']));
  });
  it('keeps load-list text layout and loose note text in generated drafts',async()=>{
    const config={get:(key:string)=>key==='OPENAI_API_KEY'?'test-key':undefined} as ConfigService;
    const text={kind:'text',text:'CỤM ĐỒNG HỒ',x:20,y:40,size:12,anchor:'start',rotate:0,bold:true,fill:'#343434',lineHeight:18};
    const layout={kind:'load-list',texts:[text],paths:[],padding:10};
    const annotations=[{id:'note',elements:[{...text,text:'GHI CHÚ\n6P / Bl: Đầu nối 6 chân, màu đen'}]}];
    const fetchMock=jest.spyOn(global,'fetch').mockResolvedValue({ok:true,json:async()=>({output_text:JSON.stringify({components:[{id:'loads',type:'device',x:0,y:0,width:40,height:40,label:'CỤM ĐỒNG HỒ',textLayout:layout,terminals:[]},{id:'regular',type:'device',x:50,y:0,width:40,height:40,label:'USB',textLayout:null,terminals:[]}],wires:[],annotations,warnings:[],uncertainItems:[]})})} as Response);
    const result=await new DiagramAiService(config).generateDraft({buffer:image,mimetype:'image/png',originalname:'source.png',size:image.length},actor);
    expect(result.diagram.components[0].textLayout).toEqual(layout);expect(result.diagram.components[1]).not.toHaveProperty('textLayout');expect(result.diagram.annotations).toEqual(annotations);
    const request=JSON.parse(String(fetchMock.mock.calls[0][1]!.body));
    expect(request.text.format.schema.required).toContain('annotations');expect(request.text.format.schema.properties.components.items.required).toContain('textLayout');
    expect(request.input[0].content[0].text).toContain('Tiêu đề căn giữa, nội dung căn trái');
  });
  it('rejects use without a server-side API key', async () => {
    const service = new DiagramAiService({ get: () => undefined } as unknown as ConfigService);
    await expect(service.generateDraft({ buffer: image, mimetype: 'image/png', originalname: 'source.png', size: image.length }, actor)).rejects.toThrow('OPENAI_API_KEY');
  });
  it('denies non-Dev before contacting the AI provider', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const service = new DiagramAiService({ get: () => 'test-key' } as unknown as ConfigService);
    await expect(service.generateDraft({ buffer: image, mimetype: 'image/png', originalname: 'source.png', size: image.length }, { ...actor, username: 'phongbk', role: UserRole.MEMBER })).rejects.toThrow('Chỉ Admin hoặc Dev');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('defaults to Astra with structured output and no storage', async () => {
    const config = { get: (key: string) => key === 'OPENAI_API_KEY' ? 'test-key' : undefined } as ConfigService;
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ output_text: JSON.stringify({ components: [], wires: [], warnings: [], uncertainItems: [] }) }) } as Response);
    const result = await new DiagramAiService(config).generateDraft({ buffer: image, mimetype: 'image/png', originalname: 'source.png', size: image.length }, actor);
    const request = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(result.model).toBe('gpt-6-astra');
    expect(request).toMatchObject({ model: 'gpt-6-astra', store: false, text: { format: { type: 'json_schema', strict: true } } });
  });
  it('keeps PNG pixel colors and uses dimensions after resizing', async () => {
    const sharp = require('sharp');
    const source = await sharp({create:{width:3000,height:600,channels:3,background:{r:15,g:170,b:65}}}).png().toBuffer();
    const config = {get:(key:string)=>key==='OPENAI_API_KEY'?'test-key':undefined} as ConfigService;
    const fetchMock=jest.spyOn(global,'fetch').mockResolvedValue({ok:true,json:async()=>({output_text:JSON.stringify({components:[],wires:[],warnings:[],uncertainItems:[]})})} as Response);
    const result=await new DiagramAiService(config).generateDraft({buffer:source,mimetype:'image/png',originalname:'large.png',size:source.length},actor);
    expect(result.diagram.canvas).toEqual({width:2400,height:480});
    const request=JSON.parse(String(fetchMock.mock.calls[0][1]!.body));
    const imageUrl=request.input[0].content[1].image_url;const png=Buffer.from(imageUrl.split(',')[1],'base64');
    expect(png.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
    const pixels=await sharp(png).raw().toBuffer();expect([...pixels.subarray(0,3)]).toEqual([15,170,65]);
    expect(request.input[0].content[0].text).toContain('2400x480');
  });
  it('rejects corrupted images before contacting the provider', async()=>{
    const fetchMock=jest.spyOn(global,'fetch');const service=new DiagramAiService({get:()=> 'test-key'} as unknown as ConfigService);
    await expect(service.generateDraft({buffer:Buffer.from('broken'),mimetype:'image/png',originalname:'bad.png',size:6},actor)).rejects.toThrow('Ảnh bị hỏng');expect(fetchMock).not.toHaveBeenCalled();
  });
  it('snaps AI wire endpoints to terminals and keeps every segment Manhattan', () => {
    const components = [{ id: 'left', terminals: [{ id: 'out', x: 10, y: 20 }] }, { id: 'right', terminals: [{ id: 'in', x: 90, y: 70 }] }];
    const [wire] = normalizeDraftGeometry(components, [{ id: 'wire', from: { componentId: 'left', terminalId: 'out' }, to: { componentId: 'right', terminalId: 'in' }, points: [{ x: 14, y: 22 }, { x: 48, y: 44 }, { x: 86, y: 68 }] }]);
    expect(wire.points[0]).toEqual({ x: 10, y: 20 });
    expect(wire.points.at(-1)).toEqual({ x: 90, y: 70 });
    expect(wire.points.slice(1).every((point: { x: number; y: number }, index: number) => point.x === wire.points[index].x || point.y === wire.points[index].y)).toBe(true);
  });
});
