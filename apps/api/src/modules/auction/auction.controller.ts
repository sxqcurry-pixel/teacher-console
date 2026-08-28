import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { AuctionService } from './auction.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import type { AuctionDto } from '@shared/dto';

class CreateAuctionDto {
  @IsString() @IsNotEmpty() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsInt() @Min(1) startingPrice!: number;
  @IsString() @IsNotEmpty() expiresAt!: string;
}

class PlaceBidDto {
  @IsString() @IsNotEmpty() auctionId!: string;
  @IsInt() @Min(1) price!: number;
  @IsString() @IsNotEmpty() studentId!: string;
  @IsString() @IsNotEmpty() classId!: string;
}

@ApiTags('Auctions')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('auctions')
export class AuctionController {
  constructor(private readonly auctions: AuctionService) {}

  @Get()
  list(
    @Query('classId') classId: string | undefined,
    @CurrentUser() u: CurrentUserPayload,
  ): Promise<AuctionDto[]> {
    return this.auctions.list(u.id, classId);
  }

  @Post()
  create(@Body() dto: CreateAuctionDto, @CurrentUser() u: CurrentUserPayload): Promise<AuctionDto> {
    return this.auctions.create(u.id, dto);
  }

  @Post('bid')
  bid(@Body() dto: PlaceBidDto, @CurrentUser() u: CurrentUserPayload): Promise<AuctionDto> {
    return this.auctions.placeBid(u.id, dto, dto.studentId, dto.classId);
  }

  @Post(':id/settle')
  settle(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload): Promise<AuctionDto> {
    return this.auctions.settle(u.id, id);
  }
}
