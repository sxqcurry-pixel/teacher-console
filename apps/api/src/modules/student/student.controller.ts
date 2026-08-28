import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipeBuilder,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import * as XLSX from 'xlsx';
import { StudentService } from './student.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { cuidLike } from '@shared/utils';
import type {
  BulkImportResult,
  CreateStudentRequest,
  PageResult,
  StudentDto,
} from '@shared/dto';

class QueryDto {
  @IsOptional() @IsNumber() page = 1;
  @IsOptional() @IsNumber() pageSize = 20;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsString() sortBy?: string;
  @IsOptional() @IsString() sortOrder?: 'asc' | 'desc';
}

class CreateStudentDto {
  @IsOptional() @IsInt() @Min(1) serialNo?: number;
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsString() status?: string;
  @IsString() @IsNotEmpty() classId!: string;
}

class UpdateStudentDto {
  @IsOptional() @IsInt() @Min(1) serialNo?: number;
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsString() status?: string;
}

@ApiTags('Students')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('students')
export class StudentController {
  constructor(private readonly students: StudentService) {}

  @Get()
  list(@Query() q: QueryDto, @CurrentUser() u: CurrentUserPayload): Promise<PageResult<StudentDto>> {
    return this.students.query(u.id, q);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload): Promise<StudentDto> {
    return this.students.get(id, u.id);
  }

  @Post()
  create(
    @Body() dto: CreateStudentDto,
    @CurrentUser() u: CurrentUserPayload,
  ): Promise<StudentDto> {
    return this.students.create(u.id, dto as CreateStudentRequest);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
    @CurrentUser() u: CurrentUserPayload,
  ): Promise<StudentDto> {
    return this.students.update(id, u.id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload): Promise<void> {
    await this.students.remove(id, u.id);
  }

  @Post('bulk-import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  async bulkImport(
    @CurrentUser() u: CurrentUserPayload,
    @Query('classId') classId: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(sheet|excel|spreadsheet|xlsx|xls|csv)$/i })
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ): Promise<BulkImportResult> {
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]!]!, {
      defval: '',
      raw: true,
    }) as Array<Record<string, unknown>>;

    const normalized = rows.map((r) => ({
      serialNo: typeof r['序号'] === 'number' ? r['序号'] : typeof r['serialNo'] === 'number' ? r['serialNo'] : undefined,
      name: String(r['姓名'] ?? r['name'] ?? '').trim(),
      remark: r['备注'] !== undefined ? String(r['备注']) : r['remark'] !== undefined ? String(r['remark']) : undefined,
      status: r['状态'] ? String(r['状态']) : r['status'] ? String(r['status']) : undefined,
    }));
    const jobId = cuidLike('job_');
    return this.students.bulkImport(u.id, classId, normalized, jobId);
  }
}
