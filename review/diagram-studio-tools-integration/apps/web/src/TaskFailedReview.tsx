import type { Task } from './api';

export function isFailedTask(task: Pick<Task, 'status' | 'reviewResult'>) {
  return task.status === 'DONE' && task.reviewResult === 'FAILED';
}

export function TaskFailedReview({ task }: { task: Task }) {
  const review = task.failedReview;
  return <div className="taskFailedReview">
    <p><b>Lý do không đạt:</b> {review?.reason?.trim() || 'Chưa có lý do trong lịch sử đánh giá.'}</p>
    <small>Phụ trách: {task.assignees?.map(item => item.user.displayName).join(', ') || 'Chưa giao người làm'}</small>
    <small>{review?.reviewedAt ? <>Đánh giá: <time dateTime={review.reviewedAt}>{new Date(review.reviewedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</time>{review.reviewerName && ` · ${review.reviewerName}`}</> : 'Chưa có ngày đánh giá trong lịch sử.'}</small>
  </div>;
}
