import { Injectable, NotFoundException } from '@nestjs/common';

/**
 * Helper base class — every feature service inherits this to get
 * consistent access to "ensure teacher owns this resource" checks +
 * common CRUD helpers. Attached per-module so testing remains easy.
 */
@Injectable()
export abstract class FeatureService {
  /**
   * Guard: throw 404 if resource owner mismatch.
   * Prevents IDOR (Insecure Direct Object Reference) across classes/students.
   */
  protected ensureOwnerOr404<T extends { teacherId?: string; userId?: string }>(
    resource: T | null,
    actorId: string,
    idField = 'id',
  ): asserts resource is T {
    if (!resource) throw new NotFoundException('目标不存在');
    const owner = resource.teacherId ?? resource.userId;
    if (owner && owner !== actorId) throw new NotFoundException('目标不存在');
    void idField;
  }
}
