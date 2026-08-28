import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DomainEventBus } from '../../common/domain-event/domain-event-bus.service';
import { FeatureService } from '../feature.service.base';
import type {
  WheelHistoryDto,
  WheelSegment,
  WheelSpinRequest,
  WheelSpinResult,
} from '@shared/dto';
import { cuidLike } from '@shared/utils';
import { SyncAction, SyncEntity } from '@shared/enums';

@Injectable()
export class WheelService extends FeatureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEventBus,
  ) {
    super();
  }

  /**
   * Weighted random — executed server-side so front-end cannot cheat.
   * Returns the final rotation (degrees) for GSAP animation.
   */
  async spin(teacherId: string, req: WheelSpinRequest): Promise<WheelSpinResult> {
    const cls = await this.prisma.class.findUnique({ where: { id: req.classId } });
    this.ensureOwnerOr404(cls, teacherId);
    if (!req.segments.length) throw new BadRequestException('转盘内容为空');

    const eligible = req.enableElimination
      ? req.segments.filter((s) => !s.eliminated)
      : req.segments;
    if (!eligible.length) throw new BadRequestException('所有扇区已被淘汰');

    const totalWeight = eligible.reduce((s, seg) => s + Math.max(0, seg.weight), 0);
    if (totalWeight <= 0) throw new BadRequestException('权重总和必须 > 0');

    const rand = Math.random() * totalWeight;
    let acc = 0;
    let winner = eligible[0]!;
    for (const s of eligible) {
      acc += Math.max(0, s.weight);
      if (rand < acc) {
        winner = s;
        break;
      }
    }

    // Persist + sync
    const segments = req.enableElimination
      ? req.segments.map((s) =>
          s.id === winner.id && s.eliminateOnWin ? { ...s, eliminated: true } : s,
        )
      : req.segments;

    const history = await this.prisma.wheelSpin.create({
      data: {
        classId: req.classId,
        mode: req.mode,
        winnerLabel: winner.label,
        winnerStudentId: winner.studentId ?? null,
        payload: segments as any,
      },
    });

    const winnerIndex = segments.findIndex((s) => s.id === winner.id);
    const sectorAngle = 360 / segments.length;
    // target middle of winning sector, plus 5 full turns (1800°) for showmanship
    const baseRotation = 1800;
    const finalRotation =
      baseRotation + 360 - (winnerIndex * sectorAngle + sectorAngle / 2);

    await this.events.publish({
      name: 'wheel.spun',
      aggregateId: history.id,
      payload: {
        id: history.id,
        mode: req.mode,
        winnerLabel: winner.label,
        winnerStudentId: winner.studentId ?? null,
        entity: SyncEntity.WHEEL,
        action: SyncAction.CREATED,
      },
      channel: `class:${req.classId}`,
    });

    return { spinId: history.id, winner, finalRotation, segments };
  }

  async history(teacherId: string, classId: string, limit = 50): Promise<WheelHistoryDto[]> {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    this.ensureOwnerOr404(cls, teacherId);
    const rows = await this.prisma.wheelSpin.findMany({
      where: { classId },
      take: Math.min(200, Math.max(1, limit)),
      orderBy: { createdAt: 'desc' },
    });
    return (rows as any[]).map((r: any) => ({
      id: r.id,
      classId: r.classId,
      mode: r.mode,
      winnerLabel: r.winnerLabel,
      winnerStudentId: r.winnerStudentId,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Auto-generate STUDENT wheel segments from class roster. */
  async generateStudentSegments(classId: string, teacherId: string): Promise<WheelSegment[]> {
    const cls: any = await this.prisma.class.findUnique({
      where: { id: classId },
      include: { students: { where: { status: 'ACTIVE' }, orderBy: { serialNo: 'asc' } } },
    });
    this.ensureOwnerOr404(cls, teacherId);
    const palette = ['#f97316', '#fb923c', '#fdba74', '#fbbf24', '#f59e0b', '#ea580c', '#c2410c', '#fde68a'];
    return ((cls?.students ?? []) as any[]).map((s: any, i: number) => ({
      id: cuidLike('seg_'),
      label: `${s.serialNo}. ${s.name}`,
      color: palette[i % palette.length],
      weight: 1,
      studentId: s.id,
      eliminateOnWin: false,
      eliminated: false,
    }));
  }
}
