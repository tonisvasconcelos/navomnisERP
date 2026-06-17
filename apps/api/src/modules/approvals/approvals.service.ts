import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalActionType,
  ApprovalDocumentType,
  ApprovalInstanceStatus,
  DocumentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantContext } from '../../tenant/tenant-storage';
import type { ApprovalActionDto, CreateApprovalPolicyDto, CreateApprovalPolicyStepDto } from './dto/approval.dto';

type PrismaTx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

@Injectable()
export class ApprovalsService {
  constructor(private readonly prisma: PrismaService) {}

  private ctx() {
    const c = getTenantContext();
    if (!c) throw new ForbiddenException('Contexto de tenant ausente.');
    return c;
  }

  listPolicies() {
    const { tenantId } = this.ctx();
    return this.prisma.approvalPolicy.findMany({
      where: { tenantId, isActive: true },
      include: { steps: { orderBy: { sequence: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async createPolicy(dto: CreateApprovalPolicyDto, steps: CreateApprovalPolicyStepDto[]) {
    const { tenantId } = this.ctx();
    return this.prisma.approvalPolicy.create({
      data: {
        tenantId,
        documentType: dto.documentType,
        name: dto.name,
        companyId: dto.companyId,
        minAmount: dto.minAmount ? new Prisma.Decimal(dto.minAmount) : undefined,
        maxAmount: dto.maxAmount ? new Prisma.Decimal(dto.maxAmount) : undefined,
        vendorId: dto.vendorId,
        steps: {
          create: steps.map((s) => ({
            sequence: s.sequence,
            approverRoleId: s.approverRoleId,
            approverUserId: s.approverUserId,
            minApprovals: s.minApprovals ?? 1,
          })),
        },
      },
      include: { steps: { orderBy: { sequence: 'asc' } } },
    });
  }

  async inbox() {
    const { tenantId, userId } = this.ctx();
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      select: { roleId: true },
    });
    const roleIds = userRoles.map((r) => r.roleId);

    const pending = await this.prisma.approvalInstance.findMany({
      where: { tenantId, status: ApprovalInstanceStatus.PENDING },
      include: {
        actions: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: { requestedAt: 'asc' },
      take: 100,
    });

    const enriched = await Promise.all(
      pending.map(async (inst) => {
        const policy = inst.policyId
          ? await this.prisma.approvalPolicy.findUnique({
              where: { id: inst.policyId },
              include: { steps: { orderBy: { sequence: 'asc' } } },
            })
          : null;
        const step = policy?.steps.find((s) => s.sequence === inst.currentStep);
        const canAct =
          step?.approverUserId === userId ||
          (step?.approverRoleId ? roleIds.includes(step.approverRoleId) : false);
        const doc = await this.loadDocumentSummary(inst.documentType, inst.documentId);
        return { ...inst, policy, currentStepDef: step, canAct, document: doc };
      }),
    );
    return enriched.filter((r) => r.canAct);
  }

  history(documentType: ApprovalDocumentType, documentId: string) {
    const { tenantId } = this.ctx();
    return this.prisma.approvalInstance.findMany({
      where: { tenantId, documentType, documentId },
      include: { actions: { orderBy: { createdAt: 'asc' } } },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async findPolicyForPurchaseOrder(
    tx: PrismaTx | PrismaService,
    tenantId: string,
    order: { companyId: string; vendorId: string; totalAmount: Prisma.Decimal },
  ) {
    const policies = await tx.approvalPolicy.findMany({
      where: {
        tenantId,
        documentType: ApprovalDocumentType.PURCHASE_ORDER,
        isActive: true,
        OR: [{ companyId: null }, { companyId: order.companyId }],
        AND: [
          { OR: [{ vendorId: null }, { vendorId: order.vendorId }] },
          { OR: [{ minAmount: null }, { minAmount: { lte: order.totalAmount } }] },
          { OR: [{ maxAmount: null }, { maxAmount: { gte: order.totalAmount } }] },
        ],
      },
      include: { steps: { orderBy: { sequence: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return policies[0] ?? null;
  }

  async submitPurchaseOrder(orderId: string, requestedById: string) {
    const { tenantId } = this.ctx();
    return this.prisma.$transaction(async (tx: PrismaTx) => {
      const order = await tx.purchaseOrder.findFirst({
        where: { id: orderId, tenantId },
      });
      if (!order) throw new NotFoundException('Pedido não encontrado.');
      if (order.status !== DocumentStatus.DRAFT) {
        throw new BadRequestException('Apenas rascunhos podem ser submetidos.');
      }
      const policy = await this.findPolicyForPurchaseOrder(tx, tenantId, order);
      if (!policy?.steps.length) {
        throw new BadRequestException('Nenhuma política de aprovação aplicável.');
      }
      const existing = await tx.approvalInstance.findUnique({
        where: {
          tenantId_documentType_documentId: {
            tenantId,
            documentType: ApprovalDocumentType.PURCHASE_ORDER,
            documentId: orderId,
          },
        },
      });
      if (existing && existing.status === ApprovalInstanceStatus.PENDING) {
        throw new BadRequestException('Aprovação já pendente.');
      }
      const instance = await tx.approvalInstance.upsert({
        where: {
          tenantId_documentType_documentId: {
            tenantId,
            documentType: ApprovalDocumentType.PURCHASE_ORDER,
            documentId: orderId,
          },
        },
        create: {
          tenantId,
          documentType: ApprovalDocumentType.PURCHASE_ORDER,
          documentId: orderId,
          policyId: policy.id,
          currentStep: 1,
          status: ApprovalInstanceStatus.PENDING,
          requestedById,
        },
        update: {
          policyId: policy.id,
          currentStep: 1,
          status: ApprovalInstanceStatus.PENDING,
          requestedById,
          requestedAt: new Date(),
        },
      });
      await tx.approvalAction.create({
        data: {
          instanceId: instance.id,
          action: ApprovalActionType.SUBMIT,
          actorId: requestedById,
          fromStatus: DocumentStatus.DRAFT,
          toStatus: DocumentStatus.PENDING_APPROVAL,
        },
      });
      await tx.purchaseOrder.update({
        where: { id: orderId },
        data: { status: DocumentStatus.PENDING_APPROVAL, submittedAt: new Date() },
      });
      return instance;
    });
  }

  async actOnPurchaseOrder(
    orderId: string,
    actorId: string,
    action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES',
    dto: ApprovalActionDto,
  ) {
    const { tenantId } = this.ctx();
    return this.prisma.$transaction(async (tx: PrismaTx) => {
      const order = await tx.purchaseOrder.findFirst({ where: { id: orderId, tenantId } });
      if (!order) throw new NotFoundException('Pedido não encontrado.');
      if (order.status !== DocumentStatus.PENDING_APPROVAL) {
        throw new BadRequestException('Pedido não está pendente de aprovação.');
      }
      const instance = await tx.approvalInstance.findUniqueOrThrow({
        where: {
          tenantId_documentType_documentId: {
            tenantId,
            documentType: ApprovalDocumentType.PURCHASE_ORDER,
            documentId: orderId,
          },
        },
      });
      const policy = instance.policyId
        ? await tx.approvalPolicy.findUniqueOrThrow({
            where: { id: instance.policyId },
            include: { steps: { orderBy: { sequence: 'asc' } } },
          })
        : null;
      const step = policy?.steps.find((s) => s.sequence === instance.currentStep);

      if (action === 'REJECT') {
        await tx.approvalAction.create({
          data: {
            instanceId: instance.id,
            action: ApprovalActionType.REJECT,
            actorId,
            comment: dto.comment,
            fromStatus: DocumentStatus.PENDING_APPROVAL,
            toStatus: DocumentStatus.REJECTED,
          },
        });
        await tx.approvalInstance.update({
          where: { id: instance.id },
          data: { status: ApprovalInstanceStatus.REJECTED },
        });
        await tx.purchaseOrder.update({
          where: { id: orderId },
          data: { status: DocumentStatus.REJECTED },
        });
        return { status: DocumentStatus.REJECTED };
      }

      if (action === 'REQUEST_CHANGES') {
        await tx.approvalAction.create({
          data: {
            instanceId: instance.id,
            action: ApprovalActionType.REQUEST_CHANGES,
            actorId,
            comment: dto.comment,
            fromStatus: DocumentStatus.PENDING_APPROVAL,
            toStatus: DocumentStatus.DRAFT,
          },
        });
        await tx.approvalInstance.update({
          where: { id: instance.id },
          data: { status: ApprovalInstanceStatus.CHANGES_REQUESTED },
        });
        await tx.purchaseOrder.update({
          where: { id: orderId },
          data: { status: DocumentStatus.DRAFT },
        });
        return { status: DocumentStatus.DRAFT };
      }

      void step;
      const maxStep = policy?.steps.length ?? 1;
      const isLast = instance.currentStep >= maxStep;
      await tx.approvalAction.create({
        data: {
          instanceId: instance.id,
          action: ApprovalActionType.APPROVE,
          actorId,
          comment: dto.comment,
          fromStatus: DocumentStatus.PENDING_APPROVAL,
          toStatus: isLast ? DocumentStatus.APPROVED : DocumentStatus.PENDING_APPROVAL,
        },
      });
      if (isLast) {
        await tx.approvalInstance.update({
          where: { id: instance.id },
          data: { status: ApprovalInstanceStatus.APPROVED },
        });
        await tx.purchaseOrder.update({
          where: { id: orderId },
          data: { status: DocumentStatus.APPROVED, approvedAt: new Date() },
        });
        return { status: DocumentStatus.APPROVED };
      }
      await tx.approvalInstance.update({
        where: { id: instance.id },
        data: { currentStep: instance.currentStep + 1 },
      });
      return { status: DocumentStatus.PENDING_APPROVAL, currentStep: instance.currentStep + 1 };
    });
  }

  private async loadDocumentSummary(documentType: ApprovalDocumentType, documentId: string) {
    if (documentType === ApprovalDocumentType.PURCHASE_ORDER) {
      return this.prisma.purchaseOrder.findUnique({
        where: { id: documentId },
        include: { vendor: true },
      });
    }
    return null;
  }
}
