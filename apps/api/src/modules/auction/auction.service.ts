import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { FeatureService } from '../feature.service.base';
import { PointService } from '../point/point.service';
import { AuctionStatus as SharedAuctionStatus } from '@spark/shared';
import type { AuctionDto, CreateAuctionRequest, PlaceBidRequest } from '@shared/dto';

@Injectable()
export class AuctionService extends FeatureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly points: PointService,
  ) {
    super();
  }

  async list(teacherId: string, classId?: string): Promise<AuctionDto[]> {
    const rows = await this.prisma.auction.findMany({
      where: {
        ...(classId ? { winner: { classId } } : { winner: { class: { teacherId } } }),
      },
      orderBy: { createdAt: 'desc' },
      include: { winner: { select: { name: true } } },
    });
    return (rows as any[]).map(this.map.bind(this));
  }

  async create(teacherId: string, dto: CreateAuctionRequest): Promise<AuctionDto> {
    if (dto.startingPrice <= 0) throw new BadRequestException('起拍价必须 > 0');
    if (!dto.title.trim()) throw new BadRequestException('标题不能为空');
    const expiresAt = new Date(dto.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('截止时间无效');
    }
    void teacherId;
    const a = await this.prisma.auction.create({
      data: {
        title: dto.title.trim(),
        description: dto.description ?? null,
        startingPrice: dto.startingPrice,
        expiresAt,
      },
      include: { winner: { select: { name: true } } },
    });
    return this.map(a);
  }

  async placeBid(
    teacherId: string,
    dto: PlaceBidRequest,
    studentId: string,
    classId: string,
  ): Promise<AuctionDto> {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    this.ensureOwnerOr404(cls, teacherId);
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, classId: true },
    });
    if (!student || student.classId !== classId) throw new NotFoundException('学生不在该班级');
    return this.prisma.$transaction(async (tx: any) => {
      const a = await tx.auction.findUnique({
        where: { id: dto.auctionId },
        include: { bids: { orderBy: { price: 'desc' }, take: 1 } },
      });
      if (!a) throw new NotFoundException('拍品不存在');
      if (a.status === SharedAuctionStatus.CLOSED) throw new ConflictException('竞拍已结束');
      if (a.expiresAt.getTime() <= Date.now()) {
        await tx.auction.update({
          where: { id: a.id },
          data: { status: SharedAuctionStatus.CLOSED },
        });
        throw new ConflictException('竞拍已过期');
      }
      const highest = a.bids[0]?.price ?? a.currentPrice ?? a.startingPrice;
      if (dto.price <= highest) throw new BadRequestException(`出价必须高于当前最高价 ${highest}`);

      const ranking = await this.points.ranking(teacherId, classId, 1000);
      const own = ranking.find((r) => r.studentId === studentId);
      if (!own || own.totalScore < dto.price) {
        throw new BadRequestException(`积分不足（当前 ${own?.totalScore ?? 0} 分）`);
      }

      const bid = await tx.auctionBid.create({
        data: { auctionId: a.id, studentId, price: dto.price },
      });
      const updated = await tx.auction.update({
        where: { id: a.id },
        data: { currentPrice: bid.price },
        include: { winner: { select: { name: true } } },
      });
      return this.map(updated);
    });
  }

  /** Close auction + deduct winner points + record result. */
  async settle(teacherId: string, auctionId: string): Promise<AuctionDto> {
    void teacherId;
    const a = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        bids: { orderBy: { price: 'desc' }, take: 1, include: { student: true } },
        winner: { select: { name: true } },
      },
    });
    if (!a) throw new NotFoundException('拍品不存在');
    const winnerBid = a.bids[0];
    if (!winnerBid) throw new BadRequestException('暂无出价，无法成交');

    await this.prisma.$transaction([
      this.prisma.point.create({
        data: {
          studentId: winnerBid.studentId,
          category: 'OTHER',
          score: -winnerBid.price,
          reason: `竞拍成交：${a.title}`,
        },
      }),
      this.prisma.auction.update({
        where: { id: a.id },
        data: {
          status: SharedAuctionStatus.CLOSED,
          winnerId: winnerBid.studentId,
          currentPrice: winnerBid.price,
        },
      }),
    ]);
    const final = await this.prisma.auction.findUnique({
      where: { id: a.id },
      include: { winner: { select: { name: true } } },
    });
    return this.map(final);
  }

  private map(a: any): AuctionDto {
    return {
      id: a.id,
      title: a.title,
      description: a.description ?? null,
      startingPrice: a.startingPrice,
      currentPrice: a.currentPrice,
      winnerId: a.winnerId ?? null,
      winnerName: a.winner?.name ?? null,
      status: a.status as SharedAuctionStatus,
      expiresAt: a.expiresAt.toISOString(),
      createdAt: a.createdAt.toISOString(),
    };
  }
}
