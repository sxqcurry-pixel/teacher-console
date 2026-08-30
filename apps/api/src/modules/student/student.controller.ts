import {
  Body,
  Controller,
  Delete,
  FileValidator,
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
        // 【修复 1/3】Nest 默认 FileTypeValidator 只匹配 file.mimetype，
        // 但 Windows 某些 Excel 组合上传 .xlsx 时浏览器会给 MIME=application/vnd.openxmlformats-...
        // （中间有很多子类型），甚至会回 text/plain（本地上传时偶尔发生），
        // 导致误判 file type。自定义 validator 同时看扩展名和 mimetype，更宽松但更安全。
        .addValidator(
          new (class extends FileValidator<{ expected: RegExp }> {
            constructor(expected: RegExp) {
              super({ expected });
            }
            buildErrorMessage(): string {
              return '文件格式不支持：仅支持 .xlsx / .xls / .csv';
            }
            isValid(file: any): boolean {
              const name: string = (file?.originalname ?? file?.name ?? '').toLowerCase();
              const mime: string = (file?.mimetype ?? file?.type ?? '').toLowerCase();
              const extOk = /\.(xlsx|xls|csv)$/.test(name);
              const mimeOk = (this.validationOptions as { expected: RegExp }).expected.test(mime);
              return extOk || mimeOk;
            }
          })(/(sheet|excel|spreadsheet|xlsx|xls|csv)/i),
        )
        .addMaxSizeValidator({ maxSize: 10 * 1024 * 1024 }) // 放宽到 10MB
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ): Promise<BulkImportResult> {
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]!]!, {
      defval: '',
      raw: true,
    }) as Array<Record<string, unknown>>;

    // 【修复 2/3】解析更宽松：字段名支持英文/中文/无括号的大小写，字符串数字也自动转成 number；
    // 空值（'' 或 undefined）都按 undefined 交给 bulkImport 的自动序号/默认状态兜底。
    const toNum = (v: unknown): number | undefined => {
      if (v === null || v === undefined || v === '') return undefined;
      if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
      if (typeof v === 'string') {
        const n = Number(v.trim());
        return Number.isFinite(n) ? n : undefined;
      }
      return undefined;
    };
    const toStr = (v: unknown): string | undefined => {
      if (v === null || v === undefined || v === '') return undefined;
      return String(v).trim() || undefined;
    };

    const normalized = rows.map((r) => ({
      serialNo: toNum(r['序号'] ?? r['serialNo'] ?? r['SerialNo']),
      name: String(r['姓名'] ?? r['name'] ?? r['Name'] ?? '').trim(),
      remark: toStr(r['备注'] ?? r['remark'] ?? r['Remark']),
      status: toStr(r['状态'] ?? r['status'] ?? r['Status'])?.toUpperCase(),
    }));
    const jobId = cuidLike('job_');
    return this.students.bulkImport(u.id, classId, normalized, jobId);
  }
}
