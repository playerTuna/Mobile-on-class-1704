import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { RetrieveCategoryDto } from './dto/retrieve-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

type CategoryRow = {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: Date;
};

@Injectable()
export class CategoryService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(user_id: string): Promise<RetrieveCategoryDto[]> {
    const categories = await this.db.query<CategoryRow>(
      `SELECT id, user_id, name, color, created_at
       FROM categories
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user_id],
    );

    return categories.rows.map((category) => this.toDto(category));
  }

  async create(
    user_id: string,
    dto: CreateCategoryDto,
  ): Promise<RetrieveCategoryDto> {
    const existing = await this.db.query(
      'SELECT 1 FROM categories WHERE user_id = $1 AND name = $2 LIMIT 1',
      [user_id, dto.name],
    );

    if (existing.rowCount) {
      throw new ConflictException(`Category "${dto.name}" already exists`);
    }

    const category = await this.db.query<CategoryRow>(
      `INSERT INTO categories (user_id, name, color)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, name, color, created_at`,
      [user_id, dto.name, dto.color ?? null],
    );

    return this.toDto(category.rows[0]);
  }

  async update(
    user_id: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<RetrieveCategoryDto> {
    await this.findOwnedOrFail(user_id, id);

    if (dto.name) {
      const duplicated = await this.db.query(
        'SELECT 1 FROM categories WHERE user_id = $1 AND name = $2 AND id <> $3 LIMIT 1',
        [user_id, dto.name, id],
      );

      if (duplicated.rowCount) {
        throw new ConflictException(`Category "${dto.name}" already exists`);
      }
    }

    const category = await this.db.query<CategoryRow>(
      `UPDATE categories
       SET name = COALESCE($1, name),
           color = COALESCE($2, color)
       WHERE id = $3
       RETURNING id, user_id, name, color, created_at`,
      [dto.name ?? null, dto.color ?? null, id],
    );

    return this.toDto(category.rows[0]);
  }

  async remove(user_id: string, id: string): Promise<void> {
    await this.findOwnedOrFail(user_id, id);
    await this.db.query('DELETE FROM categories WHERE id = $1', [id]);
  }

  private toDto(category: CategoryRow): RetrieveCategoryDto {
    return {
      id: category.id as RetrieveCategoryDto['id'],
      name: category.name,
      color: category.color ?? undefined,
      created_at: category.created_at,
    };
  }

  private async findOwnedOrFail(
    user_id: string,
    id: string,
  ): Promise<CategoryRow> {
    const category = await this.db.query<CategoryRow>(
      'SELECT id, user_id, name, color, created_at FROM categories WHERE id = $1 LIMIT 1',
      [id],
    );

    if (!category.rowCount) {
      throw new NotFoundException(`Category ${id} not found`);
    }

    if (category.rows[0].user_id !== user_id) {
      throw new ForbiddenException('Access denied');
    }

    return category.rows[0];
  }
}
