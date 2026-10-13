import 'reflect-metadata';
import { validate } from 'class-validator';
import { CreateTaskDto, UpdateTaskDto } from './task.dto';

describe('Task DTO for Task-Worklog flow', () => {
  it('accepts empty assignees only on update', async () => {
    expect(await validate(Object.assign(new UpdateTaskDto(),{assigneeIds:[]}))).toHaveLength(0);
    expect((await validate(Object.assign(new CreateTaskDto(),{assigneeIds:[]}))).some(error=>error.property==='assigneeIds')).toBe(true);
    expect((await validate(Object.assign(new UpdateTaskDto(),{assigneeIds:['not-a-uuid']}))).some(error=>error.property==='assigneeIds')).toBe(true);
  });
  it('accepts description, optional suggestion and Key Results without Due or Point', async () => {
    const dto = Object.assign(new CreateTaskDto(), {
      title: 'ScanBox firmware',
      note: 'Điều tra luồng giao tiếp',
      suggestion: 'Xem log UART trước',
      assigneeIds: ['11111111-1111-4111-8111-111111111111'],
      criteria: ['Có kết luận kèm bằng chứng'],
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a Task without a Key Result', async () => {
    const dto = Object.assign(new CreateTaskDto(), {
      title: 'ScanBox firmware',
      note: 'Điều tra luồng giao tiếp',
      assigneeIds: ['11111111-1111-4111-8111-111111111111'],
      criteria: [],
    });
    expect((await validate(dto)).some((error) => error.property === 'criteria')).toBe(true);
  });

  it('allows Admin to clear the optional suggestion', async () => {
    const dto = Object.assign(new UpdateTaskDto(), { suggestion: null });
    expect(await validate(dto)).toHaveLength(0);
  });
});
