import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { RetrieveTaskDto } from './dto/retrieve-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueueService } from '../queue/queue.service';

type TaskRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: Date | null;
  created_at: Date;
  category_id: string | null;
  category_name: string | null;
};

@Injectable()
export class TaskService {
  constructor(
    private readonly db: DatabaseService,
    private readonly queue: QueueService,
  ) {}

  async findAll(user_id: string): Promise<RetrieveTaskDto[]> {
    const tasks = await this.db.query<TaskRow>(
      `SELECT t.id, t.user_id, t.title, t.description, t.status, t.due_date, t.created_at,
              c.id AS category_id, c.name AS category_name
       FROM tasks t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = $1
       ORDER BY t.created_at DESC`,
      [user_id],
    );

    return tasks.rows.map((task) => this.toDto(task));
  }

  async create(user_id: string, dto: CreateTaskDto): Promise<RetrieveTaskDto> {
    if (dto.category_id) {
      await this.ensureCategoryOwnedByUser(user_id, dto.category_id);
    }

    const task = await this.db.query<TaskRow>(
      `INSERT INTO tasks (user_id, title, description, due_date, category_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, title, description, status, due_date, created_at, category_id, NULL::TEXT AS category_name`,
      [
        user_id,
        dto.title,
        dto.description,
        dto.due_date,
        dto.category_id ?? null,
      ],
    );

    await this.queue.sendEmail({
      to: 'vlqvinh444@gmail.com',
      subject: `New task created: ${task.rows[0].title}`,
      message: `A new task has been created: ${task.rows[0].title}`,
    });

    return this.getTaskById(idOrThrow(task.rows[0]), user_id);
  }

  async update(
    user_id: string,
    id: string,
    dto: UpdateTaskDto,
  ): Promise<RetrieveTaskDto> {
    await this.findOwnedOrFail(user_id, id);

    if (dto.category_id) {
      await this.ensureCategoryOwnedByUser(user_id, dto.category_id);
    }

    await this.db.query(
      `UPDATE tasks
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           due_date = COALESCE($3, due_date),
           category_id = COALESCE($4, category_id)
       WHERE id = $5`,
      [
        dto.title ?? null,
        dto.description ?? null,
        dto.due_date ?? null,
        dto.category_id ?? null,
        id,
      ],
    );

    return this.getTaskById(id, user_id);
  }

  async remove(user_id: string, id: string): Promise<void> {
    await this.findOwnedOrFail(user_id, id);
    await this.db.query('DELETE FROM tasks WHERE id = $1', [id]);
  }

  private toDto(task: TaskRow): RetrieveTaskDto {
    return {
      id: task.id as RetrieveTaskDto['id'],
      title: task.title,
      description: task.description ?? '',
      due_date: task.due_date ?? new Date(0),
      status: task.status,
      created_at: task.created_at,
      category: task.category_id
        ? {
            id: task.category_id as RetrieveTaskDto['id'],
            name: task.category_name ?? '',
          }
        : null,
    };
  }

  private async findOwnedOrFail(user_id: string, id: string): Promise<void> {
    const task = await this.db.query<{ id: string; user_id: string }>(
      'SELECT id, user_id FROM tasks WHERE id = $1 LIMIT 1',
      [id],
    );

    if (!task.rowCount) {
      throw new NotFoundException(`Task ${id} not found`);
    }

    if (task.rows[0].user_id !== user_id) {
      throw new ForbiddenException('Access denied');
    }
  }

  private async ensureCategoryOwnedByUser(
    user_id: string,
    category_id: string,
  ): Promise<void> {
    const category = await this.db.query<{ user_id: string }>(
      'SELECT user_id FROM categories WHERE id = $1 LIMIT 1',
      [category_id],
    );

    if (!category.rowCount) {
      throw new BadRequestException(`Category ${category_id} not found`);
    }

    if (category.rows[0].user_id !== user_id) {
      throw new ForbiddenException('Access denied');
    }
  }

  private async getTaskById(
    id: string,
    user_id: string,
  ): Promise<RetrieveTaskDto> {
    const task = await this.db.query<TaskRow>(
      `SELECT t.id, t.user_id, t.title, t.description, t.status, t.due_date, t.created_at,
              c.id AS category_id, c.name AS category_name
       FROM tasks t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.id = $1 AND t.user_id = $2
       LIMIT 1`,
      [id, user_id],
    );

    if (!task.rowCount) {
      throw new NotFoundException(`Task ${id} not found`);
    }

    return this.toDto(task.rows[0]);
  }
}

function idOrThrow(task: { id: string } | undefined): string {
  if (!task) {
    throw new NotFoundException('Task was not created');
  }
  return task.id;
}
